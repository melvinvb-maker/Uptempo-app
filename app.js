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
        if (groupId) liveSync();
      }
    });
  } catch (e) {
    if ($('#firebaseNotice')) $('#firebaseNotice').textContent = 'Firebase kon niet starten.';
    console.error(e);
  }
}

function save() {
  localStorage.festivals = JSON.stringify(festivals);
  localStorage.friends = JSON.stringify(friends);
  localStorage.profile = JSON.stringify(profile);
  localStorage.groupId = groupId;
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
  renderGroupBox();
  updateFirebaseNotice();
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
  renderGroupBox();
  updateFirebaseNotice();
}

function leaveGroup() {
  if (!confirm('Groep verlaten?')) return;

  if (unsubscribeFestivals) unsubscribeFestivals();
  if (unsubscribeFriends) unsubscribeFriends();

  groupId = "";
  festivals = [];
  friends = [];
  save();
function applyTheme() {
  if (theme.bg) document.documentElement.style.setProperty('--bg', theme.bg);
  if (theme.card) document.documentElement.style.setProperty('--card', theme.card);
  if (theme.accent) document.documentElement.style.setProperty('--pink', theme.accent);
  if (theme.purple) document.documentElement.style.setProperty('--purple', theme.purple);

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
  renderAll();
}

function liveSync() {
  if (!db || !groupId) return;

  if (unsubscribeFestivals) unsubscribeFestivals();
  if (unsubscribeFriends) unsubscribeFriends();

  unsubscribeFestivals = window.fb.onSnapshot(groupPath('festivals'), snap => {
    festivals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
  }

  await updateFestival(fest);
};

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

  return `
    <div class="card">
      <div style="
        width:100%;
        height:150px;
        border-radius:18px;
        margin-bottom:12px;
        background-image:url('${STAGE_PHOTO}');
        background-size:cover;
        background-position:center;">
      </div>

      <div class="row">
        <div class="grow">
          <b>${esc(f.name)}</b>
          <div class="muted">${fmt(f.date)} · ${esc(f.location || '')}</div>
          <span class="tag ${String(f.genre || '').toLowerCase()}">${esc(f.genre || 'Uptempo')}</span>

          <div style="margin-top:12px">
            <button class="btn2" onclick="toggleGoing('${f.id}')">
              ${iAmGoing ? '✅ Ik ga' : '🙋 Ik ga'}
            </button>

            <small style="display:block;margin-top:8px">${going.length} personen gaan</small>

            <div style="margin-top:8px;font-size:12px">
              ${going.length ? going.map(name => `<div>🙋 ${esc(name)}</div>`).join('') : '<div class="muted">Nog niemand gaat</div>'}
            </div>
          </div>
        </div>

        <button class="btn2" onclick="removeFestival('${f.id}')">Wis</button>
      </div>
    </div>
  `;
}

function render() {
  const n = nextFest();

  if ($('#nextName')) $('#nextName').textContent = n ? n.name : 'Nog niets gepland';
  if ($('#nextMeta')) $('#nextMeta').textContent = n ? `${fmt(n.date)} · ${n.location || ''}` : 'Voeg je eerste festival toe';

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
        <div class="rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
        <div class="grow">
          <b>${esc(name)}</b>
          <div class="muted">${score} festivals</div>
        </div>
      </div>
    `).join('') || '<div class="card muted">Nog geen leaderboard data.</div>';
}

function renderLineup() {
  if (!$('#lineupFestival') || !$('#lineupList')) return;

  $('#lineupFestival').innerHTML =
    festivals.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('') ||
    '<option value="">Geen festivals</option>';

  $('#lineupList').innerHTML =
    festivals.map(f => {
      const lineup = f.lineup || [];

      return `
        <div class="card">
          <b>${esc(f.name)}</b>
          <div class="muted">${fmt(f.date)} · ${esc(f.location || '')}</div>

          ${
            lineup.length
              ? lineup
                  .slice()
                  .sort((a, b) => String(a.start).localeCompare(String(b.start)))
                  .map(item => `
                    <div class="lineupItem">
                      <div><b>${esc(item.start || '')}</b><br><span class="muted">${esc(item.end || '')}</span></div>
                      <div>
                        <b>${esc(item.artist)}</b>
                        <div class="muted">${esc(item.stage || 'Stage onbekend')}</div>
                      </div>
                    </div>
                  `).join('')
              : '<p class="muted">Nog geen line-up toegevoegd.</p>'
          }
        </div>
      `;
    }).join('');
}

async function addLineupItem() {
  const festivalId = $('#lineupFestival')?.value;
  const fest = festivals.find(f => f.id === festivalId);

  if (!fest) return alert('Kies eerst een festival.');

  const artist = $('#lineupArtist').value.trim();
  const stage = $('#lineupStage').value.trim();
  const start = $('#lineupStart').value;
  const end = $('#lineupEnd').value;

  if (!artist || !start) return alert('Vul minimaal artiest en starttijd in.');

  fest.lineup = fest.lineup || [];
  fest.lineup.push({
    id: crypto.randomUUID(),
    artist,
    stage,
    start,
    end
  });

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
  updateFirebaseNotice();
}

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

renderAll();
initFirebase();
