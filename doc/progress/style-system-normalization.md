# Style system normalization

Status: done/released (v1.0.38, v1.0.39, v1.0.41); default inventory and column-state scoped token fixes implemented and shipped.

## Source

User clarification: compatibility can be an aggressive migration when it is
clearly recorded in changelog, but default styles are dangerous to remove.
If default styles disappear, the project can become visually broken even when
the TypeScript/API migration is understandable.

## Standard

- Shared primitives must keep a usable default visual style.
- A default style may be changed, but not silently removed.
- Removing/replacing a default class requires a replacement class/token path,
  changelog entry, and migration note.
- New shared visual rules should use CSS custom properties first.
- Runtime geometry may stay inline when it is state-derived, but color, spacing,
  border, shadow, font, and hover/active states should move to classes/tokens.
- Apps may override variables; primitives should not require apps to copy a full
  CSS block to remain usable.

## Token direction

Current prefixes are a good start:

- `--color-*`
- `--menu-*`
- `--wnd-*`
- `--dlg-*`
- `--tb-*`
- `--logs-*`
- `--cols-menu-*` for compact `ColumnsMenu/MenuStrip` visuals.
- `--cols-dots-*` for `ColumnDots` visuals.
- `--cols-card-*` for `CardList` visuals.

Likely next prefixes:

- `--cols-*` remains a family prefix; concrete prefixes now use `--cols-menu-*`, `--cols-dots-*`, and `--cols-card-*`.
- `--input-*` for generic input/panel defaults if they stay public.
- `--param-*` for `ParamsEditor` if it remains a shared primitive.

## First audit candidates

- `src/style/style.css`: old button/menu classes, `FloatingWindow`, `SettingsDialog`, `Toolbar`, `ColumnDots/CardList`, and raw hover colors.
- `src/style/menuRight.css`: right-menu visual contract and default state styles.
- `src/common/src/grid/columnState/*`: finish deciding whether mobile/card
  visuals need `--cols-*` tokens.
- `src/common/src/components/ParamsEditor.tsx`: move reusable editor visuals
  out of component-owned inline styles if the API remains public.
- `src/common/src/components/Input.tsx`: decide whether old input panels are
  compatibility-only or need a proper tokenized default.

## Acceptance

- Default visual contract documented per public primitive group.
- Token prefixes chosen before broad style rewrites.
- No removal of default classes without replacement and changelog.
- Scoped visual QA cards checked before and after style migration.
## 2026-07-09 default style contract inventory

Source of truth:

- CSS tokens: `src/style/tokens.css`.
- TS mirror for inline styles/theme builders: `src/common/src/styles/tokens.ts`.
- Shared runtime CSS: `src/style/style.css` and `src/style/menuRight.css`.
- Generated `dist/lib/style/*` is build output, not the edit target.

Public/default visual contracts:

- `Menu` / `MenuR` / mouse context menu: legacy `.MenuR`, `.toButton`, `.toButtonA` classes remain; colors/shadow/borders are already routed through `--menu-*` tokens. Keep the old class names as compatibility surface.
- `RightMenu`: default classes `.menu-container`, `.menu-button`, `.dropdown-content`, `.menu-item`, `.submenu`, `.draggable-div` live in `src/style/menuRight.css` and already consume `--menu-*` / `--menu-outline-color`.
- `FloatingWindow`: `.wenayWnd*` and `.wenayCloseBtn` live in `src/style/style.css`; defaults intentionally preserve the old transparent/striped window while allowing `--wnd-*` theme overrides.
- `SettingsDialog`: `.wenayDlg*` classes live in `src/style/style.css`; default look is dark and tokenized through `--dlg-*` plus selected `--wnd-*` bridge variables on `.wenayDlgWindow`.
- `Toolbar` / `createToolbar`: `.wenayTb*` classes live in `src/style/style.css`; defaults consume `--tb-*`; stand-specific skins should override through wrapper classes, not by changing shared defaults.
- `Logs`: `src/common/src/logs/logStyles.ts` maps inline logger chrome to `--logs-*`; this is an accepted transitional contract while old logger JSX stays inline-heavy.
- `ColumnDots` / `CardList`: `.wenayColDots*` and `.wenayCardList*` classes live in `src/style/style.css`; restored card-29 defaults are now tokenized through `--cols-dots-*` / `--cols-card-*` with the same fallback values.
- `ColumnsMenu` / `MenuStrip`: behavior is already headless/presentation split. Visual button/container/divider states now use `.wenayColsMenu*` classes and `--cols-menu-*` tokens with the exact previous GitHub-like defaults; runtime reorder transform stays inline.
- `ParamsEditor`: public and still mostly old class + inline style based (`toIndicatorMenuButton`, `miniEl`, `toButtonEasy`, `inputCan`). Do not token-migrate broadly until hook/API direction is decided; candidate prefix `--param-*`.
- `Input` modal helpers: public compatibility helpers over `FloatingWindow`, `.msTradeAlt`, `.msTradeActive`, `.inputCan`, inline panel spacing. Candidate prefix `--input-*`, but may remain compatibility-only if newer app surfaces replace them.

Done scoped fix:

- `ColumnsMenu/MenuStrip` visual button/container/divider styles moved to classes/tokens; runtime reorder transform/drag geometry remains inline.

Done scoped fixes:

- `ColumnsMenu/MenuStrip` visual button/container/divider styles moved to classes/tokens; runtime reorder transform/drag geometry remains inline.
- `ColumnDots/CardList` restored card-29 defaults moved to `--cols-dots-*` / `--cols-card-*` variables with unchanged fallback values.

Next scoped candidate:

- Leave `ParamsEditor` / `Input` broad visual migration until the hook-first/API direction is clearer; only do bug-level style fixes there.
## 2026-07-09 scoped fix - ColumnsMenu/MenuStrip tokens

Implemented the compact column menu style contract:

- Added `--cols-menu-*` defaults to `src/style/tokens.css` and the TS mirror in `src/common/src/styles/tokens.ts`.
- Added `.wenayColsMenu*` classes in `src/style/style.css` for container/list/button states, fixed/drag shadow, text abbreviation, marks, and divider.
- Updated `src/common/src/grid/columnState/ColumnsMenu.tsx` so visual state uses classes; only consumer `style` and `useReorder` runtime transform remain inline.

Verification: `npx tsc -p tsconfig.qa-check.json --noEmit`; `npm run testjest -- --runInBand`; `npm run build`; `git diff --check`.
## 2026-07-09 scoped fix - ColumnDots/CardList tokens

Implemented the mobile/card column-state style contract:

- Added `--cols-dots-*` and `--cols-card-*` defaults to `src/style/tokens.css` and the TS mirror in `src/common/src/styles/tokens.ts`.
- Rewrote `.wenayColDots*` and `.wenayCardList*` values in `src/style/style.css` to use variables with the exact previous fallbacks.
- Kept component code unchanged; `ColumnDots` runtime geometry (`left`, drag transform) remains inline in the component where it belongs.

Verification: `npx tsc -p tsconfig.qa-check.json --noEmit`; `npm run testjest -- --runInBand`; `npm run build`; `git diff --check`.
## 2026-07-09 — Menu default contrast restore

Сделано:
- `--menu-bg-color` возвращён к непрозрачному dark fallback `#0c0c0c`, `--menu-blur` по умолчанию `0px`;
- добавлены `--menu-item-active-*` и `--menu-item-pressed-*` tokens, старый `--menu-active-background` оставлен alias/fallback;
- `MenuR` / mouse context menu and `RightMenu` CSS получили hard fallbacks: default dark background, white text, hover white with dark text, pressed yellow-ish contrast state;
- причина: рабочие проекты могут ещё не переопределять новые CSS variables, поэтому дефолт не должен становиться glass/transparent.

Проверка: CSS-only visual contract; прогнать `tsc`/`build`, card 4 вручную открыть правой кнопкой.
