const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

initializeApp();

const db = getFirestore();
const instagramToken = defineSecret("INSTAGRAM_ACCESS_TOKEN");
const instagramAccountsJson = defineSecret("INSTAGRAM_ACCOUNTS_JSON");
const openAiApiKey = defineSecret("OPENAI_API_KEY");

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v24.0";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const LOOKBACK_DAYS = 45;
const CONFIDENCE_THRESHOLD = 0.9;

exports.importFestivalUpdates = onSchedule(
  {
    schedule: "0 9 * * 2",
    timeZone: "Europe/Amsterdam",
    region: "europe-west1",
    timeoutSeconds: 540,
    memory: "512MiB",
    secrets: [instagramToken, instagramAccountsJson, openAiApiKey],
  },
  async () => {
    const accounts = parseAccounts(instagramAccountsJson.value());
    const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
    let importedCount = 0;

    for (const account of accounts) {
      const posts = await getRecentPosts(account.username, instagramToken.value());

      for (const post of posts) {
        const createdAt = Date.parse(post.timestamp || "");
        if (!post.id || !Number.isFinite(createdAt) || createdAt < cutoff) continue;

        const processedRef = db.collection("instagramImportRuns").doc(post.id);
        const processed = await processedRef.get();
        if (processed.exists) continue;

        const extracted = await extractTimetable(post, account, openAiApiKey.value());
        if (!isUsableUpdate(extracted, account)) {
          await processedRef.set({
            status: "ignored",
            account: account.username,
            checkedAt: FieldValue.serverTimestamp(),
          });
          continue;
        }

        const affectedGroups = await applyLineupToGroups(account, post, extracted);
        if (affectedGroups > 0) {
          await processedRef.set({
            status: "imported",
            account: account.username,
            festival: account.festival,
            permalink: post.permalink || "",
            importedGroups: affectedGroups,
            checkedAt: FieldValue.serverTimestamp(),
          });
          importedCount += 1;
        }
      }
    }

    logger.info("Festival import finished", { importedCount });
  }
);

function parseAccounts(raw) {
  let accounts;
  try {
    accounts = JSON.parse(raw);
  } catch {
    throw new Error("INSTAGRAM_ACCOUNTS_JSON must contain a JSON array.");
  }

  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("Configure at least one Instagram account.");
  }

  return accounts.map((account) => {
    if (!account.festival || !account.username) {
      throw new Error("Each Instagram account needs festival and username fields.");
    }

    return {
      festival: String(account.festival).trim(),
      username: String(account.username).replace(/^@/, "").trim(),
      aliases: Array.isArray(account.aliases) ? account.aliases : [],
    };
  });
}

async function getRecentPosts(username, accessToken) {
  const fields = [
    "business_discovery.username(" + username + "){",
    "username,media.limit(20){id,caption,media_type,media_url,timestamp,permalink,children{media_type,media_url}}",
    "}",
  ].join("");
  const url = new URL("https://graph.facebook.com/" + GRAPH_VERSION + "/me");
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error("Instagram API request failed: " + JSON.stringify(payload.error || payload));
  }

  return payload.business_discovery?.media?.data || [];
}

async function extractTimetable(post, account, apiKey) {
  const mediaItems = post.media_type === "CAROUSEL_ALBUM"
    ? (post.children?.data || []).filter((item) => item.media_type === "IMAGE")
    : post.media_type === "IMAGE" && post.media_url
      ? [{ media_type: "IMAGE", media_url: post.media_url }]
      : [];

  const content = [{
    type: "input_text",
    text: [
      "Extract only lineup and timetable details that are clearly visible or stated in this official festival post.",
      "Festival to check: " + account.festival,
      "Post caption: " + (post.caption || ""),
      "Post date: " + post.timestamp,
      "Source URL: " + (post.permalink || ""),
      "Return no artists if the post does not announce artists or set times.",
      "Use 24-hour HH:MM times. Leave time or stage empty if absent.",
      "Set completeTimetable true only when the post clearly presents a complete timetable for that festival day or stage.",
    ].join("\n"),
  }];

  for (const image of mediaItems.slice(0, 8)) {
    content.push({ type: "input_image", image_url: image.media_url, detail: "high" });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: "festival_lineup_update",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              festivalName: { type: "string" },
              relevant: { type: "boolean" },
              confidence: { type: "number" },
              completeTimetable: { type: "boolean" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    artist: { type: "string" },
                    stage: { type: "string" },
                    start: { type: "string" },
                    end: { type: "string" },
                  },
                  required: ["artist", "stage", "start", "end"],
                },
              },
            },
            required: ["festivalName", "relevant", "confidence", "completeTimetable", "items"],
          },
        },
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error("Lineup extraction failed: " + JSON.stringify(payload.error || payload));
  }

  const text = payload.output_text || payload.output
    ?.flatMap((item) => item.content || [])
    .find((item) => item.type === "output_text")?.text;

  if (!text) throw new Error("The extraction service returned no structured text.");
  return JSON.parse(text);
}

function isUsableUpdate(update, account) {
  if (!update?.relevant || update.confidence < CONFIDENCE_THRESHOLD || !update.items?.length) {
    return false;
  }

  const expectedNames = [account.festival, ...account.aliases].map(normalizeName);
  if (!expectedNames.includes(normalizeName(update.festivalName))) return false;

  return update.items.every((item) =>
    item.artist?.trim() &&
    (!item.start || /^([01]\\d|2[0-3]):[0-5]\\d$/.test(item.start)) &&
    (!item.end || /^([01]\\d|2[0-3]):[0-5]\\d$/.test(item.end))
  );
}

async function applyLineupToGroups(account, post, update) {
  const groups = await db.collection("groups").get();
  let updatedGroups = 0;

  for (const group of groups.docs) {
    const festivals = await group.ref.collection("festivals").get();
    const matches = festivals.docs.filter((festivalDoc) => {
      const festival = festivalDoc.data();
      const names = [account.festival, ...account.aliases].map(normalizeName);
      return names.includes(normalizeName(festival.name));
    });

    for (const festivalDoc of matches) {
      const festival = festivalDoc.data();
      const existing = Array.isArray(festival.lineup) ? festival.lineup : [];
      const manualItems = existing.filter((item) => item.source !== "instagram");
      const importedItems = existing.filter((item) => item.source === "instagram");

      const incomingItems = update.items.map((item) => ({
        ...item,
        id: stableId(post.id + "|" + item.artist + "|" + item.stage + "|" + item.start),
        source: "instagram",
        sourcePost: post.permalink || "",
        sourceTimestamp: post.timestamp,
      }));

      const nextImported = update.completeTimetable
        ? incomingItems
        : mergeLineupItems(importedItems, incomingItems);

      await festivalDoc.ref.set(
        {
          lineup: [...manualItems, ...nextImported],
          lineupUpdatedAt: FieldValue.serverTimestamp(),
          lineupSource: post.permalink || "",
        },
        { merge: true }
      );
    }

    if (matches.length > 0) updatedGroups += 1;
  }

  return updatedGroups;
}

function mergeLineupItems(existing, incoming) {
  const byId = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()];
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function stableId(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return "ig-" + (hash >>> 0).toString(36);
}
