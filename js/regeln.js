// Günstig-Regel: Wer bei seinen letzten zwei MMM, bei denen er dabei war, etwas Günstiges hatte
// (oder nichts), nimmt beim nächsten Mal etwas Teureres. Günstig ist ein Posten, wenn alle Sachen
// darin in der Einkaufsliste als "günstig" markiert sind.

export function istGuenstig(key, sachen) {
  if (!key) return false;
  const guenstig = new Set((sachen || []).filter(s => s.guenstig).map(s => s.id));
  return key.split('+').every(id => guenstig.has(id));
}

// person: ID, schluessel: aktueller Termin, antworten: alle geladenen Antworten,
// abgesagt: Set der Termin-Schlüssel, die ausgefallen sind
export function guenstigGesperrt(person, schluessel, antworten, sachen, abgesagt = new Set()) {
  if (!(sachen || []).some(s => s.guenstig)) return false;
  const frueher = (antworten || [])
    .filter(a => a.person === person && a.dabei && a.schluessel < schluessel && !abgesagt.has(a.schluessel))
    .sort((a, b) => (a.schluessel < b.schluessel ? 1 : -1))
    .slice(0, 2);
  // Nichts mitgebracht zählt wie etwas Günstiges
  return frueher.length === 2 && frueher.every(a => !a.posten || istGuenstig(a.posten, sachen));
}
