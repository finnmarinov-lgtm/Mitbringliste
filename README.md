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
| `js/regeln.js` | Günstig-Regel: nach zweimal Günstigem ist man bei den teureren Sachen dran |
| `supabase.sql` | Tabellen und Funktionen, im SQL-Editor ausführen (darf mehrmals laufen) |
| `js/push.js`, `js/push-schluessel.js` | Gerät für Erinnerungen an- und abmelden, öffentlicher VAPID-Schlüssel |
| `erinnerung/planen.js` | Wer wann erinnert wird |
| `erinnerung/senden.js` | Verschickt die Erinnerungen (läuft als GitHub-Auftrag) |
| `.github/workflows/erinnerung.yml` | Der Auftrag: alle 30 Minuten, von Hand auch mit Testnachricht |
| `manifest.webmanifest`, `sw.js`, `icon*` | App auf dem Startbildschirm |
| `make-icons.js` | Erzeugt die PNG-Icons aus `icon.svg` (braucht Chrome oder Edge) |
| `serve.js` | Testserver: `node serve.js`, dann http://localhost:4174/?demo |
| `test/aufteilen.test.js` | Prüft die Aufteilung: `node test/aufteilen.test.js` |
| `test/erinnerung.test.js` | Prüft die Erinnerungen: `TZ=Europe/Berlin node test/erinnerung.test.js` |
| `test/regeln.test.js` | Prüft die Günstig-Regel: `node test/regeln.test.js` |

## So funktioniert es

**Termine:** Grundsätzlich jeder erste Mittwoch im Monat. Ändern kann ihn nur die Moderation (verlegen, absagen, Hinweis). Fällt er in Ferien oder auf einen Feiertag, zeigt die App eine Warnung und schlägt der Moderation den nächsten freien Mittwoch vor. Ferien und Feiertage kommen von openholidaysapi.org, für 2026 bis 2028 sind sie zur Sicherheit in `termine.js` hinterlegt.

**Aufteilen:** Jede Sache hat eine Menge pro Person (Brötchen 3, Mett 300 g), eine feste Menge (Butter 2 Blöcke), eine Schrittweite (Mett 50 g) und einen geschätzten Preis. Die App rechnet den Gesamtbedarf aus und sucht eine Aufteilung in genau so viele Posten, wie Leute dabei sind, mit möglichst gleichem Preis. Als „günstig“ markierte Sachen (Häkchen im Reiter Einkauf, nur für die Moderation; in der Startliste Zwiebeln und Gewürze) bekommen immer einen eigenen Posten, sobald mindestens so viele Leute dabei sind, wie es Sachen gibt. Bei kleineren Gruppen kommen sie zu teureren Sachen dazu, aber nie zwei günstige zusammen.

**Günstig-Regel:** Wer bei seinen letzten zwei MMM, bei denen er dabei war, etwas Günstiges hatte (oder nichts), kann beim dritten Mal keinen günstigen Posten nehmen, solange noch etwas Teureres frei ist. „Übrige Posten zufällig verteilen“ gibt diesen Leuten zuerst etwas Teureres.

**Wer bekommt was:** Gespeichert wird nur die Sorte, die jemand gewählt hat (z. B. `mett`), nicht die Menge. Wer zuerst gewählt hat, bekommt den ersten Posten seiner Sorte. Ändert sich die Zahl der Leute, passen sich die Mengen an, und wer betroffen ist, sieht „Geändert, vorher …“. Fällt eine Sorte ganz weg, muss sich der Letzte neu entscheiden.

**Rollen:**
- **Klassencode:** steckt im geteilten Link (`#k=...`), damit kann jeder abstimmen und sich etwas aussuchen.
- **Moderator:** eine Person aus der Liste mit eigener PIN. Darf Termine, Einkaufsliste und Namen ändern.
- **Admin (Finn):** Admin-Code. Darf zusätzlich Moderatoren ernennen und die Codes ändern. Ein zweiter Admin bekommt einfach den Admin-Code; wer man in der Liste ist („Wer bist du?“), merkt sich jedes Gerät getrennt davon.

Der Klassencode steht im Klartext in der Datenbank (er ist ja für alle gedacht). Admin-Code und PINs liegen dort nur als SHA-256-Prüfsumme.

**Erinnerungen:** Wer will, tippt in der App auf „Ja, erinnern“ und erlaubt Benachrichtigungen (auf dem iPhone nur, wenn die App auf dem Home-Bildschirm liegt). Einen Tag vor dem Termin um 18 Uhr (einstellbar unter „Mehr“) bekommt dann eine Nachricht, wer noch nicht abgestimmt hat („Bist du morgen dabei?“) oder zugesagt, aber nichts ausgesucht hat. Jede Erinnerung geht pro Termin nur einmal raus. Verschickt wird von einem GitHub-Auftrag (`.github/workflows/erinnerung.yml`, alle 30 Minuten) mit Web Push. Er braucht zwei Repository-Secrets: `VAPID_PRIVATE` (privater Teil zu `js/push-schluessel.js`) und `MB_GEHEIM` (Versand-Schlüssel, in der Datenbank nur als Prüfsumme in `mb_system`). Testnachricht: unter Actions → Erinnerungen → „Run workflow“ mit Haken bei „Testnachricht“. Die Protokolle des Auftrags sind öffentlich, deshalb stehen dort nur Zahlen.

## Einrichten (einmalig)

1. In Supabase (Projekt `Petri_heil`) den SQL-Editor öffnen, den Inhalt von `supabase.sql` einfügen und ausführen.
2. Die Adresse öffnen, auf „Neue Liste einrichten“ tippen, Namen der Runde, Klassencode und Admin-Code festlegen.
3. In der Moderation unter „Leute“ die Namen eintragen, unter „Mehr“ den Link kopieren und in den Klassenchat schicken.

## Veröffentlichen

Repository `finnmarinov-lgtm/Mitbringliste`, GitHub Pages aus `main` (Ordner `/`). Jeder Push ist nach etwa einer Minute online. Die App lädt online immer die neueste Fassung, der Service Worker ist nur für den Fall ohne Netz da.
