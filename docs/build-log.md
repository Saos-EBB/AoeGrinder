# Build-Log

## 2026-10-31 — refactor(state): gemeinsamen Spielzustand in state.ts bündeln
**Was:** Module können fremde `let`-Variablen nicht zuweisen; now, paused, mobs usw. liegen deshalb in einem Objekt. Modul steht nicht in der handoff-Liste, ist aber für die Aufteilung nötig.
**Nicht gebaut:** keine Getter/Setter, kein Store, nur ein Objekt.

## 2026-10-31 — chore(repo): Vite + TypeScript, v4 unverändert in main.ts
**Was:** Gerüst mit Build zu einer einzelnen index.html; Spielcode unverändert aus Artifact v4, damit jeder Modul-Schritt danach prüfbar bleibt. handoff.md und mechanics-spec.md liegen jetzt in docs/.
**Nicht gebaut:** keine Linter-Konfiguration, keine Tests im Repo, kein public/assets (noch keine Assets).
