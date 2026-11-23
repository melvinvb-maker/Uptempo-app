
import * as authApi from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {collection,doc,setDoc,updateDoc,deleteDoc,addDoc,query,where,onSnapshot,orderBy,limitToLast,serverTimestamp} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

export function setupAccount(auth, db) {
  const el = id => document.getElementById(id);
  const status = message => { el('socialStatus').textContent = message; };
  const button = (label, action) => {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'btn2';
    control.textContent = label;
    control.onclick = () => run(action);
    return control;
  };
  async function run(action) {
    try { await action(); }
    catch (error) {
      const messages = {'auth/operation-not-allowed':'Inloggen met e-mail moet nog worden geactiveerd.', 'auth/invalid-email':'Controleer je e-mailadres.', 'auth/email-already-in-use':'Dit e-mailadres heeft al een account.', 'auth/invalid-credential':'Controleer je e-mailadres en wachtwoord.', 'auth/weak-password':'Kies een sterker wachtwoord.', 'permission-denied':'De toegang tot vrienden en berichten is nog niet beschikbaar.'};
      status(messages[error.code] || 'Actie mislukt. Controleer je verbinding en probeer opnieuw.');
    }
  }
  let stopRooms, stopChat, activeRoom;
  function closeChat() { stopChat?.(); activeRoom = null; el('conversation').hidden = true; el('messages').replaceChildren(); el('messageText').value = ''; }
  function openChat(room, peer) {
    closeChat();
    activeRoom = room;
    el('conversation').hidden = false;
    el('chatTitle').textContent = peer;
    stopChat = onSnapshot(query(collection(room,'messages'),orderBy('at'),limitToLast(100)), snap => {
      el('messages').replaceChildren(...snap.docs.map(row => {
        const message = row.data(), p = document.createElement('p');
        const time = message.at?.toDate()?.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'}) || '';
        p.className = 'bubble' + (message.from === auth.currentUser?.uid ? ' own' : '');
        p.textContent = message.text;
        const small = document.createElement('small'); small.textContent = time; p.append(small);
        return p;
      }));
      el('messages').scrollTop = el('messages').scrollHeight;
    }, () => { closeChat(); status('Gesprek niet toegankelijk.'); });
  }
  el('accountForm').onsubmit = event => {
    event.preventDefault();
    run(async () => {
      const email = el('accountEmail').value.trim(), password = el('accountPassword').value;
      if (event.submitter?.value === 'register') {
        if (password.length < 8) return status('Kies een wachtwoord met minimaal acht tekens.');
        const user = auth.currentUser;
        if (user?.isAnonymous) await authApi.linkWithCredential(user,authApi.EmailAuthProvider.credential(email,password));
        else await authApi.createUserWithEmailAndPassword(auth,email,password);
      } else await authApi.signInWithEmailAndPassword(auth,email,password);
      await auth.currentUser.getIdToken(true);
      el('accountPassword').value = '';
      show(auth.currentUser);
    });
  };
  el('resetPassword').onclick = () => run(async () => {
    await authApi.sendPasswordResetEmail(auth,el('accountEmail').value.trim());
    status('Als dit adres een account heeft, ontvang je een herstellink.');
  });
  el('logout').onclick = () => run(async () => { await authApi.signOut(auth); await authApi.signInAnonymously(auth); });
  el('inviteForm').onsubmit = event => {
    event.preventDefault();
    run(async () => {
      const user = auth.currentUser, peer = el('friendCode').value.trim();
      if (!user || user.isAnonymous || !/^[a-zA-Z0-9_-]{10,128}$/.test(peer) || peer === user.uid) return status('Vul de vriendencode van iemand anders in.');
      const members = [user.uid,peer].sort(), room = doc(db,'uptempoChats',members.join(':'));
      // Creating a second request never overwrites an existing conversation.
      await setDoc(room,{members,from:user.uid,state:'pending',label:el('socialName').value.trim() || 'Festivalvriend'});
      el('friendCode').value = ''; status('Vriendschapsverzoek verstuurd.');
    });
  };
  el('sendMessage').onsubmit = event => {
    event.preventDefault();
    run(async () => {
      const text = el('messageText').value.trim(), room = activeRoom;
      if (!room || !text) return;
      await addDoc(collection(room,'messages'),{from:auth.currentUser.uid,text,at:serverTimestamp()});
      if (room === activeRoom && el('messageText').value.trim() === text) el('messageText').value = '';
    });
  };
  const copyCode = button('Kopieer vriendencode',async () => {
    await navigator.clipboard.writeText(el('myFriendCode').value);
    status('Vriendencode gekopieerd.');
  });
  el('myFriendCode').after(copyCode);
  el('closeChat').onclick = closeChat;
  function show(user) {
    stopRooms?.(); closeChat(); el('connections').replaceChildren();
    const signed = user && !user.isAnonymous;
    el('accountForm').hidden = !!signed; el('memberTools').hidden = !signed;
    status(signed ? 'Ingelogd als '+user.email : 'Log in om vrienden toe te voegen en berichten te sturen.');
    if (!signed) return;

    el("chatGate").hidden = true; el("chatTools").hidden = false;
    el('myFriendCode').value = user.uid;
    el('connections').textContent = 'Je vrienden worden geladen…';
    stopRooms = onSnapshot(query(collection(db,'uptempoChats'),where('members','array-contains',user.uid)), snap => {
      if (activeRoom && !snap.docs.some(d => d.id === activeRoom.id && d.data().state === 'accepted')) closeChat();
      const rows = snap.docs.map(d => {
        const room = d.data(), outgoing = room.from === user.uid;
        const peer = outgoing ? room.replyLabel || 'Festivalvriend' : room.label;
        const row = document.createElement('div'); row.className = 'seasonRow';
        const name = document.createElement('b'); name.textContent = peer; row.append(name);
        if (room.state === 'accepted') row.append(button('Open chat',() => openChat(d.ref,peer)));
        else if (outgoing) row.append('Verzoek verstuurd',button('Intrekken',() => deleteDoc(d.ref)));
        else row.append(button('Accepteren',() => updateDoc(d.ref,{state:'accepted',replyLabel:el('socialName').value.trim() || 'Festivalvriend'})),button('Weigeren',() => deleteDoc(d.ref)));
        return row;
      });
      el('connections').replaceChildren(...rows);
      if (!rows.length) el('connections').textContent = 'Deel je vriendencode om je eerste gesprek te starten.';
    }, () => { el('connections').textContent = 'Vrienden en berichten zijn nog niet beschikbaar.'; });
  }
  authApi.onAuthStateChanged(auth,show);
}
