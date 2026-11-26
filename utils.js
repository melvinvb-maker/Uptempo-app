// Small helpers shared by the app: escaping, dates, storage and on-screen messages.

// Short message at the bottom of the screen instead of a blocking browser popup.
export function toast(message, duration = 3500) {
  let box = document.getElementById('toast');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  box.textContent = message;
  box.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.remove('show'), duration);
}

// Reads saved JSON safely: damaged or blocked storage falls back instead of stopping the whole app.
export function stored(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value !== null && typeof value === typeof fallback && Array.isArray(value) === Array.isArray(fallback) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeFestivalName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function dayName(value) {
  const names = { friday: 'Vrijdag', saturday: 'Zaterdag', sunday: 'Zondag', monday: 'Maandag', tuesday: 'Dinsdag', wednesday: 'Woensdag', thursday: 'Donderdag' };
  return names[String(value || '').toLowerCase()] || value;
}

export function clockMinute(value) {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(String(value || '').trim());
  if (!match || Number(match[1]) > 23) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isoDay(date) { return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0'); }

export const clock = date => String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0');

export function fmt(d) {
  return d ? new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
}

export function startOfToday() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

// Offers a file to the user as a download (calendar file, plan image, ...).
export function downloadFile(blob, name) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

// Turns a festival name into a safe file name.
export const fileName = (name, suffix) => (name || 'festival').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')+suffix;
