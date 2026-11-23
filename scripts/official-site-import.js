import { chromium } from "playwright";
import { FieldValue } from "firebase-admin/firestore";

export const OFFICIAL_SOURCES = [
{
  "festival": "Classified vs Overdrive – The Final Verdict",
  "url": "https://www.classifiedevents.nl/events/the-final-verdict-case-reopened",
  "date": "2026-12-27",
  "location": "Vasim, Nijmegen",
  "imageUrl": "https://www.classifiedevents.nl/assets/the%20final%20verdict.jpg",
  "staticLineup": [
    {
      "artist": "Abaddon vs Screecher: Triplet Galore",
      "stage": "Mainstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Akimbo vs Eraized: The Verdict",
      "stage": "Mainstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Bossels LIVE",
      "stage": "Mainstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Damaxy & Missy: Koffiepauze",
      "stage": "Mainstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Dark Individual vs Deviation",
      "stage": "Mainstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "DJ Contest",
      "stage": "Mainstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "DMRC",
      "stage": "Mainstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Kemal",
      "stage": "Mainstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "MC Robs",
      "stage": "Mainstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Noxiouz LIVE",
      "stage": "Mainstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Overdrive LIVE",
      "stage": "Mainstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Revealer",
      "stage": "Mainstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Rosbeek LIVE",
      "stage": "Mainstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Satirized",
      "stage": "Mainstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "The Dark Horror vs Kili",
      "stage": "Mainstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "ALBINO",
      "stage": "Secondstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Amigo",
      "stage": "Secondstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Amtrax vs Bounster",
      "stage": "Secondstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Chrizens",
      "stage": "Secondstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "DJ Contest",
      "stage": "Secondstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Invicious",
      "stage": "Secondstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Korrupt vs Xplosiv",
      "stage": "Secondstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Lucky Noise",
      "stage": "Secondstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "MC Party Never Ends",
      "stage": "Secondstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Mengers",
      "stage": "Secondstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "MT",
      "stage": "Secondstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Mutant",
      "stage": "Secondstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Tayka vs Undivided",
      "stage": "Secondstage",
      "day": "Sunday",
      "start": "",
      "end": ""
    }
  ],
  "editionYear": 2026,
  "aliases": []
},
{
  "festival": "REACTiVATE – The Label Edition",
  "url": "https://www.013.nl/programma/156988/reactivate-2027",
  "date": "2027-01-30",
  "location": "013 Poppodium, Tilburg",
  "imageUrl": "https://013.ams3.cdn.digitaloceanspaces.com/resized/main/events/_1250x680_crop_center-center_none/REACTiVATE-Hearder-20271030.jpg",
  "staticLineup": [
    {
      "artist": "Adaro",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Alpha Twins",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Chain Reaction",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Coone",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Crypsis LIVE",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "E-Force LIVE",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Luna",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Noisecontrollers LIVE",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Noisecult",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Psyko Punkz LIVE",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Zany",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "The Force Italian Classics",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "The Pitcher",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "D-Verze",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Hardstyle Mafia",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Infirium",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Vyral vs Stratos",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Sasha F",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "Mind Dimension & The Purge: 120 Minutes Closing",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "MC Da Syndrome",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    },
    {
      "artist": "MC Barricade",
      "stage": "",
      "day": "Saturday",
      "start": "",
      "end": ""
    }
  ],
  "editionYear": 2027,
  "aliases": []
},
{
  "festival": "Up Close with D-Block & S-te-Fan",
  "url": "https://www.013.nl/programma/160973/up-close-with-d-block-s-te-fan",
  "date": "2026-12-27",
  "location": "013 Poppodium, Tilburg",
  "imageUrl": "https://013.ams3.cdn.digitaloceanspaces.com/resized/main/events/_1250x680_crop_center-center_none/DBSTF-Banner-01.jpg",
  "staticLineup": [
    {
      "artist": "D-Block & S-te-Fan",
      "stage": "Main",
      "day": "Sunday",
      "start": "",
      "end": ""
    }
  ],
  "editionYear": 2026,
  "aliases": []
},
  { festival: "Rebirth", aliases: ["REBiRTH Festival"], url: "https://www.rebirth-festival.nl/en/line-up/", editionYear: 2027, date: "2027-04-09", dateEnd: "2027-04-11", location: "Haaren", dynamic: "rebirth" },
  { festival: "Rebellion", aliases: ["REBELLiON Outdoor"], url: "https://rebellionoutdoor.nl/" },
  { festival: "Intents", aliases: ["Intents Festival"], url: "https://www.intentsfestival.nl/", editionYear: 2027, date: "2027-06-04", dateEnd: "2027-06-06", location: "Oisterwijk" },
  { festival: "Harmony of Hardcore", aliases: ["HOH"], url: "https://www.harmonyofhardcore.nl/", editionYear: 2027, date: "2027-05-15", dateEnd: "2027-05-15", location: "Erp" },
  { festival: "Snakepit", aliases: [], url: "https://www.snakepithardcore.com/", editionYear: 2026, date: "2026-11-07", location: "Klokgebouw, Eindhoven", imageUrl: "https://www.snakepithardcore.com/wp-content/uploads/2026/07/website.png" },
  { festival: "Dominator", aliases: [], url: "https://www.dominatorfestival.com/", editionYear: 2027, date: "2027-07-15", dateEnd: "2027-07-17", location: "Eersel" },
  { festival: "Annihilation Indoor", aliases: ["Annihilation"], catalogId: "annihilation", url: "https://www.annihilation.nl/line-up", sourceType: "instagram", sourcePost: "https://www.instagram.com/annihilation.nl/", editionYear: 2026, date: "2026-12-19", dateEnd: "2026-12-19", location: "Autotron, Rosmalen", staticLineup: [
      {
        "artist": "The Dispatcher vs Lucky Noise vs Mengers",
        "stage": "",
        "start": "12:00",
        "end": "12:45",
        "day": "Saturday"
      },
      {
        "artist": "Tayka vs Invicious vs Tob-E",
        "stage": "",
        "start": "12:45",
        "end": "13:30",
        "day": "Saturday"
      },
      {
        "artist": "Samynator: Mutation [Final]",
        "stage": "",
        "start": "13:30",
        "end": "14:00",
        "day": "Saturday"
      },
      {
        "artist": "Conspirator vs Luxo vs D-Stroy",
        "stage": "",
        "start": "14:00",
        "end": "14:45",
        "day": "Saturday"
      },
      {
        "artist": "Revealer & Kili Live",
        "stage": "",
        "start": "14:45",
        "end": "15:15",
        "day": "Saturday"
      },
      {
        "artist": "Missy vs Roosterz vs Screecher",
        "stage": "",
        "start": "15:15",
        "end": "16:00",
        "day": "Saturday"
      },
      {
        "artist": "Annihilation Records Live (Eraized vs Udow vs Maintrex)",
        "stage": "",
        "start": "16:00",
        "end": "16:45",
        "day": "Saturday"
      },
      {
        "artist": "Akimbo: Game Over Live",
        "stage": "",
        "start": "16:45",
        "end": "17:15",
        "day": "Saturday"
      },
      {
        "artist": "Noise of Aggression & Victus Live",
        "stage": "",
        "start": "17:15",
        "end": "17:45",
        "day": "Saturday"
      },
      {
        "artist": "Missy & Dimma: Slopen de Tent Live [Final]",
        "stage": "",
        "start": "17:45",
        "end": "18:15",
        "day": "Saturday"
      },
      {
        "artist": "MT Live [Premiere]",
        "stage": "",
        "start": "18:15",
        "end": "18:45",
        "day": "Saturday"
      },
      {
        "artist": "Partyraiser vs Bössels vs TMO",
        "stage": "",
        "start": "18:45",
        "end": "19:30",
        "day": "Saturday"
      },
      {
        "artist": "Aalst vs Latinity Live",
        "stage": "",
        "start": "19:30",
        "end": "20:00",
        "day": "Saturday"
      },
      {
        "artist": "Maistrø & Undivided: New Live Experience [Premiere]",
        "stage": "",
        "start": "20:00",
        "end": "20:30",
        "day": "Saturday"
      },
      {
        "artist": "Dark Individual: New Live Experience [Premiere]",
        "stage": "",
        "start": "20:30",
        "end": "21:00",
        "day": "Saturday"
      },
      {
        "artist": "Deviation: Sonic Surge Live [Final]",
        "stage": "",
        "start": "21:00",
        "end": "21:30",
        "day": "Saturday"
      },
      {
        "artist": "Satirized vs Dimma",
        "stage": "",
        "start": "21:30",
        "end": "22:15",
        "day": "Saturday"
      },
      {
        "artist": "Rosbeek vs Complex",
        "stage": "",
        "start": "22:15",
        "end": "23:00",
        "day": "Saturday"
      }
    ] },
  { festival: "Classified", aliases: ["Classified Events"], url: "https://www.classifiedevents.nl/" },
  { festival: "Rocketfest", aliases: [], url: "https://www.rocketfest.nl/", imageUrl: "https://partyflock.nl/images/party/497693_1920x1080_752224/Rocketfest.jpg" },
  { festival: "Tmo Bday Bash", aliases: ["T.M.O. B-Day Bash", "TMO Bday Bash"], url: "https://www.willem-twee.nl/alle-activiteiten/tmo-b-day-bash" },
  { imageUrl: "https://www.titaniumfestival.com/wp-content/uploads/2026/02/foto_titanium-1024x683.webp", festival: "Titanium", aliases: ["TITANIUM Festival"], url: "https://www.titaniumfestival.com/", editionYear: 2027, date: "2027-09-25", dateEnd: "2027-09-25", location: "Plas Middelwaard, Vianen" },
  { festival: "Decibel", aliases: ["Decibel Outdoor"], url: "https://www.decibeloutdoor.com/", editionYear: 2027, date: "2027-08-27", dateEnd: "2027-08-29", location: "Beekse Bergen, Hilvarenbeek", imageUrl: "https://d2oiyt60aney7e.cloudfront.net/2ck28wkq03nm/1q0ZoXBCZyt5QssHLRRsDV/41913f8ca4ba5570663f03b6a6b86501/DB25_CAMPAGNE-26_16x9.jpg" },
  { staticLineup: [{"artist":"Gezellige Uptempo: The Final Sh!t Happens XXL","stage":"","day":"Saturday","start":"","end":""},{"artist":"Gezellige Uptempo & Koffiepauze: Koffiepauze met Roze Koeken","stage":"","day":"Saturday","start":"","end":""},{"artist":"The Dark Horror vs Kemal vs Revealer: XXL Set","stage":"","day":"Saturday","start":"","end":""},{"artist":"Akimbo: Game Over","stage":"","day":"Saturday","start":"","end":""},{"artist":"Bössels vs Complex","stage":"","day":"Saturday","start":"","end":""},{"artist":"EZG LIVE","stage":"","day":"Saturday","start":"","end":""},{"artist":"Gezellige Uptempo","stage":"","day":"Saturday","start":"","end":""},{"artist":"Kili","stage":"","day":"Saturday","start":"","end":""},{"artist":"Missy & Dimma: Slopen de 013 LIVE","stage":"","day":"Saturday","start":"","end":""},{"artist":"Satirized: Neon Funfair LIVE","stage":"","day":"Saturday","start":"","end":""},{"artist":"T.M.O.: Brabantse Gezelligheid","stage":"","day":"Saturday","start":"","end":""},{"artist":"The Gezelligste DJ Contest Winner","stage":"","day":"Saturday","start":"","end":""},{"artist":"MC Barricade (host)","stage":"","day":"Saturday","start":"","end":""}], sourcePost: "https://clubtempo.rebirth-events.nl/wp-content/uploads/2026/09/Line-up-1.png", festival: "Gezellige Clubtempo", aliases: ["Gezellige Clubtempo XXL"], url: "https://www.013.nl/programma/160082/gezellige-clubtempo-xxl-2026", editionYear: 2026, date: "2026-12-12", location: "013 Poppodium, Tilburg", imageUrl: "https://013.ams3.cdn.digitaloceanspaces.com/resized/main/events/_1250x680_crop_center-center_none/Gezellige-Clubtempo-Banner-01.jpg" },
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
        nodes.map(node => {
          let parent = node.parentElement, portrait = "";
          for (let i=0; node.tagName === "H3" && parent && i<5; i++,parent=parent.parentElement) {
            if (parent.querySelectorAll("h3").length !== 1) break;
            const pictures = parent.querySelectorAll("img");
            if (pictures.length === 1) { portrait = pictures[0].currentSrc || pictures[0].src; break; }
          }
          return {tag:node.tagName.toLowerCase(),text:node.textContent.trim(),portrait};
        })
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

        lineup.push({ artist: text, stage, day, start: "", end: "", ...(heading.portrait?.startsWith("https://") ? {portrait:heading.portrait} : {}) });
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
  if (Array.isArray(source.staticLineup)) {
    return {
      lineup: source.staticLineup,
      imageUrl: source.imageUrl || "",
      date: source.date || "",
      dateEnd: source.dateEnd || "",
      editionYear: source.editionYear || null,
      sourceType: source.sourceType || "official_website",
    };
  }
  if (source.dynamic === "rebirth") {
    const { lineup, imageUrl } = await readRebirthLineup(source);
    return { lineup, imageUrl, date: source.date || "", dateEnd: source.dateEnd || "", editionYear: source.editionYear };
  }
  if (source.dynamic === "headings") {
    const { lineup, imageUrl } = await readBrowserHeadingSource(source, parseTimetable, minRows);
    return { lineup, imageUrl, date: source.date || "", dateEnd: source.dateEnd || "", editionYear: source.editionYear };
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
      date: source.date || (event?.date ? event.date.toISOString().slice(0, 10) : ""),
      dateEnd: source.dateEnd || "",
      editionYear: source.editionYear || event?.date?.getFullYear() || null,
    };
  }

  if (source.headingTags?.length) {
    const headingLineup = extractHeadingLineup(html, source.headingTags);
    if (headingLineup.length >= minRows) {
      return {
        lineup: headingLineup,
        imageUrl,
        date: source.date || (event?.date ? event.date.toISOString().slice(0, 10) : ""),
        dateEnd: source.dateEnd || "",
        editionYear: source.editionYear || event?.date?.getFullYear() || null,
      };
    }
  }

  if (event && event.names.length >= minRows) {
    return {
      lineup: event.names.map((artist) => ({ artist, stage: "", start: "", end: "" })),
      imageUrl,
      date: source.date || (event.date ? event.date.toISOString().slice(0, 10) : ""),
      dateEnd: source.dateEnd || "",
      editionYear: source.editionYear || event.date?.getFullYear() || null,
    };
  }

  return { lineup: [], imageUrl, date: source.date || (event?.date ? event.date.toISOString().slice(0, 10) : ""), dateEnd: source.dateEnd || "", editionYear: source.editionYear || event?.date?.getFullYear() || null };
}

export async function importOfficialSites({ db, normalizeName, itemId, parseTimetable, minRows }) {
  let imported = 0;
  const currentYear = new Date().getFullYear();

  for (const source of OFFICIAL_SOURCES) {
    try {
      const { lineup, imageUrl, date, dateEnd, editionYear, sourceType } = await readOfficialSource(source, parseTimetable, minRows);
      const importedSourceType = sourceType || "official_website";
      if (!lineup.length) {
        console.log("No clear published lineup found at " + source.url);
      }

      const ref = db.collection("festivalLineups").doc(normalizeName(source.catalogId || source.festival));
      const snapshot = await ref.get();
      const oldItems = snapshot.exists ? snapshot.data().lineup || [] : [];
      const byId = new Map(oldItems
        .filter((item) => !lineup.length || !(item.source && item.sourceUrl === source.url))
        .map((item) => [item.id, item]));

      for (const item of lineup) {
        const saved = {
          ...item,
          id: itemId(item),
          source: importedSourceType,
          sourceUrl: source.url,
          sourcePost: source.sourcePost || source.url,
          sourceTimestamp: new Date().toISOString(),
          ...(editionYear ? { editionYear } : {}),
        };
        byId.set(saved.id, saved);
      }

      await ref.set({
        festival: source.festival,
        aliases: source.aliases,
        lineup: [...byId.values()],
        lineupSource: source.sourcePost || source.url,
        lineupEditionYear: editionYear || source.editionYear || null,
        officialCatalog: true,
        imageUrl: source.imageUrl || imageUrl || snapshot.data()?.imageUrl || "",
        ...(date || source.date ? { date: date || source.date } : {}),
        ...(dateEnd || source.dateEnd ? { dateEnd: dateEnd || source.dateEnd } : {}),
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
            !lineup.length || !item.source || item.sourceUrl !== source.url
          );
          const importedById = new Map(retained.map((item) => [item.id, item]));

          for (const item of lineup) {
            const saved = {
              ...item,
              id: itemId(item),
              source: importedSourceType,
              sourceUrl: source.url,
              sourcePost: source.sourcePost || source.url,
              sourceTimestamp: new Date().toISOString(),
              ...(editionYear ? { editionYear } : {}),
            };
            importedById.set(saved.id, saved);
          }

          await festivalDoc.ref.set({
            lineup: [...importedById.values()],
            lineupSource: source.sourcePost || source.url,
            lineupEditionYear: editionYear || source.editionYear || null,
            imageUrl: source.imageUrl || imageUrl || festival.imageUrl || "",
            ...(date || source.date ? { date: date || source.date } : {}),
            ...(dateEnd || source.dateEnd ? { dateEnd: dateEnd || source.dateEnd } : {}),
            lineupUpdatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      }

      imported += 1;
      console.log("Imported " + lineup.length + " lineup items for " + source.festival + " (" + (editionYear || "year unconfirmed") + ").");
    } catch (error) {
      console.warn("Could not read official source " + source.url + ": " + error.message);
      try {
        const ref = db.collection("festivalLineups").doc(normalizeName(source.catalogId || source.festival));
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
          ...(source.dateEnd ? { dateEnd: source.dateEnd } : {}),
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
