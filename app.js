import { firebaseEnabled, firebaseConfig } from './firebase-config.js';

const $ = s => document.querySelector(s);
let festivals = JSON.parse(localStorage.festivals || '[]');
let friends = JSON.parse(localStorage.friends || '[]');
let profile = JSON.parse(localStorage.profile || '{"name":""}');
let groupId = localStorage.groupId || "";
let db = null, uid = null;

async function initFirebase() {
  if (!firebaseEnabled) return;

  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    const { getAuth, signInAnonymously, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
    const { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, serverTimestamp, deleteDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');

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
    $('#firebaseNotice').textContent = 'Firebase kon niet starten. Controleer firebase-config.js.';
    console.error(e);
  }
}

function updateFirebaseNotice() {
  if (!db) {
    $('#firebaseNotice').innerHTML = 'Live database staat klaar. Vul Firebase goed in.';
    return;
  }

  if (!groupId) {
    $('#firebaseNotice').innerHTML = '🟡 Maak of join eerst een groep. Daarna zien alleen mensen met jouw groepscode de planning.';
  } else {
    $('#firebaseNotice').innerHTML = `🟢 Live groep actief: <b>${groupId}</b>`;
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

async function createGroup() {
  if (!db || !uid) return alert('Firebase is nog niet actief.');

  const code = 'UPT-' + Math.floor(1000 + Math.random() * 9000);
  groupId = code;
  save();

  await window.fb.setDoc(window.fb.doc(db, 'groups', groupId), {
    code: groupId,
    createdBy: uid,
    createdAt: window.fb.serverTimestamp()
  });

  if (profile.name) {
    await saveProfileLive();
  }

  liveSync();
  renderGroupBox();
  updateFirebaseNotice();
  alert('Groep aangemaakt: ' + groupId);
}

async function joinGroup() {
  const code = ($('#joinGroupCode').value || '').trim().toUpperCase();

  if (!code) return alert('Vul een groepscode in.');
  if (!db || !uid) return alert('Firebase is nog niet actief.');

  const ref = window.fb.doc(db, 'groups', code);
  const snap = await window.fb.getDoc(ref);

  if (!snap.exists()) {
    return alert('Deze groep bestaat niet.');
  }

  groupId = code;
  save();

  if (profile.name) {
    await saveProfileLive();
  }

  liveSync();
  renderGroupBox();
  updateFirebaseNotice();
  alert('Je zit nu in groep: ' + groupId);
}

function leaveGroup() {
  if (!confirm('Groep verlaten? Je ziet daarna deze planning niet meer.')) return;

  groupId = "";
  festivals = [];
  friends = [];
  save();

  render();
  renderFriends();
  renderGroupBox();
  updateFirebaseNotice();
}

function liveSync() {
  if (!db || !groupId) return;

  const { onSnapshot } = window.fb;

  onSnapshot(groupPath('festivals'), snap => {
    festivals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    save();
    render();
  });

  onSnapshot(groupPath('friends'), snap => {
    friends = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    save();
    renderFriends();
    render();
  });

  if (profile.name) saveProfileLive();
}

async function saveProfileLive() {
  if (!db || !uid || !groupId) return;

  await window.fb.setDoc(
    window.fb.doc(db, 'groups', groupId, 'friends', uid),
    {
      name: profile.name || 'Naamloos',
      online: true,
      uid,
      lastSeen: window.fb.serverTimestamp()
    },
    { merge: true }
  );
}

async function addFestivalLive(f) {
  if (db && groupId) {
    await window.fb.addDoc(groupPath('festivals'), {
      ...f,
      createdAt: window.fb.serverTimestamp(),
      createdBy: uid
    });
  } else if (db && !groupId) {
    alert('Maak of join eerst een groep voordat je festivals toevoegt.');
  } else {
    festivals.push({ ...f, id: crypto.randomUUID() });
    save();
    render();
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
  } else if (db && !groupId) {
    alert('Maak of join eerst een groep.');
  } else {
    friends.push({ id: crypto.randomUUID(), name, online: true });
    save();
    renderFriends();
    render();
  }
}

window.toggleGoing = async id => {

  const fest = festivals.find(f => f.id === id);
  if (!fest) return;

  fest.going = fest.going || [];

  const myName = profile.name || 'Anoniem';

  if (fest.going.includes(myName)) {
    fest.going = fest.going.filter(x => x !== myName);
  } else {
    fest.going.push(myName);
  }

  if (db && groupId) {
    await window.fb.setDoc(
      window.fb.doc(db,'groups',groupId,'festivals',id),
      fest
    );
  }

  save();
  render();
};

function nextFest() {
  return festivals
    .filter(f => new Date(f.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
}

function festivalCard(f) {
  const going = f.going || [];

  return `
    <div class="card">
      <div class="row">
        <div class="thumb"></div>

        <div class="grow">
          <b>${esc(f.name)}</b>
          <div class="muted">
            ${fmt(f.date)} · ${esc(f.location || '')}
          </div>

          <span class="tag ${String(f.genre || '').toLowerCase()}">
            ${esc(f.genre || 'Uptempo')}
          </span>

          <div style="margin-top:10px">
            <button class="btn2" onclick="toggleGoing('${f.id}')">
              🙋 Ik ga
            </button>

            <small style="display:block;margin-top:6px">
              ${going.length} personen gaan
            </small>
          </div>
        </div>

        <button class="btn2" onclick="removeFestival('${f.id}')">
          Wis
        </button>
      </div>
    </div>
  `;
}

function render() {
  let n = nextFest();

  $('#nextName').textContent = n ? n.name : 'Nog niets gepland';
  $('#nextMeta').textContent = n ? `${fmt(n.date)} · ${n.location}` : 'Voeg je eerste festival toe';

  $('#totalFest').textContent = festivals.length;
  $('#doneFest').textContent = festivals.filter(f => new Date(f.date) < new Date()).length;
  $('#friendCount').textContent = friends.length;

  $('#sPlanned').textContent = festivals.length;
  $('#sVisited').textContent = festivals.filter(f => new Date(f.date) < new Date()).length;
  $('#sCities').textContent = new Set(festivals.map(f => f.location).filter(Boolean)).size;

  let up = festivals
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .filter(f => new Date(f.date) >= new Date(new Date().toDateString()));

  $('#upcoming').innerHTML = up.slice(0, 5).map(festivalCard).join('') || '<div class="card muted">Nog geen festivals.</div>';

  let q = ($('#search')?.value || '').toLowerCase();

  $('#festivalList').innerHTML = festivals
    .filter(f => (f.name + f.location + f.genre).toLowerCase().includes(q))
    .map(festivalCard)
    .join('') || '<div class="card muted">Geen festivals gevonden.</div>';

  renderCal();
  renderStats();
  countdown();
}

function renderCal() {
  const now = new Date();
  $('#monthTitle').textContent = now.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });

  let days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let html = '';

  for (let d = 1; d <= days; d++) {
    let date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    let has = festivals.some(f => f.date === date);
    html += `<div class="day">${d}${has ? '<div class="dot"></div>' : ''}</div>`;
  }

  $('#calendarGrid').innerHTML = html;
}

function renderStats() {
  let months = Array(12).fill(0);

  festivals.forEach(f => {
    let d = new Date(f.date);
    if (!isNaN(d)) months[d.getMonth()]++;
  });

  let max = Math.max(1, ...months);

  $('#bars').innerHTML = months
    .map(m => `<div style="height:${8 + (m / max) * 88}px"></div>`)
    .join('');

  let genres = {};

  festivals.forEach(f => {
    genres[f.genre || 'Uptempo'] = (genres[f.genre || 'Uptempo'] || 0) + 1;
  });

  $('#genreStats').innerHTML = Object.entries(genres)
    .map(([g, c]) => `<p>${g}: <b>${c}</b></p>`)
    .join('') || '<p class="muted">Nog geen data.</p>';
}

function renderFriends() {
  $('#myName').value = profile.name || '';

  $('#friendsList').innerHTML = friends
    .map(fr => `
      <div class="card friend">
        <div class="avatar">${esc(fr.name || '?').slice(0, 1)}</div>
        <div class="grow">
          <b>${esc(fr.name || 'Vriend')}</b>
          <div class="online">● Online</div>
        </div>
      </div>
    `)
    .join('') || '<div class="card muted">Nog geen vrienden.</div>';
}

function renderGroupBox() {
  if ($('#groupBox')) $('#groupBox').remove();

  const box = document.createElement('div');
  box.id = 'groupBox';
  box.className = 'card form';

  box.innerHTML = `
    <b>Groep</b>
    <div class="muted">
      ${groupId ? `Jouw groepscode: <b>${groupId}</b>` : 'Maak een groep of join met een code.'}
    </div>
    <button class="btn" id="createGroupBtn">Groep aanmaken</button>
    <input id="joinGroupCode" placeholder="Groepscode, bijvoorbeeld UPT-4829" value="">
    <button class="btn2" id="joinGroupBtn">Groep joinen</button>
    ${groupId ? '<button class="btn2" id="leaveGroupBtn">Groep verlaten</button>' : ''}
  `;

  $('#friends').insertBefore(box, $('#friends').children[2]);

  $('#createGroupBtn').onclick = createGroup;
  $('#joinGroupBtn').onclick = joinGroup;

  if ($('#leaveGroupBtn')) {
    $('#leaveGroupBtn').onclick = leaveGroup;
  }
}

function countdown() {
  let n = nextFest();
  if (!n) return;

  let diff = Math.max(0, new Date(n.date) - new Date());
  let d = Math.floor(diff / 864e5);
  let h = Math.floor(diff / 36e5) % 24;
  let m = Math.floor(diff / 6e4) % 60;
  let s = Math.floor(diff / 1e3) % 60;

  $('#cdD').textContent = String(d).padStart(2, '0');
  $('#cdH').textContent = String(h).padStart(2, '0');
  $('#cdM').textContent = String(m).padStart(2, '0');
  $('#cdS').textContent = String(s).padStart(2, '0');
}

function fmt(d) {
  return d ? new Date(d).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }) : '';
}

function esc(s) {
  return String(s || '').replace(/[&<>"]/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[m]));
}

$('.tabs').onclick = e => {
  let b = e.target.closest('.tab');
  if (!b) return;

  document.querySelectorAll('.tab,.screen').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  $('#' + b.dataset.tab).classList.add('active');
};

$('#openAdd').onclick = () => $('#modal').classList.add('active');
$('#closeModal').onclick = () => $('#modal').classList.remove('active');

$('#saveFestival').onclick = async () => {
  let f = {
    name: $('#fName').value.trim(),
    date: $('#fDate').value,
    location: $('#fLocation').value.trim(),
    genre: $('#fGenre').value,
    notes: $('#fNotes').value.trim()
  };

  if (!f.name || !f.date) {
    return alert('Vul minimaal naam en datum in.');
  }

  await addFestivalLive(f);

  $('#modal').classList.remove('active');

  ['#fName', '#fDate', '#fLocation', '#fNotes'].forEach(s => $(s).value = '');
};

$('#search').oninput = render;

$('#saveProfile').onclick = async () => {
  profile.name = $('#myName').value.trim();
  save();

  if (db && groupId) {
    await saveProfileLive();
  }

  renderFriends();
};

$('#addFriend').onclick = async () => {
  let n = $('#friendName').value.trim();
  if (!n) return;

  await addFriendLive(n);
  $('#friendName').value = '';
};

let installPrompt;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
});

$('#installBtn').onclick = async () => {
  if (installPrompt) {
    installPrompt.prompt();
  } else {
    alert('Op iPhone: tik op Delen en kies Zet op beginscherm.');
  }
};

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
}

setInterval(countdown, 1000);
window.toggleGoing = async function(id) {
  const fest = festivals.find(f => f.id === id);
  if (!fest) {
    alert('Festival niet gevonden.');
    return;
  }

  fest.going = fest.going || [];

  const myName = profile.name || 'Anoniem';

  if (fest.going.includes(myName)) {
    fest.going = fest.going.filter(x => x !== myName);
  } else {
    fest.going.push(myName);
  }

  if (db && groupId) {
    await window.fb.setDoc(
      window.fb.doc(db, 'groups', groupId, 'festivals', id),
      fest,
      { merge: true }
    );
  }

  save();
  render();
};
render();
renderFriends();
renderGroupBox();
initFirebase();
