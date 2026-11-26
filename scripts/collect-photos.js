// Collects artist images that festival sites publish with their line-ups, for artists
// that have no hand-picked press photo yet. Each image is cropped to a portrait,
// turned black and white and darkened at the edges, so it matches the calm style of
// the other lineup photos. Results go to images/acts/auto/ and ../auto-photos.js.
//
// Usage: node collect-photos.js            (reads line-ups from Firestore)
//        node collect-photos.js --input x  (reads a JSON array of {lineup:[...]} for testing)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import sharp from "sharp";
import { artistPortraits } from "../timetable-photos.js";

const ROOT = new URL("../", import.meta.url);
const OUT_DIR = new URL("images/acts/auto/", ROOT);
const MAP_FILE = new URL("auto-photos.js", ROOT);
const MAX_NEW_PER_RUN = 40;
const MAX_BYTES = 8 * 1024 * 1024;

// The same name rules as the app (app.js), so a photo is found under the name the app looks up.
const normalize = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const artistKey = (value) => normalize(String(value).replace(/ø/gi, "o"));
const profileName = (label) => label.split(":")[0].replace(/\s*\[[^\]]*\]/g, "").replace(/\s+live$/i, "").trim() || label;
const cleanCredit = (name) => String(name).replace(/\s*\([^)]*\)/g, "").replace(/\s+(?:pres\.?|presents)\s.*$/i, "").replace(/\s+live$/i, "").trim();
const isCombined = (label) => /\s(?:vs\.?|b2b|&|x)\s/i.test(profileName(label));

async function readLineups() {
  const input = process.argv.indexOf("--input");
  if (input > 0) return JSON.parse(await readFile(process.argv[input + 1], "utf8"));
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "null");
  if (!account) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");
  initializeApp({ credential: cert(account), projectId: process.env.FIREBASE_PROJECT_ID || account.project_id });
  const snapshot = await getFirestore().collection("festivalLineups").get();
  return snapshot.docs.map((doc) => doc.data());
}

async function readExisting() {
  if (!existsSync(MAP_FILE)) return {};
  const text = await readFile(MAP_FILE, "utf8");
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}

// Names that already have a hand-picked photo in app.js (group photos) or timetable-photos.js.
async function curatedKeys() {
  const app = await readFile(new URL("app.js", ROOT), "utf8");
  const block = app.match(/const officialActPhotos = \{([\s\S]*?)\n\};/)?.[1] || "";
  const groupNames = [...block.matchAll(/"([^"]+)":/g)].map((match) => match[1]);
  return [...Object.keys(artistPortraits), ...groupNames];
}

// True when the credit is one of the names, or starts with one of them as a whole word
// ("D-STURB UNIVERSE" belongs to D-Sturb), mirroring photoFor() in app.js.
function coveredBy(names, credit) {
  const key = artistKey(credit);
  const lower = credit.toLowerCase();
  return names.some((name) => artistKey(name) === key || artistKey(cleanCredit(name)) === key || lower.startsWith(name.toLowerCase() + " "));
}

const vignette = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="288" height="360">
  <defs><radialGradient id="v" cx="50%" cy="42%" r="70%">
    <stop offset="55%" stop-color="#fff"/><stop offset="100%" stop-color="#4a4a4a"/>
  </radialGradient></defs><rect width="288" height="360" fill="url(#v)"/></svg>`);

async function toPortrait(buffer) {
  const image = sharp(buffer).rotate();
  const { width, height } = await image.metadata();
  if (!width || !height || width < 200 || height < 200) throw new Error("image too small");
  const cropWidth = Math.min(width, Math.round(height * 0.8));
  const cropHeight = Math.min(height, Math.round(cropWidth / 0.8));
  const left = Math.round((width - cropWidth) / 2);
  const top = Math.round((height - cropHeight) * 0.15);
  return image.extract({ left, top, width: cropWidth, height: cropHeight })
    .resize(288, 360)
    .grayscale()
    .linear(1.05, -4)
    .composite([{ input: vignette, blend: "multiply" }])
    .webp({ quality: 80 })
    .toBuffer();
}

async function download(url) {
  const response = await fetch(url, { headers: { "user-agent": "UPTEMPO festival planner photo collector" }, redirect: "follow" });
  if (!response.ok) throw new Error("HTTP " + response.status);
  if (!/^image\//.test(response.headers.get("content-type") || "")) throw new Error("not an image");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_BYTES) throw new Error("image too large");
  return buffer;
}

const lineups = await readLineups();
const existing = await readExisting();
const curated = await curatedKeys();
const skip = JSON.parse(await readFile(new URL("photo-skip.json", import.meta.url), "utf8"));
const known = Object.keys(existing);

const candidates = new Map();
for (const festival of lineups) {
  for (const item of festival.lineup || []) {
    if (!item?.artist || !/^https:\/\//.test(item.portrait || "") || isCombined(item.artist)) continue;
    const name = cleanCredit(profileName(item.artist));
    const key = artistKey(name);
    if (!key || candidates.has(key) || coveredBy(curated, name) || coveredBy(known, name) || coveredBy(skip, name)) continue;
    candidates.set(key, { name, url: item.portrait });
  }
}

await mkdir(OUT_DIR, { recursive: true });
let added = 0;
for (const [key, { name, url }] of candidates) {
  if (added >= MAX_NEW_PER_RUN) break;
  try {
    const file = key.slice(0, 60) + ".webp";
    await writeFile(new URL(file, OUT_DIR), await toPortrait(await download(url)));
    existing[name] = "images/acts/auto/" + file;
    added++;
    console.log("Added", name);
  } catch (error) {
    console.log("Skipped", name, "-", error.message);
  }
}

const sorted = Object.fromEntries(Object.entries(existing).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(MAP_FILE, "// Generated by scripts/collect-photos.js. Hand-picked photos in timetable-photos.js take precedence.\n"
  + "export const autoPortraits = " + JSON.stringify(sorted, null, 2) + ";\n");
console.log(`${added} new photo(s), ${Object.keys(sorted).length} in total, ${candidates.size - added} candidate(s) left.`);
