// Mitbringliste: Oberfläche. Daten über api.js, Aufteilung aus aufteilen.js, Termine aus termine.js.
import { aufteilen, zuordnen, bedarf, euro, mengeText } from './aufteilen.js';
import { termine, phase, freigabeZeit, erinnerungZeit, kurzDatum, WOCHENTAGE, MONATE, ausIso, iso, ferienLaden } from './termine.js';
import { pushMoeglich, aboHolen, abonnieren } from './push.js';
import { macheApi, fehlerText, DEMO_CODES } from './api.js';
import { VORLAGE, EINSTELLUNGEN } from './vorlage.js';

// ---------- Grundlagen ----------
const adresse = new URL(location.href);
const DEMO = adresse.searchParams.has('demo');
const GRUPPE = (adresse.searchParams.get('g') || (DEMO ? 'demo' : 'standard')).toLowerCase();
const TESTZEIT = adresse.searchParams.get('jetzt'); // nur zum Ausprobieren, z. B. ?jetzt=2026-10-05T18:30
const api = macheApi(GRUPPE, DEMO);
const jetzt = () => (TESTZEIT ? new Date(TESTZEIT) : new Date());

const speicher = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privater Modus */ } },
  weg(k) { try { localStorage.removeItem(k); } catch { /* privater Modus */ } },
};
const K = {
  code: 'mb_code_' + GRUPPE, mod: 'mb_mod_' + GRUPPE, ich: 'mb_ich_' + GRUPPE,
  gesehen: 'mb_gesehen_' + GRUPPE, install: 'mb_install_weg', abo: 'mb_abo_' + GRUPPE,
};

const S = {
  code: speicher.get(K.code),
  mod: speicher.get(K.mod),      // Admin-Code oder "Personen-ID:PIN" eines Moderators
  rolle: null,                   // 'admin' | 'mod', sobald in der Moderation angemeldet
  ich: speicher.get(K.ich),
  daten: null, roh: '', termine: [], gewaehlt: null,
  ansicht: 'laden',              // laden | code | einrichten | fehler | haupt | moderation
  tab: 'termin', fehler: '', busy: false,
  entwurf: null, vorschauN: null, modFormFuer: null, installPrompt: null,
  push: 'unbekannt',             // an | aus | blockiert | ios | nein | unbekannt
};

// Klassencode aus dem geteilten Link (#k=...) übernehmen und aus der Adresszeile nehmen
const hashCode = new URLSearchParams(location.hash.slice(1)).get('k');
if (hashCode) {
  S.code = hashCode;
  speicher.set(K.code, hashCode);
  history.replaceState(null, '', location.pathname + location.search);
}
if (DEMO && !S.code) S.code = DEMO_CODES.klasse;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uhr = d => d.getMinutes() ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')} Uhr` : `${d.getHours()} Uhr`;
const tagMonat = d => `${d.getDate()}.${d.getMonth() + 1}.`;
const istApp = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const istIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const svg = (inhalt, klasse = 'ic') => `<svg class="${klasse}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inhalt}</svg>`;
const ICON = {
  links: svg('<path d="M15 18l-6-6 6-6"/>'),
  rechts: svg('<path d="M9 18l6-6-6-6"/>'),
  haken: svg('<path d="M20 6L9 17l-5-5"/>'),
  kreuz: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  warn: svg('<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17.5v.5"/>'),
  info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7.5v.5"/>'),
  runter: svg('<path d="M12 5v14M5 12l7 7 7-7"/>'),
  hoch: svg('<path d="M12 19V5M5 12l7-7 7 7"/>'),
  teilen: svg('<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>'),
  punkte: svg('<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>'),
  zahnrad: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
  muell: svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
  glocke: svg('<path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/>'),
};
const logo = (klasse = '') => `<img src="icon.svg" alt="" class="logo ${klasse}" width="40" height="40">`;

let toastUhr;
function toast(text, art = '') {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.className = 'zeigen ' + art;
  clearTimeout(toastUhr);
  toastUhr = setTimeout(() => { el.className = ''; }, 3200);
}

// ---------- Daten ----------
async function neuLaden(erzwingen = false) {
  try {
    const d = await api.laden(S.code);
    const roh = JSON.stringify(d);
    if (!erzwingen && roh === S.roh) return;
    S.roh = roh;
    S.daten = d;
    if ((d.rolle === 'admin' || d.rolle === 'mod') && !S.mod) S.mod = S.code;
    if (S.ich && !d.personen.some(p => p.id === S.ich)) { S.ich = null; speicher.weg(K.ich); }
    termineBerechnen();
    if (['laden', 'code', 'fehler'].includes(S.ansicht)) S.ansicht = 'haupt';
    render();
    if (S.push === 'unbekannt') pushStatusLaden().then(() => { if (S.ansicht === 'haupt') render(); });
  } catch (e) {
    if (e.code === 'falscher_code') {
      speicher.weg(K.code);
      S.code = null;
      S.fehler = 'Der Klassencode stimmt nicht (mehr). Frag in der Klasse nach dem aktuellen Link.';
      S.ansicht = 'code';
      render();
    } else if (e.code === 'keine_gruppe') {
      S.fehler = '';
      S.ansicht = 'einrichten';
      render();
    } else if (!S.daten) {
      S.fehler = fehlerText(e);
      S.ansicht = 'fehler';
      render();
    } else if (erzwingen) {
      toast(fehlerText(e), 'schlecht');
    }
  }
}

function termineBerechnen() {
  S.termine = termine(jetzt(), S.daten.termine);
  if (!S.termine.some(t => t.schluessel === S.gewaehlt)) {
    const heute = iso(jetzt());
    const kommend = S.termine.filter(t => t.datum >= heute);
    S.gewaehlt = (kommend.find(t => !t.abgesagt) || kommend[0] || S.termine[S.termine.length - 1]).schluessel;
  }
}

// Alles, was man zum gewählten Termin wissen muss
function lage() {
  const d = S.daten;
  const t = S.termine.find(x => x.schluessel === S.gewaehlt);
  const ph = phase(t, jetzt(), d.einstellungen);
  const ids = new Set(d.personen.map(p => p.id));
  const antworten = d.antworten.filter(a => a.schluessel === t.schluessel && ids.has(a.person));
  const dabei = antworten.filter(a => a.dabei);
  const auf = aufteilen(d.sachen, dabei.length);
  const zu = zuordnen(auf.posten, dabei);
  const meine = antworten.find(a => a.person === S.ich) || null;
  return { t, ph, antworten, dabei, auf, zu, meine, offen: ph === 'anmeldung' || ph === 'liste' };
}

const personName = id => S.daten.personen.find(p => p.id === id)?.name || '?';
const einst = () => ({ ...EINSTELLUNGEN, ...(S.daten.einstellungen || {}) });

function gesehenSetzen(t, text) {
  const g = speicher.get(K.gesehen, {});
  g[t.schluessel + '|' + S.ich] = text;
  speicher.set(K.gesehen, g);
}

// ---------- Ansichten ----------
function render() {
  const app = document.getElementById('app');
  const ansichten = {
    laden: () => '<div class="laden">Lädt …</div>',
    code: ansichtCode, einrichten: ansichtEinrichten, fehler: ansichtFehler,
    haupt: ansichtHaupt, moderation: ansichtModeration,
  };
  app.innerHTML = (ansichten[S.ansicht] || ansichtHaupt)();
  document.body.classList.toggle('busy', S.busy);
}

function ansichtCode() {
  return `<main class="start">
    ${logo('gross')}
    <h1>Mitbringliste</h1>
    <p>Gib den Klassencode ein. Er steckt im Link aus eurem Klassenchat, sonst frag in der Klasse nach.</p>
    <form class="zeile-form" data-form="code">
      <input id="code-feld" class="feld" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Klassencode" aria-label="Klassencode" required>
      <button class="knopf">Weiter</button>
    </form>
    ${S.fehler ? `<p class="fehler">${esc(S.fehler)}</p>` : ''}
    <button class="link leise" data-a="einrichten-zeigen">Neue Liste einrichten</button>
  </main>`;
}

function ansichtEinrichten() {
  return `<main class="start">
    ${logo('gross')}
    <h1>Neue Liste einrichten</h1>
    <p>Das machst du nur einmal. Danach trägst du die Namen ein und schickst den Link in den Klassenchat.</p>
    <form class="spalte breit-form" data-form="einrichten">
      <label class="feld-label">Name der Runde<input id="ein-name" class="feld" value="Mett-Frühstück" maxlength="40" required></label>
      <label class="feld-label">Klassencode <span class="leise">mind. 4 Zeichen, steckt im Link für alle</span>
        <input id="ein-code" class="feld" autocomplete="off" autocapitalize="off" spellcheck="false" minlength="4" required></label>
      <label class="feld-label">Admin-Code <span class="leise">mind. 6 Zeichen, nur für dich</span>
        <input id="ein-admin" class="feld" type="password" autocomplete="new-password" minlength="6" required></label>
      <button class="knopf">Einrichten</button>
    </form>
    ${S.fehler ? `<p class="fehler">${esc(S.fehler)}</p>` : ''}
    <button class="link leise" data-a="code-zeigen">Zurück</button>
  </main>`;
}

function ansichtFehler() {
  return `<main class="start">
    ${logo('gross')}
    <h1>Das hat nicht geklappt</h1>
    <p class="fehler">${esc(S.fehler)}</p>
    <button class="knopf" data-a="neu-versuchen">Nochmal versuchen</button>
  </main>`;
}

function kopfHaupt() {
  return `<header class="kopf">
    ${logo()}
    <div class="kopf-mitte"><h1>${esc(S.daten.name)}</h1><div class="kopf-unter">Mitbringliste${DEMO ? ' · Demo' : ''}</div></div>
    <button class="knopf-icon" data-a="moderation" aria-label="Moderation">${ICON.zahnrad}</button>
  </header>`;
}

function ansichtHaupt() {
  const L = lage();
  let html = kopfHaupt() + terminKarte(L);
  if (L.ph !== 'abgesagt') {
    html += S.ich ? ichKarte(L) : namenKarte();
    html += L.ph === 'anmeldung' ? vorschauKarte(L) : listeKarte(L);
    html += werKarte(L);
  }
  return html + installKarte() + fuss();
}

function terminNav(L, oben, unten) {
  const i = S.termine.findIndex(x => x.schluessel === L.t.schluessel);
  return `<div class="termin-nav">
    <button class="pfeil" data-a="termin" data-d="-1" ${i <= 0 ? 'disabled' : ''} aria-label="Vorheriger Termin">${ICON.links}</button>
    <div class="termin-mitte"><div class="termin-tag">${oben}</div><div class="termin-datum">${unten}</div></div>
    <button class="pfeil" data-a="termin" data-d="1" ${i >= S.termine.length - 1 ? 'disabled' : ''} aria-label="Nächster Termin">${ICON.rechts}</button>
  </div>`;
}

function statusText({ t, ph }) {
  switch (ph) {
    case 'abgesagt': return 'Fällt diesmal aus';
    case 'anmeldung': {
      const f = freigabeZeit(t, einst());
      return `Abstimmung läuft · Liste kommt ${WOCHENTAGE[f.getDay()]}, ${uhr(f)}`;
    }
    case 'liste': return 'Die Mitbringliste ist da';
    case 'heute': return 'Heute ist es so weit!';
    default: return 'Vorbei';
  }
}

function terminKarte(L) {
  const { t } = L;
  const d = ausIso(t.datum);
  return `<section class="karte termin">
    ${terminNav(L, WOCHENTAGE[d.getDay()], `${d.getDate()}. ${MONATE[d.getMonth()]}`)}
    <div class="status status-${L.ph}">${statusText(L)}</div>
    ${t.festgelegt && t.datum !== t.regulaer ? `<p class="hinweis">Verlegt, eigentlich ${kurzDatum(t.regulaer)}</p>` : ''}
    ${t.grund ? `<p class="hinweis warn">${ICON.warn}<span>Achtung, ${esc(t.grund)}. Die Moderation entscheidet noch, ob der Termin verlegt wird.</span></p>` : ''}
    ${t.notiz ? `<p class="notiz">${esc(t.notiz)}</p>` : ''}
  </section>`;
}

function namenKarte() {
  const leute = S.daten.personen;
  return `<section class="karte">
    <h2>Wer bist du?</h2>
    ${leute.length
      ? `<p class="leise">Tipp auf deinen Namen. Dein Handy merkt sich das.</p>
         <div class="namen">${leute.map(p => `<button class="name" data-a="ich" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</div>`
      : '<p class="leise">Es sind noch keine Namen eingetragen. Das macht die Moderation über das Zahnrad oben rechts.</p>'}
  </section>`;
}

function ichKarte(L) {
  const { t, ph, meine, offen } = L;
  const d = ausIso(t.datum);
  let html = `<section class="karte ich">
    <div class="ich-kopf"><span>Hallo, <b>${esc(personName(S.ich))}</b>!</span><button class="link" data-a="ich-weg">Nicht du?</button></div>`;
  if (offen) {
    html += `<div class="frage">Bist du am ${WOCHENTAGE[d.getDay()]}, ${tagMonat(d)} dabei?</div>
      <div class="wahl">
        <button class="wahl-knopf ja ${meine?.dabei === true ? 'an' : ''}" data-a="dabei" data-v="1" aria-pressed="${meine?.dabei === true}">${ICON.haken}Bin dabei</button>
        <button class="wahl-knopf nein ${meine?.dabei === false ? 'an' : ''}" data-a="dabei" data-v="0" aria-pressed="${meine?.dabei === false}">${ICON.kreuz}Bin nicht dabei</button>
      </div>`;
  } else {
    const warst = ph === 'vorbei';
    html += `<div class="frage">${meine?.dabei ? (warst ? 'Du warst dabei.' : 'Du bist dabei.') : meine ? (warst ? 'Du warst nicht dabei.' : 'Du bist nicht dabei.') : 'Du hast nicht abgestimmt.'}</div>`;
  }
  if (ph !== 'anmeldung' && meine?.dabei) html += aufgabeBlock(L);
  if (offen && meine?.dabei !== false) html += erinnerungZeile(L);
  return html + '</section>';
}

// Erinnerung per Benachrichtigung ein- und ausschalten
function erinnerungZeile(L) {
  const e = einst();
  if (e.erinnerung === false || S.push === 'nein' || S.push === 'unbekannt') return '';
  const z = erinnerungZeit(L.t, e);
  const wann = jetzt() < z ? `am ${WOCHENTAGE[z.getDay()]} um ${uhr(z)}` : 'gleich';
  switch (S.push) {
    case 'an':
      return `<div class="erinnerung an">${ICON.glocke}<span>Erinnerung ist an. Falls dann noch was fehlt, meldet sich die App ${wann}.</span>
        <button class="link" data-a="push-aus">Ausschalten</button></div>`;
    case 'aus':
      return `<div class="erinnerung">${ICON.glocke}<span>Soll dich die App ${wann} erinnern, falls du bis dahin noch nicht abgestimmt oder nichts ausgesucht hast?</span>
        <button class="knopf klein zweit" data-a="push-an">Ja, erinnern</button></div>`;
    case 'blockiert':
      return `<div class="erinnerung leise">${ICON.glocke}<span>Benachrichtigungen sind für diese Seite blockiert. Wenn du erinnert werden willst, erlaube sie in den Einstellungen deines Browsers.</span></div>`;
    case 'ios':
      return `<div class="erinnerung leise">${ICON.glocke}<span>Auf dem iPhone kann die App dich nur erinnern, wenn sie auf dem Home-Bildschirm liegt (Anleitung unten).</span></div>`;
    default:
      return '';
  }
}

async function pushStatusLaden() {
  if (!pushMoeglich()) { S.push = istIOS() && !istApp() ? 'ios' : 'nein'; return; }
  if (Notification.permission === 'denied') { S.push = 'blockiert'; return; }
  let abo = null;
  try { abo = await aboHolen(); } catch { /* egal */ }
  S.push = abo ? 'an' : 'aus';
  // Gehört das Abo noch zu einem anderen Namen (z. B. nach "Nicht du?"), neu zuordnen
  if (abo && S.ich && S.code && speicher.get(K.abo) !== S.ich) {
    try { await api.abo(S.code, S.ich, abo.toJSON()); speicher.set(K.abo, S.ich); } catch { /* beim nächsten Mal */ }
  }
}

function notizen(teile) {
  const n = teile.filter(x => x.notiz);
  return n.length ? `<div class="posten-notiz">${n.map(x => esc(n.length > 1 || teile.length > 1 ? x.name + ': ' + x.notiz : x.notiz)).join(' · ')}</div>` : '';
}

function aufgabeBlock(L) {
  const { t, ph, auf, zu } = L;
  const idx = zu.vonPerson[S.ich];
  if (idx !== undefined) {
    const p = auf.posten[idx];
    const alt = speicher.get(K.gesehen, {})[t.schluessel + '|' + S.ich];
    if (!alt) gesehenSetzen(t, p.text);
    let html = `<div class="aufgabe">
      <div class="aufgabe-titel">${ph === 'vorbei' ? 'Du hattest' : 'Du bringst mit'}</div>
      <div class="aufgabe-text">${esc(p.text)}</div>
      ${notizen(p.teile)}
      <div class="aufgabe-fuss"><span>ca. ${euro(p.kosten)}</span>${ph === 'liste' ? '<button class="link" data-a="abgeben">Wieder abgeben</button>' : ''}</div>
    </div>`;
    if (alt && alt !== p.text) {
      html += `<div class="geaendert">${ICON.info}<div>Geändert, weil sich die Zahl der Leute geändert hat. Vorher: ${esc(alt)}.
        <button class="link" data-a="gesehen">Alles klar</button></div></div>`;
    }
    return html;
  }
  if (zu.verloren.includes(S.ich)) {
    return `<div class="aufgabe leer warn">${ICON.info}<span>Dein Posten fällt weg, weil sich die Zahl der Leute geändert hat. Such dir bitte unten etwas Neues aus.</span></div>`;
  }
  if (ph === 'liste') return `<div class="aufgabe leer">${ICON.runter}<span>Such dir unten in der Liste etwas aus.</span></div>`;
  return '';
}

function vorschauKarte(L) {
  const { t, dabei, auf } = L;
  const f = freigabeZeit(t, einst());
  const n = dabei.length;
  return `<section class="karte">
    <h2>Mitbringliste</h2>
    <p>Die Liste zum Aussuchen kommt am <b>${WOCHENTAGE[f.getDay()]}, ${tagMonat(f)} um ${uhr(f)}</b>. Bis dahin einfach oben abstimmen.</p>
    ${n ? `<p class="leise">So viel brauchen wir bei ${n} ${n === 1 ? 'Person' : 'Leuten'} (Stand jetzt):</p>
      <ul class="bedarf">${auf.bedarf.map(b => `<li>${esc(b.text)}</li>`).join('')}</ul>
      <p class="leise klein">Zusammen ca. ${euro(auf.gesamt)}, pro Person etwa ${euro(auf.ziel)}</p>`
    : '<p class="leise">Noch hat niemand zugesagt.</p>'}
  </section>`;
}

function listeKarte(L) {
  const { ph, auf, zu } = L;
  const interaktiv = ph === 'liste';
  const vergeben = zu.belegt.filter(x => x !== null).length;
  const gruppen = [];
  auf.posten.forEach((p, i) => {
    let g = gruppen.find(x => x.key === p.key);
    if (!g) gruppen.push(g = { key: p.key, name: p.name, teile: p.teile, posten: [] });
    g.posten.push({ ...p, i });
  });
  const meinIdx = zu.vonPerson[S.ich];
  const meinKey = meinIdx !== undefined ? auf.posten[meinIdx].key : null;
  let html = `<section class="karte">
    <div class="karte-kopf"><h2>Mitbringliste</h2>${auf.posten.length ? `<span class="pille ${vergeben === auf.posten.length ? 'gut' : ''}">${vergeben} von ${auf.posten.length} vergeben</span>` : ''}</div>`;
  if (!auf.posten.length) html += `<p class="leise">${L.dabei.length ? 'Die Einkaufsliste ist noch leer.' : 'Noch hat niemand zugesagt.'}</p>`;
  for (const g of gruppen) {
    const belegte = g.posten.filter(p => zu.belegt[p.i] !== null);
    const freie = g.posten.filter(p => zu.belegt[p.i] === null);
    const zeilen = belegte.map(p => {
      const wer = zu.belegt[p.i];
      return `<li class="${wer === S.ich ? 'meins' : ''}">
        <div class="posten-links"><span class="posten-text">${esc(p.text)}</span><span class="posten-preis">ca. ${euro(p.kosten)}</span></div>
        <div class="posten-rechts"><span class="wer${wer === S.ich ? ' du' : ''}">${esc(personName(wer))}${wer === S.ich ? ' (du)' : ''}</span></div></li>`;
    });
    // Freie Posten einer Sorte als eine Zeile; wer "Nehm ich" tippt, bekommt den ersten davon
    if (freie.length) {
      const p = freie[0];
      const anzahl = freie.length > 1 ? `noch ${freie.length} frei` : 'frei';
      const rechts = interaktiv && meinKey !== g.key
        ? `<button class="knopf klein" data-a="nehmen" data-key="${esc(g.key)}">Nehm ich</button>`
        : `<span class="frei">${anzahl}</span>`;
      zeilen.push(`<li class="ist-frei">
        <div class="posten-links"><span class="posten-text">${esc(p.text)}</span><span class="posten-preis">ca. ${euro(p.kosten)}${rechts.startsWith('<button') ? ' · ' + anzahl : ''}</span></div>
        <div class="posten-rechts">${rechts}</div></li>`);
    }
    html += `<div class="gruppe">
      <div class="gruppe-kopf"><span class="gruppe-name">${esc(g.name)}</span>${g.posten.length > 1 ? `<span class="leise klein">${g.posten.length} Portionen</span>` : ''}</div>
      ${notizen(g.teile)}
      <ul class="posten">${zeilen.join('')}</ul>
    </div>`;
  }
  if (auf.bedarf.length) {
    html += `<div class="summe"><div>Insgesamt: ${auf.bedarf.map(b => esc(b.text)).join(' · ')}</div>
      <div class="leise klein">Zusammen ca. ${euro(auf.gesamt)}, pro Person etwa ${euro(auf.ziel)}</div></div>`;
  }
  return html + '</section>';
}

function werKarte(L) {
  const { antworten, zu, ph } = L;
  const leute = S.daten.personen;
  const antwort = id => antworten.find(a => a.person === id);
  const ja = leute.filter(p => antwort(p.id)?.dabei === true);
  const nein = leute.filter(p => antwort(p.id)?.dabei === false);
  const offen = leute.filter(p => !antwort(p.id));
  const ohne = ph === 'liste' ? ja.filter(p => zu.vonPerson[p.id] === undefined) : [];
  const chips = (liste, art) => liste.map(p => {
    const nichts = ohne.includes(p);
    return `<span class="chip ${art}${p.id === S.ich ? ' du' : ''}${nichts ? ' ohne' : ''}">${esc(p.name)}</span>`;
  }).join('');
  const zeile = (titel, liste, art) => liste.length
    ? `<div class="wer-zeile"><div class="wer-titel ${art}">${titel} <b>${liste.length}</b></div><div class="chips">${chips(liste, art)}</div></div>` : '';
  return `<section class="karte">
    <h2>Wer ist dabei?</h2>
    ${zeile('Dabei', ja, 'ja')}
    ${zeile('Nicht dabei', nein, 'nein')}
    ${zeile(L.offen ? 'Noch keine Antwort' : 'Nicht abgestimmt', offen, 'offen')}
    ${ohne.length ? `<p class="leise klein">Noch nichts ausgesucht: ${ohne.map(p => esc(p.name)).join(', ')}</p>` : ''}
    ${leute.length ? '' : '<p class="leise">Noch keine Namen eingetragen.</p>'}
  </section>`;
}

function installKarte() {
  if (istApp() || speicher.get(K.install)) return '';
  let inhalt;
  if (S.installPrompt) {
    inhalt = `<p>Leg die Mitbringliste auf deinen Startbildschirm, dann ist sie mit einem Tipp da.</p>
      <button class="knopf" data-a="installieren">Zum Startbildschirm hinzufügen</button>`;
  } else if (istIOS()) {
    inhalt = `<p>In Safari unten auf <span class="inline-ic">${ICON.teilen}</span> <b>Teilen</b> tippen, dann <b>„Zum Home-Bildschirm“</b>.</p>
      <p class="leise klein">Beim ersten Öffnen fragt die App nach dem Klassencode: <b class="code">${esc(S.daten.code)}</b></p>`;
  } else {
    inhalt = `<p>Im Browser-Menü <span class="inline-ic">${ICON.punkte}</span> <b>„App installieren“</b> oder <b>„Zum Startbildschirm hinzufügen“</b> wählen.</p>`;
  }
  return `<section class="karte install">
    <div class="karte-kopf"><h2>Als App speichern</h2><button class="knopf-icon klein" data-a="install-weg" aria-label="Hinweis ausblenden">${ICON.kreuz}</button></div>
    ${inhalt}
  </section>`;
}

function fuss() {
  return `<footer class="fuss">
    <button class="knopf zweit" data-a="teilen">${ICON.teilen}Link für die Klasse teilen</button>
    ${DEMO ? `<p class="leise klein">Demo: Alles bleibt nur in diesem Browser. Moderation mit dem Admin-Code „${DEMO_CODES.admin}“.
      <button class="link" data-a="demo-reset">Demo zurücksetzen</button></p>` : ''}
  </footer>`;
}

// ---------- Moderation ----------
function modName() {
  if (S.rolle === 'admin') return 'Admin';
  const id = String(S.mod || '').split(':')[0];
  return personName(id);
}

function ansichtModeration() {
  const kopf = `<header class="kopf">
    <button class="knopf-icon" data-a="zurueck" aria-label="Zurück">${ICON.links}</button>
    <div class="kopf-mitte"><h1>Moderation</h1><div class="kopf-unter">${S.rolle ? 'Angemeldet: ' + esc(modName()) : esc(S.daten.name)}</div></div>
    <span class="kopf-platz"></span>
  </header>`;
  if (!S.rolle) return kopf + loginKarte();
  const tabs = [['termin', 'Termin'], ['liste', 'Einkauf'], ['leute', 'Leute'], ['mehr', 'Mehr']];
  const inhalt = { termin: tabTermin, liste: tabListe, leute: tabLeute, mehr: tabMehr }[S.tab]();
  return kopf + `<nav class="tabs" role="tablist">${tabs.map(([k, n]) =>
    `<button role="tab" aria-selected="${S.tab === k}" class="tab${S.tab === k ? ' an' : ''}" data-a="tab" data-tab="${k}">${n}</button>`).join('')}</nav>` + inhalt;
}

function loginKarte() {
  const mods = S.daten.personen.filter(p => p.mod);
  return `<section class="karte">
    <h2>Anmelden</h2>
    <p>Termine verlegen oder absagen, die Einkaufsliste und die Namen ändern darf nur die Moderation.</p>
    ${mods.length ? `<form class="spalte" data-form="login-mod">
        <label class="feld-label">Name<select id="login-person" class="feld">${mods.map(p =>
          `<option value="${p.id}"${p.id === S.ich ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
        <label class="feld-label">PIN<input id="login-pin" class="feld" type="password" autocomplete="current-password" required></label>
        <button class="knopf">Anmelden</button>
      </form>
      <div class="trenner"><span>oder mit dem Admin-Code</span></div>` : ''}
    <form class="spalte" data-form="login-admin">
      <label class="feld-label">Admin-Code<input id="login-admin" class="feld" type="password" autocomplete="current-password" required></label>
      <button class="knopf${mods.length ? ' zweit' : ''}">Anmelden</button>
    </form>
    ${DEMO ? `<p class="leise klein">Demo: Der Admin-Code ist „${DEMO_CODES.admin}“.</p>` : ''}
    ${S.fehler ? `<p class="fehler">${esc(S.fehler)}</p>` : ''}
  </section>`;
}

function tabTermin() {
  const L = lage();
  const { t } = L;
  const o = S.daten.termine.find(x => x.schluessel === t.schluessel) || {};
  const r = ausIso(t.regulaer);
  const f = freigabeZeit(t, einst());
  let html = `<section class="karte">
    ${terminNav(L, 'Termin im', `${MONATE[r.getMonth()]} ${r.getFullYear()}`)}
    <p class="mitte-text">Erster Mittwoch: <b>${kurzDatum(t.regulaer)}</b>${t.festgelegt && t.datum !== t.regulaer ? ` · verlegt auf <b>${kurzDatum(t.datum)}</b>` : ''}${t.abgesagt ? ' · <b>fällt aus</b>' : ''}</p>
    ${t.grund ? `<div class="hinweis-box warn">${ICON.warn}<div><b>${esc(t.grund)}</b> (${kurzDatum(t.datum)}). Was soll passieren?
      <div class="knopf-reihe">
        ${t.vorschlag ? `<button class="knopf klein" data-a="t-verlegen" data-datum="${t.vorschlag}">Auf ${kurzDatum(t.vorschlag)} verlegen</button>` : ''}
        <button class="knopf klein zweit" data-a="t-absagen">Absagen</button>
        <button class="knopf klein zweit" data-a="t-bleibt">Bleibt so</button>
      </div></div></div>` : ''}
  </section>
  <section class="karte">
    <h2>Termin ändern</h2>
    <form class="spalte" data-form="termin">
      <label class="feld-label">Datum<input id="t-datum" class="feld" type="date" value="${t.datum}" required></label>
      <label class="haken"><input id="t-abgesagt" type="checkbox"${o.abgesagt ? ' checked' : ''}> Fällt aus</label>
      <label class="haken"><input id="t-frei" type="checkbox"${o.frei ? ' checked' : ''}> Mitbringliste schon jetzt freigeben
        <span class="leise klein">(sonst ${WOCHENTAGE[f.getDay()]}, ${tagMonat(f)} um ${uhr(f)})</span></label>
      <label class="feld-label">Hinweis für alle<input id="t-notiz" class="feld" maxlength="300" value="${esc(t.notiz)}" placeholder="z. B. Diesmal in Raum 204"></label>
      <div class="knopf-reihe">
        <button class="knopf">Speichern</button>
        ${Object.keys(o).length ? '<button type="button" class="knopf zweit" data-a="t-zurueck">Auf ersten Mittwoch zurücksetzen</button>' : ''}
      </div>
    </form>
  </section>`;
  if (L.ph === 'liste') {
    const ohne = L.dabei.filter(a => L.zu.vonPerson[a.person] === undefined).length;
    const frei = L.zu.belegt.filter(x => x === null).length;
    html += `<section class="karte">
      <h2>Übrige Posten verteilen</h2>
      <p class="leise">Wer dabei ist, sich aber noch nichts ausgesucht hat, bekommt zufällig einen freien Posten.</p>
      <button class="knopf zweit" data-a="rest-verteilen"${ohne && frei ? '' : ' disabled'}>Zufällig verteilen (${Math.min(ohne, frei)} ${Math.min(ohne, frei) === 1 ? 'Person' : 'Leute'})</button>
    </section>`;
  }
  return html;
}

// Zahlen in der Einkaufsliste: Komma oder Punkt
const ZAHLFELDER = ['proPerson', 'fest', 'schritt', 'preis', 'preisMenge'];
const zahlLesen = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : 0; };
const zahlZeigen = v => (typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? ''));
const sachenSauber = liste => liste
  .filter(s => String(s.name || '').trim())
  .map(s => {
    const name = String(s.name).trim();
    const n = {
      id: String(s.id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
      name, einheit: String(s.einheit || '').trim(), notiz: String(s.notiz || '').trim(),
    };
    for (const f of ZAHLFELDER) n[f] = zahlLesen(s[f]);
    if (!n.schritt) n.schritt = 1;
    if (!n.preisMenge) n.preisMenge = 1;
    return n;
  });

function sacheInfo(s) {
  const n = Math.max(1, Number(S.vorschauN) || 1);
  const sauber = sachenSauber([s])[0];
  if (!sauber) return 'Ohne Namen wird die Sache nicht gespeichert.';
  const menge = mengeText(sauber.einheit, sauber.preisMenge);
  const preis = `Preis: ${euro(sauber.preis)} für ${esc(/^[\d,.]+$/.test(menge) ? menge + ' Stück' : menge)}`;
  const b = bedarf([sauber], n)[0];
  if (!b) return preis + ' · wird gerade nicht gebraucht';
  return `${preis} · bei ${n} ${n === 1 ? 'Person' : 'Leuten'}: ${esc(b.text)} für ca. ${euro(b.kosten)}`;
}

function vorschauHtml() {
  const n = Math.max(1, Math.min(60, Number(S.vorschauN) || 1));
  const auf = aufteilen(sachenSauber(S.entwurf), n);
  if (!auf.posten.length) return '<p class="leise">Noch nichts eingetragen.</p>';
  const zeilen = [];
  for (const p of auf.posten) {
    const z = zeilen.find(x => x.text === p.text);
    if (z) z.anzahl++; else zeilen.push({ text: p.text, kosten: p.kosten, anzahl: 1 });
  }
  return `<ul class="vorschau-liste">${zeilen.map(z => `<li><span>${z.anzahl > 1 ? `<b>${z.anzahl} ×</b> ` : ''}${esc(z.text)}</span><span class="leise">je ca. ${euro(z.kosten)}</span></li>`).join('')}</ul>
    <p class="leise klein">${auf.posten.length} Posten, zusammen ca. ${euro(auf.gesamt)}, pro Person etwa ${euro(auf.ziel)}</p>`;
}

// Feldweise vergleichen (die Datenbank ändert die Reihenfolge der Schlüssel)
const listeVergleich = l => JSON.stringify(sachenSauber(l).map(s => [s.id, s.name, s.einheit, s.notiz, ...ZAHLFELDER.map(f => s[f])]));
function listeGeaendert() {
  return listeVergleich(S.entwurf) !== listeVergleich(S.daten.sachen);
}

function tabListe() {
  if (!S.entwurf) S.entwurf = JSON.parse(JSON.stringify(S.daten.sachen));
  if (S.vorschauN === null) S.vorschauN = lage().dabei.length || S.daten.personen.length || 15;
  const feld = (s, i, f, label, attr = '') =>
    `<label class="feld-label">${label}<input class="feld" data-i="${i}" data-f="${f}" value="${esc(ZAHLFELDER.includes(f) ? zahlZeigen(s[f]) : s[f])}" ${attr}></label>`;
  const karten = S.entwurf.map((s, i) => `<section class="karte sache">
    <div class="sache-kopf">
      <input class="feld sache-name" data-i="${i}" data-f="name" value="${esc(s.name)}" placeholder="Name, z. B. Brötchen" aria-label="Name der Sache">
      <button class="knopf-icon klein" data-a="sache-hoch" data-i="${i}"${i === 0 ? ' disabled' : ''} aria-label="Nach oben">${ICON.hoch}</button>
      <button class="knopf-icon klein" data-a="sache-weg" data-i="${i}" aria-label="Entfernen">${ICON.muell}</button>
    </div>
    <div class="felder">
      ${feld(s, i, 'proPerson', 'Pro Person', 'inputmode="decimal"')}
      ${feld(s, i, 'fest', 'Fest dazu', 'inputmode="decimal"')}
      ${feld(s, i, 'einheit', 'Einheit', 'placeholder="Stück, g, Block/Blöcke"')}
      ${feld(s, i, 'schritt', 'In Schritten von', 'inputmode="decimal"')}
      ${feld(s, i, 'preis', 'Preis ca. (€)', 'inputmode="decimal"')}
      ${feld(s, i, 'preisMenge', 'für Menge', 'inputmode="decimal"')}
    </div>
    ${feld(s, i, 'notiz', 'Hinweis in der Liste', 'placeholder="z. B. schon geschnitten" maxlength="80"')}
    <div class="sache-info leise klein" data-info="${i}">${sacheInfo(s)}</div>
  </section>`).join('');
  const geaendert = listeGeaendert();
  return `<section class="karte">
    <h2>Was gebraucht wird</h2>
    <p class="leise klein"><b>Pro Person:</b> so viel braucht jeder. <b>Fest dazu:</b> kommt einmal dazu, egal wie viele kommen (z. B. 2 Blöcke Butter).
    <b>Schritte:</b> wie fein man aufteilen kann (Mett in 50-g-Schritten, Butter nur ganze Blöcke). <b>Preis:</b> grob geschätzt, damit jeder Posten etwa gleich viel kostet.
    Bei der Einheit gehen Einzahl und Mehrzahl mit Schrägstrich, z. B. „Sack/Säcke“.</p>
  </section>
  ${karten}
  <button class="knopf zweit breit" data-a="sache-neu">+ Sache hinzufügen</button>
  <section class="karte">
    <div class="karte-kopf"><h2>Vorschau</h2>
      <label class="klein vorschau-n">für <input id="vorschau-n" class="feld mini" type="number" min="1" max="60" value="${S.vorschauN}"> Leute</label></div>
    <div id="vorschau">${vorschauHtml()}</div>
  </section>
  <div class="speicher-leiste${geaendert ? ' aktiv' : ''}"><button class="knopf breit" id="sachen-speichern" data-a="sachen-speichern"${geaendert ? '' : ' disabled'}>${geaendert ? 'Änderungen speichern' : 'Alles gespeichert'}</button></div>`;
}

function listeAuffrischen() {
  const v = document.getElementById('vorschau');
  if (v) v.innerHTML = vorschauHtml();
  document.querySelectorAll('[data-info]').forEach(el => { el.innerHTML = sacheInfo(S.entwurf[el.dataset.info]); });
  const k = document.getElementById('sachen-speichern');
  if (k) {
    const g = listeGeaendert();
    k.disabled = !g;
    k.textContent = g ? 'Änderungen speichern' : 'Alles gespeichert';
    k.parentElement.classList.toggle('aktiv', g);
  }
}

function tabLeute() {
  const leute = S.daten.personen;
  const admin = S.rolle === 'admin';
  const modZeile = p => {
    if (S.modFormFuer === p.id) {
      return `<form class="mod-form" data-form="mod" data-id="${p.id}">
        <input id="mod-pin" class="feld" placeholder="PIN, mind. 4 Zeichen" minlength="4" autocomplete="off" required aria-label="PIN für ${esc(p.name)}">
        <button class="knopf klein">${p.mod ? 'PIN ändern' : 'Moderator machen'}</button>
        <button type="button" class="link" data-a="mod-abbrechen">Abbrechen</button>
      </form>`;
    }
    return `<div class="mod-knoepfe">
      <button class="link" data-a="mod-form" data-id="${p.id}">${p.mod ? 'Neue PIN' : 'Zum Moderator machen'}</button>
      ${p.mod ? `<button class="link rot" data-a="mod-weg" data-id="${p.id}">Rechte entziehen</button>` : ''}
    </div>`;
  };
  return `<section class="karte">
    <h2>Namen hinzufügen</h2>
    <p class="leise klein">Einer pro Zeile. Vornamen reichen.</p>
    <form class="spalte" data-form="leute-neu">
      <textarea id="neue-namen" class="feld" rows="4" placeholder="Anna&#10;Ben&#10;…" aria-label="Neue Namen"></textarea>
      <button class="knopf">Hinzufügen</button>
    </form>
  </section>
  <section class="karte">
    <h2>Alle (${leute.length})</h2>
    ${admin ? '<p class="leise klein">Moderatoren dürfen Termine, Einkaufsliste und Namen ändern. Jeder bekommt eine eigene PIN, die du ihm sagst.</p>' : ''}
    <ul class="leute-liste">${leute.map(p => `<li>
      <div class="leute-zeile">
        <input class="feld" data-person="${p.id}" value="${esc(p.name)}" maxlength="40" aria-label="Name ändern">
        ${p.abo ? `<span class="glocke" title="Hat Erinnerungen eingeschaltet" aria-label="Erinnerungen an">${ICON.glocke}</span>` : ''}
        ${p.mod ? '<span class="pille mod">Moderator</span>' : ''}
        <button class="knopf-icon klein" data-a="person-weg" data-id="${p.id}" aria-label="${esc(p.name)} entfernen">${ICON.muell}</button>
      </div>
      ${admin ? modZeile(p) : ''}
    </li>`).join('')}</ul>
    ${leute.length ? `<p class="leise klein">Namen ändern: einfach reinschreiben, gespeichert wird beim Verlassen des Feldes.
      <span class="inline-ic">${ICON.glocke}</span> = hat Erinnerungen eingeschaltet (${leute.filter(p => p.abo).length} von ${leute.length}).</p>` : ''}
  </section>`;
}

function teilLink() {
  const q = DEMO ? '?demo' : GRUPPE !== 'standard' ? '?g=' + encodeURIComponent(GRUPPE) : '';
  return location.origin + location.pathname + q + '#k=' + encodeURIComponent(S.daten.code);
}

function tabMehr() {
  const e = einst();
  const admin = S.rolle === 'admin';
  return `<section class="karte">
    <h2>Allgemein</h2>
    <form class="spalte" data-form="einstellungen">
      <label class="feld-label">Name der Runde<input id="e-name" class="feld" maxlength="40" value="${esc(S.daten.name)}" required></label>
      <div class="feld-label">Die Mitbringliste kommt
        <div class="zeile"><input id="e-tage" class="feld mini" type="number" min="0" max="14" value="${e.tage}" aria-label="Tage vorher"> Tage vorher um
        <input id="e-uhr" class="feld mini" type="number" min="0" max="23" value="${e.uhr}" aria-label="Uhrzeit"> Uhr</div></div>
      <label class="haken"><input id="e-erinnerung" type="checkbox"${e.erinnerung !== false ? ' checked' : ''}> Erinnerungen verschicken
        <span class="leise klein">(an alle, die sie eingeschaltet und noch nicht abgestimmt oder nichts ausgesucht haben)</span></label>
      <div class="feld-label">Die Erinnerung kommt
        <div class="zeile"><input id="e-etage" class="feld mini" type="number" min="0" max="14" value="${e.erinnerungTage}" aria-label="Tage vorher"> Tage vorher um
        <input id="e-euhr" class="feld mini" type="number" min="0" max="23" value="${e.erinnerungUhr}" aria-label="Uhrzeit der Erinnerung"> Uhr</div></div>
      <button class="knopf">Speichern</button>
    </form>
  </section>
  <section class="karte">
    <h2>Link für die Klasse</h2>
    <div class="link-box">${esc(teilLink())}</div>
    <button class="knopf zweit" data-a="teilen">${ICON.teilen}Teilen oder kopieren</button>
    ${admin ? `<form class="spalte abstand" data-form="klassencode">
      <label class="feld-label">Klassencode ändern<input id="e-code" class="feld" minlength="4" autocomplete="off" autocapitalize="off" required placeholder="neuer Klassencode"></label>
      <p class="leise klein">Danach funktioniert der alte Link nicht mehr, alle brauchen den neuen.</p>
      <button class="knopf zweit">Klassencode ändern</button>
    </form>` : ''}
  </section>
  ${admin ? `<section class="karte">
    <h2>Admin-Code</h2>
    <form class="spalte" data-form="admincode">
      <label class="feld-label">Neuer Admin-Code<input id="e-admin" class="feld" type="password" minlength="6" autocomplete="new-password" required></label>
      <button class="knopf zweit">Admin-Code ändern</button>
    </form>
  </section>` : ''}
  <section class="karte">
    <button class="knopf zweit breit" data-a="abmelden">Auf diesem Gerät abmelden</button>
  </section>`;
}

// ---------- Aktionen ----------
async function mitLaden(fn, erfolg) {
  if (S.busy) return false;
  S.busy = true;
  document.body.classList.add('busy');
  try {
    await fn();
    await neuLaden(true);
    if (erfolg) toast(erfolg, 'gut');
    return true;
  } catch (e) {
    toast(fehlerText(e), 'schlecht');
    return false;
  } finally {
    S.busy = false;
    document.body.classList.remove('busy');
  }
}

function terminSpeichern(t, aenderung, text) {
  const o = S.daten.termine.find(x => x.schluessel === t.schluessel) || {};
  const daten = { schluessel: t.schluessel, datum: o.datum || null, abgesagt: !!o.abgesagt, frei: !!o.frei, notiz: o.notiz || '', ...aenderung };
  return mitLaden(() => api.admin(S.mod, 'termin', daten), text);
}

async function modPruefen() {
  if (!S.mod || S.rolle) return;
  try {
    const r = await api.admin(S.mod, 'pruefen');
    S.rolle = r.rolle;
  } catch {
    S.mod = null;
    speicher.weg(K.mod);
  }
  render();
}

function oben() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

const AKTIONEN = {
  termin(el) {
    const i = S.termine.findIndex(x => x.schluessel === S.gewaehlt) + Number(el.dataset.d);
    if (S.termine[i]) { S.gewaehlt = S.termine[i].schluessel; render(); }
  },
  async ich(el) {
    S.ich = el.dataset.id;
    speicher.set(K.ich, S.ich);
    render();
    if (S.push === 'an') { await pushStatusLaden(); render(); }
  },
  async 'push-an'() {
    if (!S.ich) { toast('Tipp zuerst oben auf deinen Namen.'); return; }
    if (S.busy) return;
    S.busy = true;
    try {
      const abo = await abonnieren();
      await api.abo(S.code, S.ich, abo.toJSON());
      speicher.set(K.abo, S.ich);
      S.push = 'an';
      toast('Erinnerung ist an', 'gut');
    } catch (e) {
      if (e.code === 'blockiert') { S.push = 'blockiert'; toast('Benachrichtigungen wurden nicht erlaubt.'); }
      else if (e.code === 'abgebrochen') toast('Ohne Erlaubnis geht es leider nicht.');
      else if (e.code === 'kein_sw') toast('Das klappt gerade nicht. Lade die Seite neu und versuch es nochmal.', 'schlecht');
      else if (e instanceof DOMException) toast('Dieser Browser kann leider keine Erinnerungen empfangen. Probier es in Chrome oder als App.', 'schlecht');
      else toast(fehlerText(e), 'schlecht');
    } finally {
      S.busy = false;
      render();
    }
  },
  async 'push-aus'() {
    try {
      const abo = await aboHolen();
      if (abo) {
        await api.aboWeg(S.code, abo.endpoint).catch(() => {});
        await abo.unsubscribe();
      }
      speicher.weg(K.abo);
      S.push = 'aus';
      toast('Erinnerung ist aus');
    } catch (e) {
      toast(fehlerText(e), 'schlecht');
    }
    render();
  },
  'ich-weg'() { S.ich = null; speicher.weg(K.ich); render(); oben(); },
  async dabei(el) {
    const L = lage();
    const wert = el.dataset.v === '1';
    if (L.meine?.dabei === wert) return;
    const ok = await mitLaden(() => api.antworten(S.code, L.t.schluessel, S.ich, wert),
      wert ? (L.ph === 'liste' ? 'Schön! Such dir jetzt was aus.' : 'Schön, du bist dabei!') : 'Alles klar, du bist raus.');
    if (ok && !wert) gesehenSetzen(L.t, '');
  },
  async nehmen(el) {
    if (!S.ich) { toast('Tipp zuerst oben auf deinen Namen.'); oben(); return; }
    const t = lage().t;
    const ok = await mitLaden(() => api.nehmen(S.code, t.schluessel, S.ich, el.dataset.key), 'Eingetragen!');
    if (ok) {
      const L = lage();
      const idx = L.zu.vonPerson[S.ich];
      if (idx !== undefined) gesehenSetzen(L.t, L.auf.posten[idx].text);
      render();
    }
  },
  async abgeben() {
    const t = lage().t;
    const ok = await mitLaden(() => api.nehmen(S.code, t.schluessel, S.ich, null), 'Wieder frei. Such dir was anderes aus.');
    if (ok) gesehenSetzen(t, '');
  },
  gesehen() {
    const L = lage();
    const idx = L.zu.vonPerson[S.ich];
    if (idx !== undefined) gesehenSetzen(L.t, L.auf.posten[idx].text);
    render();
  },
  moderation() { S.ansicht = 'moderation'; S.fehler = ''; render(); oben(); modPruefen(); },
  zurueck() {
    if (S.entwurf && listeGeaendert() && !confirm('Die Änderungen an der Einkaufsliste sind nicht gespeichert. Verwerfen?')) return;
    S.entwurf = null; S.vorschauN = null; S.modFormFuer = null;
    S.ansicht = 'haupt';
    render();
    oben();
  },
  tab(el) {
    if (S.tab === 'liste' && el.dataset.tab !== 'liste' && S.entwurf && listeGeaendert()
      && !confirm('Die Änderungen an der Einkaufsliste sind nicht gespeichert. Verwerfen?')) return;
    if (el.dataset.tab !== 'liste') { S.entwurf = null; S.vorschauN = null; }
    S.tab = el.dataset.tab;
    render();
  },
  async installieren() {
    const p = S.installPrompt;
    if (!p) return;
    p.prompt();
    try { await p.userChoice; } catch { /* egal */ }
    S.installPrompt = null;
    render();
  },
  'install-weg'() { speicher.set(K.install, true); render(); },
  async teilen() {
    const url = teilLink();
    const text = `${S.daten.name}: Stimm ab, ob du dabei bist, und such dir aus, was du mitbringst.`;
    if (navigator.share) {
      try { await navigator.share({ title: S.daten.name, text, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); toast('Link kopiert', 'gut'); } catch { prompt('Link zum Kopieren:', url); }
  },
  async 'demo-reset'() {
    if (!confirm('Demo auf den Anfang zurücksetzen?')) return;
    await api.admin(DEMO_CODES.admin, 'gruppe_loeschen');
    Object.values(K).forEach(k => speicher.weg(k));
    location.reload();
  },
  'einrichten-zeigen'() { S.fehler = ''; S.ansicht = 'einrichten'; render(); },
  'code-zeigen'() { S.fehler = ''; S.ansicht = 'code'; render(); },
  'neu-versuchen'() { location.reload(); },
  't-verlegen'(el) { terminSpeichern(lage().t, { datum: el.dataset.datum, abgesagt: false }, `Verlegt auf ${kurzDatum(el.dataset.datum)}`); },
  't-absagen'() { terminSpeichern(lage().t, { abgesagt: true }, 'Termin fällt aus'); },
  't-bleibt'() { const t = lage().t; terminSpeichern(t, { datum: t.datum }, 'Termin bleibt'); },
  't-zurueck'() {
    const t = lage().t;
    terminSpeichern(t, { datum: null, abgesagt: false, frei: false, notiz: '' }, 'Zurückgesetzt');
  },
  async 'rest-verteilen'() {
    const L = lage();
    const ohne = L.dabei.map(a => a.person).filter(p => L.zu.vonPerson[p] === undefined);
    const frei = L.auf.posten.filter((_, i) => L.zu.belegt[i] === null);
    for (let i = ohne.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ohne[i], ohne[j]] = [ohne[j], ohne[i]]; }
    const paare = ohne.slice(0, frei.length).map((p, i) => [p, frei[i].key]);
    if (!paare.length || !confirm(`${paare.length} ${paare.length === 1 ? 'Person bekommt' : 'Leute bekommen'} zufällig einen freien Posten. Weiter?`)) return;
    await mitLaden(async () => {
      for (const [p, key] of paare) await api.nehmen(S.code, L.t.schluessel, p, key);
    }, `${paare.length} ${paare.length === 1 ? 'Posten' : 'Posten'} verteilt`);
  },
  'sache-neu'() {
    S.entwurf.push({ id: 's' + Date.now().toString(36), name: '', einheit: 'Stück', proPerson: 0, fest: 1, schritt: 1, preis: 1, preisMenge: 1, notiz: '' });
    render();
    const felder = document.querySelectorAll('.sache-name');
    felder[felder.length - 1]?.focus();
  },
  'sache-hoch'(el) {
    const i = Number(el.dataset.i);
    [S.entwurf[i - 1], S.entwurf[i]] = [S.entwurf[i], S.entwurf[i - 1]];
    render();
  },
  'sache-weg'(el) {
    const i = Number(el.dataset.i);
    const name = S.entwurf[i].name || 'Diese Sache';
    if (!confirm(`${name} von der Liste nehmen?`)) return;
    S.entwurf.splice(i, 1);
    render();
  },
  async 'sachen-speichern'() {
    const sauber = sachenSauber(S.entwurf);
    const ok = await mitLaden(() => api.admin(S.mod, 'sachen', sauber), 'Einkaufsliste gespeichert');
    if (ok) { S.entwurf = JSON.parse(JSON.stringify(S.daten.sachen)); render(); }
  },
  async 'person-weg'(el) {
    const name = personName(el.dataset.id);
    if (!confirm(`${name} entfernen? Die Antworten von ${name} verschwinden auch.`)) return;
    if (el.dataset.id === S.ich) { S.ich = null; speicher.weg(K.ich); }
    await mitLaden(() => api.admin(S.mod, 'person_loeschen', { id: el.dataset.id }), `${name} entfernt`);
  },
  'mod-form'(el) { S.modFormFuer = el.dataset.id; render(); document.getElementById('mod-pin')?.focus(); },
  'mod-abbrechen'() { S.modFormFuer = null; render(); },
  async 'mod-weg'(el) {
    const name = personName(el.dataset.id);
    if (!confirm(`${name} die Moderator-Rechte entziehen?`)) return;
    await mitLaden(() => api.admin(S.mod, 'mod_entfernen', { id: el.dataset.id }), `${name} ist kein Moderator mehr`);
  },
  abmelden() {
    if (S.daten && S.code !== S.daten.code) { S.code = S.daten.code; speicher.set(K.code, S.code); }
    S.mod = null; S.rolle = null; speicher.weg(K.mod);
    S.ansicht = 'haupt';
    neuLaden(true);
    toast('Abgemeldet');
  },
};

const FORMULARE = {
  code() {
    const v = document.getElementById('code-feld').value.trim();
    if (!v) return;
    S.code = v;
    speicher.set(K.code, v);
    S.fehler = '';
    S.ansicht = 'laden';
    render();
    neuLaden(true);
  },
  async einrichten() {
    const name = document.getElementById('ein-name').value.trim();
    const code = document.getElementById('ein-code').value.trim();
    const admin = document.getElementById('ein-admin').value;
    try {
      await api.einrichten(name, code, admin, VORLAGE);
    } catch (e) {
      S.fehler = fehlerText(e);
      render();
      return;
    }
    S.code = code; speicher.set(K.code, code);
    S.mod = admin; speicher.set(K.mod, admin);
    S.rolle = 'admin';
    S.ansicht = 'laden';
    await neuLaden(true);
    S.ansicht = 'moderation';
    S.tab = 'leute';
    render();
    toast('Eingerichtet! Trag jetzt die Namen ein.', 'gut');
  },
  async 'login-mod'() {
    const cred = document.getElementById('login-person').value + ':' + document.getElementById('login-pin').value;
    await anmelden(cred);
  },
  async 'login-admin'() {
    await anmelden(document.getElementById('login-admin').value);
  },
  async termin() {
    const t = lage().t;
    const datum = document.getElementById('t-datum').value;
    await terminSpeichern(t, {
      datum: datum && (datum !== t.regulaer || t.festgelegt) ? datum : null,
      abgesagt: document.getElementById('t-abgesagt').checked,
      frei: document.getElementById('t-frei').checked,
      notiz: document.getElementById('t-notiz').value.trim(),
    }, 'Termin gespeichert');
  },
  async 'leute-neu'() {
    const namen = document.getElementById('neue-namen').value.split('\n').map(s => s.trim()).filter(Boolean);
    const vorhanden = new Set(S.daten.personen.map(p => p.name.toLowerCase()));
    const neu = [...new Set(namen)].filter(n => !vorhanden.has(n.toLowerCase())).map(n => n.slice(0, 40));
    if (!neu.length) { toast(namen.length ? 'Die Namen gibt es schon.' : 'Schreib mindestens einen Namen rein.'); return; }
    await mitLaden(async () => {
      for (const name of neu) await api.admin(S.mod, 'person_neu', { name });
    }, neu.length === 1 ? `${neu[0]} hinzugefügt` : `${neu.length} Namen hinzugefügt`);
  },
  async mod(f) {
    const pin = document.getElementById('mod-pin').value;
    const name = personName(f.dataset.id);
    const ok = await mitLaden(() => api.admin(S.mod, 'mod_setzen', { id: f.dataset.id, pin }), `${name} ist Moderator. Sag ${name} die PIN.`);
    if (ok) { S.modFormFuer = null; render(); }
  },
  async einstellungen() {
    const zahl = (id, max) => Math.max(0, Math.min(max, Math.round(zahlLesen(document.getElementById(id).value))));
    await mitLaden(() => api.admin(S.mod, 'einstellungen', {
      name: document.getElementById('e-name').value.trim(),
      einstellungen: {
        ...einst(), tage: zahl('e-tage', 14), uhr: zahl('e-uhr', 23),
        erinnerung: document.getElementById('e-erinnerung').checked,
        erinnerungTage: zahl('e-etage', 14), erinnerungUhr: zahl('e-euhr', 23),
      },
    }), 'Gespeichert');
  },
  async klassencode() {
    const code = document.getElementById('e-code').value.trim();
    if (!confirm('Klassencode wirklich ändern? Der alte Link funktioniert dann nicht mehr.')) return;
    const warKlasse = S.code === S.daten.code;
    try {
      await api.admin(S.mod, 'klassencode', { code });
    } catch (e) { toast(fehlerText(e), 'schlecht'); return; }
    if (warKlasse) { S.code = code; speicher.set(K.code, code); }
    await neuLaden(true);
    toast('Neuer Klassencode gilt. Teil den neuen Link.', 'gut');
  },
  async admincode() {
    const code = document.getElementById('e-admin').value;
    try {
      await api.admin(S.mod, 'admincode', { code });
    } catch (e) { toast(fehlerText(e), 'schlecht'); return; }
    if (S.code === S.mod) { S.code = code; speicher.set(K.code, code); }
    S.mod = code; speicher.set(K.mod, code);
    render();
    toast('Neuer Admin-Code gilt.', 'gut');
  },
};

async function anmelden(cred) {
  try {
    const r = await api.admin(cred, 'pruefen');
    S.mod = cred; S.rolle = r.rolle; S.fehler = '';
    speicher.set(K.mod, cred);
    S.tab = 'termin';
    render();
  } catch (e) {
    S.fehler = e.code === 'falscher_code' ? 'Das passt nicht. Prüf Name und PIN oder den Admin-Code.' : fehlerText(e);
    render();
  }
}

async function personUmbenennen(el) {
  const name = el.value.trim();
  const alt = personName(el.dataset.person);
  if (!name || name === alt) { el.value = alt; return; }
  await mitLaden(() => api.admin(S.mod, 'person_name', { id: el.dataset.person, name }), `Umbenannt in ${name}`);
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled || !AKTIONEN[el.dataset.a]) return;
  e.preventDefault();
  AKTIONEN[el.dataset.a](el);
});

document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]');
  if (!f || !FORMULARE[f.dataset.form]) return;
  e.preventDefault();
  if (!S.busy) FORMULARE[f.dataset.form](f);
});

document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.f !== undefined && el.dataset.i !== undefined && S.entwurf) {
    const s = S.entwurf[Number(el.dataset.i)];
    s[el.dataset.f] = el.value;
    listeAuffrischen();
  } else if (el.id === 'vorschau-n') {
    S.vorschauN = el.value;
    listeAuffrischen();
  }
});

document.addEventListener('change', e => {
  if (e.target.dataset.person) personUmbenennen(e.target);
});

// ---------- App auf dem Startbildschirm ----------
addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  S.installPrompt = e;
  if (S.ansicht === 'haupt') render();
});
addEventListener('appinstalled', () => {
  S.installPrompt = null;
  speicher.set(K.install, true);
  if (S.ansicht === 'haupt') render();
});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

// Zum Testen auf dem eigenen Rechner: Zustand in der Konsole erreichbar
if (location.hostname === 'localhost') window.__mb = { S, render, lage };

// ---------- Start ----------
ferienLaden().then(neu => {
  if (neu && S.daten) { termineBerechnen(); if (S.ansicht === 'haupt') render(); }
});

if (!S.code) {
  S.ansicht = 'code';
  render();
} else {
  render();
  neuLaden(true);
}

// Alle 20 Sekunden nachsehen, ob sich etwas getan hat (nur wenn die Seite sichtbar ist)
setInterval(() => {
  if (document.visibilityState !== 'visible' || S.ansicht !== 'haupt' || S.busy || !S.code) return;
  neuLaden();
}, 20000);
// Jede Minute neu zeichnen, damit z. B. Montag 18 Uhr die Liste von selbst erscheint
setInterval(() => { if (S.ansicht === 'haupt' && !S.busy && S.daten) { termineBerechnen(); render(); } }, 60000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.ansicht === 'haupt' && S.code && !S.busy) neuLaden();
});
