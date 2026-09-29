# Mitbringliste

Web-App für das gemeinsame Frühstück am **ersten Mittwoch im Monat**: Jeder stimmt ab, ob er dabei ist. Ab Montag 18 Uhr teilt die App den Einkauf in etwa gleich teure Posten auf (so viele Posten, wie Leute dabei sind), und jeder sucht sich einen aus. Sagt danach noch jemand zu oder ab, rechnet sich die Liste von selbst neu.

- Adresse: https://finnmarinov-lgtm.github.io/Mitbringliste/
- Zum Ausprobieren ohne Datenbank: https://finnmarinov-lgtm.github.io/Mitbringliste/?demo (Admin-Code `demo-admin`)
- Installierbar auf dem Startbildschirm (PWA), wie Petri Heil.

## Dateien

| Datei | Wozu |
|---|---|
| `index.html`, `style.css` | Seite und Aussehen |
| `js/app.js` | Oberfläche: Abstimmen, Mitbringliste, Moderation |
| `js/aufteilen.js` | Rechnet den Bedarf aus und teilt ihn in gleich teure Posten |
| `js/termine.js` | Erster Mittwoch im Monat, Ferien und Feiertage Sachsen-Anhalt |
| `js/api.js` | Verbindung zu Supabase, dazu der Demo-Modus |
| `js/vorlage.js` | Startliste (Brötchen, Mett, Butter, Zwiebeln, Gewürze) |
| `supabase.sql` | Tabellen und Funktionen, einmal im SQL-Editor ausführen |
| `manifest.webmanifest`, `sw.js`, `icon*` | App auf dem Startbildschirm |
| `make-icons.js` | Erzeugt die PNG-Icons aus `icon.svg` (braucht Chrome oder Edge) |
| `serve.js` | Testserver: `node serve.js`, dann http://localhost:4174/?demo |
| `test/aufteilen.test.js` | Prüft die Aufteilung: `node test/aufteilen.test.js` |

## So funktioniert es

**Termine:** Grundsätzlich jeder erste Mittwoch im Monat. Ändern kann ihn nur die Moderation (verlegen, absagen, Hinweis). Fällt er in Ferien oder auf einen Feiertag, zeigt die App eine Warnung und schlägt der Moderation den nächsten freien Mittwoch vor. Ferien und Feiertage kommen von openholidaysapi.org, für 2026 bis 2028 sind sie zur Sicherheit in `termine.js` hinterlegt.

**Aufteilen:** Jede Sache hat eine Menge pro Person (Brötchen 3, Mett 300 g), eine feste Menge (Butter 2 Blöcke), eine Schrittweite (Mett 50 g) und einen geschätzten Preis. Die App rechnet den Gesamtbedarf aus und sucht eine Aufteilung in genau so viele Posten, wie Leute dabei sind, mit möglichst gleichem Preis. Kleine Sachen landen gemeinsam in einem Posten (z. B. „1 Sack Zwiebeln + Gewürze“).

**Wer bekommt was:** Gespeichert wird nur die Sorte, die jemand gewählt hat (z. B. `mett`), nicht die Menge. Wer zuerst gewählt hat, bekommt den ersten Posten seiner Sorte. Ändert sich die Zahl der Leute, passen sich die Mengen an, und wer betroffen ist, sieht „Geändert, vorher …“. Fällt eine Sorte ganz weg, muss sich der Letzte neu entscheiden.

**Rollen:**
- **Klassencode:** steckt im geteilten Link (`#k=...`), damit kann jeder abstimmen und sich etwas aussuchen.
- **Moderator:** eine Person aus der Liste mit eigener PIN. Darf Termine, Einkaufsliste und Namen ändern.
- **Admin (Finn):** Admin-Code. Darf zusätzlich Moderatoren ernennen und die Codes ändern.

Der Klassencode steht im Klartext in der Datenbank (er ist ja für alle gedacht). Admin-Code und PINs liegen dort nur als SHA-256-Prüfsumme.

## Einrichten (einmalig)

1. In Supabase (Projekt `Petri_heil`) den SQL-Editor öffnen, den Inhalt von `supabase.sql` einfügen und ausführen.
2. Die Adresse öffnen, auf „Neue Liste einrichten“ tippen, Namen der Runde, Klassencode und Admin-Code festlegen.
3. In der Moderation unter „Leute“ die Namen eintragen, unter „Mehr“ den Link kopieren und in den Klassenchat schicken.

## Veröffentlichen

Repository `finnmarinov-lgtm/Mitbringliste`, GitHub Pages aus `main` (Ordner `/`). Jeder Push ist nach etwa einer Minute online. Die App lädt online immer die neueste Fassung, der Service Worker ist nur für den Fall ohne Netz da.
