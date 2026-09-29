// Wer bekommt jetzt eine Erinnerung? Reine Logik, genutzt von senden.js (und in den Tests).
// Erinnert wird einmal pro Termin und Art: 'abstimmen' (noch keine Antwort) oder
// 'aussuchen' (dabei, aber noch kein Posten, sobald die Liste da ist).
import { termine, phase, erinnerungZeit, iso, ausIso, WOCHENTAGE } from '../js/termine.js';
import { aufteilen, zuordnen } from '../js/aufteilen.js';
import { EINSTELLUNGEN } from '../js/vorlage.js';

export const ADRESSE = 'https://finnmarinov-lgtm.github.io/Mitbringliste/';

function wannText(heute, datum) {
  const tage = Math.round((ausIso(datum) - ausIso(heute)) / 864e5);
  if (tage === 1) return 'morgen';
  if (tage === 0) return 'heute';
  const d = ausIso(datum);
  return `am ${WOCHENTAGE[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.`;
}

// g: eine Liste aus mb_versand_daten, jetzt: Date (Zeitzone Europe/Berlin)
export function planen(g, jetzt) {
  const einst = { ...EINSTELLUNGEN, ...(g.einstellungen || {}) };
  if (einst.erinnerung === false) return [];
  const heute = iso(jetzt);
  const t = termine(jetzt, g.termine, 0, 2).find(x => !x.abgesagt && x.datum >= heute);
  // nur zwischen Erinnerungszeit und Beginn des Termintags (dann ist die Abstimmung zu)
  if (!t || heute >= t.datum || jetzt < erinnerungZeit(t, einst)) return [];

  const ph = phase(t, jetzt, einst);
  const ids = new Set(g.personen.map(p => p.id));
  const antworten = g.antworten.filter(a => a.schluessel === t.schluessel && ids.has(a.person));
  const dabei = antworten.filter(a => a.dabei);
  const auf = aufteilen(g.sachen, dabei.length);
  const zu = zuordnen(auf.posten, dabei);
  const frei = [...new Set(auf.posten.filter((_, i) => zu.belegt[i] === null).map(p => p.text))];
  const schonGesendet = new Set((g.gesendet || []).map(x => `${x.schluessel}|${x.person}|${x.art}`));
  const wann = wannText(heute, t.datum);
  const url = ADRESSE + (g.id !== 'standard' ? '?g=' + encodeURIComponent(g.id) : '');

  const plan = [];
  const mitAbo = [...new Set((g.abos || []).map(a => a.person))].filter(id => ids.has(id));
  for (const person of mitAbo) {
    const a = antworten.find(x => x.person === person);
    let art, titel, text;
    if (!a) {
      art = 'abstimmen';
      titel = `Bist du ${wann} dabei?`;
      text = `${g.name}: Du hast noch nicht abgestimmt. Tipp hier und sag kurz Bescheid.`;
    } else if (a.dabei && ph === 'liste' && zu.vonPerson[person] === undefined) {
      art = 'aussuchen';
      titel = 'Such dir noch was aus';
      text = `${g.name}: Du bist ${wann} dabei, hast dir aber noch nichts ausgesucht.`
        + (frei.length ? ` Noch frei: ${frei.slice(0, 3).join(', ')}.` : '');
    } else {
      continue;
    }
    if (schonGesendet.has(`${t.schluessel}|${person}|${art}`)) continue;
    plan.push({
      gruppe: g.id, schluessel: t.schluessel, person, art, titel, text, url,
      abos: g.abos.filter(x => x.person === person),
    });
  }
  return plan;
}
