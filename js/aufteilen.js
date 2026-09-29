// Rechnet aus, was gebraucht wird, und teilt es in etwa gleich teure Posten auf:
// so viele Posten, wie Leute dabei sind. Reine Logik ohne Oberfläche (mit Node testbar).

const EPS = 1e-9;

export function zahl(x) {
  return (Math.round(x * 100) / 100).toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

export function euro(x) {
  return x.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// "g", "Stück", "Block/Blöcke" (Einzahl/Mehrzahl mit Schrägstrich)
export function einheitInfo(einheit) {
  const e = String(einheit || '').trim();
  const kl = e.toLowerCase();
  if (kl === 'g' || kl === 'gramm') return { art: 'g' };
  if (kl === 'kg') return { art: 'kg' };
  if (kl === 'ml') return { art: 'ml' };
  if (kl === 'l' || kl === 'liter') return { art: 'l' };
  if (!e || kl === 'stück' || kl === 'stk' || kl === 'stk.') return { art: 'stueck' };
  const [ein, mehr] = e.split('/').map(s => s.trim());
  return { art: 'wort', ein, mehr: mehr || ein };
}

export function mengeText(einheit, menge) {
  const info = einheitInfo(einheit);
  switch (info.art) {
    case 'g': return menge >= 1000 ? zahl(menge / 1000) + ' kg' : zahl(menge) + ' g';
    case 'kg': return menge < 1 ? zahl(menge * 1000) + ' g' : zahl(menge) + ' kg';
    case 'ml': return menge >= 1000 ? zahl(menge / 1000) + ' l' : zahl(menge) + ' ml';
    case 'l': return menge < 1 ? zahl(menge * 1000) + ' ml' : zahl(menge) + ' l';
    case 'stueck': return zahl(menge);
    default: return zahl(menge) + ' ' + (menge === 1 ? info.ein : info.mehr);
  }
}

// "450 g Mett", "15 Brötchen", "2 Blöcke Butter", "Gewürze"
export function teilText(sache, menge) {
  if (einheitInfo(sache.einheit).art === 'stueck') {
    if (menge === 1 && !(Number(sache.proPerson) > 0)) return sache.name;
    return zahl(menge) + ' ' + sache.name;
  }
  return mengeText(sache.einheit, menge) + ' ' + sache.name;
}

// Gesamtbedarf je Sache, aufgerundet auf ganze Schritte
export function bedarf(sachen, n) {
  const liste = [];
  for (const s of sachen || []) {
    if (!s || !String(s.name || '').trim()) continue;
    const schritt = Number(s.schritt) > 0 ? Number(s.schritt) : 1;
    const menge = (Number(s.fest) || 0) + n * (Number(s.proPerson) || 0);
    const schritte = menge > EPS ? Math.ceil(menge / schritt - EPS) : 0;
    if (!schritte) continue;
    const preisMenge = Number(s.preisMenge) > 0 ? Number(s.preisMenge) : 1;
    const preisProSchritt = (Number(s.preis) || 0) / preisMenge * schritt;
    liste.push({
      sache: s, schritt, schritte, menge: schritte * schritt, preisProSchritt,
      kosten: schritte * preisProSchritt, text: teilText(s, schritte * schritt),
    });
  }
  return liste;
}

// Bewertet eine Wahl k (k[i] = in wie viele Posten Sache i geteilt wird, 0 = kommt in einen Sammelposten)
function bewerten(items, k, n, t) {
  const posten = [];
  items.forEach((it, i) => {
    const ki = k[i];
    if (!ki) return;
    const basis = Math.floor(it.schritte / ki), rest = it.schritte % ki;
    for (let j = 0; j < ki; j++) {
      const s = basis + (j < rest ? 1 : 0);
      posten.push({ teile: [{ i, schritte: s }], w: s * it.w, geteilt: ki > 1, gemischt: false });
    }
  });
  const pool = items.map((_, i) => i).filter(i => !k[i])
    .sort((a, b) => items[b].w * items[b].schritte - items[a].w * items[a].schritte || a - b);
  if (pool.length) {
    const frei = n - posten.length;
    let ziele = posten;
    if (frei > 0) {
      ziele = [];
      for (let j = 0; j < Math.min(frei, pool.length); j++) ziele.push({ teile: [], w: 0, geteilt: false, gemischt: false });
      posten.push(...ziele);
    }
    for (const i of pool) {
      let ziel = ziele[0];
      for (const z of ziele) if (z.w < ziel.w - EPS) ziel = z;
      if (ziel.geteilt) ziel.gemischt = true;
      ziel.teile.push({ i, schritte: items[i].schritte });
      ziel.w += items[i].schritte * items[i].w;
    }
  }
  let score = (n - posten.length) * t * t; // Leute ohne Posten zählen wie Posten für 0 €
  for (const p of posten) score += (p.w - t) ** 2 + (p.gemischt ? 0.15 * t * t : 0);
  return { score, posten };
}

function suchen(items, start, n, t) {
  let k = start.slice();
  const summe = a => a.reduce((x, y) => x + y, 0);
  while (summe(k) > n) {
    let j = 0;
    for (let i = 1; i < k.length; i++) if (k[i] > k[j]) j = i;
    k[j]--;
  }
  let best = bewerten(items, k, n, t);
  for (let runde = 0; runde < 300; runde++) {
    let kandidat = null, kBest = null;
    const probe = k2 => {
      for (let i = 0; i < k2.length; i++) if (k2[i] < 0 || k2[i] > items[i].schritte) return;
      if (summe(k2) > n) return;
      const b = bewerten(items, k2, n, t);
      if (b.score < (kandidat ? kandidat.score : best.score) - EPS) { kandidat = b; kBest = k2; }
    };
    for (let i = 0; i < k.length; i++) {
      for (const d of [-1, 1]) { const k2 = k.slice(); k2[i] += d; probe(k2); }
      for (let j = 0; j < k.length; j++) {
        if (i === j) continue;
        const k2 = k.slice(); k2[i]++; k2[j]--; probe(k2);
      }
    }
    if (!kandidat) break;
    best = kandidat; k = kBest;
  }
  return best;
}

// Ergebnis: { posten: [{ key, teile, text, kosten }], bedarf, gesamt, ziel }
export function aufteilen(sachen, n) {
  const bed = bedarf(sachen, n);
  const gesamt = bed.reduce((a, b) => a + b.kosten, 0);
  if (n < 1 || !bed.length) return { posten: [], bedarf: bed, gesamt, ziel: 0 };

  // Ohne Preise zählt jeder Schritt gleich viel
  const items = bed.map(b => ({ ...b, w: gesamt > EPS ? b.preisProSchritt : 1 }));
  const C = items.reduce((a, it) => a + it.w * it.schritte, 0);
  const t = C / n;
  const q = items.map(it => it.w * it.schritte / t);
  const starts = [
    q.map((x, i) => Math.min(items[i].schritte, Math.round(x))),
    q.map((x, i) => Math.min(items[i].schritte, Math.floor(x))),
    q.map((x, i) => Math.min(items[i].schritte, Math.max(1, Math.round(x)))),
  ];
  let best = null;
  for (const s of starts) {
    const b = suchen(items, s, n, t);
    if (!best || b.score < best.score - EPS) best = b;
  }

  const posten = best.posten.map((p, nr) => {
    const teile = p.teile.slice().sort((a, b) => a.i - b.i).map(({ i, schritte }) => {
      const s = items[i].sache;
      const menge = schritte * items[i].schritt;
      return { id: s.id, name: s.name, menge, text: teilText(s, menge), notiz: s.notiz || '', i };
    });
    return {
      key: teile.map(x => x.id).join('+'),
      name: teile.map(x => x.name).join(' + '),
      teile,
      text: teile.map(x => x.text).join(' + '),
      kosten: p.teile.reduce((a, { i, schritte }) => a + schritte * items[i].preisProSchritt, 0),
      ord: teile[0].i, nr,
    };
  });
  posten.sort((a, b) => a.ord - b.ord || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) || a.nr - b.nr);
  return { posten, bedarf: bed, gesamt, ziel: gesamt / n };
}

// Wer bekommt welchen Posten? Wer zuerst gewählt hat, bekommt den ersten freien Posten seiner Art.
// Gibt es die gewählte Art nicht mehr (andere Teilnehmerzahl), rückt man auf einen freien Posten
// mit denselben Sachen, sonst muss man neu wählen (verloren).
export function zuordnen(posten, antworten) {
  const belegt = posten.map(() => null);
  const wahl = (antworten || []).filter(a => a.dabei && a.posten)
    .sort((a, b) => (a.seit || '') < (b.seit || '') ? -1 : (a.seit || '') > (b.seit || '') ? 1 : a.person < b.person ? -1 : 1);
  const waisen = [];
  for (const a of wahl) {
    const idx = posten.findIndex((p, i) => p.key === a.posten && belegt[i] === null);
    if (idx >= 0) belegt[idx] = a.person; else waisen.push(a);
  }
  const verloren = [];
  for (const a of waisen) {
    const alt = new Set(a.posten.split('+'));
    let best = -1, bestAnz = 0;
    posten.forEach((p, i) => {
      if (belegt[i] !== null) return;
      const anz = p.teile.filter(t => alt.has(t.id)).length;
      if (anz > bestAnz) { best = i; bestAnz = anz; }
    });
    if (best >= 0) belegt[best] = a.person; else verloren.push(a.person);
  }
  const vonPerson = {};
  belegt.forEach((p, i) => { if (p !== null) vonPerson[p] = i; });
  return { belegt, vonPerson, verloren };
}
