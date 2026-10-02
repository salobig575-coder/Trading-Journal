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

## Daten

Alle Daten liegen lokal im Browser (IndexedDB) des jeweiligen Geräts. Über **Einstellungen → Backup** lassen sie sich als JSON exportieren/importieren (z. B. PC ↔ Handy).
