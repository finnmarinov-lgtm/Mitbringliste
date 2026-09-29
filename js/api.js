// Verbindung zur Datenbank (Supabase, dasselbe Projekt wie Petri Heil und Feuer Frei).
// Mit ?demo in der Adresse läuft stattdessen alles nur im Browser (zum Ausprobieren).

import { VORLAGE, EINSTELLUNGEN } from './vorlage.js';

export const SB = {
  url: 'https://yzzipjtounvktdhhvrnt.supabase.co',
  key: 'sb_publishable_OCNFFT4wa4CMaHyhcLAY4A_u2flZF1s', // öffentlicher Schlüssel, darf im Code stehen
};

export class ApiFehler extends Error {
  constructor(code) { super(code); this.code = code; }
}

async function rpc(fn, body) {
  let res;
  try {
    res = await fetch(SB.url + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { apikey: SB.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiFehler('netz');
  }
  if (!res.ok) {
    let msg = '';
    try { msg = (await res.json()).message || ''; } catch { /* keine Antwort */ }
    if (res.status === 404 || /could not find the function/i.test(msg)) throw new ApiFehler('kein_sql');
    throw new ApiFehler(msg || 'fehler_' + res.status);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function supabaseApi(gruppe) {
  return {
    demo: false,
    laden: code => rpc('mb_laden', { p_gruppe: gruppe, p_code: code }),
    antworten: (code, schluessel, person, dabei) =>
      rpc('mb_antworten', { p_gruppe: gruppe, p_code: code, p_schluessel: schluessel, p_person: person, p_dabei: dabei }),
    nehmen: (code, schluessel, person, posten) =>
      rpc('mb_nehmen', { p_gruppe: gruppe, p_code: code, p_schluessel: schluessel, p_person: person, p_posten: posten }),
    admin: (code, aktion, daten = {}) =>
      rpc('mb_admin', { p_gruppe: gruppe, p_admin: code, p_aktion: aktion, p_daten: daten }),
    einrichten: (name, code, admin, sachen) =>
      rpc('mb_einrichten', { p_gruppe: gruppe, p_name: name, p_code: code, p_admin: admin, p_sachen: sachen }),
    abo: (code, person, abo) => rpc('mb_abo_setzen', { p_gruppe: gruppe, p_code: code, p_person: person, p_abo: abo }),
    aboWeg: (code, endpoint) => rpc('mb_abo_loeschen', { p_gruppe: gruppe, p_code: code, p_endpoint: endpoint }),
  };
}

// ---------- Demo: gleiche Regeln wie supabase.sql, gespeichert im Browser ----------
const DEMO_NAMEN = ['Alex', 'Ben', 'Clara', 'Deniz', 'Ella', 'Finn', 'Greta', 'Hannes', 'Ida', 'Jonas', 'Kim', 'Lea', 'Mats', 'Nora', 'Ole'];
export const DEMO_CODES = { klasse: 'demo', admin: 'demo-admin' };

function demoApi(gruppe) {
  const SCHLUESSEL = 'mb_demo_' + gruppe;
  const neueId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
  const lesen = () => {
    try { return JSON.parse(localStorage.getItem(SCHLUESSEL) || 'null'); } catch { return null; }
  };
  const schreiben = db => localStorage.setItem(SCHLUESSEL, JSON.stringify(db));
  let db = lesen();
  if (!db) {
    db = {
      name: 'Mett-Frühstück (Demo)', code: DEMO_CODES.klasse, admin: DEMO_CODES.admin,
      sachen: VORLAGE, einstellungen: EINSTELLUNGEN,
      personen: DEMO_NAMEN.map(name => ({ id: neueId(), name })), termine: [], antworten: [],
    };
    schreiben(db);
  }
  const warte = () => new Promise(r => setTimeout(r, 120));
  // wie mb_rolle: 'admin', 'mod' (Personen-ID:PIN) oder 'klasse'
  const rolle = code => {
    db = lesen();
    if (code === db.admin) return 'admin';
    if (db.personen.some(p => p.pin && code === p.id + ':' + p.pin)) return 'mod';
    if (code === db.code) return 'klasse';
    throw new ApiFehler('falscher_code');
  };
  const person = id => {
    if (!db.personen.some(p => p.id === id)) throw new ApiFehler('keine_person');
  };
  const antwort = (schluessel, pid) => db.antworten.find(a => a.schluessel === schluessel && a.person === pid);
  return {
    demo: true,
    async laden(code) {
      await warte();
      const r = rolle(code);
      return {
        name: db.name, code: db.code, sachen: db.sachen, einstellungen: db.einstellungen, rolle: r,
        personen: db.personen.map(p => ({ id: p.id, name: p.name, mod: !!p.pin, abo: (db.abos || []).some(a => a.person === p.id) }))
          .sort((a, b) => a.name.localeCompare(b.name, 'de')),
        termine: db.termine, antworten: db.antworten,
      };
    },
    async antworten(code, schluessel, pid, dabei) {
      await warte(); rolle(code); person(pid);
      if (dabei === null) db.antworten = db.antworten.filter(a => !(a.schluessel === schluessel && a.person === pid));
      else {
        const a = antwort(schluessel, pid);
        if (a) { a.dabei = dabei; if (!dabei) { a.posten = null; a.seit = null; } } else db.antworten.push({ schluessel, person: pid, dabei, posten: null, seit: null });
      }
      schreiben(db);
    },
    async nehmen(code, schluessel, pid, posten) {
      await warte(); rolle(code); person(pid);
      const seit = posten ? new Date().toISOString() : null;
      const a = antwort(schluessel, pid);
      if (a) Object.assign(a, { dabei: true, posten: posten || null, seit });
      else db.antworten.push({ schluessel, person: pid, dabei: true, posten: posten || null, seit });
      schreiben(db);
    },
    async admin(code, aktion, d = {}) {
      await warte();
      const r = rolle(code);
      if (r === 'klasse') throw new ApiFehler('falscher_code');
      if (r !== 'admin' && ['mod_setzen', 'mod_entfernen', 'klassencode', 'admincode', 'gruppe_loeschen'].includes(aktion)) throw new ApiFehler('nur_admin');
      switch (aktion) {
        case 'pruefen': return { rolle: r };
        case 'sachen': db.sachen = d; break;
        case 'einstellungen': if (d.name?.trim()) db.name = d.name.trim(); if (d.einstellungen) db.einstellungen = d.einstellungen; break;
        case 'person_neu': { const id = neueId(); db.personen.push({ id, name: d.name.trim() }); schreiben(db); return { id }; }
        case 'person_name': db.personen.find(p => p.id === d.id).name = d.name.trim(); break;
        case 'person_loeschen':
          db.personen = db.personen.filter(p => p.id !== d.id);
          db.antworten = db.antworten.filter(a => a.person !== d.id); break;
        case 'mod_setzen':
          if ((d.pin || '').length < 4) throw new ApiFehler('pin_zu_kurz');
          db.personen.find(p => p.id === d.id).pin = d.pin; break;
        case 'mod_entfernen': delete db.personen.find(p => p.id === d.id).pin; break;
        case 'termin': {
          db.termine = db.termine.filter(t => t.schluessel !== d.schluessel);
          const t = { schluessel: d.schluessel, datum: d.datum || null, abgesagt: !!d.abgesagt, frei: !!d.frei, notiz: d.notiz || '' };
          if (t.datum || t.abgesagt || t.frei || t.notiz) db.termine.push(t);
          break;
        }
        case 'klassencode':
          if ((d.code || '').length < 4) throw new ApiFehler('code_zu_kurz');
          if (d.code === db.admin) throw new ApiFehler('codes_gleich');
          db.code = d.code; break;
        case 'admincode':
          if ((d.code || '').length < 6) throw new ApiFehler('code_zu_kurz');
          if (d.code === db.code) throw new ApiFehler('codes_gleich');
          db.admin = d.code; break;
        case 'gruppe_loeschen': localStorage.removeItem(SCHLUESSEL); return {};
        default: throw new ApiFehler('unbekannte_aktion');
      }
      schreiben(db);
      return {};
    },
    async einrichten() { throw new ApiFehler('gibt_es_schon'); },
    async abo(code, pid, abo) {
      await warte(); rolle(code); person(pid);
      db.abos = (db.abos || []).filter(a => a.endpoint !== abo.endpoint).concat({ endpoint: abo.endpoint, person: pid });
      schreiben(db);
    },
    async aboWeg(code, endpoint) {
      await warte(); rolle(code);
      db.abos = (db.abos || []).filter(a => a.endpoint !== endpoint);
      schreiben(db);
    },
  };
}

export function macheApi(gruppe, demo) {
  return demo ? demoApi(gruppe) : supabaseApi(gruppe);
}

export const FEHLERTEXT = {
  netz: 'Keine Verbindung. Bist du online?',
  kein_sql: 'Die Datenbank ist noch nicht eingerichtet (SQL-Block fehlt).',
  falscher_code: 'Der Code stimmt nicht.',
  keine_gruppe: 'Diese Liste gibt es noch nicht.',
  keine_person: 'Diesen Namen gibt es nicht mehr. Lade die Seite neu.',
  code_zu_kurz: 'Der Code ist zu kurz (Klassencode mindestens 4, Admin-Code mindestens 6 Zeichen).',
  codes_gleich: 'Klassencode und Admin-Code müssen verschieden sein.',
  gibt_es_schon: 'Diese Liste ist schon eingerichtet.',
  ungueltig: 'Da stimmt etwas mit der Eingabe nicht.',
  nur_admin: 'Das darf nur der Admin.',
  pin_zu_kurz: 'Die PIN muss mindestens 4 Zeichen haben.',
};

export function fehlerText(e) {
  return FEHLERTEXT[e?.code] || 'Etwas ist schiefgegangen (' + (e?.code || e?.message || e) + ').';
}
