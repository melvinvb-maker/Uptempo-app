// Artist names and photos: which press photo belongs to which set in a line-up.
import { normalizeFestivalName } from './utils.js';
import { artistBios } from './artist-bios.js';
import { artistPortraits } from './timetable-photos.js';
import { autoPortraits } from './auto-photos.js';

export const officialActPhotos = {
  "Conspirator vs Luxo vs D-Stroy": "images/acts/annihilation-1.webp",
  "Aalst vs Latinity": "images/acts/annihilation-2.webp",
  "Rosbeek vs Complex": "images/acts/annihilation-3.webp",
  "Akimbo": "images/acts/annihilation-4.webp",
  "Annihilation Records Live (Eraized vs Udow vs Maintrex)": "images/acts/annihilation-5.webp",
  "Deviation": "images/acts/annihilation-6.webp",
  "Maistrø & Undivided": "images/acts/annihilation-7.webp",
  "Dark Individual": "images/acts/annihilation-8.webp",
  "MT": "images/acts/annihilation-9.webp",
  "Noise of Aggression & Victus": "images/acts/annihilation-10.webp",
  "Missy vs Roosterz vs Screecher": "images/acts/annihilation-11.webp",
  "Missy & Dimma": "images/acts/annihilation-12.webp",
  "Satirized vs Dimma": "images/acts/annihilation-13.webp",
  "Revealer & Kili": "images/acts/annihilation-14.webp",
  "Samynator": "images/acts/annihilation-15.webp",
  "Partyraiser vs Bössels vs TMO": "images/acts/annihilation-16.webp",
  "The Dispatcher vs Lucky Noise vs Mengers": "images/acts/annihilation-17.webp",
  "Tayka vs Invicious vs Tob-E": "images/acts/annihilation-18.webp"
};

export const artistKey = value => normalizeFestivalName(String(value).replace(/ø/gi, 'o'));

export const artistRecords = new Map(artistBios.map(([name,bio,url]) => [artistKey(name), {name,bio,url}]));

// Hand-picked photos win over automatically collected ones (auto-photos.js).
export const profilePhotos = new Map(Object.entries({...autoPortraits, ...officialActPhotos, ...artistPortraits}).map(([name,url]) => [artistKey(name),url]));
// "Akimbo pres. Game Over" is also found as "AKIMBO GAME OVER".
for (const [name,url] of Object.entries(artistPortraits)) {
  const alias = artistKey(name.replace(/\s+pres\.?\s+/i,' '));
  if (!profilePhotos.has(alias)) profilePhotos.set(alias,url);
}

export const photoNames = Object.keys({...autoPortraits, ...officialActPhotos, ...artistPortraits}).sort((a,b) => b.length-a.length);

// Strips billing extras such as "(host)", "pres. ..." and "LIVE" so the press photo of the artist is found.
export function cleanCredit(name) {
  return String(name).replace(/\s*\([^)]*\)/g,'').replace(/\s+(?:pres\.?|presents)\s.*$/i,'').replace(/\s+live$/i,'').trim();
}

// Curated press photo for one artist (or a fixed group); show titles such as "D-STURB UNIVERSE" fall back to the artist.
// A combined set only matches a photo that shows that same combination, never one of its members alone.
export function photoFor(name, combined = false) {
  const clean = cleanCredit(name);
  const direct = profilePhotos.get(artistKey(name)) || profilePhotos.get(artistKey(clean));
  if (direct) return direct;
  const lower = clean.toLowerCase();
  const hit = photoNames.find(entry => lower.startsWith(entry.toLowerCase()+' ') && (performers(entry).length > 1) === combined);
  return hit ? profilePhotos.get(artistKey(hit)) : '';
}

// Clean press photos come first; a festival's promo banner is only used when no press photo is known.
export function setPhotos(item) {
  const members = performers(item.artist);
  const whole = photoFor(profileName(item.artist), members.length > 1);
  if (whole) return [whole];
  if (members.length < 2) return item.portrait ? [item.portrait] : [];
  if (item.portrait) return [item.portrait];
  return [...new Set(members.map(photoFor).filter(Boolean))].slice(0,3);
}

document.addEventListener('error', event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  if (image.dataset.initial !== undefined) {
    const initial = document.createElement('span');
    initial.className = 'rowInitial';
    initial.textContent = image.dataset.initial;
    return image.replaceWith(initial);
  }
  if (!image.closest('.slotArt')) return;
  const art = image.parentElement;
  image.remove();
  if (!art.querySelector('img')) art.closest('.artistSlot')?.classList.remove('hasArt');
}, true);

export function profileName(label) {
  return label.split(':')[0].replace(/\s*\[[^\]]*\]/g,'').replace(/\s+live$/i,'').trim() || label;
}

export function performers(label) {
  const credit = profileName(label);
  if (/^D-Block & S-te-Fan$/i.test(credit)) return [credit];
  const inside = credit.match(/\(([^()]+\s+vs\s+[^()]+)\)/i);
  return (inside ? inside[1] : credit).split(/\s+(?:vs\.?|b2b|&)\s+/i).filter(Boolean);
}

export const knownArtists = [...artistRecords.values()].sort((a,b) => b.name.length - a.name.length);

export function resolveArtist(name, showTitle) {
  return artistRecords.get(artistKey(name)) || (showTitle && knownArtists.find(entry =>
    name.toLowerCase().startsWith(entry.name.toLowerCase()+' ')
  ));
}
