import { firebaseEnabled, firebaseConfig } from './firebase-config.js';

const STAGE_PHOTO = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80";
const $ = s => document.querySelector(s);

let festivals = JSON.parse(localStorage.festivals || '[]');
let friends = JSON.parse(localStorage.friends || '[]');
let profile = JSON.parse(localStorage.profile || '{"name":""}');
let groupId = localStorage.groupId || "";
let calendarDate = new Date();
let theme = JSON.parse(localStorage.theme || '{}');

let db = null;
let uid = null;
let unsubscribeFestivals = null;
let unsubscribeFriends = null;
let unsubscribeFestivalLineups = null;
let festivalLineupUpdates = [];
let selectedLineupKey = '';
let selectedLineupDay = 'all';

function save() {
  localStorage.festivals = JSON.stringify(festivals);
  localStorage.friends = JSON.stringify(friends);
  localStorage.profile = JSON.stringify(profile);
  localStorage.groupId = groupId;
}

function applyTheme() {
  if (theme.bg) document.documentElement.style.setProperty('--bg', theme.bg);
  if (theme.card) document.documentElement.style.setProperty('--card', theme.card);
  if (theme.accent) document.documentElement.style.setProperty('--pink', theme.accent);
  if (theme.purple) document.documentElement.style.setProperty('--purple', theme.purple);

  if (theme.card) {
    document.querySelectorAll('.card,.stat,.sheet').forEach(el => {
      el.style.background = theme.card;
    });
  }

  if (theme.bg) {
    document.body.style.background =
      `radial-gradient(circle at 20% 0%, ${theme.purple || '#30105c'} 0, ${theme.bg} 35%, #05050b 100%)`;
  }
}

function renderTheme() {
  if (!$('#themeBg')) return;
  $('#themeBg').value = theme.bg || '#090913';
  $('#themeCard').value = theme.card || '#151522';
  $('#themeAccent').value = theme.accent || '#ff2fb3';
  $('#themePurple').value = theme.purple || '#8b35ff';
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

    await signInAnonymously(auth);

    onAuthStateChanged(auth, user => {
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

async function createGroup() {
  if (!db || !uid) return alert('Firebase is nog niet actief.');

  groupId = 'UPT-' + Math.floor(1000 + Math.random() * 9000);
  save();

  await window.fb.setDoc(window.fb.doc(db, 'groups', groupId), {
    code: groupId,
    createdBy: uid,
    createdAt: window.fb.serverTimestamp()
  });

  if (profile.name) await saveProfileLive();

  liveSync();
  renderAll();
  alert('Groep aangemaakt: ' + groupId);
}

async function joinGroup() {
  const code = ($('#joinGroupCode')?.value || '').trim().toUpperCase();
  if (!code) return alert('Vul een groepscode in.');
  if (!db || !uid) return alert('Firebase is nog niet actief.');

  const snap = await window.fb.getDoc(window.fb.doc(db, 'groups', code));
  if (!snap.exists()) return alert('Deze groep bestaat niet.');

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

function watchFestivalLineups() {
  if (!db || !uid) return;
  if (unsubscribeFestivalLineups) unsubscribeFestivalLineups();

  unsubscribeFestivalLineups = window.fb.onSnapshot(
    window.fb.collection(db, 'festivalLineups'),
    snap => {
      festivalLineupUpdates = snap.docs.map(d => d.data());
      applyFestivalLineupUpdates();
      save();
      renderAll();
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
      .filter(item => !importedSources.has(item.source));
    const importedItems = update.lineup || [];

    return {
      ...festival,
      lineup: [...manualItems, ...importedItems],
      lineupSource: update.lineupSource || '',
      lineupUpdatedAt: update.lineupUpdatedAt || null,
      imageUrl: update.imageUrl || festival.imageUrl || ''
    };
  });
}

function normalizeFestivalName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

async function saveProfileLive() {
  if (!db || !uid || !groupId) return;

  await window.fb.setDoc(
    window.fb.doc(db, 'groups', groupId, 'friends', uid),
    {
      name: profile.name || 'Naamloos',
      uid,
      online: true,
      lastSeen: window.fb.serverTimestamp()
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
    alert('Maak of join eerst een groep.');
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
        online: true,
        addedBy: uid,
        lastSeen: window.fb.serverTimestamp()
      }
    );
  } else {
    friends.push({ id: crypto.randomUUID(), name, online: true });
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
  calendarDate.setMonth(calendarDate.getMonth() + amount);
  renderCal();
};

function nextFest() {
  return festivals
    .filter(f => new Date(f.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
}

function festivalCard(f) {
  const going = f.going || [];
  const myName = profile.name || 'Anoniem';
  const iAmGoing = going.includes(myName);
  const image = f.imageUrl || STAGE_PHOTO;

  return `
    <article class="card">
      <div class="festival-cover" style="background-image:linear-gradient(0deg,rgba(7,10,14,.72),transparent 68%),url('${esc(image)}')"></div>
      <div class="row" style="align-items:flex-start">
        <div class="grow">
          <b style="font-size:17px">${esc(f.name)}</b>
          <div class="muted">${fmt(f.date)} · ${esc(f.location || '')}</div>
          <span class="tag ${String(f.genre || '').toLowerCase()}">${esc(f.genre || 'Uptempo')}</span>
        </div>
        <button class="btn2" onclick="removeFestival('${f.id}')" aria-label="Festival verwijderen">Wis</button>
      </div>
      <div class="row" style="justify-content:space-between;margin-top:14px;flex-wrap:wrap">
        <button class="btn2" onclick="toggleGoing('${f.id}')">${iAmGoing ? 'Je gaat ✓' : 'Ik ga'}</button>
        <button class="btn2" onclick="openFestivalLineup('${f.id}')">♫ Timetable</button>
        <span class="muted">${going.length} gaan</span>
      </div>
      ${going.length ? `<div class="muted" style="margin-top:10px">${going.map(esc).join(' · ')}</div>` : ''}
    </article>
  `;
}

function render() {
  const n = nextFest();

  if ($('#nextName')) $('#nextName').textContent = n ? n.name : 'Nog niets gepland';
  if ($('#nextMeta')) $('#nextMeta').textContent = n ? `${fmt(n.date)} · ${n.location || ''}` : 'Voeg je eerste festival toe';
  if ($('#heroAction')) {
    $('#heroAction').textContent = n ? 'Bekijk mijn festivals' : 'Festival toevoegen';
    $('#heroAction').onclick = () => n ? switchTab('festivals') : $('#modal').classList.add('active');
  }

  if ($('#totalFest')) $('#totalFest').textContent = festivals.length;
  if ($('#doneFest')) $('#doneFest').textContent = festivals.filter(f => new Date(f.date) < new Date()).length;
  if ($('#friendCount')) $('#friendCount').textContent = friends.length;

  if ($('#sPlanned')) $('#sPlanned').textContent = festivals.length;
  if ($('#sVisited')) $('#sVisited').textContent = festivals.filter(f => new Date(f.date) < new Date()).length;
  if ($('#sCities')) $('#sCities').textContent = new Set(festivals.map(f => f.location).filter(Boolean)).size;

  const upcoming = festivals
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .filter(f => new Date(f.date) >= new Date(new Date().toDateString()));

  if ($('#upcoming')) {
    $('#upcoming').innerHTML = upcoming.map(festivalCard).join('') || '<div class="card muted">Nog geen festivals.</div>';
  }

  const q = ($('#search')?.value || '').toLowerCase();

  if ($('#festivalList')) {
    $('#festivalList').innerHTML =
      festivals
        .filter(f => (f.name + f.location + f.genre).toLowerCase().includes(q))
        .map(festivalCard)
        .join('') || '<div class="card muted">Geen festivals gevonden.</div>';
  }

  countdown();
}


function renderOfficialFestivalCatalog() {
  const container = $('#officialFestivalCatalog');
  if (!container) return;

  const catalog = festivalLineupUpdates
    .filter(update => update.officialCatalog)
    .slice()
    .sort((a, b) => String(a.festival || '').localeCompare(String(b.festival || '')));

  container.innerHTML = catalog.map(update => {
    const lineupCount = (update.lineup || []).length;
    const edition = update.date
      ? fmt(update.date)
      : update.lineupEditionYear
        ? `Editie ${update.lineupEditionYear}`
        : 'Editie nog niet bevestigd';
    const poster = update.imageUrl
      ? `<div style="height:150px;border-radius:16px;margin-bottom:12px;background:linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.38)),url('${esc(update.imageUrl)}') center/cover"></div>`
      : `<div style="height:150px;border-radius:16px;margin-bottom:12px;background:linear-gradient(135deg,#28164a,#101a35);display:grid;place-items:center;font-size:42px">U</div>`;

    return `
      <div class="card">
        ${poster}
        <div class="row" style="justify-content:space-between">
          <div class="grow">
            <b>${esc(update.festival || 'Festival')}</b>
            <div class="muted">${esc(edition)}${update.location ? ` · ${esc(update.location)}` : ''}</div>
          </div>
          <span class="tag">Uptempo</span>
        </div>
        <div class="muted" style="margin:10px 0 12px">
          ${lineupCount ? `${lineupCount} acts in de festivalinformatie` : 'Er is nog geen timetable beschikbaar.'}
        </div>
        <button class="btn2" onclick="openOfficialLineup('${normalizeFestivalName(update.festival)}')">Bekijk timetable</button>
      </div>
    `;
  }).join('') || '<div class="card muted">De officiële festivalcatalogus wordt geladen.</div>';
}

function lineupOptions() {
  const personal = festivals.map(f => ({
    key: 'personal:' + f.id, id: f.id, name: f.name, date: f.date || '',
    location: f.location || '', imageUrl: f.imageUrl || '', lineup: f.lineup || [],
    lineupSource: f.lineupSource || '', isImportedCatalog: false
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
      name: update.festival || 'Festival', date: update.date || '',
      location: update.location || (update.lineupEditionYear ? 'Editie ' + update.lineupEditionYear : ''),
      lineup: update.lineup || [], imageUrl: update.imageUrl || '',
      lineupSource: update.lineupSource || '', isImportedCatalog: true
    }));
  return [...personal, ...catalog];
}

function getSelectedLineup() {
  return lineupOptions().find(f => f.key === selectedLineupKey) || null;
}

function dayName(value) {
  const names = { friday: 'Vrijdag', saturday: 'Zaterdag', sunday: 'Zondag', monday: 'Maandag', tuesday: 'Dinsdag', wednesday: 'Woensdag', thursday: 'Donderdag' };
  return names[String(value || '').toLowerCase()] || value;
}

window.openOfficialLineup = slug => {
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
  selectedLineupKey = 'personal:' + id;
  selectedLineupDay = 'all';
  switchTab('lineup');
};

function renderHomeFestivalCatalog() {
  const container = $('#homeFestivalCatalog');
  if (!container) return;

  const catalog = festivalLineupUpdates
    .filter(update => update.officialCatalog)
    .slice()
    .sort((a, b) => String(a.festival || '').localeCompare(String(b.festival || '')));

  container.innerHTML = catalog.map(update => {
    const edition = update.date
      ? fmt(update.date)
      : update.lineupEditionYear
        ? `Editie ${update.lineupEditionYear}`
        : 'Editie volgt';
    const poster = update.imageUrl
      ? `linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.35)),url('${esc(update.imageUrl)}')`
      : 'linear-gradient(135deg,#28164a,#101a35)';

    return `
      <article class="card homeFestivalCard">
        <div class="homeFestivalPoster" style="background-image:${poster}"></div>
        <div class="homeFestivalCardBody">
          <b>${esc(update.festival || 'Festival')}</b>
          <span class="muted">${esc(edition)}${update.location ? ` · ${esc(update.location)}` : ''}</span>
          <button class="btn2" onclick="openOfficialLineup('${normalizeFestivalName(update.festival)}')">Timetable bekijken</button>
        </div>
      </article>
    `;
  }).join('') || '<div class="card muted">Festivalupdates worden geladen.</div>';
}

function renderCal() {
  if (!$('#monthTitle') || !$('#calendarGrid')) return;

  const now = calendarDate;

  $('#monthTitle').innerHTML = `
    <div class="row" style="justify-content:space-between">
      <button class="btn2" onclick="changeMonth(-1)">‹</button>
      <span>${now.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}</span>
      <button class="btn2" onclick="changeMonth(1)">›</button>
    </div>
  `;

  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let html = '';

  for (let d = 1; d <= days; d++) {
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayFestivals = festivals.filter(f => f.date === date);

    html += `
      <div class="day">
        <b>${d}</b>
        ${dayFestivals.map(f => `
          <div style="margin-top:5px;padding:3px 5px;border-radius:8px;background:rgba(255,47,179,.25);font-size:10px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
            ${esc(f.name)}
          </div>
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
          <div class="online">● Online</div>
        </div>
      </div>
    `).join('') || '<div class="card muted">Nog geen vrienden.</div>';
}

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
    <input id="joinGroupCode" placeholder="Groepscode, bijvoorbeeld UPT-4829">
    <button class="btn2" id="joinGroupBtn">Groep joinen</button>
    ${groupId ? '<button class="btn2" id="leaveGroupBtn">Groep verlaten</button>' : ''}
  `;

  $('#friends').insertBefore(box, $('#friends').children[2] || null);

  $('#createGroupBtn').onclick = createGroup;
  $('#joinGroupBtn').onclick = joinGroup;
  if ($('#leaveGroupBtn')) $('#leaveGroupBtn').onclick = leaveGroup;
}

function renderProfile() {
  const name = profile.name || 'Naamloos';
  const goingCount = festivals.filter(f => (f.going || []).includes(name)).length;

  if ($('#profileName')) $('#profileName').textContent = name;
  if ($('#profileAvatar')) $('#profileAvatar').textContent = name.slice(0, 1).toUpperCase();
  if ($('#headerAvatar')) $('#headerAvatar').textContent = name.slice(0, 1).toUpperCase();
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
    `).join('') || '<div class="card muted">Nog geen leaderboard data.</div>';
}

function renderLineup() {
  const picker = $('#lineupFestival');
  const container = $('#lineupList');
  if (!picker || !container) return;

  const options = lineupOptions();
  if (!options.some(f => f.key === selectedLineupKey)) selectedLineupKey = options[0]?.key || '';
  picker.innerHTML = options.map(f => `<option value="${esc(f.key)}">${esc(f.name)}${f.date ? ' · ' + esc(fmt(f.date)) : ''}</option>`).join('')
    || '<option value="">Geen festivals beschikbaar</option>';
  picker.value = selectedLineupKey;
  picker.onchange = () => { selectedLineupKey = picker.value; selectedLineupDay = 'all'; renderLineup(); };

  const selected = getSelectedLineup();
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
  const visible = selectedLineupDay === 'all' ? lineup : lineup.filter(item => item.day === selectedLineupDay);
  const image = selected.imageUrl || STAGE_PHOTO;
  const source = selected.lineupSource
    ? `<a class="source-link" href="${esc(selected.lineupSource)}" target="_blank" rel="noopener noreferrer">Bekijk bron ↗</a>`
    : '';

  container.innerHTML = `
    <div class="card" style="padding:10px">
      <div class="lineup-hero" style="background-image:linear-gradient(0deg,rgba(5,8,12,.95),rgba(5,8,12,.08)),url('${esc(image)}')">
        <div><div class="eyebrow">${selected.isImportedCatalog ? 'Festivaleditie' : 'Jouw festival'}</div>
          <h2>${esc(selected.name)}</h2>
          <p>${esc([selected.date ? fmt(selected.date) : '', selected.location].filter(Boolean).join(' · '))}</p>
        </div>
      </div>
      <div class="row" style="justify-content:space-between;padding:13px 5px 2px">
        <b>${lineup.length ? lineup.length + ' sets / acts' : 'Timetable'}</b>
        <span class="muted">${lineup.length ? selected.isImportedCatalog ? 'Festivalupdate' : 'Persoonlijke timetable' : 'Nog geen tijden bekend'}</span>
      </div>
    </div>
    ${days.length ? `<div class="lineup-days">
      <button class="day-chip ${selectedLineupDay === 'all' ? 'active' : ''}" data-lineup-day="all">Alle dagen</button>
      ${days.map(day => `<button class="day-chip ${selectedLineupDay === day ? 'active' : ''}" data-lineup-day="${esc(day)}">${esc(dayName(day))}</button>`).join('')}
    </div>` : ''}
    <div class="card set-list">
      ${visible.length ? visible.map(item => `
        <div class="set-row">
          <div class="set-time">${esc(item.start || dayName(item.day) || 'Tijd volgt')}${item.end ? '<br><span class="muted">tot ' + esc(item.end) + '</span>' : ''}</div>
          <div><div class="set-artist">${esc(item.artist || 'Artiest')}</div>${item.stage ? `<div class="set-stage">${esc(item.stage)}</div>` : ''}</div>
        </div>`).join('') : '<div class="empty-state">De timetable is nog niet bekend. Zodra tijden beschikbaar zijn, verschijnen ze hier.</div>'}
    </div>
    <div style="padding:2px 4px">${source}</div>
  `;

  container.querySelectorAll('[data-lineup-day]').forEach(button => {
    button.onclick = () => { selectedLineupDay = button.dataset.lineupDay; renderLineup(); };
  });
}

async function addLineupItem() {
  const selected = getSelectedLineup();
  const fest = selected && !selected.isImportedCatalog ? festivals.find(f => f.id === selected.id) : null;
  if (!fest) return alert('Kies eerst een festival uit jouw eigen festivaloverzicht.');

  const artist = $('#lineupArtist').value.trim();
  const stage = $('#lineupStage').value.trim();
  const start = $('#lineupStart').value;
  const end = $('#lineupEnd').value;
  if (!artist) return alert('Vul minimaal een artiest of act in.');

  fest.lineup = fest.lineup || [];
  fest.lineup.push({ id: crypto.randomUUID(), artist, stage, start, end });
  await updateFestival(fest);
  $('#lineupArtist').value = '';
  $('#lineupStage').value = '';
  $('#lineupStart').value = '';
  $('#lineupEnd').value = '';
}

function countdown() {
  const n = nextFest();

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

function fmt(d) {
  return d ? new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

function esc(s) {
  return String(s || '').replace(/[&<>"]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m]));
}

function switchTab(tab) {
  document.querySelectorAll('.tab,.screen').forEach(x => x.classList.remove('active'));

  const mainTab = document.querySelector(`.tab[data-tab="${tab}"]`);
  if (mainTab) mainTab.classList.add('active');

  const screen = $('#' + tab);
  if (screen) screen.classList.add('active');
  const addButton = $('#openAdd');
  if (addButton) addButton.hidden = ['lineup', 'friends', 'more', 'profile', 'leaderboard', 'stats', 'theme'].includes(tab);

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
  renderLineup();
  renderOfficialFestivalCatalog();
  renderHomeFestivalCatalog();
  renderTheme();
  applyTheme();
  updateFirebaseNotice();
}

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

    if (!f.name || !f.date) return alert('Vul minimaal naam en datum in.');

    await addFestivalLive(f);

    $('#modal').classList.remove('active');
    ['#fName', '#fDate', '#fLocation', '#fNotes'].forEach(s => { if ($(s)) $(s).value = ''; });
  };
}

if ($('#search')) $('#search').oninput = render;

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

if ($('#saveTheme')) {
  $('#saveTheme').onclick = () => {
    theme = {
      bg: $('#themeBg').value,
      card: $('#themeCard').value,
      accent: $('#themeAccent').value,
      purple: $('#themePurple').value
    };

    localStorage.theme = JSON.stringify(theme);
    applyTheme();
    alert('Thema opgeslagen.');
  };
}

if ($('#resetTheme')) {
  $('#resetTheme').onclick = () => {
    localStorage.removeItem('theme');
    theme = {};
    location.reload();
  };
}

let lastTouchEnd = 0;

document.addEventListener('touchend', function(event) {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) event.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
}

setInterval(countdown, 1000);

applyTheme();
renderAll();
initFirebase();
