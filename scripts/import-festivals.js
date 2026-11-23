import { spawn } from "node:child_process";
import { initializeApp, cert } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { importOfficialSites } from "./official-site-import.js";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v27.0";
const LOOKBACK_DAYS = 8;
const MAX_POSTS_PER_ACCOUNT = 20;
const MIN_TIMETABLE_ROWS = 4;

if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  throw new Error("Missing GitHub Actions secret: FIREBASE_SERVICE_ACCOUNT_JSON");
}

const instagramKeys = ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_USER_ID", "INSTAGRAM_ACCOUNTS_JSON"];
const instagramKeysSet = instagramKeys.filter((name) => Boolean(process.env[name])).length;
if (instagramKeysSet > 0 && instagramKeysSet < instagramKeys.length) {
  throw new Error("Set all Instagram secrets/config values or leave them all empty.");
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
initializeApp({
  credential: cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
});

const db = getFirestore();

function parseAccounts(raw) {
  const accounts = JSON.parse(raw);
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("INSTAGRAM_ACCOUNTS_JSON must be a non-empty JSON array.");
  }

  return accounts.map((account) => {
    if (!account.festival || !account.username) {
      throw new Error("Each account needs festival and username fields.");
    }

    return {
      festival: String(account.festival).trim(),
      username: String(account.username).replace(/^@/, "").trim(),
      aliases: Array.isArray(account.aliases) ? account.aliases : [],
    };
  });
}

async function getRecentPosts(username) {
  const fields = [
    "business_discovery.username(" + username + "){",
    "username,media.limit(" + MAX_POSTS_PER_ACCOUNT + "){id,caption,media_type,media_url,timestamp,permalink,children{media_type,media_url}}",
    "}",
  ].join("");

  const url = new URL(
    `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.INSTAGRAM_USER_ID}`
  );
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", process.env.INSTAGRAM_ACCESS_TOKEN);

  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok || payload.error) {
    throw new Error(
      `Instagram API error for @${username}: ${JSON.stringify(payload.error || payload)}`
    );
  }

  return payload.business_discovery?.media?.data || [];
}

async function readImageText(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) return "";

  const image = Buffer.from(await response.arrayBuffer());

  return new Promise((resolve, reject) => {
    const ocr = spawn("tesseract", ["stdin", "stdout", "--psm", "6"]);
    let text = "";
    let errorText = "";

    ocr.stdout.setEncoding("utf8");
    ocr.stderr.setEncoding("utf8");
    ocr.stdout.on("data", (chunk) => { text += chunk; });
    ocr.stderr.on("data", (chunk) => { errorText += chunk; });
    ocr.on("error", reject);
    ocr.on("close", (code) => {
      if (code === 0) resolve(text);
      else reject(new Error(errorText || `Tesseract exited with code ${code}`));
    });

    ocr.stdin.end(image);
  });
}

function normalizeText(value) {
  return String(value || "")
    .replace(/[–—−]/g, "-")
    .replace(/[.]/g, ":")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTime(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return "";

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTimetable(text) {
  const rows = [];
  const seen = new Set();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = normalizeText(rawLine);
    let match = line.match(
      /^(\d{1,2}:\d{2})\s*(?:-|to)?\s*(\d{1,2}:\d{2})?\s+(.+)$/
    );

    if (!match) {
      match = line.match(
        /^(.+?)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/
      );
      if (match) {
        match = [match[0], match[2], match[3], match[1]];
      }
    }

    if (!match) continue;

    const start = normalizeTime(match[1]);
    const end = normalizeTime(match[2]);
    const artist = String(match[3] || "").replace(/^[|:;\- ]+|[|:;\- ]+$/g, "");
    if (!start || artist.length < 2 || artist.length > 60) continue;
    if (/^(stage|area|line.?up|timetable|time|artist)$/i.test(artist)) continue;

    const key = `${artist.toLowerCase()}|${start}|${end}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({
      artist,
      stage: "",
      start,
      end,
    });
  }

  return rows;
}

async function getPostText(post) {
  const textParts = [post.caption || ""];
  const images = post.media_type === "CAROUSEL_ALBUM"
    ? (post.children?.data || []).filter((item) => item.media_type === "IMAGE")
    : post.media_type === "IMAGE" && post.media_url
      ? [{ media_url: post.media_url }]
      : [];

  for (const image of images.slice(0, 8)) {
    try {
      const ocrText = await readImageText(image.media_url);
      if (ocrText) textParts.push(ocrText);
    } catch (error) {
      console.warn("Could not read an Instagram image", error.message);
    }
  }

  return textParts.join("\n");
}

function isRecentPost(post, cutoff) {
  const timestamp = Date.parse(post.timestamp || "");
  return post.id && Number.isFinite(timestamp) && timestamp >= cutoff;
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function itemId(item) {
  return stableId(normalizeName(item.artist) + "|" + normalizeName(item.stage) + "|" + normalizeTime(item.start) + "|" + normalizeTime(item.end));
}

function stableId(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return "ig-" + (hash >>> 0).toString(36);
}

async function saveToCatalogue(account, post, lineup) {
  const ref = db.collection("festivalLineups").doc(normalizeName(account.festival));
  const snapshot = await ref.get();
  const oldItems = snapshot.exists ? snapshot.data().lineup || [] : [];
  const byId = new Map(oldItems.map((item) => [item.id, item]));

  for (const item of lineup) {
    const saved = {
      ...item,
      id: itemId(item),
      source: "instagram",
      sourcePost: post.permalink || "",
      sourceTimestamp: post.timestamp,
    };
    byId.set(saved.id, saved);
  }

  await ref.set({
    festival: account.festival,
    aliases: account.aliases,
    lineup: [...byId.values()],
    lineupSource: post.permalink || "",
    lineupUpdatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function updateGroups(account, post, lineup) {
  const groups = await db.collection("groups").get();

  for (const group of groups.docs) {
    const festivalDocs = await group.ref.collection("festivals").get();

    for (const festivalDoc of festivalDocs.docs) {
      const festival = festivalDoc.data();
      const matchNames = [account.festival, ...account.aliases].map(normalizeName);
      if (!matchNames.includes(normalizeName(festival.name))) continue;

      const existing = Array.isArray(festival.lineup) ? festival.lineup : [];
      const manualItems = existing.filter((item) => item.source !== "instagram");
      const importedItems = new Map(
        existing
          .filter((item) => item.source === "instagram")
          .map((item) => [item.id, item])
      );

      for (const item of lineup) {
        const saved = {
          ...item,
          id: itemId(item),
          source: "instagram",
          sourcePost: post.permalink || "",
          sourceTimestamp: post.timestamp,
        };
        importedItems.set(saved.id, saved);
      }

      await festivalDoc.ref.set({
        lineup: [...manualItems, ...importedItems.values()],
        lineupUpdatedAt: FieldValue.serverTimestamp(),
        lineupSource: post.permalink || "",
      }, { merge: true });
    }
  }
}

async function run() {
  const accounts = process.env.INSTAGRAM_ACCOUNTS_JSON
    ? parseAccounts(process.env.INSTAGRAM_ACCOUNTS_JSON)
    : [];
  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  let importedPosts = 0;

  for (const account of accounts) {
    const posts = (await getRecentPosts(account.username))
      .filter((post) => isRecentPost(post, cutoff))
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

    for (const post of posts) {
      const runRef = db.collection("instagramImportRuns").doc(post.id);
      if ((await runRef.get()).exists) continue;

      const postText = await getPostText(post);
      const lineup = parseTimetable(postText);
      const uniqueStartTimes = new Set(lineup.map((item) => item.start));

      if (lineup.length < MIN_TIMETABLE_ROWS || uniqueStartTimes.size < 3) {
        await runRef.set({
          status: "ignored",
          account: account.username,
          checkedAt: FieldValue.serverTimestamp(),
        });
        continue;
      }

      await saveToCatalogue(account, post, lineup);
      await updateGroups(account, post, lineup);
      await runRef.set({
        status: "imported",
        account: account.username,
        festival: account.festival,
        permalink: post.permalink || "",
        itemCount: lineup.length,
        checkedAt: FieldValue.serverTimestamp(),
      });
      importedPosts += 1;
    }
  }

  const importedOfficialPages = await importOfficialSites({
    db,
    normalizeName,
    itemId,
    parseTimetable,
    minRows: MIN_TIMETABLE_ROWS,
  });

  console.log("Imported " + importedPosts + " Instagram timetable posts and " + importedOfficialPages + " official site pages.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
