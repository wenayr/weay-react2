# Settings dialog search history

Goal: make Global Settings search/history and tree controls follow the new usage standards.

Checkpoints:
- [x] Record the dictated task in `doc/target/my.md`.
- [x] Add a reusable small search-history utility instead of hard-coding history in `SettingsDialog`.
- [x] Use the utility in `SettingsDialog` with persisted history and keyboard-friendly recall.
- [x] Replace the three separate tree tool buttons with a compact control in the search row.
- [x] Update docs/changelog and run focused checks.

Notes:
- Existing `SettingsDialog` already owns the search tree; keep the feature generic and theme through `.wenayDlg*` classes/tokens.
- "Blocker Store" in the dictation is treated as the existing library persistence channel: memory store + `memoryCache` dirty publication.

Card 29 audit:
- Fixed: `ColumnDots` and `CardList` no longer carry their visual shell in inline styles; CSS classes now define the reusable primitive look.
- Still open for later audit: card 27 insert-column UX and delete behavior need product decision before changing semantics.
## 2026-07-09 follow-up

- Fixed: search history dropdown now closes when focus leaves the search box, while clicks inside the history list still work.
- Test: `__test/settingsDialog.test.tsx` covers the blur-close behavior.