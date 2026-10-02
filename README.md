# Trading Journal

Mobile-first PWA (Vanilla JS, IndexedDB, offline-fähig) – Nachbau des Notion-Templates **„Journal 2026 Community“** im Look & Feel der Produktiv-App.

## Inhalt (1:1 aus dem Notion übernommen)

| Notion | In der App |
| --- | --- |
| Menu (Gallery) | **Home** – Kachel-Menü + Schnellaktionen (Trade / Analyse / Review) |
| Weekly Tracker | Wochenplaner (Intention, Priorities, Reminders, Affirmation, Mo–So) |
| Journal (Trading Journal v2) | **Journal** – Liste/Galerie, Filter Alle/Heute/Woche/Monat, Detail & Formular |
| My Analysis (Pre-Session Analysis) | **Analyse** – Weekly Outlook, Weekly Review, Daily Log |
| REVIEW (Review DB) | **Analyse → Review** |
| Statistics | **Statistik** – Setups (Timeframes, Models, PO3, DoL, Entry-Typen, Rating, Tickers, Results), Zeit (Weekdays, Killzones, Years, Monate) |
| Equity Curve | Cumulative R:R + Net Daily R:R, Max Drawdown |
| Monthly Performance / Kalender | Monatsübersicht + Kalender mit Tages-R |
| W/L/B Trades | Wins / Losses / B/E / Tape |
| Trading Model, Mistakes | Abhakbare, editierbare Checklisten |
| Edu Content, Bio Concepts, Backtests, Prop Firms | Sammlungen mit Suche, Tags, Link |

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
