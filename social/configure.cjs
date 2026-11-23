const admin = require('../scripts/node_modules/firebase-admin');
const fs = require('node:fs');
async function main() {
 const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
 if (account.project_id !== 'uptempo-43116') throw Error('Project mismatch');
 admin.initializeApp({credential:admin.credential.cert(account)});
 const token = (await admin.app().options.credential.getAccessToken()).access_token;
 async function call(url, method='GET', body) {
   const result = await fetch(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body: JSON.stringify(body)});
   if (!result.ok) throw Error(method+' '+new URL(url).hostname+' '+result.status+' '+(await result.json()).error?.status);
   return result.json();
 }
 const project = 'projects/'+account.project_id;
 const authUrl = 'https://identitytoolkit.googleapis.com/admin/v2/'+project+'/config';
 await call(authUrl+'?updateMask=signIn.email.enabled,signIn.email.passwordRequired','PATCH',{signIn:{email:{enabled:true,passwordRequired:true}}});
 const base = 'https://firebaserules.googleapis.com/v1/';
 const release = await call(base+project+'/releases/cloud.firestore');
 const rules = (await call(base+release.rulesetName)).source;
 const file = rules.files.find(f=>f.content.includes('service cloud.firestore'));
 if (!file) throw Error('Existing rules missing');
 const snippet = fs.readFileSync('social/social.rules','utf8').trim();
 if (!file.content.includes(snippet)) {
   const anchor = /match\s+\/databases\/\{database\}\/documents\s*\{/;
   const rest = file.content.split(anchor)[1];
   if (!rest || /match\s+\/\{|match\s+\/uptempoChats|allow\s+[^;]*;\s*$/m.test(rest.split(/match\s+\//)[0])) throw Error('Review existing broad or conflicting Firestore rules before activating chat');
   file.content = file.content.replace(anchor,match=>match+'\n'+snippet+'\n');
   const created = await call(base+project+'/rulesets','POST',{source:rules});
   if ((await call(base+release.name)).rulesetName !== release.rulesetName) throw Error('Concurrent rules change');
   await call(base+release.name,'PATCH',{release:{name:release.name,rulesetName:created.name},updateMask:'rulesetName'});
 }
 console.log('Account provider and participant-only chat rules active');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
