// Startliste beim Einrichten (Preise geschätzt, in der App änderbar).
// proPerson: Menge pro Person · fest: Menge unabhängig von der Personenzahl
// schritt: in welchen Schritten man die Sache aufteilen kann · preis: € pro preisMenge
export const VORLAGE = [
  { id: 'broetchen', name: 'Brötchen', einheit: 'Stück', proPerson: 3, fest: 0, schritt: 1, preis: 0.35, preisMenge: 1, notiz: '' },
  { id: 'mett', name: 'Mett', einheit: 'g', proPerson: 300, fest: 0, schritt: 50, preis: 1.10, preisMenge: 100, notiz: '' },
  { id: 'butter', name: 'Butter', einheit: 'Block/Blöcke', proPerson: 0, fest: 2, schritt: 1, preis: 2.39, preisMenge: 1, notiz: '' },
  { id: 'zwiebeln', name: 'Zwiebeln', einheit: 'Sack/Säcke', proPerson: 0, fest: 1, schritt: 1, preis: 2.50, preisMenge: 1, notiz: 'schon geschnitten' },
  { id: 'gewuerze', name: 'Gewürze', einheit: 'Stück', proPerson: 0, fest: 1, schritt: 1, preis: 2.00, preisMenge: 1, notiz: '' },
];

export const EINSTELLUNGEN = { tage: 2, uhr: 18 };
