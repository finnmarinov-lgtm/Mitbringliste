// Termine: grundsätzlich der erste Mittwoch im Monat. Ändern (verlegen, absagen) kann nur die Moderation.
// Fällt ein Termin in Ferien oder auf einen Feiertag (Sachsen-Anhalt), gibt es nur einen Hinweis
// und einen Vorschlag (nächster freier Mittwoch vor dem nächsten regulären Termin).

// Ersatz, falls die Ferien-Schnittstelle nicht erreichbar ist (Quelle: openholidaysapi.org, DE-ST)
const FERIEN_ERSATZ = [
  ['2025-12-22', '2026-01-05', 'Weihnachtsferien'], ['2026-01-31', '2026-02-06', 'Winterferien'],
  ['2026-03-30', '2026-04-04', 'Osterferien'], ['2026-05-26', '2026-05-29', 'Pfingstferien'],
  ['2026-07-04', '2026-08-14', 'Sommerferien'], ['2026-10-19', '2026-10-30', 'Herbstferien'],
  ['2026-12-21', '2027-01-02', 'Weihnachtsferien'], ['2027-02-01', '2027-02-06', 'Winterferien'],
  ['2027-03-22', '2027-03-27', 'Osterferien'], ['2027-05-15', '2027-05-22', 'Pfingstferien'],
  ['2027-07-10', '2027-08-20', 'Sommerferien'], ['2027-10-18', '2027-10-23', 'Herbstferien'],
  ['2027-12-20', '2027-12-31', 'Weihnachtsferien'], ['2028-02-07', '2028-02-12', 'Winterferien'],
  ['2028-04-10', '2028-04-22', 'Osterferien'], ['2028-06-03', '2028-06-10', 'Pfingstferien'],
  ['2028-07-22', '2028-09-01', 'Sommerferien'], ['2028-10-02', '2028-10-02', 'Ferientag'],
  ['2028-10-30', '2028-11-03', 'Herbstferien'], ['2028-12-21', '2029-01-02', 'Weihnachtsferien'],
  ['2026-01-01', '2026-01-01', 'Neujahr'], ['2026-01-06', '2026-01-06', 'Heilige Drei Könige'],
  ['2026-04-03', '2026-04-03', 'Karfreitag'], ['2026-04-06', '2026-04-06', 'Ostermontag'],
  ['2026-05-01', '2026-05-01', 'Tag der Arbeit'], ['2026-05-14', '2026-05-14', 'Christi Himmelfahrt'],
  ['2026-05-25', '2026-05-25', 'Pfingstmontag'], ['2026-10-03', '2026-10-03', 'Tag der Deutschen Einheit'],
  ['2026-10-31', '2026-10-31', 'Reformationstag'], ['2026-12-25', '2026-12-26', 'Weihnachten'],
  ['2027-01-01', '2027-01-01', 'Neujahr'], ['2027-01-06', '2027-01-06', 'Heilige Drei Könige'],
  ['2027-03-26', '2027-03-26', 'Karfreitag'], ['2027-03-29', '2027-03-29', 'Ostermontag'],
  ['2027-05-01', '2027-05-01', 'Tag der Arbeit'], ['2027-05-06', '2027-05-06', 'Christi Himmelfahrt'],
  ['2027-05-17', '2027-05-17', 'Pfingstmontag'], ['2027-10-03', '2027-10-03', 'Tag der Deutschen Einheit'],
  ['2027-10-31', '2027-10-31', 'Reformationstag'], ['2027-12-25', '2027-12-26', 'Weihnachten'],
  ['2028-01-01', '2028-01-01', 'Neujahr'], ['2028-01-06', '2028-01-06', 'Heilige Drei Könige'],
  ['2028-04-14', '2028-04-14', 'Karfreitag'], ['2028-04-17', '2028-04-17', 'Ostermontag'],
  ['2028-05-01', '2028-05-01', 'Tag der Arbeit'], ['2028-05-25', '2028-05-25', 'Christi Himmelfahrt'],
  ['2028-06-05', '2028-06-05', 'Pfingstmontag'], ['2028-10-03', '2028-10-03', 'Tag der Deutschen Einheit'],
  ['2028-10-31', '2028-10-31', 'Reformationstag'], ['2028-12-25', '2028-12-26', 'Weihnachten'],
];

export const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function iso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function ausIso(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function plusTage(s, n) {
  const d = ausIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function ersterMittwoch(jahr, monat) {
  const d = new Date(jahr, monat, 1);
  d.setDate(1 + ((3 - d.getDay() + 7) % 7));
  return iso(d);
}

// "Mi, 7.10." / "Mittwoch, 7. Oktober"
export function kurzDatum(s) {
  const d = ausIso(s);
  return WOCHENTAGE[d.getDay()].slice(0, 2) + ', ' + d.getDate() + '.' + (d.getMonth() + 1) + '.';
}
export function langDatum(s) {
  const d = ausIso(s);
  return d.getDate() + '. ' + MONATE[d.getMonth()];
}

// ---------- Ferien ----------
let ferien = FERIEN_ERSATZ;

export function freiGrund(s) {
  for (const [von, bis, name] of ferien) if (s >= von && s <= bis) return name;
  return null;
}

// Holt aktuelle Ferien und Feiertage (zwischengespeichert für eine Woche)
export async function ferienLaden() {
  const SCHLUESSEL = 'mb_ferien';
  try {
    const alt = JSON.parse(localStorage.getItem(SCHLUESSEL) || 'null');
    if (alt && Date.now() - alt.zeit < 7 * 864e5 && alt.daten?.length) { ferien = alt.daten; return false; }
  } catch { /* egal */ }
  // Die Schnittstelle liefert höchstens 1095 Tage auf einmal
  const heute = new Date();
  const vonTag = new Date(heute.getFullYear(), heute.getMonth() - 4, 1);
  const bisTag = new Date(vonTag.getFullYear(), vonTag.getMonth(), vonTag.getDate() + 1090);
  const von = iso(vonTag), bis = iso(bisTag);
  const url = art => `https://openholidaysapi.org/${art}?countryIsoCode=DE&subdivisionCode=DE-ST&languageIsoCode=DE&validFrom=${von}&validTo=${bis}`;
  try {
    const teile = await Promise.all(['SchoolHolidays', 'PublicHolidays'].map(async art => {
      const res = await fetch(url(art));
      if (!res.ok) throw new Error(res.status);
      return (await res.json()).map(h => [h.startDate, h.endDate, h.name?.[0]?.text || 'Ferien']);
    }));
    const daten = teile.flat();
    if (!daten.length) return false;
    // Ersatzdaten für Zeiträume behalten, die die Schnittstelle nicht abdeckt
    ferien = daten.concat(FERIEN_ERSATZ.filter(([a, b]) => b < von || a > bis));
    try { localStorage.setItem(SCHLUESSEL, JSON.stringify({ zeit: Date.now(), daten: ferien })); } catch { /* egal */ }
    return true;
  } catch {
    return false;
  }
}

// ---------- Terminliste ----------
// overrides: Zeilen aus der Datenbank { schluessel, datum, abgesagt, frei, notiz }
export function termine(jetzt, overrides, vorher = 3, nachher = 7) {
  const nachSchluessel = {};
  for (const o of overrides || []) nachSchluessel[o.schluessel] = o;
  const liste = [];
  for (let m = -vorher; m <= nachher; m++) {
    const d = new Date(jetzt.getFullYear(), jetzt.getMonth() + m, 1);
    const schluessel = ersterMittwoch(d.getFullYear(), d.getMonth());
    const naechster = ersterMittwoch(d.getFullYear(), d.getMonth() + 1);
    const o = nachSchluessel[schluessel] || {};
    const t = {
      schluessel, regulaer: schluessel, datum: o.datum || schluessel, abgesagt: !!o.abgesagt, frei: !!o.frei,
      notiz: o.notiz || '', festgelegt: !!o.datum, grund: null, vorschlag: null,
    };
    // Hat die Moderation das Datum festgelegt, gilt es ohne Warnung
    const grund = !t.festgelegt && !t.abgesagt ? freiGrund(t.datum) : null;
    if (grund) {
      t.grund = grund;
      for (let x = plusTage(schluessel, 7); x < naechster; x = plusTage(x, 7)) {
        if (!freiGrund(x)) { t.vorschlag = x; break; }
      }
    }
    liste.push(t);
  }
  return liste;
}

// Wann kommt die Mitbringliste raus? (z. B. 2 Tage vorher um 18 Uhr)
export function freigabeZeit(t, einst) {
  const d = ausIso(t.datum);
  const tage = Number.isFinite(Number(einst?.tage)) ? Number(einst.tage) : 2;
  const uhr = Number.isFinite(Number(einst?.uhr)) ? Number(einst.uhr) : 18;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - tage, uhr, 0, 0);
}

// Wann kommt die Erinnerung? (z. B. 1 Tag vorher um 18 Uhr)
export function erinnerungZeit(t, einst) {
  const d = ausIso(t.datum);
  const tage = Number.isFinite(Number(einst?.erinnerungTage)) ? Number(einst.erinnerungTage) : 1;
  const uhr = Number.isFinite(Number(einst?.erinnerungUhr)) ? Number(einst.erinnerungUhr) : 18;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - tage, uhr, 0, 0);
}

// Phase: abgesagt | anmeldung | liste | heute | vorbei
export function phase(t, jetzt, einst) {
  if (t.abgesagt) return 'abgesagt';
  const heute = iso(jetzt);
  if (heute > t.datum) return 'vorbei';
  if (heute === t.datum) return 'heute';
  if (t.frei || jetzt >= freigabeZeit(t, einst)) return 'liste';
  return 'anmeldung';
}
