// Tests firestore.rules against the Firestore emulator: what the app needs must work,
// and what a stranger tries must fail.
// Run: cd tests && npx firebase emulators:exec --only firestore --project demo-uptempo "node rules.test.mjs"
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-uptempo',
  firestore: { rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8') }
});

const anna = env.authenticatedContext('anna', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const tom = env.authenticatedContext('tom', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const eve = env.authenticatedContext('eve', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const owner = env.authenticatedContext('owner', { uptempoOwner: true, firebase: { sign_in_provider: 'password' } }).firestore();
const nobody = env.unauthenticatedContext().firestore();
const code = 'UPT-K7Q9-X2MF';

let failures = 0;
async function check(label, attempt, expectAllowed) {
  try {
    await (expectAllowed ? assertSucceeds(attempt) : assertFails(attempt));
    console.log('  ok   ' + label);
  } catch (error) {
    failures++;
    console.log('  FAIL ' + label + ' — ' + String(error.message || error).split('\n')[0]);
  }
}
const allowed = (label, attempt) => check(label, attempt, true);
const denied = (label, attempt) => check(label, attempt, false);

await env.withSecurityRulesDisabled(async context => {
  await setDoc(doc(context.firestore(), 'festivalLineups', 'loudness'), { festival: 'Loudness', lineup: [] });
});

console.log('Creating and joining a group (what the app does)');
await allowed('Anna creates a group with a valid code', setDoc(doc(anna, 'groups', code), { code, createdBy: 'anna', createdAt: serverTimestamp() }));
await allowed('Anna writes her own membership', setDoc(doc(anna, 'groups', code, 'friends', 'anna'), { name: 'Anna', uid: 'anna', activeAt: Date.now(), lastSeen: serverTimestamp(), favorites: ['set-1'] }, { merge: true }));
await allowed('Anna reads her group members', getDocs(collection(anna, 'groups', code, 'friends')));
await allowed('Anna adds a festival to her group', setDoc(doc(anna, 'groups', code, 'festivals', 'f1'), { name: 'Loudness', going: [], lineup: [] }));
await allowed('Tom checks that the group code exists', getDoc(doc(tom, 'groups', code)));
await allowed('Tom joins by writing his own membership (no name yet)', setDoc(doc(tom, 'groups', code, 'friends', 'tom'), { name: 'Naamloos', uid: 'tom', activeAt: Date.now(), lastSeen: serverTimestamp(), favorites: [] }, { merge: true }));
await allowed('Tom then reads the group festivals', getDocs(collection(tom, 'groups', code, 'festivals')));
await allowed('Tom marks "Ik ga" on a festival', updateDoc(doc(tom, 'groups', code, 'festivals', 'f1'), { going: ['Tom'] }));
await allowed('Tom shares his favourite sets', setDoc(doc(tom, 'groups', code, 'friends', 'tom'), { favorites: ['set-1', 'set-2'] }, { merge: true }));
await allowed('Tom adds a friend without the app', setDoc(doc(tom, 'groups', code, 'friends', 'sanne-id'), { name: 'Sanne', addedBy: 'tom', lastSeen: serverTimestamp() }));
await allowed('Tom removes the friend he added', deleteDoc(doc(tom, 'groups', code, 'friends', 'sanne-id')));
await allowed('The app reads the festival catalogue', getDoc(doc(anna, 'festivalLineups', 'loudness')));
await allowed('The owner publishes a correction', setDoc(doc(owner, 'editionOverrides', 'loudness'), { festival: 'Loudness' }));

console.log('What a stranger tries');
await denied('Not signed in: read a group', getDoc(doc(nobody, 'groups', code)));
await denied('Not signed in: read the catalogue', getDoc(doc(nobody, 'festivalLineups', 'loudness')));
await denied('Eve lists every group to harvest codes', getDocs(collection(eve, 'groups')));
await denied('Eve reads members of a group she is not in', getDocs(collection(eve, 'groups', code, 'friends')));
await denied('Eve reads festivals of a group she is not in', getDocs(collection(eve, 'groups', code, 'festivals')));
await denied('Eve adds a festival to that group', addDoc(collection(eve, 'groups', code, 'festivals'), { name: 'Spam' }));
await denied('Eve deletes the group', deleteDoc(doc(eve, 'groups', code)));
await denied('Eve overwrites the group', setDoc(doc(eve, 'groups', code), { code, createdBy: 'eve' }));
await denied('Eve writes into Anna\'s membership', setDoc(doc(eve, 'groups', code, 'friends', 'anna'), { name: 'Hacked' }, { merge: true }));
await denied('Eve creates a group with an invalid code', setDoc(doc(eve, 'groups', 'hack'), { code: 'hack', createdBy: 'eve' }));
await denied('Eve creates a group in someone else\'s name', setDoc(doc(eve, 'groups', 'UPT-AAAA-BBBB'), { code: 'UPT-AAAA-BBBB', createdBy: 'anna' }));
await denied('Eve changes the festival catalogue', setDoc(doc(eve, 'festivalLineups', 'loudness'), { festival: 'Hacked' }));
await denied('Eve publishes a correction without the owner role', setDoc(doc(eve, 'editionOverrides', 'loudness'), { festival: 'Hacked' }));
await denied('Eve writes to an unknown collection', setDoc(doc(eve, 'anything', 'x'), { a: 1 }));
await denied('Eve reads Anna\'s private profile', getDoc(doc(eve, 'memberProfiles', 'anna')));

console.log('Members stay within limits');
await denied('Tom changes Anna\'s membership', setDoc(doc(tom, 'groups', code, 'friends', 'anna'), { name: 'Not Anna' }, { merge: true }));
await denied('Tom adds an unknown field to his membership', setDoc(doc(tom, 'groups', code, 'friends', 'tom'), { admin: true }, { merge: true }));
await denied('Tom shares more than 400 favourites', setDoc(doc(tom, 'groups', code, 'friends', 'tom'), { favorites: Array.from({ length: 401 }, (_, i) => 's' + i) }, { merge: true }));
await denied('Tom adds a friend posing as another account', setDoc(doc(tom, 'groups', code, 'friends', 'fake'), { name: 'X', uid: 'anna', addedBy: 'tom' }));
await allowed('Anna adds a friend without the app', setDoc(doc(anna, 'groups', code, 'friends', 'lisa-id'), { name: 'Lisa', addedBy: 'anna' }));
await denied('Tom deletes a friend Anna added', deleteDoc(doc(tom, 'groups', code, 'friends', 'lisa-id')));

await env.cleanup();
console.log(failures ? `\n${failures} rule check(s) failed.` : '\nAll rule checks passed.');
process.exit(failures ? 1 : 0);
