import {setupGuide} from './festival-guide.js?v=4';
import { bundledLineups } from './festival-data.js';
import { firebaseEnabled, firebaseConfig } from './firebase-config.js';
import { toast, stored, normalizeFestivalName, dayName, clockMinute, isoDay, clock, fmt, esc, startOfToday, downloadFile, fileName } from './utils.js';
import { artistKey, photoFor, setPhotos, profileName, performers, resolveArtist } from './artists.js';
import { setKey, timedSets, scheduledSets, icsText, icsTime, icsFold, planImage } from './planning.js';

const $ = s => document.querySelector(s);

let festivals = stored('festivals', []);
let friends = stored('friends', []);
let profile = stored('profile', {name:''});
let groupId = (() => { try { return localStorage.groupId || ""; } catch { return ""; } })();
let calendarDate = new Date();

let db = null;
let uid = null;
let unsubscribeFestivals = null;
let unsubscribeFriends = null;
let unsubscribeFestivalLineups = null;
let festivalLineupUpdates = bundledLineups;
let savedKeys = stored('uptempoSavedEditions', []);
function editionKey(f) {
  return normalizeFestivalName(f.festival) + '-' + (f.date || f.lineupEditionYear || 'open');
}
function datedEditions() {
  return festivalLineupUpdates.filter(f => f.officialCatalog && f.date).sort((a,b) => a.date.localeCompare(b.date));
}
function seasonRow(f) {
  return '<button class="seasonRow seasonOpen" data-edition="'+normalizeFestivalName(f.festival)+'"><span><b>'+esc(f.festival)+'</b><small>'+esc(festivalDateLabel(f))+' · '+esc(f.location)+'</small></span></button>';
}
function renderSeason() {
  if (!$('#seasonAgenda') || !$('#seasonStats') || !$('#savedEditions')) return;
  const editions = datedEditions();
  const years = [...new Set(editions.filter(f => !festivalHasPassed(f)).map(f => f.date.slice(0,4)))];
  $('#seasonAgenda').innerHTML = years.map(year => '<h3 class="seasonYear">'+year+'</h3>'+editions.filter(f => !festivalHasPassed(f) && f.date.startsWith(year)).map(seasonRow).join('')).join('') || 'Festivaldata worden opgehaald.';
  const saved = editions.filter(f => savedKeys.includes(editionKey(f)));
  $('#savedEditions').innerHTML = saved.map(seasonRow).join('') || '<button class="btn2" data-go="festivals">Kies een festival om te bewaren</button>';
  const season = editions.filter(f => f.date.startsWith('2027'));
  $('#seasonStats').innerHTML = '<b>'+season.length+' bevestigde edities</b>'+season.map(seasonRow).join('');
}
document.addEventListener('click', event => {
  const personal = event.target.closest('[data-personal]');
  if (personal) return window.openFestivalLineup(personal.dataset.personal);
  const button = event.target.closest('[data-go],[data-edition],[data-save-edition]');
  if (!button) return;
  if (button.dataset.go) return switchTab(button.dataset.go);
  if (button.dataset.edition) return window.openOfficialLineup(button.dataset.edition);
  const key = button.dataset.saveEdition;
  savedKeys = savedKeys.includes(key) ? savedKeys.filter(k => k !== key) : [...savedKeys,key];
  localStorage.uptempoSavedEditions = JSON.stringify(savedKeys);
  renderAll();
});
let selectedLineupKey = '';
let selectedLineupDay = 'all';
let favoriteSets = stored('uptempoFavoriteSets', []);
let onlyFavoriteSets = false;
document.addEventListener('click', event => {
  const button = event.target.closest('[data-set-key],[data-favorites-only]');
  if (!button) return;
  if (button.hasAttribute('data-favorites-only')) onlyFavoriteSets = !onlyFavoriteSets;
  else {
    const key = button.dataset.setKey;
    favoriteSets = favoriteSets.includes(key) ? favoriteSets.filter(value => value !== key) : [...favoriteSets,key];
    shareFavorites();
    localStorage.uptempoFavoriteSets = JSON.stringify(favoriteSets);
    if (!onlyFavoriteSets) {
      const saved = favoriteSets.includes(key);
      for (const star of document.querySelectorAll('[data-set-key]')) {
        if (star.dataset.setKey !== key) continue;
        star.setAttribute('aria-pressed', String(saved));
        const heart = star.querySelector('.slotHeart');
        if (heart) heart.textContent = saved ? '♥' : '♡';
        else star.textContent = saved ? '★' : '☆';
      }
      refreshPlanPanel();
      return;
    }
  }
  renderLineup();
});

function save() {
  try {
    localStorage.festivals = JSON.stringify(festivals);
    localStorage.friends = JSON.stringify(friends);
    localStorage.profile = JSON.stringify(profile);
    localStorage.groupId = groupId;
  } catch {
    // Storage full or blocked (private mode): the app keeps working for this visit.
  }
}

function launchConfetti() {
  const emojis = ['🎉','🎊','✨','💜','🎵'];

  for (let i = 0; i < 40; i++) {
    const piece = document.createElement('div');
    piece.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    piece.style.position = 'fixed';
    piece.style.left = Math.random() * window.innerWidth + 'px';
    piece.style.top = '-40px';
    piece.style.fontSize = (20 + Math.random() * 20) + 'px';
    piece.style.zIndex = '99999';
    piece.style.pointerEvents = 'none';
    piece.style.transition = 'transform 2s ease-out, opacity 2s ease-out';

    document.body.appendChild(piece);

    requestAnimationFrame(() => {
      piece.style.transform =
        `translateY(${window.innerHeight + 100}px) rotate(${Math.random() * 1080}deg)`;
      piece.style.opacity = '0';
    });

    setTimeout(() => piece.remove(), 2000);
  }
}

async function initFirebase() {
  if (!firebaseEnabled) return;

  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    const { getAuth, signInAnonymously, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
    const {
      getFirestore, collection, doc, setDoc, onSnapshot,
      addDoc, serverTimestamp, deleteDoc, getDoc
    } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');

    window.fb = { collection, doc, setDoc, onSnapshot, addDoc, serverTimestamp, deleteDoc, getDoc };

    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    const auth = getAuth(app);

    await auth.authStateReady();
    if (!auth.currentUser) await signInAnonymously(auth);
    const {setupAccount} = await import('./social/account.js');
    setupAccount(auth,db);

    onAuthStateChanged(auth, user => {
      if (!user) {
        uid = null;
        unsubscribeFestivals?.(); unsubscribeFriends?.(); unsubscribeFestivalLineups?.();
        return;
      }
      if (user) {
        uid = user.uid;
        updateFirebaseNotice();
        watchFestivalLineups();
        if (groupId) liveSync();
      }
    });
  } catch (e) {
    if ($('#firebaseNotice')) $('#firebaseNotice').textContent = 'Firebase kon niet starten.';
    console.error(e);
  }
}

function groupPath(type) {
  return window.fb.collection(db, 'groups', groupId, type);
}

function updateFirebaseNotice() {
  if (!$('#firebaseNotice')) return;
  $('#firebaseNotice').innerHTML = groupId
    ? `🟢 Live groep actief: <b>${groupId}</b>`
    : '🟡 Maak of join eerst een groep.';
}

// 8 random characters from a set without look-alikes (0/O, 1/I/L): about a trillion possible codes.
function newGroupCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = [...bytes].map(byte => alphabet[byte % alphabet.length]).join('');
  return 'UPT-' + chars.slice(0,4) + '-' + chars.slice(4);
}

async function createGroup() {
  if (!db || !uid) return toast('Firebase is nog niet actief.');

  let code = '';
  for (let attempt = 0; attempt < 5 && !code; attempt++) {
    const candidate = newGroupCode();
    if (!(await window.fb.getDoc(window.fb.doc(db, 'groups', candidate))).exists()) code = candidate;
  }
  if (!code) return toast('Er kon geen groepscode worden gemaakt. Probeer het opnieuw.');
  groupId = code;
  save();

  await window.fb.setDoc(window.fb.doc(db, 'groups', groupId), {
    code: groupId,
    createdBy: uid,
    createdAt: window.fb.serverTimestamp()
  });

  if (profile.name) await saveProfileLive();

  liveSync();
  renderAll();
  toast('Groep aangemaakt: ' + groupId + ' · deel deze code met je vrienden', 8000);
}

async function joinGroup() {
  const code = ($('#joinGroupCode')?.value || '').trim().toUpperCase();
  if (!code) return toast('Vul een groepscode in.');
  if (!db || !uid) return toast('Firebase is nog niet actief.');

  const snap = await window.fb.getDoc(window.fb.doc(db, 'groups', code));
  if (!snap.exists()) return toast('Deze groep bestaat niet.');

  groupId = code;
  festivals = [];
  friends = [];
  save();

  if (profile.name) await saveProfileLive();

  liveSync();
  renderAll();
}

function leaveGroup() {
  if (!confirm('Groep verlaten?')) return;

  if (unsubscribeFestivals) unsubscribeFestivals();
  if (unsubscribeFriends) unsubscribeFriends();

  groupId = "";
  festivals = [];
  friends = [];
  save();
  renderAll();
}

function liveSync() {
  if (!db || !groupId) return;

  if (unsubscribeFestivals) unsubscribeFestivals();
  if (unsubscribeFriends) unsubscribeFriends();

  unsubscribeFestivals = window.fb.onSnapshot(groupPath('festivals'), snap => {
    festivals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    applyFestivalLineupUpdates();
    save();
    renderAll();
  });

  unsubscribeFriends = window.fb.onSnapshot(groupPath('friends'), snap => {
    friends = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    save();
    renderAll();
  });

  if (profile.name) saveProfileLive();
}

const bundledEditions = festivalLineupUpdates;
let rawEditions = bundledEditions;
let editorial = new Map();
let stopEditorial;
function publishCatalog() {
  const byId = new Map(rawEditions.map(item => [item.catalogKey || normalizeFestivalName(item.festival),item]));
  for (const [id,patch] of editorial) byId.set(id,{...byId.get(id),...patch,catalogKey:id,officialCatalog:true});
  window.editableEditions = [...byId.entries()];
  festivalLineupUpdates = [...byId.values()].filter(item => !item.hidden);
  applyFestivalLineupUpdates(); save(); renderAll();
  window.dispatchEvent(new Event('catalog-ready'));
}
function watchFestivalLineups() {
  if (!db || !uid) return;
  if (unsubscribeFestivalLineups) unsubscribeFestivalLineups();

  stopEditorial?.();
  stopEditorial = window.fb.onSnapshot(window.fb.collection(db,'editionOverrides'), snap => {
    editorial = new Map(snap.docs.map(d => [d.id,d.data()])); publishCatalog();
  });
  unsubscribeFestivalLineups = window.fb.onSnapshot(
    window.fb.collection(db, 'festivalLineups'),
    snap => {
      const synced = snap.docs.map(doc => {
        const entry = {...doc.data(), catalogKey:doc.id};
        const seed = bundledEditions.find(item => item.date === entry.date &&
          normalizeFestivalName(item.festival) === normalizeFestivalName(entry.festival));
        for (const field of ['hours','age','address']) if (seed?.[field] && !entry[field]) entry[field] = seed[field];
        if (seed?.imageUrl && !entry.imageUrl) entry.imageUrl = seed.imageUrl;
        if (seed?.lineupRevision > (entry.lineupRevision || 0)) {
          Object.assign(entry, {lineup:seed.lineup, lineupRevision:seed.lineupRevision, host:seed.host, lineupSource:seed.lineupSource});
        }
        return entry;
      });
      rawEditions = [...synced, ...bundledEditions.filter(seed => !synced.some(entry =>
        normalizeFestivalName(entry.festival) === normalizeFestivalName(seed.festival) && entry.date === seed.date
      ))];
      publishCatalog();
    },
    error => console.warn('Festival line-up updates could not be loaded.', error)
  );
}

function applyFestivalLineupUpdates() {
  if (!festivalLineupUpdates.length) return;

  festivals = festivals.map(festival => {
    const festivalName = normalizeFestivalName(festival.name);
    const update = festivalLineupUpdates.find(item =>
      [item.festival, ...(item.aliases || [])]
        .some(name => normalizeFestivalName(name) === festivalName)
    );

    if (!update) return festival;

    const festivalYear = new Date(festival.date || '').getFullYear();
    const lineupYear = Number(update.lineupEditionYear || 0);
    if (lineupYear && Number.isFinite(festivalYear) && festivalYear !== lineupYear) return festival;

    const hasUnversionedWebsiteData = (update.lineup || []).some(
      item => item.source === 'official_website' && !item.editionYear
    );
    if (hasUnversionedWebsiteData &&
        Number.isFinite(festivalYear) &&
        festivalYear < new Date().getFullYear()) return festival;

    const importedSources = new Set(['instagram', 'official_website']);
    const manualItems = (festival.lineup || [])
      .filter(item => !importedSources.has(item.source) && (item.id || !update.lineupRevision));
    const importedItems = (update.lineup || []).map(item => item.source ? item : {...item, source:'official_website'});

    return {
      ...festival,
      lineup: [...manualItems, ...importedItems],
      host: update.host || festival.host || '',
      hours:update.hours || festival.hours || '', age:update.age || festival.age || '', address:update.address || festival.address || '',
      lineupSource: update.lineupSource || '',
      lineupUpdatedAt: update.lineupUpdatedAt || null,
      imageUrl: update.imageUrl || festival.imageUrl || ''
    };
  });
}

// Favourite sets are shared with the group, so friends can see who is going to which set.
// Debounced: a burst of taps costs one write instead of one per tap.
let shareTimer;
function shareFavorites() {
  clearTimeout(shareTimer);
  shareTimer = setTimeout(() => {
    if (!db || !uid || !groupId) return;
    window.fb.setDoc(window.fb.doc(db, 'groups', groupId, 'friends', uid), {favorites: favoriteSets.slice(-400)}, {merge: true}).catch(() => {});
  }, 2000);
}

// Group members (not yourself) who marked this set as a favourite.
function friendsAtSet(key) {
  return friends.filter(friend => friend.id !== uid && Array.isArray(friend.favorites) && friend.favorites.includes(key));
}

function friendBadges(key) {
  const going = friendsAtSet(key);
  if (!going.length) return '';
  const names = going.map(friend => friend.name || 'Vriend');
  const dots = going.slice(0,3).map(friend => '<i>'+esc((friend.name || '?').trim().slice(0,1).toUpperCase())+'</i>').join('');
  return '<span class="slotFriends" title="'+esc(names.join(', '))+'">'+dots+(going.length > 3 ? '<i>+'+(going.length-3)+'</i>' : '')+'</span>';
}

async function saveProfileLive() {
  if (!db || !uid || !groupId) return;

  await window.fb.setDoc(
    window.fb.doc(db, 'groups', groupId, 'friends', uid),
    {
      name: profile.name || 'Naamloos',
      uid,
      activeAt: document.hidden ? 0 : Date.now(),
      lastSeen: window.fb.serverTimestamp(),
      favorites: favoriteSets.slice(-400)
    },
    { merge: true }
  );
}

async function addFestivalLive(f) {
  const item = {
    ...f,
    going: [],
    lineup: [],
    createdBy: uid || 'local',
    createdAt: db ? window.fb.serverTimestamp() : Date.now()
  };

  if (db && groupId) {
    await window.fb.addDoc(groupPath('festivals'), item);
  } else if (db && !groupId) {
    toast('Maak of join eerst een groep.');
  } else {
    festivals.push({ ...item, id: crypto.randomUUID() });
    save();
    renderAll();
  }
}

async function addFriendLive(name) {
  if (db && groupId) {
    await window.fb.setDoc(
      window.fb.doc(db, 'groups', groupId, 'friends', crypto.randomUUID()),
      {
        name,
        addedBy: uid,
        lastSeen: window.fb.serverTimestamp()
      }
    );
  } else {
    friends.push({ id: crypto.randomUUID(), name });
    save();
    renderAll();
  }
}

async function updateFestival(fest) {
  if (db && groupId) {
    await window.fb.setDoc(
      window.fb.doc(db, 'groups', groupId, 'festivals', fest.id),
      fest,
      { merge: true }
    );
  }

  save();
  renderAll();
}

window.removeFestival = async id => {
  if (!confirm('Festival verwijderen?')) return;

  if (db && groupId) {
    await window.fb.deleteDoc(window.fb.doc(db, 'groups', groupId, 'festivals', id));
  } else {
    festivals = festivals.filter(f => f.id !== id);
    save();
    renderAll();
  }
};

window.toggleGoing = async id => {
  const fest = festivals.find(f => f.id === id);
  if (!fest) return;

  const myName = profile.name || 'Anoniem';
  fest.going = fest.going || [];

  if (fest.going.includes(myName)) {
    fest.going = fest.going.filter(x => x !== myName);
  } else {
    fest.going.push(myName);
    launchConfetti();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  }

  await updateFestival(fest);
};

window.changeMonth = amount => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + amount, 1);
  renderCal();
};

function nextFest() {
  return festivals
    .filter(f => !festivalHasPassed(f))
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
}

function festivalCard(f) {
  const going = f.going || [];
  const myName = profile.name || 'Anoniem';
  const iAmGoing = going.includes(myName);
  const coverInitials = String(f.name || 'UP').split(/\\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const cover = f.imageUrl
    ? `<div class="festival-cover" style="background-image:linear-gradient(0deg,rgba(7,10,14,.72),transparent 68%),url('${esc(f.imageUrl)}')"></div>`
    : `<div class="festival-cover no-image"><span>${esc(coverInitials)}</span></div>`;

  return `
    <article class="card personalFest">
      ${cover}
      <div class="row" style="align-items:flex-start">
        <div class="grow">
          <b><button class="stretchedTitle" data-personal="${esc(f.id)}">${esc(f.name)}</button></b>
          <div class="muted">${festivalDateLabel(f)} · ${esc(f.location || '')}</div>
          <span class="tag ${String(f.genre || '').toLowerCase()}">${esc(f.genre || 'Uptempo')}</span>
        </div>
        <button class="btn2" onclick="removeFestival('${f.id}')" aria-label="Festival verwijderen">Wis</button>
      </div>
      <div class="row" style="justify-content:space-between;margin-top:14px;flex-wrap:wrap">
        <button class="btn2" onclick="toggleGoing('${f.id}')">${iAmGoing ? 'Je gaat ✓' : 'Ik ga'}</button>
        <span class="muted">${going.length} gaan</span>
      </div>
      ${going.length ? `<div class="muted" style="margin-top:10px">${going.map(esc).join(' · ')}</div>` : ''}
    </article>
  `;
}

function festivalHasPassed(festival) {
  const endDate = festival.dateEnd || festival.date || '';
  const date = new Date(endDate);
  return Number.isFinite(date.getTime()) && date < startOfToday();
}

function catalogHasPassed(update) {
  if (update.dateEnd || update.date) return festivalHasPassed(update);
  const year = Number(update.lineupEditionYear || 0);
  return year > 0 && year < new Date().getFullYear();
}

function festivalDateLabel(item) {
  const start = fmt(item.date);
  const end = fmt(item.dateEnd);
  if (start && end && item.date !== item.dateEnd) {
    const startDate = new Date(item.date);
    const endDate = new Date(item.dateEnd);
    if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
      return `${startDate.getDate()}–${endDate.getDate()} ${endDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}`;
    }
    return `${start} – ${end}`;
  }
  return start || (item.lineupEditionYear ? `Editie ${item.lineupEditionYear}` : 'Datum volgt');
}

function matchesFestivalSearch(item, query) {
  if (!query) return true;
  const text = [item.name, item.festival, item.location, item.genre, item.lineupEditionYear, item.date ? new Date(item.date).getFullYear() : '', item.dateEnd ? new Date(item.dateEnd).getFullYear() : '']
    .filter(Boolean).join(' ');
  return normalizeFestivalName(text).includes(normalizeFestivalName(query));
}

function render() {
  const n = nextFest() || datedEditions().find(f => !festivalHasPassed(f));
  const activeFestivals = festivals.filter(f => !festivalHasPassed(f));
  const archivedFestivals = festivals.filter(festivalHasPassed);

  if ($('#nextName')) $('#nextName').textContent = n ? (n.name || n.festival) : 'Nog niets gepland';
  if ($('#nextMeta')) $('#nextMeta').textContent = n ? `${festivalDateLabel(n)} · ${n.location || ''}` : 'Voeg je eerste festival toe';
  if ($('#heroAction')) {
    $('#heroAction').textContent = n?.festival ? 'Bekijk festival' : n ? 'Bekijk mijn festivals' : 'Festival toevoegen';
    $('#heroAction').onclick = () => n?.festival ? window.openOfficialLineup(normalizeFestivalName(n.festival)) : n ? switchTab('festivals') : $('#modal').classList.add('active');
  }

  if ($('#totalFest')) $('#totalFest').textContent = activeFestivals.length;
  if ($('#doneFest')) $('#doneFest').textContent = archivedFestivals.length;
  if ($('#friendCount')) $('#friendCount').textContent = friends.length;

  if ($('#sPlanned')) $('#sPlanned').textContent = activeFestivals.length;
  if ($('#sVisited')) $('#sVisited').textContent = archivedFestivals.length;
  if ($('#sCities')) $('#sCities').textContent = new Set(festivals.map(f => f.location).filter(Boolean)).size;

  const upcoming = activeFestivals
    .slice()
    .sort((a, b) => new Date(a.date || '9999-12-31') - new Date(b.date || '9999-12-31'));

  if ($('#upcoming')) {
    $('#upcoming').innerHTML = (upcoming.map(festivalCard).join('') + datedEditions().filter(f => !festivalHasPassed(f) && savedKeys.includes(editionKey(f))).map(seasonRow).join('')) || '<button class="btn2" data-go="festivals">Kies een festival voor mijn planning</button>';
  }

  const query = $('#search')?.value || '';
  const activeMatches = activeFestivals.filter(f => matchesFestivalSearch(f, query));
  const archiveMatches = query ? archivedFestivals.filter(f => matchesFestivalSearch(f, query)) : [];

  if ($('#festivalList')) {
    $('#festivalList').innerHTML =
      activeMatches.map(festivalCard).join('') ||
      (query ? '<div class="card muted">Geen aankomende festivals gevonden.</div>' : '<div class="card muted">Nog geen aankomende festivals. Ontdek hieronder edities die al bekend zijn.</div>');
  }

  const archive = $('#festivalArchive');
  if (archive) {
    archive.innerHTML = query
      ? `${archiveMatches.length ? '<div class="section">Afgelopen festivals</div>' : ''}${archiveMatches.map(festivalCard).join('')}`
      : '<div class="muted archive-hint">Afgelopen edities zijn bewaard. Zoek hierboven op naam om ze terug te vinden.</div>';
  }

  countdown();
}

function compactFestival(update, archived = false) {
  const name = update.festival || 'Festival';
  const key = editionKey(update);
  const saved = savedKeys.includes(key);
  const subtitle = [archived ? 'Archief' : '', festivalDateLabel(update), update.location].filter(Boolean).join(' · ');
  const art = update.imageUrl ? '<img loading="lazy" decoding="async" alt="" data-initial="'+esc(name.slice(0,1))+'" src="'+esc(update.imageUrl)+'">' : '<span class="rowInitial">'+esc(name.slice(0,1))+'</span>';
  return '<article class="festivalRow"><button type="button" class="festivalOpen" data-edition="'+esc(normalizeFestivalName(name))+'">'+art+'<span><strong>'+esc(name)+'</strong><small>'+esc(subtitle)+'</small></span></button>'+
    (update.date ? '<button class="rowSave" data-save-edition="'+esc(key)+'" aria-label="'+esc((saved?'Verwijder uit planning: ':'Bewaar festival: ')+name)+'" aria-pressed="'+saved+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg></button>' : '')+'</article>';
}
function renderOfficialFestivalCatalog() {
  const container = $('#officialFestivalCatalog');
  if (!container) return;

  const query = $('#search')?.value || '';
  const catalog = festivalLineupUpdates
    .filter(update => update.officialCatalog)
    .filter(update => query.trim() ? matchesFestivalSearch(update, query.trim()) : update.date && !catalogHasPassed(update))
    .slice()
    .sort((a, b) => new Date(a.date || '9999-12-31') - new Date(b.date || '9999-12-31') ||
      String(a.festival || '').localeCompare(String(b.festival || '')));

  container.innerHTML = catalog.map(update => compactFestival(update, catalogHasPassed(update))).join('') || `<div class="card muted">${query ? 'Geen festivalinformatie gevonden voor deze zoekopdracht.' : 'Er zijn nog geen actuele festivaledities beschikbaar.'}</div>`;
}

function lineupOptions() {
  const personal = festivals.map(f => ({
    key: 'personal:' + f.id, id: f.id, name: f.name, date: f.date || '', dateEnd: f.dateEnd || '',
    location: f.location || '', imageUrl: f.imageUrl || '', lineup: f.lineup || [],
    hours:f.hours, age:f.age, address:f.address, lineupRevision:f.lineupRevision, host: f.host, floorplanUrl: f.floorplanUrl, lineupSource: f.lineupSource || '', isImportedCatalog: false
  }));
  const catalog = festivalLineupUpdates
    .filter(update => update.officialCatalog || (Array.isArray(update.lineup) && update.lineup.length))
    .filter(update => !festivals.some(festival => {
      const sameName = [update.festival, ...(update.aliases || [])]
        .some(name => normalizeFestivalName(name) === normalizeFestivalName(festival.name));
      if (!sameName) return false;
      const editionYear = Number(update.lineupEditionYear || 0);
      const festivalYear = new Date(festival.date || '').getFullYear();
      return !editionYear || festivalYear === editionYear;
    }))
    .map(update => ({
      key: 'catalog:' + normalizeFestivalName(update.festival),
      name: update.festival || 'Festival', date: update.date || '', dateEnd: update.dateEnd || '',
      location: update.location || (update.lineupEditionYear ? 'Editie ' + update.lineupEditionYear : ''),
      lineup: update.lineup || [], imageUrl: update.imageUrl || '',
      hours:update.hours, age:update.age, address:update.address, lineupRevision:update.lineupRevision, host: update.host, floorplanUrl: update.floorplanUrl, lineupSource: update.lineupSource || '', isImportedCatalog: true
    }));
  return [...personal, ...catalog].sort((a,b) => (a.date || '9999').localeCompare(b.date || '9999'));
}

function getSelectedLineup() {
  return lineupOptions().find(f => f.key === selectedLineupKey) || null;
}

window.openOfficialLineup = slug => {
  $('#lineupSearch').value = '';
  onlyFavoriteSets = false;
  const update = festivalLineupUpdates.find(item => normalizeFestivalName(item.festival) === slug);
  const personal = update && festivals.find(festival => {
    const matches = [update.festival, ...(update.aliases || [])].some(name => normalizeFestivalName(name) === normalizeFestivalName(festival.name));
    const updateYear = Number(update.lineupEditionYear || 0);
    const festivalYear = new Date(festival.date || '').getFullYear();
    return matches && (!updateYear || festivalYear === updateYear);
  });
  selectedLineupKey = personal ? 'personal:' + personal.id : 'catalog:' + slug;
  selectedLineupDay = 'all';
  switchTab('lineup');
};

window.openFestivalLineup = id => {
  $('#lineupSearch').value = '';
  onlyFavoriteSets = false;
  selectedLineupKey = 'personal:' + id;
  selectedLineupDay = 'all';
  switchTab('lineup');
};

function renderHomeFestivalCatalog() {
  renderFollowed();
  const container = $('#homeFestivalCatalog');
  if (!container) return;

  const catalog = festivalLineupUpdates
    .filter(update => update.officialCatalog && update.date && !catalogHasPassed(update))
    .slice()
    .sort((a, b) => new Date(a.date || '9999-12-31') - new Date(b.date || '9999-12-31') ||
      String(a.festival || '').localeCompare(String(b.festival || '')));

  const feature = catalog.find(f => (f.lineup || []).some(set => set.start && set.end)) || catalog[0];
  const spotlight = $('#homeSpotlight');
  if (spotlight && feature) {
    const timed = (feature.lineup || []).filter(set => set.start && set.end).length;
    spotlight.innerHTML = '<article class="spotlight"><span class="eyebrow">'+(timed ? 'Timetable beschikbaar' : 'Eerstvolgende editie')+'</span><h1><button class="stretchedTitle" data-edition="'+normalizeFestivalName(feature.festival)+'">'+esc(feature.festival)+'</button></h1><p>'+esc(festivalDateLabel(feature))+' · '+esc(feature.location || '')+'</p></article>';
    if (feature.imageUrl) spotlight.firstElementChild.style.backgroundImage = 'url('+JSON.stringify(feature.imageUrl)+')';
  }
  const plans = $('#homePlans');
  if (plans) plans.hidden = !nextFest() && !datedEditions().some(f => !festivalHasPassed(f) && savedKeys.includes(editionKey(f)));
  let lastSection = '';
  container.innerHTML = catalog.map(update => {
    const section = update.date ? 'Festivals '+update.date.slice(0,4) : 'Datum volgt';
    const heading = section === lastSection ? '' : '<h2 class="section">'+esc(section)+'</h2>';
    lastSection = section;
    return heading + compactFestival(update);
  }).join('') || '<div class="card muted">Er zijn nog geen actuele festivaledities bekend.</div>';
}

function renderCal() {
  if (!$('#monthTitle') || !$('#calendarGrid')) return;

  const now = calendarDate;

  $('#monthTitle').innerHTML = `
    <div class="calHead">
      <button class="calNav" onclick="changeMonth(-1)" aria-label="Vorige maand">‹</button>
      <span>${now.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}</span>
      <button class="calNav" onclick="changeMonth(1)" aria-label="Volgende maand">›</button>
    </div>
  `;

  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let html = ['ma','di','wo','do','vr','za','zo'].map(label => '<b class="weekday">'+label+'</b>').join('');
  html += '<div></div>'.repeat((new Date(now.getFullYear(), now.getMonth(), 1).getDay()+6)%7);
  const events = [...festivals, ...datedEditions().map(f => ({...f,name:f.festival}))];
  for (let d = 1; d <= days; d++) {
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayFestivals = events.filter(f => f.date && f.date <= date && (f.dateEnd || f.date) >= date).filter((f,i,all) => all.findIndex(x => normalizeFestivalName(x.name) === normalizeFestivalName(f.name)) === i);

    html += `
      <div class="day${date === isoDay(new Date()) ? ' today' : ''}${dayFestivals.length ? ' hasEvent' : ''}">
        <b>${d}</b>
        ${dayFestivals.map(f => `
          <button class="calendarFestival" ${f.festival ? `data-edition="${esc(normalizeFestivalName(f.festival))}"` : `data-personal="${esc(f.id)}"`} title="${esc(f.name)}">${esc(f.name)}</button>
        `).join('')}
      </div>
    `;
  }

  $('#calendarGrid').innerHTML = html;
}

function renderStats() {
  if (!$('#bars') || !$('#genreStats')) return;

  const months = Array(12).fill(0);

  festivals.forEach(f => {
    const d = new Date(f.date);
    if (!isNaN(d)) months[d.getMonth()]++;
  });

  const max = Math.max(1, ...months);

  $('#bars').innerHTML = months.map(m => `<div style="height:${8 + (m / max) * 88}px"></div>`).join('');

  const genres = {};
  festivals.forEach(f => genres[f.genre || 'Uptempo'] = (genres[f.genre || 'Uptempo'] || 0) + 1);

  $('#genreStats').innerHTML =
    Object.entries(genres).map(([g, c]) => `<p>${g}: <b>${c}</b></p>`).join('') ||
    '<p class="muted">Nog geen data.</p>';
}

function renderFriends() {
  if ($('#myName')) $('#myName').value = profile.name || '';
  if (!$('#friendsList')) return;

  $('#friendsList').innerHTML =
    friends.map(fr => `
      <div class="card friend">
        <div class="avatar">${esc(fr.name || '?').slice(0, 1)}</div>
        <div class="grow">
          <b>${esc(fr.name || 'Vriend')}</b>
          <div class="muted" data-friend-status></div>
        </div>
      </div>
    `).join('') || '<div class="card muted">Nog geen vrienden.</div>';
  refreshFriendStatus();
}

function refreshFriendStatus() {
  const now = Date.now();
  document.querySelectorAll('#friendsList [data-friend-status]').forEach((label,index) => {
    const friend = friends[index];
    const isMember = !!friend?.uid && friend.uid === friend.id;
    const confirmed = friend?.lastSeen?.toMillis?.() || 0;
    const age = now - Math.min(confirmed, Number(friend?.activeAt || 0));
    const active = isMember && navigator.onLine && age >= -5000 && age < 200000;
    label.textContent = active ? '● Online' : isMember ? 'Offline' : 'Groepslijst';
    label.className = active ? 'online' : 'muted';
  });
}

function updatePresence() {
  if (!profile.name || !groupId || !uid || !db || !navigator.onLine) return;
  saveProfileLive().catch(() => { /* The last confirmed heartbeat expires automatically. */ });
}
// Every 90 s: each heartbeat is one write plus one read per group member, so this keeps a group within Firebase's free daily quota.
setInterval(() => { if (!document.hidden) updatePresence(); }, 90000);
setInterval(refreshFriendStatus, 5000);
document.addEventListener('visibilitychange', updatePresence);
window.addEventListener('pagehide', () => {
  if (db && groupId && uid && profile.name && navigator.onLine) {
    window.fb.setDoc(window.fb.doc(db,'groups',groupId,'friends',uid),{activeAt:0},{merge:true}).catch(()=>{});
  }
});
window.addEventListener('online', updatePresence);
window.addEventListener('offline', refreshFriendStatus);

function renderGroupBox() {
  if (!$('#friends')) return;
  if ($('#groupBox')) $('#groupBox').remove();

  const box = document.createElement('div');
  box.id = 'groupBox';
  box.className = 'card form';

  box.innerHTML = `
    <b>Groep</b>
    <div class="muted">${groupId ? `Jouw groepscode: <b>${groupId}</b>` : 'Maak een groep of join met een code.'}</div>
    <button class="btn" id="createGroupBtn">Groep aanmaken</button>
    <input id="joinGroupCode" placeholder="Groepscode, bijv. UPT-K7Q9">
    <button class="btn2" id="joinGroupBtn">Groep joinen</button>
    ${groupId ? '<button class="btn2" id="leaveGroupBtn">Groep verlaten</button>' : ''}
  `;

  $('#friends').insertBefore(box, $('#friends').children[2] || null);

  $('#createGroupBtn').onclick = createGroup;
  $('#joinGroupBtn').onclick = joinGroup;
  if ($('#leaveGroupBtn')) $('#leaveGroupBtn').onclick = leaveGroup;
}

function renderProfile() {
  const name = window.accountName || profile.name || 'Naamloos';
  const goingCount = festivals.filter(f => (f.going || []).includes(name)).length;

  if ($('#profileName')) $('#profileName').textContent = name;
  if ($('#profileAvatar')) $('#profileAvatar').textContent = name.slice(0, 1).toUpperCase();
  if ($('#headerAvatar')) $('#headerAvatar').textContent = name.slice(0, 1).toUpperCase();
  for (const id of ['#profileAvatar','#headerAvatar']) {
    const avatar = $(id);
    if (avatar) {
      avatar.style.backgroundImage = window.accountPortrait ? 'url('+JSON.stringify(window.accountPortrait)+')' : '';
      if (window.accountPortrait) avatar.textContent = '';
    }
  }
  if ($('#profileGroup')) $('#profileGroup').textContent = groupId ? `Groep: ${groupId}` : 'Geen groep actief';
  if ($('#profileFestivalCount')) $('#profileFestivalCount').textContent = festivals.length;
  if ($('#profileGoingCount')) $('#profileGoingCount').textContent = goingCount;
  if ($('#profileFriendCount')) $('#profileFriendCount').textContent = friends.length;
}

function renderLeaderboard() {
  if (!$('#leaderboardList')) return;

  const scores = {};

  festivals.forEach(f => {
    (f.going || []).forEach(name => {
      scores[name] = (scores[name] || 0) + 1;
    });
  });

  const ranking = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  $('#leaderboardList').innerHTML =
    ranking.map(([name, score], i) => `
      <div class="card row">
        <div class="rank">${String(i + 1).padStart(2, '0')}</div>
        <div class="grow">
          <b>${esc(name)}</b>
          <div class="muted">${score} festivals</div>
        </div>
      </div>
    `).join('') || '<div class="card muted">De ranglijst verschijnt zodra iemand in je groep op ‘Ik ga’ tikt.</div>';
}


function artistLink(item) {
  return '<button type="button" class="artistLink" data-artist-info="'+esc(item.artist)+'" aria-haspopup="dialog">'+esc(item.artist)+'</button>';
}

const followed = new Map(stored('uptempoFollowedArtists', []));
function renderFollowed() {
  const section = $('#followedArtists');
  section.hidden = !followed.size;
  if (!followed.size) return;
  const shows = [];
  for (const edition of datedEditions().filter(f => !catalogHasPassed(f))) {
    const names = new Set();
    for (const set of edition.lineup || []) {
      const members = performers(set.artist);
      for (const member of members) {
        const id = artistKey(resolveArtist(member, members.length === 1)?.name || member);
        if (followed.has(id)) names.add(followed.get(id));
      }
    }
    if (names.size) shows.push('<button class="btn2" data-edition="'+esc(normalizeFestivalName(edition.festival))+'">'+esc(edition.festival)+' · '+esc(fmt(edition.date))+'<br>'+esc([...names].join(', '))+'</button>');
  }
  section.querySelector('.followShows').innerHTML = shows.join(' ') || 'Er zijn nog geen komende optredens bevestigd.';
}

function mapLink(festival) {
  const edition = festivalLineupUpdates.find(f => f.date === festival.date && normalizeFestivalName(f.festival) === normalizeFestivalName(festival.name));
  let url = edition?.floorplanUrl;
  let label = 'Festivalplattegrond';
  if (!/^https:\/\//i.test(url || '')) {
    label = 'Plattegrond van de locatie';
    if (/autotron/i.test(festival.location)) url = 'https://www.autotron.nl/wp-content/uploads/sites/4/2018/08/Plattegrond-Autotron.pdf';
    else if (/brabanthallen/i.test(festival.location)) url = 'https://www.brabanthallen.nl/wp-content/uploads/2026/01/Plattegrond-Brabanthallen-s-Hertogenbosch-JAN2026.pdf';
    else return '';
  }
  return '<p><a class="btn2" target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+label+'</a></p>';
}
function showArtist(label, chosen) {
  const festival = getSelectedLineup();
  const act = festival?.lineup?.find(item => item.artist === label);
  if (!act) return;
  const names = performers(label);
  const name = chosen && names.includes(chosen) ? chosen : names.length === 1 ? names[0] : profileName(label);
  const id = artistKey(name);
  const record = resolveArtist(name, names.length === 1 && !chosen);
  const appearances = festivalLineupUpdates.filter(edition => edition.lineup?.some(item =>
    artistKey(profileName(item.artist)) === id || performers(item.artist).some(artist => artistKey(artist) === id)
  ));
  const group = names.length > 1 && !chosen;
  const venues = [...new Set([festival.name, ...appearances.map(edition => edition.festival)])];
  let bio = record?.bio;
  if (!bio) {
    bio = group ? 'Voor deze set staan '+names.join(' en ')+' samen op het programma van '+festival.name+'.'
      : name+' staat op de line-up van '+venues.slice(0,3).join(', ')+'.';
    if (!group && act.stage) bio += ' Bij '+festival.name+' staat deze act op '+act.stage+'.';
  }
  const catalogPhoto = appearances.flatMap(edition => edition.lineup).find(item => artistKey(profileName(item.artist)) === id && item.portrait?.startsWith('https://'))?.portrait;
  const photo = (record && photoFor(record.name)) || photoFor(name) || catalogPhoto || (!chosen && act.portrait?.startsWith('https://') ? act.portrait : '');
  const dialog = document.getElementById('artistDialog');
  dialog.querySelector('h2').textContent = record?.name || name;
  dialog.querySelector('.artistBio').textContent = bio;
  dialog.querySelector('.artistSection').textContent = record ? 'Biografie' : 'In het programma';
  const image = dialog.querySelector('img');
  image.hidden = !photo;
  if (photo) { image.onerror = () => {image.hidden = true;}; image.src = photo; image.alt = name; }
  else image.removeAttribute('src');
  const links = dialog.querySelector('.artistMembers');
  links.replaceChildren();
  if (names.length > 1) for (const artist of names) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'day-chip';
    button.textContent = artist;
    button.setAttribute('aria-pressed', String(chosen === artist));
    button.onclick = () => {showArtist(label,artist); dialog.querySelector('h2').focus();};
    links.append(button);
  }
  const follow = dialog.querySelector('.followArtist');
  follow.hidden = group;
  const displayName = record?.name || name;
  const followId = artistKey(displayName);
  const updateButton = () => {
    follow.textContent = followed.has(followId) ? 'Ontvolgen' : 'Artiest volgen';
    follow.setAttribute('aria-pressed', String(followed.has(followId)));
  };
  updateButton();
  follow.onclick = () => {
    if (followed.has(followId)) followed.delete(followId);
    else followed.set(followId, displayName);
    localStorage.setItem('uptempoFollowedArtists', JSON.stringify([...followed]));
    updateButton();
    renderFollowed();
  };
  const source = dialog.querySelector('a');
  const url = record?.url || festival.lineupSource;
  source.hidden = !/^https?:\/\//i.test(url || '');
  if (!source.hidden) {source.href = url; source.textContent = record ? 'Officieel artiestenprofiel' : 'Bron van de line-up';}
  if (!dialog.open) dialog.showModal();
}

document.addEventListener('click', event => {
  const link = event.target.closest('[data-artist-info]');
  if (link) showArtist(link.dataset.artistInfo);
});

function nowNextHtml(sets, now) {
  if (!sets.length) return '';
  const first = sets[0].start, last = sets.reduce((max,set) => set.end > max ? set.end : max, sets[0].end);
  if (now < first - 3*3600000 || now > last) return '';
  const stages = [...new Set(sets.map(set => set.stage))];
  const rows = stages.map(stage => {
    const own = sets.filter(set => set.stage === stage);
    const current = own.find(set => set.start <= now && now < set.end);
    const next = own.find(set => set.start > now);
    if (!current && !next) return '';
    const fav = set => favoriteSets.includes(set.key) ? '<span class="nnFav" aria-label="favoriet">♥</span> ' : '';
    const with_ = set => { const names = friendsAtSet(set.key).map(friend => friend.name || 'Vriend'); return names.length ? ' <small class="nnWith">· '+esc(names.slice(0,3).join(', '))+(names.length > 3 ? ' +'+(names.length-3) : '')+'</small>' : ''; };
    return '<div class="nnRow"><b>'+esc(stage)+'</b><div>'
      +(current ? '<span class="nnNow">Nu</span> '+fav(current)+esc(current.item.artist)+' <small>tot '+clock(current.end)+'</small>'+with_(current) : '<span class="muted">Even pauze</span>')
      +(next ? '<br><span class="nnNext">'+clock(next.start)+'</span> '+fav(next)+esc(next.item.artist)+with_(next) : '')
      +'</div></div>';
  }).join('');
  const title = now < first ? 'Vandaag · begint om '+clock(first) : 'Nu & straks';
  return rows ? '<section class="planCard"><h3>'+title+'</h3>'+rows+'</section>' : '';
}

function overlapHtml(favorites) {
  const pairs = [];
  favorites.forEach((a,i) => favorites.slice(i+1).forEach(b => {
    const minutes = Math.round((Math.min(a.end,b.end) - Math.max(a.start,b.start)) / 60000);
    if (minutes > 0 && a.stage !== b.stage) pairs.push({a,b,minutes});
  }));
  if (!pairs.length) return '';
  pairs.sort((x,y) => y.minutes-x.minutes);
  const rows = pairs.slice(0,3).map(({a,b,minutes}) =>
    '<p><b>'+esc(a.item.artist)+'</b> <span class="muted">en</span> <b>'+esc(b.item.artist)+'</b> <small>· '+minutes+' min</small></p>').join('');
  const more = pairs.length > 3 ? '<p class="muted">+ '+(pairs.length-3)+' andere overlap'+(pairs.length > 4 ? 'pen' : '')+'</p>' : '';
  return '<section class="planCard planWarn"><h3>Overlap in je favorieten</h3>'+rows+more+'</section>';
}

function planPanel(festival) {
  const sets = scheduledSets(festival);
  const favorites = sets.filter(set => favoriteSets.includes(set.key));
  const untimed = (festival.lineup || []).filter(item => clockMinute(item.start) === null && favoriteSets.includes(setKey(festival,item))).length;
  const agenda = favorites.length ? '<div class="planActions"><button class="btn2" data-export-agenda>In mijn agenda ('+favorites.length+')</button><button class="btn2" data-share-plan>Deel mijn planning</button></div>'
    + (untimed ? '<p class="muted">'+untimed+' favoriet'+(untimed > 1 ? 'en hebben' : ' heeft')+' nog geen speeltijd en '+(untimed > 1 ? 'komen' : 'komt')+' er later bij.</p>' : '') : '';
  return nowNextHtml(sets, new Date()) + overlapHtml(favorites) + agenda;
}

function refreshPlanPanel() {
  const panel = document.getElementById('planPanel');
  const festival = panel && getSelectedLineup();
  if (festival) panel.innerHTML = planPanel(festival);
}
setInterval(() => { if (!document.hidden) refreshPlanPanel(); }, 60000);


function exportAgenda(festival) {
  const favorites = scheduledSets(festival).filter(set => favoriteSets.includes(set.key));
  if (!favorites.length) return toast('Markeer eerst sets met een hartje.');
  const stamp = icsTime(new Date());
  const events = favorites.map(set => [
    'BEGIN:VEVENT',
    'UID:'+normalizeFestivalName(festival.name)+'-'+icsTime(set.start)+'-'+normalizeFestivalName(set.item.artist+set.stage)+'@uptempo',
    'DTSTAMP:'+stamp, 'DTSTART:'+icsTime(set.start), 'DTEND:'+icsTime(set.end),
    'SUMMARY:'+icsText(set.item.artist+' · '+set.stage),
    'LOCATION:'+icsText([festival.name, festival.location].filter(Boolean).join(', ')),
    'DESCRIPTION:'+icsText('Favoriete set in je UPTEMPO-planning.'),
    'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:'+icsText(set.item.artist+' begint over 15 minuten op '+set.stage), 'END:VALARM',
    'END:VEVENT'
  ]).flat();
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//UPTEMPO//Festival planner//NL','CALSCALE:GREGORIAN','METHOD:PUBLISH',...events,'END:VCALENDAR'];
  const blob = new Blob([lines.map(icsFold).join('\r\n')+'\r\n'], {type:'text/calendar;charset=utf-8'});
  downloadFile(blob, fileName(festival.name, '-favorieten.ics'));
  toast(favorites.length+' set'+(favorites.length > 1 ? 's' : '')+' klaar voor je agenda');
}

document.addEventListener('click', event => {
  if (!event.target.closest('[data-export-agenda]')) return;
  const festival = getSelectedLineup();
  if (festival) exportAgenda(festival);
});

async function sharePlan(festival) {
  const sets = scheduledSets(festival).filter(set => favoriteSets.includes(set.key));
  if (!sets.length) return toast('Markeer eerst sets met een hartje.');
  const canvas = planImage(festival, sets);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const name = fileName(festival.name, '-planning.png');
  const file = new File([blob], name, {type:'image/png'});
  if (navigator.canShare?.({files:[file]})) {
    try { await navigator.share({files:[file], title:'Mijn planning · '+festival.name}); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  downloadFile(blob, name);
  toast('Afbeelding van je planning opgeslagen');
}

document.addEventListener('click', event => {
  if (!event.target.closest('[data-share-plan]')) return;
  const festival = getSelectedLineup();
  if (festival) sharePlan(festival);
});

// Each stage uses the same time scale so simultaneous sets line up vertically.
function horizontalSchedule(items, festival) {
  const card = item => {
    const key = setKey(festival,item);
    const saved = favoriteSets.includes(key);
    const photos = setPhotos(item);
    const art = photos.map(url => '<img loading="lazy" decoding="async" alt="" src="'+esc(url)+'">').join('');
    const time = item.start ? [item.start,item.end].filter(Boolean).join('–') : 'Tijd volgt';
    const going = friendsAtSet(key).map(friend => friend.name || 'Vriend');
    return '<button type="button" class="artistSlot'+(photos.length ? ' hasArt' : '')+'" data-set-key="'+esc(key)+'" aria-pressed="'+saved+'" aria-label="'+esc(item.artist+' · '+time+(going.length ? ' · ook '+going.join(', ') : '')+' · Favoriet')+'"><span class="slotArt" aria-hidden="true">'+art+'</span>'+friendBadges(key)+'<span class="slotText"><strong>'+esc(item.artist)+'</strong><small>'+esc(time)+'</small></span><span class="slotHeart" aria-hidden="true">'+(saved?'♥':'♡')+'</span></button>';
  };
  const days = [...new Set(items.map(item => item.day || ''))];
  return days.map(day => {
    const entries = items.filter(item => (item.day || '') === day);
    const timed = timedSets(entries.filter(item => clockMinute(item.start) !== null));
    const pending = entries.filter(item => clockMinute(item.start) === null);
    let timeline = '';
    if (timed.length) {
      const first = Math.floor(timed[0].start / 60) * 60;
      const until = Math.ceil(Math.max(...timed.map(set => set.end)) / 60) * 60;
      const shortest = Math.min(...timed.filter(set => set.item.end).map(set => set.end-set.start));
      const scale = Math.max(4,Math.min(10,100/shortest));
      const offset = t => (t-first)*scale;
      const ticks = [];
      for (let t=first; t<until; t+=60) ticks.push('<span style="left:'+offset(t)+'px">'+String(Math.floor(t/60)%24).padStart(2,'0')+':00</span>');
      const stages = [...new Set(timed.map(set => set.item.stage || 'Programma'))];
      const tracks = stages.map(stage => {
        const ends = [];
        const slots = timed.filter(set => (set.item.stage || 'Programma')===stage).map(set => {
          const width = Math.max(52,(set.end-set.start)*scale);
          const left = offset(set.start);
          let lane = ends.findIndex(end => end <= left);
          if (lane < 0) lane = ends.length;
          ends[lane] = left + width;
          return '<div class="slotPlace" style="left:'+left+'px;width:'+width+'px;top:'+lane*108+'px">'+card(set.item)+'</div>';
        });
        return '<section class="stageTrack"><h4>'+esc(stage)+'</h4><div class="slotLane" style="height:'+ends.length*108+'px">'+slots.join('')+'</div></section>';
      }).join('');
      timeline = '<div class="ttScroll horizontalScroll" tabindex="0" aria-label="Tijdlijn, veeg horizontaal voor latere sets"><div class="timeCanvas" style="width:'+Math.max(offset(until),...timed.map(set=>offset(set.start)+52))+'px;--hour:'+scale*60+'px"><div class="timeAxis">'+ticks.join('')+'</div>'+tracks+'</div></div>';
    }
    const unknown = pending.length ? '<h4>Speeltijd volgt</h4><div class="untimedSlots">'+pending.map(card).join('')+'</div>' : '';
    return (day ? '<h3 class="slotDay">'+esc(dayName(day))+'</h3>' : '') + timeline + unknown;
  }).join('');
}
function stageSchedule(items, selected) {
  const timed = items.filter(item => clockMinute(item.start) !== null);
  const untimed = items.filter(item => clockMinute(item.start) === null);
  const star = item => {
    const key = setKey(selected, item);
    const saved = favoriteSets.includes(key);
    return '<button class="ttStar" data-set-key="'+esc(key)+'" aria-label="Favoriet: '+esc(item.artist)+'" aria-pressed="'+saved+'">'+(saved ? '★' : '☆')+'</button>';
  };
  const groups = [...new Set(timed.map(item => item.day || ''))];
  const boards = groups.map(day => {
    const rows = timed.filter(item => (item.day || '') === day);
    const sets = timedSets(rows);
    const stages = [...new Set(sets.map(set => set.item.stage || 'Programma'))];
    let column = 2;
    const headers = stages.map(stage => {
      const lanes = [];
      const first = column;
      sets.filter(set => (set.item.stage || 'Programma') === stage).forEach(set => {
        let lane = lanes.findIndex(end => end <= set.start);
        if (lane < 0) lane = lanes.length;
        lanes[lane] = set.end;
        set.column = first + lane;
      });
      column += lanes.length;
      return '<b class="ttHead" style="grid-column:'+first+' / span '+lanes.length+';grid-row:1">'+esc(stage)+'</b>';
    }).join('');
    const first = Math.floor(sets[0].start/30)*30;
    const last = Math.ceil(Math.max(...sets.map(set => set.end))/30)*30;
    const ticks = [];
    for (let minute=first; minute<=last; minute+=30) ticks.push(minute);
    const points = [...new Set([...ticks,...sets.flatMap(set => [set.start,set.end])])].sort((a,b) => a-b);
    const row = minute => points.indexOf(minute)+2;
    const tracks = points.slice(1).map((minute,i) => 'minmax('+((minute-points[i])*2.1)+'px,auto)').join(' ');
    const labels = ticks.map(minute => {
      const time = String(Math.floor(minute/60)%24).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
      return '<span class="ttTick" style="grid-row:'+row(minute)+'">'+time+'</span><i class="ttRule" style="grid-row:'+row(minute)+'"></i>';
    }).join('');
    const cards = sets.map(({item,start,end,column}) => '<article class="ttAct" style="grid-column:'+column+';grid-row:'+row(start)+' / '+row(end)+'"><small>'+esc(item.start)+(item.end ? ' – '+esc(item.end) : ' · eindtijd volgt')+'</small>'+artistLink(item)+star(item)+'</article>').join('');
    return (day ? '<h3>'+esc(dayName(day))+'</h3>' : '')+'<div class="ttScroll" tabindex="0" aria-label="Tijdrooster per podium"><div class="ttBoard" style="grid-template-columns:48px repeat('+(column-2)+',minmax(145px,1fr));grid-template-rows:auto '+tracks+' auto"><b class="ttHead ttClock">Tijd</b>'+headers+labels+cards+'</div></div>';
  }).join('');
  const pending = untimed.map(item => '<div class="ttPending"><div>'+artistLink(item)+'<small>'+esc([dayName(item.day),item.stage].filter(Boolean).join(' · '))+'</small></div>'+star(item)+'</div>').join('');
  return boards + (pending ? '<h3>Speeltijd volgt</h3>'+pending : '');
}

let stageFestivalKey = '';
let selectedStage = '';

function renderLineup() {
  const container = $('#lineupList');
  if (!container) return;
  const options = lineupOptions();
  const selected = options.find(f => f.key === selectedLineupKey) ||
    options.find(f => f.date && !festivalHasPassed(f) && f.lineup.some(set => set.start)) ||
    options.find(f => f.date && !festivalHasPassed(f));
  selectedLineupKey = selected?.key || '';
  const manual = $('#lineupManual');
  if (manual) manual.hidden = !selected || selected.isImportedCatalog;
  if (!selected) {
    container.innerHTML = '<div class="card empty-state">Voeg een festival toe of kies een festival uit Ontdek.</div>';
    return;
  }

  const lineup = (selected.lineup || []).slice().sort((a, b) =>
    String(a.day || '').localeCompare(String(b.day || '')) || String(a.start || '').localeCompare(String(b.start || ''))
  );
  const days = [...new Set(lineup.map(item => item.day).filter(Boolean))];
  if (selectedLineupDay !== 'all' && !days.includes(selectedLineupDay)) selectedLineupDay = 'all';
  const dayLineup = selectedLineupDay === 'all' ? lineup : lineup.filter(item => item.day === selectedLineupDay);
  if (stageFestivalKey !== selected.key) {
    stageFestivalKey = selected.key;
    selectedStage = '';
  }
  const stageName = item => String(item.stage || '').trim();
  const stages = [...new Set(dayLineup.map(stageName).filter(Boolean))].sort((a,b) => a.localeCompare(b,'nl'));
  if (!stages.includes(selectedStage)) selectedStage = '';
  const stageLineup = selectedStage ? dayLineup.filter(item => stageName(item) === selectedStage) : dayLineup;
  const searchText = ($('#lineupSearch')?.value || '').trim().toLowerCase();
  const visible = stageLineup.filter(item => !onlyFavoriteSets || favoriteSets.includes(setKey(selected,item))).filter(item => `${item.artist || ''} ${item.stage || ''}`.toLowerCase().includes(searchText));
  const image = selected.imageUrl || '';
  const source = selected.lineupSource
    ? `<a class="source-link" href="${esc(selected.lineupSource)}" target="_blank" rel="noopener noreferrer">Bekijk bron</a>`
    : '';

  container.innerHTML = `
    <div class="card" style="padding:10px">
      <div class="lineup-hero" style="background-image:linear-gradient(0deg,rgba(5,8,12,.95),rgba(5,8,12,.08)),url('${esc(image)}')">
        <div><div class="eyebrow">${selected.isImportedCatalog ? 'Festivaleditie' : 'Jouw festival'}</div>
          <h2>${esc(selected.name)}</h2>
          <p>${esc([selected.date ? fmt(selected.date) : '', selected.location].filter(Boolean).join(' · '))}</p>
        </div>
      </div>
      ${selected.host ? `<p class="muted">Host · ${esc(selected.host)}</p>` : ''}
      <div class="row" style="justify-content:space-between;padding:13px 5px 2px">
        <b>${lineup.length ? lineup.length + ' sets / acts' : 'Timetable'}</b>
        <span class="muted">${lineup.length ? selected.isImportedCatalog ? 'Festivalupdate' : 'Persoonlijke timetable' : 'Nog geen tijden bekend'}</span>
      </div>
    </div>
    ${lineup.length ? '<button class="btn2" data-download-timetable>Bewaar offline</button><div role="status" data-download-status></div>' : ''}
    ${days.length > 1 ? `<div class="lineup-days">
      <button class="day-chip ${selectedLineupDay === 'all' ? 'active' : ''}" data-lineup-day="all">Alle dagen</button>
      ${days.map(day => `<button class="day-chip ${selectedLineupDay === day ? 'active' : ''}" data-lineup-day="${esc(day)}">${esc(dayName(day))}</button>`).join('')}
    </div>` : ''}
    ${stages.length > 1 ? `<fieldset style="border:0;margin:8px 0 16px;padding:0"><legend style="margin-bottom:8px;font-weight:750">Podium</legend><div style="display:flex;flex-wrap:wrap;gap:6px">
      ${['',...stages].map(stage => `<button class="day-chip ${selectedStage === stage ? 'active' : ''}" data-stage-filter="${esc(stage)}" aria-pressed="${selectedStage === stage}">${esc(stage || 'Alle podia')}</button>`).join('')}
    </div></fieldset>` : ''}
    ${lineup.length ? `<button class="day-chip ${onlyFavoriteSets ? "active" : ""}" data-favorites-only aria-pressed="${onlyFavoriteSets}">Mijn favoriete acts</button>` : ""}
    ${lineup.length ? '<div id="planPanel">'+planPanel(selected)+'</div>' : ''}
    ${visible.length ? horizontalSchedule(visible,selected) : '<div class="card empty-state">'+(lineup.length ? 'Geen acts met deze filters.' : 'De timetable is nog niet bekend.')+'</div>'}
    ${visible.length ? '<details class="profileList"><summary>Artiestenprofielen</summary>'+[...new Set(visible.map(a => a.artist))].map(artist => artistLink({artist})).join('')+'</details>' : ''}
    <div style="padding:2px 4px">${mapLink(selected)}${source}</div>
    ${selected.date === '2027-03-27' && /masters of hardcore/i.test(selected.name) ? `<section class="card masters-gallery">
      <h3>Sfeerbeelden · Masters of Hardcore 2026</h3>
      <div>
        <a href="images/festivals/masters-2026-1.webp"><img loading="lazy" src="images/festivals/masters-2026-1.webp" alt="Het publiek voor het goudverlichte podium van Masters of Hardcore"></a>
        <a href="images/festivals/masters-2026-2.webp"><img loading="lazy" src="images/festivals/masters-2026-2.webp" alt="Lichtbundels boven de dansvloer van Masters of Hardcore"></a>
      </div>
    </section>` : ''}
  `;

  const download = container.querySelector('[data-download-timetable]');
  const copyKey = JSON.stringify([selected.key,selected.date]);
  if (download) {
    try {
      if (stored('uptempoOfflineSchedules', {})[copyKey]) download.textContent = 'Offline versie bijwerken';
    } catch {}
  }
  if (download) download.onclick = () => {
    const board = document.createElement('div');
    board.innerHTML = stageSchedule(lineup, selected);
    for (const button of board.querySelectorAll('button')) {
      if (button.hasAttribute('data-set-key')) {
        if (button.getAttribute('aria-pressed') !== 'true') { button.remove(); continue; }
        button.closest('article, .ttPending')?.classList.add('savedSet');
        const star = document.createElement('span');
        star.className = 'setMark';
        star.textContent = '★ Favoriet';
        button.replaceWith(star);
      } else {
        const name = document.createElement('strong');
        name.textContent = button.textContent;
        button.replaceWith(name);
      }
    }
    const meta = [selected.date && fmt(selected.date),selected.location].filter(Boolean).join(' · ');
    const css = `:root{color-scheme:dark;--lime:#c2f66b;--line:#33393c}
*{box-sizing:border-box}body{font:15px/1.45 system-ui,sans-serif;background:#101214;color:#f7f8f5;max-width:76rem;margin:auto;padding:clamp(14px,3vw,32px)}
h1{font-size:clamp(24px,5vw,38px);letter-spacing:-.045em;line-height:1.1;margin:10px 0 4px}h3{margin:22px 0 8px}p{color:#bbc2c1;margin:4px 0}
header{border-top:3px solid var(--lime);padding:12px 0 16px}header small,footer{color:#a9b3ad;font-size:12px}footer{margin:16px 0}
.ttScroll{overflow:auto;max-height:76vh;border:1px solid var(--line);border-radius:12px;background:#131618;margin:10px 0}.ttBoard{display:grid;position:relative;isolation:isolate}
.ttHead,.ttTick{position:sticky;background:#23282a}.ttHead{top:0;padding:10px 6px;border-bottom:1px solid var(--line);font-size:13px;text-align:center;z-index:3}
.ttTick,.ttClock{grid-column:1;left:0}.ttClock{grid-row:1;z-index:4}.ttTick{font:600 11px/1.4 system-ui;font-variant-numeric:tabular-nums;padding:4px;z-index:2;color:#c7cfcb}
.ttRule{grid-column:2/-1;border-top:1px solid var(--line)}.ttAct{z-index:1;min-width:0;border-left:3px solid #788b79;border-radius:6px;background:#292f31;margin:2px;padding:5px 8px;overflow-wrap:anywhere;line-height:1.22}
.ttAct small,.ttPending small{display:block;color:#bcc7c0;font-size:11px;font-variant-numeric:tabular-nums}.ttAct strong,.ttPending strong{font-size:14px;display:block;margin:3px 0}.ttPending{padding:9px 12px;border-bottom:1px solid var(--line)}
.savedSet{background:#263521;border-left:3px solid var(--lime)}.setMark{font-size:11px;color:var(--lime)}`;
    const html = '<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(selected.name)+'</title><style>'+css+'</style><header><small>UPTEMPO · Timetable</small><h1>'+esc(selected.name)+'</h1><p>'+esc(meta)+'</p></header>'+board.innerHTML+'<footer>Opgeslagen op '+new Date().toLocaleString('nl-NL')+'</footer></html>';
    const status = container.querySelector('[data-download-status]');
    try {
      const copies = stored('uptempoOfflineSchedules', {});
      copies[copyKey] = {name:selected.name,meta,html,lineupRevision:selected.lineupRevision};
      localStorage.uptempoOfflineSchedules = JSON.stringify(copies);
      download.textContent = 'Offline versie bijwerken';
      status.textContent = 'Bewaard op dit toestel · Bekijk in Mijn timetables.';
    } catch { status.textContent = 'Opslaan is niet gelukt. Controleer de vrije opslag op je toestel en probeer opnieuw.'; }
  };
  container.querySelectorAll('[data-stage-filter]').forEach(button => {
    button.onclick = () => {
      selectedStage = button.dataset.stageFilter;
      renderLineup();
      [...container.querySelectorAll('[data-stage-filter]')].find(b => b.dataset.stageFilter === selectedStage)?.focus({preventScroll:true});
    };
  });
  container.querySelectorAll('[data-lineup-day]').forEach(button => {
    button.onclick = () => { selectedLineupDay = button.dataset.lineupDay; renderLineup(); };
  });
}

async function addLineupItem() {
  const selected = getSelectedLineup();
  const fest = selected && !selected.isImportedCatalog ? festivals.find(f => f.id === selected.id) : null;
  if (!fest) return toast('Kies eerst een festival uit jouw eigen festivaloverzicht.');

  const artist = $('#lineupArtist').value.trim();
  const stage = $('#lineupStage').value.trim();
  const start = $('#lineupStart').value;
  const end = $('#lineupEnd').value;
  if (!artist) return toast('Vul minimaal een artiest of act in.');

  fest.lineup = fest.lineup || [];
  fest.lineup.push({ id: crypto.randomUUID(), artist, stage, start, end });
  await updateFestival(fest);
  $('#lineupArtist').value = '';
  $('#lineupStage').value = '';
  $('#lineupStart').value = '';
  $('#lineupEnd').value = '';
}

function countdown() {
  if (!$('#cdD')) return;
  const n = nextFest() || datedEditions().find(f => !festivalHasPassed(f));

  if (!n) {
    ['#cdD', '#cdH', '#cdM', '#cdS'].forEach(x => { if ($(x)) $(x).textContent = '00'; });
    return;
  }

  const diff = Math.max(0, new Date(n.date) - new Date());
  const d = Math.floor(diff / 864e5);
  const h = Math.floor(diff / 36e5) % 24;
  const m = Math.floor(diff / 6e4) % 60;
  const s = Math.floor(diff / 1e3) % 60;

  if ($('#cdD')) $('#cdD').textContent = String(d).padStart(2, '0');
  if ($('#cdH')) $('#cdH').textContent = String(h).padStart(2, '0');
  if ($('#cdM')) $('#cdM').textContent = String(m).padStart(2, '0');
  if ($('#cdS')) $('#cdS').textContent = String(s).padStart(2, '0');
}

function switchTab(tab) {
  document.querySelectorAll('.tab,.screen').forEach(x => x.classList.remove('active'));

  const mainTab = document.querySelector(`.tab[data-tab="${tab}"]`);
  (mainTab || $('.tab[data-tab="more"]'))?.classList.add('active');

  const screen = $('#' + tab);
  if (screen) screen.classList.add('active');
  const addButton = $('#openAdd');
  if (addButton) addButton.hidden = tab !== 'festivals' && tab !== 'calendar';
  window.scrollTo(0,0);

  renderAll();
}

function renderAll() {
  render();
  renderCal();
  renderStats();
  renderFriends();
  renderGroupBox();
  renderProfile();
  renderLeaderboard();
  if ($('#lineup.active')) {
    const positions = Array.from(document.querySelectorAll('.ttScroll'), board => [board.scrollLeft, board.scrollTop]);
    const edition = stageFestivalKey;
    renderLineup();
    if (edition === selectedLineupKey) {
      document.querySelectorAll('.ttScroll').forEach((board, i) => {
        if (positions[i]) board.scrollTo(...positions[i]);
      });
    }
  }
  if ($('#festivals.active')) renderOfficialFestivalCatalog();
  if ($('#dashboard.active')) renderHomeFestivalCatalog();
  renderSeason();


  updateFirebaseNotice();
}

window.addEventListener('identity-changed', renderProfile);
if ($('#headerProfile')) $('#headerProfile').onclick = () => switchTab('profile');

if ($('.tabs')) {
  $('.tabs').onclick = e => {
    const b = e.target.closest('.tab');
    if (!b) return;
    switchTab(b.dataset.tab);
  };
}

document.addEventListener('click', e => {
  const tile = e.target.closest('.menuTile');
  if (tile) switchTab(tile.dataset.tab);
});

if ($('#openAdd')) $('#openAdd').onclick = () => $('#modal').classList.add('active');
if ($('#closeModal')) $('#closeModal').onclick = () => $('#modal').classList.remove('active');

if ($('#saveFestival')) {
  $('#saveFestival').onclick = async () => {
    const f = {
      name: $('#fName').value.trim(),
      date: $('#fDate').value,
      location: $('#fLocation').value.trim(),
      genre: $('#fGenre').value,
      notes: $('#fNotes').value.trim()
    };

    if (!f.name || !f.date) return toast('Vul minimaal naam en datum in.');

    await addFestivalLive(f);

    $('#modal').classList.remove('active');
    ['#fName', '#fDate', '#fLocation', '#fNotes'].forEach(s => { if ($(s)) $(s).value = ''; });
  };
}

if ($('#search')) $('#search').oninput = () => { render(); renderOfficialFestivalCatalog(); };
if ($('#lineupSearch')) $('#lineupSearch').oninput = renderLineup;

if ($('#saveProfile')) {
  $('#saveProfile').onclick = async () => {
    profile.name = $('#myName').value.trim();
    save();

    if (db && groupId) await saveProfileLive();

    renderAll();
  };
}

if ($('#addFriend')) {
  $('#addFriend').onclick = async () => {
    const name = $('#friendName').value.trim();
    if (!name) return;

    await addFriendLive(name);
    $('#friendName').value = '';
  };
}

if ($('#addLineup')) $('#addLineup').onclick = addLineupItem;





if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
}

setInterval(countdown, 1000);

renderAll();
initFirebase();



setupGuide({editions:lineupOptions,passed:festivalHasPassed,dateLabel:festivalDateLabel,dayName,
  planned:f=>!f.isImportedCatalog || savedKeys.includes(editionKey({festival:f.name,date:f.date})),
  favorite:(f,a)=>favoriteSets.includes(setKey(f,a)),
  open:f=>f.isImportedCatalog ? window.openOfficialLineup(normalizeFestivalName(f.name)) : window.openFestivalLineup(f.id)
});
$('#guideLaunch').onclick=()=>switchTab('guide');
