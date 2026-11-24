// Local nearest-example classifier with inverse document frequency weighting.
const training = {
  upcoming:['komende festivals','welke feesten komen eraan','wat is het volgende festival','wat is er binnenkort'],
  details:['waar is het','welke locatie','welke datum','wanneer is het festival','in welke stad'],
  stages:['welke podia zijn er','toon de stages','hoeveel zalen','welke areas'],
  sets:['wie draaien er','wat is de line up','wie staat op de lineup','toon de timetable','hoe laat draait','wanneer speelt','welke settijden zijn bekend','toon het programma'],
  favorites:['mijn favoriete sets','toon mijn favorieten','welke acts heb ik opgeslagen']
};
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const words=s=>[...new Set(norm(s).split(' ').filter(w=>w&&!['de','wat','het','op','welke','er','zijn','is','in','bij','en'].includes(w)))];
const samples=Object.entries(training).flatMap(([intent,phrases])=>phrases.map(p=>({intent,tokens:words(p)})));
const weights=new Map();
for(const {tokens} of samples) for(const token of tokens) weights.set(token,1+(weights.get(token)||0));
for(const [token,count] of weights) weights.set(token,Math.log(1+samples.length/count)**2);
function classify(q){
  const tokens=words(q).filter(w=>weights.has(w));
  const length=list=>Math.sqrt(list.reduce((sum,w)=>sum+weights.get(w),0));
  let best='',score=.24;
  for(const sample of samples){
    const shared=sample.tokens.filter(w=>tokens.includes(w));
    const sim=shared.reduce((sum,w)=>sum+weights.get(w),0)/(length(tokens)*length(sample.tokens));
    if(sim>score){best=sample.intent;score=sim;}
  }
  return best;
}
export function setupGuide({editions,passed,favorite,dateLabel,dayName,open}){
  const form=document.querySelector('#guideForm'),log=document.querySelector('#guideLog');
  let previous='';
  function reply(question){
    const all=editions(),q=' '+norm(question)+' ';
    const has=n=>norm(n)&&q.includes(' '+norm(n)+' ');
    const explicit=all.find(f=>has(f.name)||has(f.name.split(/[–—]/)[0])||(f.name.split(' ')[0].length>=5&&has(f.name.split(' ')[0])));
    const intent=classify(question);
    const festival=explicit||all.find(f=>f.key===previous);
    if(explicit) previous=explicit.key;
    if(intent==='upcoming'&&!explicit){
      previous='';const soon=all.filter(f=>f.date&&!passed(f)).slice(0,5);
      return [soon.map(f=>dateLabel(f)+' · '+f.name).join('\n')||'Geen komende festivals bekend.',soon];
    }
    const scope=festival?[festival]:all.filter(f=>!passed(f));
    const row=a=>[dayName(a.day),a.start?a.start+(a.end?'–'+a.end:''):'Speeltijd volgt',a.artist,a.stage].filter(Boolean).join(' · ');
    const hits=[];
    for(const f of scope) for(const a of f.lineup||[]){
      const matches=a.artist.split(/\s+(?:vs\.?|b2b|&)\s+|:/i).some(n=>has(n.replace(/\s+live$/i,'')));
      if(intent==='favorites'?favorite(f,a):matches) hits.push({f,a});
    }
    if(hits.length)return [hits.slice(0,12).map(({f,a})=>f.name+' · '+row(a)).join('\n'),[...new Set(hits.map(h=>h.f))].slice(0,6)];
    if(intent==='favorites')return ['Geen favoriete sets gevonden in deze selectie. Tik op een ster in de timetable.'];
    if(festival&&(explicit||intent)){
      let info=[dateLabel(festival),festival.location].filter(Boolean).join(' · ');
      if(intent==='stages')info=[...new Set(festival.lineup.map(a=>a.stage).filter(Boolean))].join(' · ')||'Podiumindeling nog onbekend.';
      if(intent==='sets')info=festival.lineup.slice(0,10).map(row).join('\n')||'Nog geen programma bevestigd.';
      return [festival.name+'\n'+info,[festival]];
    }
    return ['Over welk festival of welke artiest gaat je vraag? Ik kan helpen met de agenda, podia, settijden en je favoriete sets.'];
  }
  function send(text){
    if(!text.trim())return;
    const user=document.createElement('p');user.className='guideUser';user.textContent=text;
    const [message,links=[]]=reply(text);
    const answer=document.createElement('div');answer.className='guideAnswer';answer.textContent=message;
    for(const f of links){const b=document.createElement('button');b.type='button';b.className='day-chip';b.textContent=f.name;b.onclick=()=>open(f);answer.append(document.createElement('br'),b);}
    log.append(user,answer);form.elements.question.value='';log.scrollTop=log.scrollHeight;
  }
  form.onsubmit=e=>{e.preventDefault();send(form.elements.question.value);};
  document.querySelectorAll('[data-guide]').forEach(b=>b.onclick=()=>send(b.textContent));
}
