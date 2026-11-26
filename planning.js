// Festival-day planning: real clock times for sets, calendar export and the shareable plan image.
import { clockMinute, isoDay, clock, fmt, dayName } from './utils.js';

export function setKey(festival, item) {
  return JSON.stringify([festival.key, festival.date, item.day || '', item.artist, item.stage || '']);
}

export function timedSets(rows) {
    const overnight = rows.some(item => clockMinute(item.start) >= 1080) &&
      !rows.some(item => clockMinute(item.start) >= 360 && clockMinute(item.start) < 600);
    return rows.map(item => {
      let start = clockMinute(item.start);
      if (overnight && start < 360) start += 1440;
      let end = clockMinute(item.end);
      if (end !== null && end < start) end += 1440;
      return {item,start,end: end !== null && end > start ? end : start + 1};
    }).sort((a,b) => a.start-b.start);
}

// ---- Festival-day planning: real clock times, "now & next", overlaps and calendar export ----
export const WEEKDAYS = {sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6};

// Calendar date of a lineup day ("Saturday", an ISO date or empty) within the festival's dates.
export function lineupDayDate(festival, day) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(day || '')) return day;
  const weekday = WEEKDAYS[String(day || '').toLowerCase()];
  if (weekday === undefined || !festival.date) return festival.date;
  const date = new Date(festival.date+'T12:00');
  const last = new Date((festival.dateEnd || festival.date)+'T12:00');
  for (; date <= last; date.setDate(date.getDate()+1)) if (date.getDay() === weekday) return isoDay(date);
  return festival.date;
}

// Every set with a known start time, as real Date objects. A set without an end time is counted as one hour.
export function scheduledSets(festival) {
  if (!festival?.date) return [];
  const rows = (festival.lineup || []).filter(item => clockMinute(item.start) !== null);
  return [...new Set(rows.map(item => item.day || ''))].flatMap(day => {
    const base = new Date(lineupDayDate(festival, day)+'T00:00');
    return timedSets(rows.filter(item => (item.day || '') === day)).map(({item,start,end}) => ({
      item, key: setKey(festival,item), stage: String(item.stage || '').trim() || 'Programma',
      start: new Date(base.getTime() + start*60000),
      end: new Date(base.getTime() + (item.end ? end : start+60)*60000)
    }));
  }).sort((a,b) => a.start-b.start);
}

export const icsText = value => String(value || '').replace(/\\/g,'\\\\').replace(/;/g,'\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');

export const icsTime = date => date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');

// Lines longer than 75 characters are folded, as the calendar format requires.
export const icsFold = line => line.length <= 74 ? line : line.match(/.{1,74}/g).join('\r\n ');

// ---- Share your plan as a story-sized image (drawn locally, nothing is uploaded) ----
export function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line+' '+word : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function planImage(festival, sets) {
  const W = 1080, H = 1920, X = 96, font = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#090c12'; ctx.fillRect(0,0,W,H);
  const glow = ctx.createRadialGradient(W*.85,0,0,W*.85,0,900);
  glow.addColorStop(0,'rgba(166,140,255,.14)'); glow.addColorStop(1,'rgba(166,140,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(0,0,W,H);

  let y = 170;
  ctx.fillStyle = '#d6ff42'; ctx.font = '800 30px '+font;
  ctx.fillText('M I J N   P L A N N I N G', X, y);
  y += 90;
  ctx.fillStyle = '#f6f8fa'; ctx.font = '900 84px '+font;
  for (const line of wrapText(ctx, festival.name, W-2*X).slice(0,3)) { ctx.fillText(line, X, y); y += 96; }
  ctx.fillStyle = '#9ba8b7'; ctx.font = '600 36px '+font;
  ctx.fillText([festival.date ? fmt(festival.date) : '', festival.location].filter(Boolean).join(' · ').slice(0,52), X, y+4);
  y += 80;
  ctx.fillStyle = 'rgba(215,226,240,.14)'; ctx.fillRect(X,y,W-2*X,2);
  y += 70;

  const multiDay = new Set(sets.map(set => isoDay(set.start))).size > 1 && new Set(sets.map(set => set.item.day || '')).size > 1;
  const rowHeight = 132, bottom = H-210;
  let lastDay = '', shown = 0;
  for (const set of sets) {
    const day = set.item.day || '';
    const need = rowHeight + (multiDay && day !== lastDay ? 80 : 0);
    if (y + need > bottom) break;
    if (multiDay && day !== lastDay) {
      ctx.fillStyle = '#9ba8b7'; ctx.font = '800 30px '+font;
      ctx.fillText(String(dayName(day)).toUpperCase(), X, y); y += 60; lastDay = day;
    }
    ctx.fillStyle = '#d6ff42'; ctx.font = '800 38px '+font;
    ctx.fillText(clock(set.start)+' – '+clock(set.end), X, y+38);
    ctx.fillStyle = '#f6f8fa'; ctx.font = '800 44px '+font;
    ctx.fillText(wrapText(ctx, set.item.artist, W-2*X-300)[0], X+300, y+38);
    ctx.fillStyle = '#9ba8b7'; ctx.font = '600 30px '+font;
    ctx.fillText(set.stage, X+300, y+84);
    y += rowHeight; shown++;
  }
  if (shown < sets.length) {
    ctx.fillStyle = '#9ba8b7'; ctx.font = '600 32px '+font;
    ctx.fillText('+ '+(sets.length-shown)+' andere sets', X, y+20);
  }
  ctx.fillStyle = '#9ba8b7'; ctx.font = '700 28px '+font;
  ctx.fillText('UPTEMPO · FESTIVAL PLANNER', X, H-110);
  return canvas;
}
