// Prueft die Aufteilung fuer 1 bis 30 Leute. Aufruf: node test/aufteilen.test.js
import { aufteilen, zuordnen, euro } from '../js/aufteilen.js';
import { VORLAGE } from '../js/vorlage.js';

let fehler = 0;
const pruef = (ok, text) => { if (!ok) { fehler++; console.log('FEHLER:', text); } };
const zeigen = process.argv.includes('-v');

for (let n = 1; n <= 30; n++) {
  const t0 = performance.now();
  const r = aufteilen(VORLAGE, n);
  const ms = performance.now() - t0;
  pruef(r.posten.length <= n, `n=${n}: mehr Posten als Leute`);
  // Summe der Posten = Gesamtbedarf
  for (const b of r.bedarf) {
    const summe = r.posten.flatMap(p => p.teile).filter(t => t.id === b.sache.id).reduce((a, t) => a + t.menge, 0);
    pruef(Math.abs(summe - b.menge) < 1e-6, `n=${n}: ${b.sache.id} ${summe} statt ${b.menge}`);
  }
  const kosten = r.posten.map(p => p.kosten);
  const max = Math.max(...kosten), min = Math.min(...kosten);
  pruef(ms < 200, `n=${n}: zu langsam (${ms.toFixed(0)} ms)`);
  if (zeigen || n === 15 || n === 12 || n === 3) {
    console.log(`\n${n} Leute: ${r.posten.length} Posten, Ziel ${euro(r.ziel)}, Spanne ${euro(min)} bis ${euro(max)} (${ms.toFixed(1)} ms)`);
    for (const p of r.posten) console.log('  ', p.key.padEnd(20), p.text.padEnd(40), euro(p.kosten));
  } else {
    console.log(`${String(n).padStart(2)} Leute: ${r.posten.length} Posten, ${euro(min)} bis ${euro(max)}, Ziel ${euro(r.ziel)}`);
  }
}

// Zuordnung: 15 Leute, alle haben gewaehlt, dann springt einer ab
const r15 = aufteilen(VORLAGE, 15);
const leute = Array.from({ length: 15 }, (_, i) => 'p' + String(i).padStart(2, '0'));
const antworten = leute.map((p, i) => ({ person: p, dabei: true, posten: r15.posten[i].key, seit: '2026-10-05T18:0' + (i % 10) + ':' + String(i).padStart(2, '0') }));
const z15 = zuordnen(r15.posten, antworten);
pruef(z15.belegt.every(x => x !== null), 'alle 15 Posten belegt');
pruef(z15.verloren.length === 0, 'niemand verloren');
// Einer mit Broetchen springt ab
const weg = antworten.find(a => a.posten === 'broetchen');
const rest = antworten.filter(a => a !== weg);
const r14 = aufteilen(VORLAGE, 14);
const z14 = zuordnen(r14.posten, rest);
console.log('\nNach Absage (Broetchen) bei 14:', r14.posten.map(p => p.text).join(' | '));
console.log('  verloren:', z14.verloren, ' frei:', z14.belegt.filter(x => x === null).length);
// Einer mit Mett springt ab
const wegM = antworten.find(a => a.posten === 'mett');
const z14m = zuordnen(r14.posten, antworten.filter(a => a !== wegM));
console.log('Nach Absage (Mett) bei 14: verloren', z14m.verloren, ' frei:', z14m.belegt.filter(x => x === null).length);
// Doppelt gewaehlt: einer mehr will Mett, als es Mett-Posten gibt
const mettPosten = r15.posten.filter(p => p.key === 'mett').length;
const doppelt = leute.slice(0, mettPosten + 1).map((p, i) => ({ person: p, dabei: true, posten: 'mett', seit: '2026-10-05T18:00:' + String(i).padStart(2, '0') }));
const zd = zuordnen(r15.posten, doppelt);
pruef(zd.verloren.length === 1 && zd.verloren[0] === leute[mettPosten], 'der Letzte beim Mett geht leer aus');
// Ohne Preise
const ohne = aufteilen(VORLAGE.map(s => ({ ...s, preis: 0 })), 10);
pruef(ohne.posten.length === 10, 'ohne Preise trotzdem 10 Posten: ' + ohne.posten.length);

console.log(fehler ? `\n${fehler} Fehler` : '\nAlles ok');
process.exit(fehler ? 1 : 0);
