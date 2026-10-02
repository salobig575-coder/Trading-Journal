# Trading Journal

Mobile-first PWA (Vanilla JS, IndexedDB, offline-fähig) – Nachbau des Notion-Templates **„Journal 2026 Community“** im Look & Feel der Produktiv-App.

## Inhalt (aus dem Notion übernommen)

| Notion | In der App |
| --- | --- |
| Menu (Gallery) | **Heute** – Wochen-Ergebnis, Routine, Schnellzugriffe; **+** unten für Trade / Analyse / Review |
| Weekly Tracker | Wochenplaner (Intention, Priorities, Reminders, Affirmation, Mo–So) |
| Checklist | Mech & Continuation Model Checklist |
| Journal (Trading Journal v2) | **Journal → Trades** – Liste/Galerie, Filter Zeitraum & Ergebnis (Wins/Losses/B-E/Tape) |
| My Analysis (Pre-Session Analysis) | **Journal → Analysen** – Weekly Outlook, Weekly Review, Daily Log |
| REVIEW (Review DB) | **Journal → Reviews** |
| Statistics, Equity Curve, Monthly Performance | **Statistik** – Übersicht, Equity, Kalender + Monate, Setups, Zeit |
| Trading Model, Mistakes | Abhakbare, editierbare Checklisten |
| Edu Content, Bio Concepts, Backtests, Prop Firms | **Bibliothek** |

## Routine (Habit-Tracker)

Tägliche Gewohnheiten mit XP-Gewichtung: Tages-Ring, Wochen-Score (Mo–Fr, Wochenende optional), Monats-Score mit Heatmap, Streak und Feier-Effekt, wenn ein Tag/eine Woche/ein Monat komplett ist. Alles unter **Routine → Gewohnheiten & XP bearbeiten** anpassbar.

Alle Auswahllisten (Pairs, Models, PO3, Entry-Setups, DoL, Macros, Ergebnisse …) stammen aus dem Notion und sind in den Einstellungen anpassbar.

## Lokal starten

```powershell
powershell -ExecutionPolicy Bypass -File scripts/serve.ps1 -Port 8430
```

Dann `http://localhost:8430` öffnen.

## Installation am Handy

Die App über die GitHub-Pages-URL öffnen → Browser-Menü → **„Zum Startbildschirm hinzufügen“** (iPhone: Teilen → Zum Home-Bildschirm).

## Daten & Cloud-Sync (Supabase)

Die App speichert lokal (IndexedDB, funktioniert offline) und gleicht optional mit Supabase ab, damit PC und Handy identisch sind. Pro Datensatz gewinnt die letzte Änderung; Löschungen werden mit synchronisiert.

Einrichtung:

1. Auf [supabase.com](https://supabase.com) ein Projekt anlegen.
2. SQL Editor → Inhalt von [`supabase/schema.sql`](supabase/schema.sql) ausführen (Tabelle + Row Level Security: jeder sieht nur seine eigenen Daten).
3. Authentication → Providers → Email: für den einfachsten Start **„Confirm email“ ausschalten** (sonst Bestätigungs-Mail abwarten).
4. Project Settings → API: **Project URL** und **anon/publishable key** kopieren und in [`js/config.js`](js/config.js) eintragen (oder in der App unter Einstellungen → Cloud-Sync). Der anon key ist öffentlich gedacht, geschützt wird über Row Level Security.
5. In der App: Einstellungen → Cloud-Sync → **Registrieren**, auf dem Handy dann mit denselben Daten **Anmelden**.

Zusätzlich gibt es unter **Einstellungen → Backup** einen JSON-Export/-Import.

## Neue Version ausliefern

Bei jedem Release in `sw.js` die Zahl in `CACHE_NAME` erhöhen (z. B. `trading-journal-v8`). Offene Apps zeigen dann unten „Neue Version verfügbar“ mit Button **Neu laden**.

## Weitere Funktionen

- **Pre-Trade-Check** (Trading Model abhaken) und **Warnungen** bei Trade-Limit, Verlustserie und Tageslimit (Einstellungen → Trading-Regeln)
- **Fehler-Tags** pro Trade mit Kosten-Auswertung in der Statistik
- **Prop-Konten** mit Profit-Ziel, Drawdown- und Tageslimit-Puffer (Bibliothek → Prop-Konten)
- **Wochenrückblick** ab Freitag 16 Uhr, **Risiko-Rechner**, **CSV-Export**
- Bilder aus der **Zwischenablage** einfügen, Vollbild mit Wischen
- Routine: Unterpunkte erscheinen nach der Hauptgewohnheit, Reihenfolge per Ziehen
- **Realtime-Sync**: Änderungen vom anderen Gerät erscheinen sofort (dafür `supabase/schema.sql` einmal erneut ausführen)

## Design-System

Alle Bewegungswerte (`--ease`, `--spring`, `--t-fast/base/slow` = 200/320/440 ms, `--press`, `--stagger`), Abstände (8-pt-Raster), Radien und Schriftgrößen stehen als Tokens oben in `css/style.css`. Animiert wird nur `transform`/`opacity`; `prefers-reduced-motion` wird respektiert. Schrift: SF Pro (Apple) bzw. Inter. Logo: `icons/logo-dark.svg`, `icons/logo-light.svg` (Entwürfe in `design/`).

## Sicherheit, Datenschutz, Qualität

- **App-Sperre per PIN** (Einstellungen → Sicherheit & Daten): schützt vor neugierigen Blicken, verschlüsselt aber nicht.
- **Passwort vergessen**: in Supabase unter *Authentication → URL Configuration* die Site URL (`https://salobig575-coder.github.io/Trading-Journal/`) eintragen, damit der Link in der Reset-Mail zur App führt.
- **Registrierung begrenzen**: Sobald alle eingeladenen Personen ein Konto haben, in Supabase unter *Authentication → Sign In / Providers* neue Registrierungen ausschalten.
- Schrift **Inter lokal** (`fonts/`), keine Google-Abrufe.
- **Tests**: `tests/index.html` im Browser öffnen (Berechnungen für Winrate, R, Streak, Routine).
- Entwürfe neuer Trades werden lokal gesichert, Löschen lässt sich per „Rückgängig“ zurücknehmen.

## Farbschema

Alle Farben stehen zentral in `css/palette.css`. Standard ist **Warm** (warme Neutraltöne + Gold, alle Kontraste mindestens WCAG AA). Das vorherige Schema bleibt als **Klassisch** erhalten – Umschalten unter Einstellungen → Darstellung → Farbschema.

`tests/sweep.js` prüft per Konsole (`await __sweep('iPhone 390x844')`) alle Seiten und Dialoge auf Überlauf, abgeschnittene Texte und Fehler.
