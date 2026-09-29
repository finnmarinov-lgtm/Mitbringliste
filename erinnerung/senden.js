// Verschickt die fälligen Erinnerungen. Läuft als GitHub-Auftrag alle 30 Minuten (.github/workflows/erinnerung.yml).
// Aufruf: TZ=Europe/Berlin MB_GEHEIM=... VAPID_PRIVATE=... node erinnerung/senden.js
//   --probe       nur anzeigen, was verschickt würde (nichts senden, nichts merken)
//   MB_TEST=true  eine Testnachricht an alle angemeldeten Geräte schicken
// Achtung: Die Protokolle öffentlicher Repositories kann jeder lesen, deshalb nur Zahlen ausgeben, keine Namen.
import webpush from 'web-push';
import { SB } from '../js/api.js';
import { VAPID_PUBLIC } from '../js/push-schluessel.js';
import { planen, ADRESSE } from './planen.js';

const PROBE = process.argv.includes('--probe');
const TEST = process.env.MB_TEST === 'true';
const GEHEIM = process.env.MB_GEHEIM;
if (!GEHEIM) { console.log('Erinnerungen sind noch nicht eingerichtet (MB_GEHEIM fehlt).'); process.exit(0); }

async function rpc(fn, body) {
  const res = await fetch(`${SB.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SB.key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${fn}: HTTP ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

// Eine Nachricht an ein Gerät: 'ok', 'weg' (abgemeldet) oder 'fehler'
async function schicken(abo, nachricht) {
  try {
    await webpush.sendNotification(
      { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
      JSON.stringify(nachricht),
      { TTL: 6 * 3600, urgency: 'high' },
    );
    return 'ok';
  } catch (err) {
    // 404/410: Das Gerät hat die Erinnerungen abbestellt oder die App gelöscht
    if (err.statusCode === 404 || err.statusCode === 410) return 'weg';
    console.log(`  Versand fehlgeschlagen: HTTP ${err.statusCode || '-'}`);
    return 'fehler';
  }
}

const jetzt = process.env.MB_JETZT ? new Date(process.env.MB_JETZT) : new Date();
const gruppen = await rpc('mb_versand_daten', { p_geheim: GEHEIM });
const plan = gruppen.flatMap(g => planen(g, jetzt));
console.log(`${jetzt.toString().slice(0, 21)}: ${gruppen.length} Liste(n) mit Erinnerungen, ${plan.length} fällig`);

if (PROBE) {
  for (const e of plan) {
    const g = gruppen.find(x => x.id === e.gruppe);
    const name = g.personen.find(p => p.id === e.person)?.name;
    console.log(`  ${e.gruppe} · ${name} · ${e.art} · ${e.abos.length} Gerät(e)\n    ${e.titel}\n    ${e.text}`);
  }
  process.exit(0);
}
if (!plan.length && !TEST) process.exit(0);

if (!process.env.VAPID_PRIVATE) { console.error('VAPID_PRIVATE fehlt'); process.exit(1); }
webpush.setVapidDetails(ADRESSE, VAPID_PUBLIC, process.env.VAPID_PRIVATE);

const gesendet = [], abgelaufen = [];
const zaehler = { ok: 0, weg: 0, fehler: 0 };

if (TEST) {
  for (const g of gruppen) {
    for (const abo of g.abos) {
      const r = await schicken(abo, {
        titel: 'Test: Erinnerungen funktionieren',
        text: `${g.name}: So sieht eine Erinnerung aus. Tipp drauf, dann öffnet sich die App.`,
        url: ADRESSE + (g.id !== 'standard' ? '?g=' + encodeURIComponent(g.id) : ''), tag: 'test',
      });
      zaehler[r]++;
      if (r === 'weg') abgelaufen.push(abo.endpoint);
    }
  }
} else {
  for (const e of plan) {
    let angekommen = false;
    for (const abo of e.abos) {
      const r = await schicken(abo, { titel: e.titel, text: e.text, url: e.url, tag: `${e.schluessel}-${e.art}` });
      zaehler[r]++;
      if (r === 'ok') angekommen = true;
      if (r === 'weg') abgelaufen.push(abo.endpoint);
    }
    // Nur merken, wenn es angekommen ist; sonst wird es beim nächsten Lauf nochmal versucht
    if (angekommen) gesendet.push({ gruppe: e.gruppe, schluessel: e.schluessel, person: e.person, art: e.art });
  }
}
await rpc('mb_versand_merken', { p_geheim: GEHEIM, p_gesendet: gesendet, p_abgelaufen: abgelaufen });
console.log(`${TEST ? 'Test: ' : ''}${zaehler.ok} zugestellt, ${zaehler.weg} abgemeldete Geräte entfernt, ${zaehler.fehler} Fehler`);
if (zaehler.fehler && !zaehler.ok) process.exit(1);
