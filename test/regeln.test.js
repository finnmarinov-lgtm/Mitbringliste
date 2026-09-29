// Prueft die Guenstig-Regel. Aufruf: node test/regeln.test.js
import { istGuenstig, guenstigGesperrt } from '../js/regeln.js';
import { VORLAGE } from '../js/vorlage.js';

let fehler = 0;
const pruef = (ok, text) => { console.log((ok ? 'ok    ' : 'FEHLER') + ' ' + text); if (!ok) fehler++; };
const a = (schluessel, posten, dabei = true) => ({ person: 'P', schluessel, dabei, posten, seit: null });
const JETZT = '2026-11-04';

pruef(istGuenstig('zwiebeln', VORLAGE) && istGuenstig('gewuerze', VORLAGE), 'Zwiebeln und Gewürze sind günstig');
pruef(!istGuenstig('mett', VORLAGE) && !istGuenstig('mett+gewuerze', VORLAGE), 'Mett (auch mit Gewürzen) ist nicht günstig');
pruef(!istGuenstig(null, VORLAGE), 'kein Posten ist kein günstiger Posten');

pruef(guenstigGesperrt('P', JETZT, [a('2026-09-02', 'zwiebeln'), a('2026-10-07', 'gewuerze')], VORLAGE), 'zweimal günstig hintereinander: gesperrt');
pruef(!guenstigGesperrt('P', JETZT, [a('2026-09-02', 'mett'), a('2026-10-07', 'gewuerze')], VORLAGE), 'einmal günstig: frei');
pruef(!guenstigGesperrt('P', JETZT, [a('2026-10-07', 'gewuerze')], VORLAGE), 'erst einmal dabei: frei');
pruef(!guenstigGesperrt('P', JETZT, [a('2026-08-05', 'zwiebeln'), a('2026-09-02', 'mett'), a('2026-10-07', 'gewuerze')], VORLAGE), 'nur die letzten zwei zählen');
pruef(guenstigGesperrt('P', JETZT, [a('2026-09-02', 'zwiebeln'), a('2026-10-07', 'x', false), a('2026-10-07', null)].slice(0, 1).concat([a('2026-10-07', null)]), VORLAGE), 'dabei ohne Posten zählt wie günstig');
pruef(guenstigGesperrt('P', JETZT, [a('2026-08-05', 'zwiebeln'), a('2026-09-02', 'gewuerze', false), a('2026-10-07', 'gewuerze')], VORLAGE), 'nicht dabei gewesen: übersprungen');
pruef(!guenstigGesperrt('P', JETZT, [a('2026-09-02', 'zwiebeln'), a('2026-10-07', 'gewuerze')], VORLAGE, new Set(['2026-10-07'])), 'abgesagter Termin zählt nicht');
pruef(!guenstigGesperrt('P', JETZT, [a('2026-09-02', 'zwiebeln'), a('2026-12-02', 'gewuerze')], VORLAGE), 'spätere Termine zählen nicht');
pruef(!guenstigGesperrt('P', JETZT, [a('2026-09-02', 'zwiebeln'), a('2026-10-07', 'gewuerze')], VORLAGE.map(s => ({ ...s, guenstig: false }))), 'ohne markierte Sachen gilt keine Sperre');

console.log(fehler ? `\n${fehler} Fehler` : '\nAlles ok');
process.exit(fehler ? 1 : 0);
