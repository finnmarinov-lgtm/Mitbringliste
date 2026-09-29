// Prueft, wer wann erinnert wird. Aufruf: node test/erinnerung.test.js
import { planen } from '../erinnerung/planen.js';
import { VORLAGE } from '../js/vorlage.js';

let fehler = 0;
const pruef = (ok, text, extra = '') => { console.log((ok ? 'ok    ' : 'FEHLER') + ' ' + text + (extra ? '  ' + extra : '')); if (!ok) fehler++; };
const T = '2026-10-07';
const leute = ['A', 'B', 'C', 'D', 'E'].map(n => ({ id: 'id-' + n, name: n }));
const basis = () => ({
  id: 'standard', name: 'Mett-Frühstück', sachen: VORLAGE, einstellungen: {}, personen: leute, termine: [],
  antworten: [
    { schluessel: T, person: 'id-A', dabei: true, posten: 'mett', seit: '2026-10-05T18:10:00+00:00' },
    { schluessel: T, person: 'id-B', dabei: true, posten: null, seit: null },
    { schluessel: T, person: 'id-C', dabei: false, posten: null, seit: null },
  ],
  abos: ['A', 'B', 'C', 'D'].map(n => ({ endpoint: 'https://push.example/' + n, person: 'id-' + n, p256dh: 'x', auth: 'y' })),
  gesendet: [],
});
const kurz = plan => plan.map(e => e.person.slice(3) + ':' + e.art).sort().join(' ');

pruef(planen(basis(), new Date('2026-10-06T17:59')).length === 0, 'Dienstag 17:59: noch nichts');
let p = planen(basis(), new Date('2026-10-06T18:05'));
pruef(kurz(p) === 'B:aussuchen D:abstimmen', 'Dienstag 18:05: B soll aussuchen, D abstimmen', kurz(p));
const d = p.find(e => e.art === 'abstimmen');
pruef(d.titel === 'Bist du morgen dabei?' && d.url === 'https://finnmarinov-lgtm.github.io/Mitbringliste/', 'Text und Adresse', d.titel);
pruef(p.find(e => e.art === 'aussuchen').text.includes('Noch frei:'), 'freie Posten werden genannt', p.find(e => e.art === 'aussuchen').text);

const g2 = basis();
g2.gesendet = [{ schluessel: T, person: 'id-B', art: 'aussuchen' }];
pruef(kurz(planen(g2, new Date('2026-10-06T21:00'))) === 'D:abstimmen', 'nichts doppelt verschicken');

const g3 = basis();
g3.antworten.push({ schluessel: T, person: 'id-D', dabei: true, posten: null, seit: null });
g3.gesendet = [{ schluessel: T, person: 'id-D', art: 'abstimmen' }];
pruef(kurz(planen(g3, new Date('2026-10-06T21:00'))) === 'B:aussuchen D:aussuchen', 'wer nach der Erinnerung zusagt, wird ans Aussuchen erinnert');

pruef(planen(basis(), new Date('2026-10-07T07:30')).length === 0, 'am Termintag keine Erinnerung mehr');
pruef(planen({ ...basis(), einstellungen: { erinnerung: false } }, new Date('2026-10-06T18:05')).length === 0, 'Erinnerungen ausgeschaltet');

const g4 = basis();
g4.einstellungen = { tage: 0, uhr: 18 }; // Liste erst am Mittwoch: Dienstag gibt es nur "abstimmen"
pruef(kurz(planen(g4, new Date('2026-10-06T18:05'))) === 'D:abstimmen', 'vor der Liste nur ans Abstimmen erinnern');

const g5 = basis();
g5.termine = [{ schluessel: T, datum: null, abgesagt: true, frei: false, notiz: '' }];
pruef(planen(g5, new Date('2026-10-06T18:05')).length === 0, 'abgesagter Termin: keine Erinnerung');

const g6 = basis();
g6.termine = [{ schluessel: T, datum: '2026-10-14', abgesagt: false, frei: false, notiz: '' }];
pruef(planen(g6, new Date('2026-10-06T18:05')).length === 0, 'verlegter Termin: am alten Dienstag nichts');
pruef(kurz(planen(g6, new Date('2026-10-13T18:05'))) === 'B:aussuchen D:abstimmen', 'verlegter Termin: am Dienstag davor');

const g7 = { ...basis(), id: 'probe' };
pruef(planen(g7, new Date('2026-10-06T18:05'))[0].url.endsWith('?g=probe'), 'andere Liste bekommt ?g= in der Adresse');

console.log(fehler ? `\n${fehler} Fehler` : '\nAlles ok');
process.exit(fehler ? 1 : 0);
