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
