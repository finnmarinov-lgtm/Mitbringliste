// Startliste beim Einrichten (Preise von Finn, Gewürze geschätzt; in der App änderbar).
// proPerson: Menge pro Person · fest: Menge unabhängig von der Personenzahl
// schritt: in welchen Schritten man die Sache aufteilen kann · preis: € pro preisMenge
export const VORLAGE = [
  { id: 'broetchen', name: 'Brötchen', einheit: 'Stück', proPerson: 3, fest: 0, schritt: 10, preis: 2, preisMenge: 10, notiz: '10er-Tüten' },
  { id: 'mett', name: 'Mett', einheit: 'g', proPerson: 300, fest: 0, schritt: 50, preis: 1, preisMenge: 100, notiz: '' },
  { id: 'butter', name: 'Butter', einheit: 'Block/Blöcke', proPerson: 0, fest: 2, schritt: 1, preis: 2, preisMenge: 1, notiz: '' },
  { id: 'zwiebeln', name: 'Zwiebeln', einheit: 'Sack/Säcke', proPerson: 0, fest: 1, schritt: 1, preis: 2, preisMenge: 1, notiz: 'schon geschnitten' },
  { id: 'gewuerze', name: 'Gewürze', einheit: 'Stück', proPerson: 0, fest: 1, schritt: 1, preis: 2.00, preisMenge: 1, notiz: '' },
];

// Liste kommt 2 Tage vorher um 18 Uhr, Erinnerung 1 Tag vorher um 18 Uhr
export const EINSTELLUNGEN = { tage: 2, uhr: 18, erinnerung: true, erinnerungTage: 1, erinnerungUhr: 18 };
