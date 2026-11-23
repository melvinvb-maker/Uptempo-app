import { chromium } from "playwright";
import { FieldValue } from "firebase-admin/firestore";

export const OFFICIAL_SOURCES = [
  { festival: "Rebirth", aliases: ["REBiRTH Festival"], url: "https://www.rebirth-festival.nl/en/line-up/", editionYear: 2027, dynamic: "rebirth" },
  { festival: "Rebellion", aliases: ["REBELLiON Outdoor"], url: "https://rebellionoutdoor.nl/" },
  { festival: "Intents", aliases: ["Intents Festival"], url: "https://www.intentsfestival.nl/" },
  { festival: "Harmony of Hardcore", aliases: ["HOH"], url: "https://www.harmonyofhardcore.nl/" },
  { festival: "Snakepit", aliases: [], url: "https://www.snakepithardcore.com/" },
  { festival: "Dominator", aliases: [], url: "https://www.dominatorfestival.com/" },
  { festival: "Annihilation", aliases: [], url: "https://www.annihilation.nl/line-up", editionYear: 2026, headingTags: ["h2"], dynamic: "headings" },
  { festival: "Classified", aliases: ["Classified Events"], url: "https://www.classifiedevents.nl/" },
  { festival: "Rocketfest", aliases: [], url: "https://www.rocketfest.nl/" },
  { festival: "Tmo Bday Bash", aliases: ["T.M.O. B-Day Bash", "TMO Bday Bash"], url: "https://www.willem-twee.nl/alle-activiteiten/tmo-b-day-bash" },
  { festival: "Titanium", aliases: ["TITANIUM Festival"], url: "https://www.titaniumfestival.com/" },
  { festival: "Decibel", aliases: ["Decibel Outdoor"], url: "https://www.decibeloutdoor.com/" },
  { festival: "Gezellige Clubtempo", aliases: ["Gezellige Clubtempo XXL"], url: "https://www.013.nl/programma/160082/gezellige-clubtempo-xxl-2026", editionYear: 2026, date: "2026-12-12", location: "013 Poppodium, Tilburg", imageUrl: "https://013.ams3.cdn.digitaloceanspaces.com/resized/main/events/_1250x680_crop_center-center_none/Gezellige-Clubtempo-Banner-01.jpg" },
];

function htmlToText(html) {
  return String(html || "")
    .replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|li|div|section|article|tr|h[1-6]|br|header|footer|main|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function getOpenGraphImage(html, baseUrl) {
  const tags = String(html || "").match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const property = (tag.match(/(?:property|name)=["']([^"']+)["']/i) || [])[1] || "";
    if (property.toLowerCase() !== "og:image") continue;
    const content = (tag.match(/content=["']([^"']+)["']/i) || [])[1];
    if (!content) continue;
    try {
      return new URL(content.replace(/&amp;/gi, "&"), baseUrl).href;
    } catch {
      return "";
    }
  }
  return "";
}

function addNames(value, target) {
  if (typeof value === "string") {
    const name = value.trim();
    if (name.length >= 2 && name.length <= 80) target.add(name);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => addNames(item, target));
    return;
  }
  if (value && typeof value === "object") {
    if (typeof value.name === "string") addNames(value.name, target);
    else Object.values(value).forEach((item) => addNames(item, target));
  }
}

function collectEventData(html) {
  const events = [];
  const keys = new Set(["performer", "performers", "artist", "artists", "lineup", "line-up"]);

  function visit(value) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;

    const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
    const isEvent = types.some((type) => String(type || "").toLowerCase().includes("event"));
    if (isEvent) {
      const names = new Set();
      for (const [key, item] of Object.entries(value)) {
        if (keys.has(key.toLowerCase())) addNames(item, names);
      }
      if (names.size) {
        const startDate = value.startDate ? new Date(value.startDate) : null;
        events.push({
          names: [...names],
          date: startDate && Number.isFinite(startDate.getTime()) ? startDate : null,
        });
      }
    }

    for (const item of Object.values(value)) {
      if (item && typeof item === "object") visit(item);
    }
  }

  for (const match of String(html || "").matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(match[1]));
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }

  return events;
}

function chooseCurrentEvent(events) {
  if (!events.length) return null;
  const now = new Date();
  const upcoming = events
    .filter((event) => event.date && event.date.getTime() >= now.getTime())
    .sort((a, b) => a.date - b.date);
  if (upcoming.length) return upcoming[0];

  const dated = events
    .filter((event) => event.date)
    .sort((a, b) => b.date - a.date);
  return dated[0] || events[0];
}

function cleanHeading(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHeadingLineup(html, tags = []) {
  const items = [];
  const seen = new Set();

  for (const tag of tags) {
    const pattern = new RegExp("<" + tag + "[^>]*>([\s\S]*?)<\/" + tag + ">", "gi");
    for (const match of String(html || "").matchAll(pattern)) {
      const artist = cleanHeading(match[1]);
      const key = artist.toLowerCase();
      if (!artist || artist.length < 2 || artist.length > 80) continue;
      if (/^(line.?up|artists?|line.?up not announced|full line.?up soon|tba|hosted by|live)$/i.test(artist)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ artist, stage: "", start: "", end: "" });
    }
  }

  return items;
}

async function readRebirthLineup(source) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const lineup = [];
    let imageUrl = "";

    for (const day of ["Friday", "Saturday", "Sunday"]) {
      const url = new URL(source.url);
      url.searchParams.set("day", day.toLowerCase());
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
      imageUrl ||= await page.locator('meta[property="og:image"]').getAttribute("content").catch(() => "");
      await page.waitForFunction(() => document.querySelectorAll("h2").length > 3 && document.querySelectorAll("h3").length > 20, undefined, { timeout: 30000 });

      const headings = await page.locator("h2, h3").evaluateAll((nodes) =>
        nodes.map((node) => ({ tag: node.tagName.toLowerCase(), text: node.textContent.trim() }))
      );

      let stage = "";
      for (const heading of headings) {
        const text = heading.text.replace(/\s+/g, " ").trim();
        if (heading.tag === "h2") {
          stage = text;
          continue;
        }
        if (heading.tag !== "h3" || !text || text.length > 100) continue;
        if (/^(line.?up|no results found|the full line.?up is now online)/i.test(text)) continue;

        lineup.push({ artist: text, stage, day, start: "", end: "" });
      }
    }

    return { lineup, imageUrl };
  } finally {
    await browser.close();
  }
}

async function readBrowserHeadingSource(source, parseTimetable, minRows) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(source.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    const selector = source.headingTags.join(",");
    const imageUrl = await page.locator('meta[property="og:image"]').getAttribute("content").catch(() => "");
    await page.locator(selector).first().waitFor({ state: "visible", timeout: 30000 });
    const pageText = await page.locator("body").innerText();
    const timetableRows = parseTimetable ? parseTimetable(pageText) : [];
    if (timetableRows.length >= minRows) {
      return { lineup: timetableRows, imageUrl };
    }

    const names = await page.locator(selector).allTextContents();
    const lineup = [];
    const seen = new Set();

    for (const value of names) {
      const artist = cleanHeading(value);
      const key = artist.toLowerCase();
      if (!artist || artist.length < 2 || artist.length > 80) continue;
      if (/^(line.?up|artists?|line.?up not announced|full line.?up soon|tba|hosted by|live)$/i.test(artist)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      lineup.push({ artist, stage: "", start: "", end: "" });
    }

    return { lineup, imageUrl };
  } finally {
    await browser.close();
  }
}

async function readOfficialSource(source, parseTimetable, minRows) {
  if (source.dynamic === "rebirth") {
    const { lineup, imageUrl } = await readRebirthLineup(source);
    return { lineup, imageUrl, editionYear: source.editionYear };
  }
  if (source.dynamic === "headings") {
    const { lineup, imageUrl } = await readBrowserHeadingSource(source, parseTimetable, minRows);
    return { lineup, imageUrl, editionYear: source.editionYear };
  }

  const response = await fetch(source.url, {
    headers: { "user-agent": "UPTEMPO-festival-import/1.0" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("HTTP " + response.status);

  const html = await response.text();
  const imageUrl = getOpenGraphImage(html, source.url);
  const timetable = parseTimetable(htmlToText(html));
  const uniqueTimes = new Set(timetable.map((item) => item.start));
  const event = chooseCurrentEvent(collectEventData(html));

  if (timetable.length >= minRows && uniqueTimes.size >= 3) {
    return {
      lineup: timetable,
      imageUrl,
      editionYear: source.editionYear || event?.date?.getFullYear() || null,
    };
  }

  if (source.headingTags?.length) {
    const headingLineup = extractHeadingLineup(html, source.headingTags);
    if (headingLineup.length >= minRows) {
      return {
        lineup: headingLineup,
        imageUrl,
        editionYear: source.editionYear || event?.date?.getFullYear() || null,
      };
    }
  }

  if (event && event.names.length >= minRows) {
    return {
      lineup: event.names.map((artist) => ({ artist, stage: "", start: "", end: "" })),
      imageUrl,
      editionYear: source.editionYear || event.date?.getFullYear() || null,
    };
  }

  return { lineup: [], imageUrl, editionYear: source.editionYear || event?.date?.getFullYear() || null };
}

export async function importOfficialSites({ db, normalizeName, itemId, parseTimetable, minRows }) {
  let imported = 0;
  const currentYear = new Date().getFullYear();

  for (const source of OFFICIAL_SOURCES) {
    try {
      const { lineup, imageUrl, editionYear } = await readOfficialSource(source, parseTimetable, minRows);
      if (!lineup.length) {
        console.log("No clear published lineup found at " + source.url);
      }

      const ref = db.collection("festivalLineups").doc(normalizeName(source.festival));
      const snapshot = await ref.get();
      const oldItems = snapshot.exists ? snapshot.data().lineup || [] : [];
      const byId = new Map(oldItems
        .filter((item) => !lineup.length || !(item.source === "official_website" && item.sourceUrl === source.url))
        .map((item) => [item.id, item]));

      for (const item of lineup) {
        const saved = {
          ...item,
          id: itemId(item),
          source: "official_website",
          sourceUrl: source.url,
          sourcePost: source.url,
          sourceTimestamp: new Date().toISOString(),
          ...(editionYear ? { editionYear } : {}),
        };
        byId.set(saved.id, saved);
      }

      await ref.set({
        festival: source.festival,
        aliases: source.aliases,
        lineup: [...byId.values()],
        lineupSource: source.url,
        lineupEditionYear: editionYear || source.editionYear || null,
        officialCatalog: true,
        imageUrl: imageUrl || source.imageUrl || snapshot.data()?.imageUrl || "",
        ...(source.date ? { date: source.date } : {}),
        ...(source.location ? { location: source.location } : {}),
        lineupUpdatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      const groups = await db.collection("groups").get();
      for (const group of groups.docs) {
        const festivals = await group.ref.collection("festivals").get();

        for (const festivalDoc of festivals.docs) {
          const festival = festivalDoc.data();
          const names = [source.festival, ...source.aliases].map(normalizeName);
          if (!names.includes(normalizeName(festival.name))) continue;

          const festivalYear = new Date(festival.date || "").getFullYear();
          if (editionYear && Number.isFinite(festivalYear) && festivalYear !== editionYear) continue;
          if (!editionYear && Number.isFinite(festivalYear) && festivalYear < currentYear) continue;

          const existing = Array.isArray(festival.lineup) ? festival.lineup : [];
          const retained = existing.filter((item) =>
            !lineup.length || item.source !== "official_website" || item.sourceUrl !== source.url
          );
          const importedById = new Map(retained.map((item) => [item.id, item]));

          for (const item of lineup) {
            const saved = {
              ...item,
              id: itemId(item),
              source: "official_website",
              sourceUrl: source.url,
              sourcePost: source.url,
              sourceTimestamp: new Date().toISOString(),
              ...(editionYear ? { editionYear } : {}),
            };
            importedById.set(saved.id, saved);
          }

          await festivalDoc.ref.set({
            lineup: [...importedById.values()],
            lineupSource: source.url,
            lineupEditionYear: editionYear || source.editionYear || null,
            imageUrl: imageUrl || source.imageUrl || festival.imageUrl || "",
            lineupUpdatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      }

      imported += 1;
      console.log("Imported " + lineup.length + " lineup items for " + source.festival + " (" + (editionYear || "year unconfirmed") + ").");
    } catch (error) {
      console.warn("Could not read official source " + source.url + ": " + error.message);
      try {
        const ref = db.collection("festivalLineups").doc(normalizeName(source.festival));
        const snapshot = await ref.get();
        const previous = snapshot.exists ? snapshot.data() : {};
        await ref.set({
          festival: source.festival,
          aliases: source.aliases,
          lineup: Array.isArray(previous.lineup) ? previous.lineup : [],
          lineupSource: source.url,
          lineupEditionYear: source.editionYear || previous.lineupEditionYear || null,
          officialCatalog: true,
          imageUrl: source.imageUrl || previous.imageUrl || "",
          ...(source.date ? { date: source.date } : {}),
          ...(source.location ? { location: source.location } : {}),
          lineupUpdatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (catalogError) {
        console.warn("Could not save catalog entry for " + source.festival + ": " + catalogError.message);
      }
    }
  }

  return imported;
}
