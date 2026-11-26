const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const contains = (phrase, name) => !!name && (' ' + phrase + ' ').includes(' ' + normalize(name) + ' ');
const months = 'januari februari maart april mei juni juli augustus september oktober november december'.split(' ');
const days = 'zondag maandag dinsdag woensdag donderdag vrijdag zaterdag'.split(' ');
function editionScore(question, festival) {
  const title = normalize(festival.name);
  const compact = question.replaceAll(' ', '');
  if (contains(question, title) || (title.length > 4 && compact.includes(title.replaceAll(' ', '')))) return 1000 + title.length;
  const head = title.split(' ').filter(w => !/^\d+$/.test(w));
  if (head[0] === 'gezellige' && !contains(question, 'clubtempo')) return 0;
  const aliases = [head.slice(0, 2).join(' '), head[0], ...(festival.name.includes('Wreck Room') ? ['wreckroom','wreck room'] : [])];
  return Math.max(0, ...aliases.filter(n => n.length >= 4 && contains(question, n)).map(n => n.length));
}
function dateFilter(q, today) {
  const year = q.match(/\b(20\d{2})\b/)?.[1];
  const month = months.findIndex(name => contains(q,name));
  const day = month >= 0 && q.match(new RegExp('\\b(\\d{1,2}) ' + months[month] + '\\b'))?.[1];
  const iso = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const offset = n => new Date(today.getFullYear(),today.getMonth(),today.getDate()+n,12);
  let start, end;
  if (/\b(dit|komend) weekend\b/.test(q)) {
    const distance = today.getDay() === 0 ? -1 : 6-today.getDay();
    start = iso(offset(distance)); end = iso(offset(distance+1));
  } else if (/\b(vandaag|morgen)\b/.test(q)) start = end = iso(offset(contains(q,'morgen') ? 1 : 0));
  else if (/\b(deze|volgende) maand\b/.test(q) || month >= 0 || year) {
    const y = Number(year || today.getFullYear());
    const m = month >= 0 ? month : /maand/.test(q) ? today.getMonth()+Number(contains(q,'volgende maand')) : null;
    const useYear = !year && month >= 0 && month < today.getMonth() ? y+1 : y;
    start = iso(new Date(useYear,m ?? 0,day ? Number(day) : 1,12));
    end = day ? start : iso(new Date(useYear,m === null ? 12 : m+1,0,12));
  }
  return start && (f => f.date && f.date <= end && (f.dateEnd || f.date) >= start);
}
function matchedArtist(q, act) {
  return act.artist.split(/\s+(?:vs\.?|b2b|x|&)\s+|:/i).some(part => {
    const name = normalize(part).replace(/\s+(?:live|presenteert|presents)(?:\s.*)?$/, '').replace(/ contest winners$/, '');
    return contains(q, name);
  });
}
function groupSets(f, sets, dayName) {
  const byDay = new Map();
  for (const set of sets) {
    const day = dayName(set.day) || '';
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(set);
  }
  return [...byDay].map(([day, acts]) => ({festival:f, day, rows:acts.slice().sort((a,b) =>
    (a.start || '99').localeCompare(b.start || '99')).map(a => ({
    time:a.start ? [a.start,a.end].filter(Boolean).join('–') : '', name:a.artist, detail:a.stage
  }))}));
}
const hhmm = d => String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
export function setupGuide({editions,passed,favorite,planned,dateLabel,dayName,open,sets,friendsAt}) {
  const form = document.querySelector('#guideForm'), log = document.querySelector('#guideLog');
  let previous = [];
  function reply(question) {
    const all = editions(), q = normalize(question);
    const upcoming = all.filter(f => f.date && !passed(f));
    const dateMatches = dateFilter(q, new Date());
    const city = all.map(f => f.location?.split(',').at(-1)?.trim()).filter(Boolean).find(c => contains(q,c));
    const scored = all.map(f => [f,editionScore(q,f)]);
    const best = Math.max(0,...scored.map(([,score]) => score));
    let named = best ? scored.filter(([,score]) => score === best).map(([f]) => f) : [];
    if (city && named.length > 1) named = named.filter(f => contains(normalize(f.location),city));
    if (dateMatches && named.length > 1) named = named.filter(dateMatches);
    const list = (items,title,empty) => ({title:items.length ? title : empty, groups:items.map(f => ({festival:f}))});
    // "Wat speelt er nu?": per stage the current and the next set at every festival running now.
    if (/\b(nu|straks|op dit moment|now|zo meteen)\b/.test(q) && !/\b(tickets?|kopen)\b/.test(q)) {
      const now = new Date();
      const groups = all.map(f => {
        const timed = sets(f);
        if (!timed.length) return null;
        const first = timed[0].start, last = timed.reduce((max,set) => set.end > max ? set.end : max, timed[0].end);
        if (now < first - 3*3600000 || now > last) return null;
        const rows = [...new Set(timed.map(set => set.stage))].flatMap(stage => {
          const own = timed.filter(set => set.stage === stage);
          const current = own.find(set => set.start <= now && now < set.end);
          const next = own.find(set => set.start > now);
          const row = (set, label) => {
            const names = friendsAt(f, set.item);
            return {time: label, name: (favorite(f,set.item) ? '♥ ' : '') + set.item.artist, detail: [stage, names.length ? 'met ' + names.join(', ') : ''].filter(Boolean).join(' · ')};
          };
          return [current && row(current, 'Nu'), next && row(next, hhmm(next.start))].filter(Boolean);
        });
        return rows.length ? {festival:f, rows} : null;
      }).filter(Boolean);
      return groups.length ? {title:'Nu & straks', groups, schedules:true}
        : {title:'Er is op dit moment geen festival bezig.', note:'Vraag bijvoorbeeld “Wat is het eerstvolgende festival?”'};
    }
    // Friends: which sets people in your group marked as favourite, optionally for one artist.
    if (/\b(vrienden|vriend|groep|wie van)\b/.test(q)) {
      const artist = all.some(f => f.lineup.some(a => matchedArtist(q,a)));
      const groups = (named.length ? named : upcoming).flatMap(f => {
        const rows = f.lineup.filter(a => (!artist || matchedArtist(q,a)) && friendsAt(f,a).length)
          .sort((x,y) => String(x.day || '').localeCompare(String(y.day || '')) || String(x.start || '99').localeCompare(String(y.start || '99')))
          .map(a => ({time: a.start ? [a.start,a.end].filter(Boolean).join('–') : '', name: a.artist, detail: [dayName(a.day), a.stage, 'met ' + friendsAt(f,a).join(', ')].filter(Boolean).join(' · ')}));
        return rows.length ? [{festival:f, rows}] : [];
      });
      return groups.length ? {title:'Hier gaan je vrienden heen', groups, schedules:true}
        : {title:'Je vrienden hebben hier nog geen favoriete sets.', note:'Zodra iemand in je groep een set met een hartje markeert, zie je dat hier.'};
    }
    const schedule = /\b(planning|bewaarde festivals|mijn festivals|welke festivals heb ik|waar ga ik)\b/.test(q);
    if (schedule) return list(upcoming.filter(f => planned(f) && (!dateMatches || dateMatches(f))), 'Jouw festivalplanning','Je hebt hiervoor nog geen festival gepland.');
    const fav = /favoriet/.test(q);
    const b2b = /\b(b2b|back to back|samen|duo)\b/.test(q);
    const stages = /\b(podia|stages|zalen|areas|podiumindeling)\b/.test(q);
    const artistInQuestion = all.some(f => f.lineup.some(a => matchedArtist(q,a)));
    const favoritesAcross = fav && !named.length && !/\b(daar|hier|dit festival)\b/.test(q);
    const agenda = !artistInQuestion && !fav && !b2b && !stages && !named.length &&
      (dateMatches || city || /\b(komende|binnenkort|agenda|festivals|feesten|eerstvolgende|volgende festival)\b/.test(q));
    if (agenda) {
      previous = [];
      let found = (dateMatches ? all : upcoming).filter(f => (!dateMatches || dateMatches(f)) && (!city || contains(normalize(f.location),city)));
      if (/eerstvolgende|volgende festival/.test(q)) found = found.slice(0,1);
      return list(found,'Festivals in je selectie','Voor deze selectie staat er geen festival in de agenda.');
    }
    const across = /\b(waar (draait|speelt|staat)|welke festivals|optredens|alle festivals)\b/.test(q);
    const context = previous.map(k => all.find(f => f.key === k)).filter(Boolean);
    const scope = named.length ? named : !across && !favoritesAcross && context.length ? context : upcoming;
    const filtered = scope.filter(f => (!dateMatches || dateMatches(f)) && (!city || contains(normalize(f.location),city)));
    if (named.length) previous = named.map(f => f.key);
    const specific = named.length || (!across && !favoritesAcross && context.length);
    const weekday = days.find(d => contains(q,d));
    const clock = question.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
    const time = clock && clock[1].padStart(2,'0')+':'+clock[2];
    const wantsLineup = /line ?up|timetable|programma|wie (draait|draaien|speelt|spelen|staat|staan)|\b(acts|sets|artiesten|settijden)\b/.test(q);
    if (artistInQuestion || fav || b2b || time || (wantsLineup && specific && !stages)) {
      const groups = filtered.flatMap(f => groupSets(f, f.lineup.filter(a => {
        if (fav && !favorite(f,a) || artistInQuestion && !matchedArtist(q,a)) return false;
        if (b2b && !/\s(?:vs\.?|b2b|&|x)\s/i.test(a.artist)) return false;
        if (weekday && normalize(dayName(a.day)) !== weekday) return false;
        if (time) {
          if (!a.start) return false;
          if (/\b(na|vanaf)\b/.test(q)) return a.start >= time;
          if (/\b(voor|tot)\b/.test(q)) return a.start < time;
          return !a.end ? a.start === time : a.end < a.start ? time >= a.start || time < a.end : a.start <= time && time < a.end;
        }
        return true;
      }),dayName));
      if (!groups.length) return {title:fav ? 'Geen favoriete sets in deze selectie.' : 'Geen bevestigde sets gevonden voor deze vraag.', note:fav ? 'Tik op een artiestenvak in de timetable om de set te bewaren.' : '',groups:specific ? filtered.map(f => ({festival:f})) : []};
      if (!specific && new Set(groups.map(g => g.festival.key)).size===1) previous=[groups[0].festival.key];
      return {title:fav?'Jouw favoriete sets':b2b?'Gezamenlijke sets':'', groups, schedules:true};
    }
    if (specific) {
      const groups = filtered.map(f => {
        let note = '';
        if (stages) note = [...new Set(f.lineup.map(a => a.stage).filter(Boolean))].join(' · ') || 'De podiumindeling is nog onbekend.';
        else if (/plattegrond|kaart van/.test(q)) note = f.floorplanUrl ? 'Je vindt de officiële plattegrond op de festivalpagina.' : 'Er staat nog geen officiële editieplattegrond in de app.';
        else if (/\b(host|mc)\b/.test(q)) note = f.host ? 'Host · '+f.host : 'Er staat nog geen host in de festivalgegevens.';
        else if (/hoe laat|openingstijd|aanvang|begint|eindigt|afgelopen|sluit/.test(q) && !/draait|speelt/.test(q)) note = f.hours ? 'Openingstijden · '+f.hours : 'De openingstijden zijn nog onbekend.';
        else if (/leeftijd|hoe oud/.test(q)) note = f.age ? 'Minimumleeftijd · '+f.age : 'De minimumleeftijd staat nog niet in de app.';
        else if (/adres|route|straat/.test(q)) note = f.address || 'Het exacte adres staat nog niet in de app.';
        else if (/ticket|prijs|kost|leeftijd|kluis|parkeren|bereikbaarheid|trein|aanvang|open|begint|eindigt|uitverkocht/.test(q)) note = 'Dit staat nog niet in de festivalgegevens. Bekijk de bron voor de praktische informatie.';
        else if (!/wanneer|waar|locatie|datum|stad|vertel|informatie|details/.test(q) && !named.some(n => normalize(n.name)===q)) note = 'Ik heb hiervoor geen bevestigd antwoord. Je kunt hier de line-up, podia, locatie en datum opvragen.';
        return {festival:f, note, source:f.lineupSource};
      });
      return {groups};
    }
    return {title:'Over welk festival of welke artiest wil je iets weten?',note:'Bijvoorbeeld “Welke festivals zijn er in maart 2027?” of “Waar draait Missy?”'};
  }
  function element(tag, text, cls) {
    const node=document.createElement(tag);
    if (text) node.textContent=text;
    if (cls) node.className=cls;
    return node;
  }
  function send(value) {
    const question=value.trim();
    if (!question) return;
    const result=reply(question);
    const answer=element('div','','guideAnswer');
    if (result.title) answer.append(element('strong',result.title));
    if (result.note) answer.append(element('p',result.note));
    for (const group of result.groups || []) {
      const f=group.festival, card=element('section','','guideResult');
      card.append(element('h3',f.name),element('small',[group.day,dateLabel(f),f.location].filter(Boolean).join(' · ')));
      if (group.note) card.append(element('p',group.note));
      for (const row of group.rows || []) {
        const item=element('div','','guideSet');
        const act=element('div');act.append(element('b',row.name));
        if (row.detail) act.append(element('small',row.detail));
        item.append(element('span',row.time || 'Tijd volgt','guideTime'),act);card.append(item);
      }
      const actions=element('div','','guideLinks');
      const button=element('button','Open festival','day-chip');button.type='button';button.onclick=()=>open(f);actions.append(button);
      if (/^https:\/\//i.test(group.source || '')) {
        const link=element('a','Bekijk bron','source-link');link.href=group.source; link.target='_blank';link.rel='noopener noreferrer';actions.append(link);
      }
      card.append(actions);answer.append(card);
    }
    const user=element('p',question,'guideUser');log.append(user,answer);
    form.elements.question.value='';
    log.scrollTop=user.offsetTop;
  }
  form.onsubmit=e=>{e.preventDefault();send(form.elements.question.value);};
  document.querySelectorAll('[data-guide]').forEach(b=>b.onclick=()=>send(b.textContent));
}
