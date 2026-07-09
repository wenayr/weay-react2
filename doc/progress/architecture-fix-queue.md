# Architecture fix queue (A1-A10) — progress

Status: in progress (session 2026-07-10). Queue source: `doc/target/my.md` (audit 2026-07-09).
Durable per-change record: `doc/changes/v1.0.41.md` (shipped part), `doc/changes/v1.0.42.md` (current).

## Session 2026-07-10 — recovery + tail of the queue

Context: the machine rebooted; recovered from docs. Discovered and fixed first:
the 1.0.41 release commit did NOT contain `columnGrid.tsx`, `fixedOrder.ts`,
`persistedMaps.ts` and the whole architecture pass (npm had them, git did not —
same failure mode as the earlier eb4e9b3 fix). Also `.npmrc` with a live npm
auth token was sitting untracked — now gitignored (`/.npmrc`, `.vite-*.log`);
the token itself should probably be rotated since it was on disk in the repo dir.

Commits this session (chronological):

1. **Post-release commit of the 1.0.41 working tree** — createColumnGrid sources,
   A1/A2/A4/A5/A6/A8/A10-safe, hook-extraction do-now trio, common2 ^1.0.70,
   changelog/docs; .gitignore hardening.
2. **A10 safe part 2** — `onClickClose` alias (+deprecated `onCLickClose`),
   `keyForSave` alias on `Button` (+deprecated `keySave`), QA card dup fix
   (Replay 25→33, 26→34), `__test/tokens.test.ts` (two-way tokens.ts↔tokens.css).
   Verify: tsc qa-check, jest 47/47.
3. **A10 loop-guard** — `utils/structEqual.ts` (+barrel export, permanent test);
   `columnState.readFromGrid` guards off `JSON.stringify`; order-sensitive
   `sameMap` deliberately untouched (its sensitivity re-imposes stored order on
   columnDefs reset). Verify: tsc, jest 53/53.
4. **A7** — `DragBox` → thin adapter over `useDraggableApi` (+additive
   `onMove`/`trackState:false` on the hook); `DragArea` @deprecated as-is;
   `useFloatingWindowController`/`StickerMenu` deliberately stay bespoke
   (recon: clamp, `buttons===1` recovery, persist, z-stack / mount-lifetime
   listeners, click-suppression are load-bearing). `__test/dragBox.test.tsx`,
   QA card 35. Verify: tsc, jest 58/58, stand: card 35 two drags commit without
   jump-back (renders 1+2/gesture), card 26 reorder commits once, zero console
   errors on fresh load.

## A9 — DONE (committed 2026-07-10, 5th commit of the session; build OK)

Done:

- `components/Overlay.tsx` — INTERNAL (not exported) portal+scrim+outside+Escape
  composition; outside-click delegates to `OutsideClickArea`; Escape listener only
  when `onEscape` given; callbacks through refs. Doubles as the DOM seam for the
  future react-native view layer (headless state stays in hosts).
- `ModalProvider` → Overlay (inline token scrim + flex centering, Escape gated by
  `closeOnEscape`, outside by `closeOnOutsideClick`) — public API untouched.
- `SettingsDialog` → Overlay (`wenayDlgScrim`/`wenayDlgOutside` classes,
  NO onEscape — the controller keeps the two-stage Escape: clear search, then close).
- New permanent `__test/modalProvider.test.tsx` (portal/scrim/Escape/outside gates).

Verified so far: tsc qa-check OK; jest 62/62; stand card 13 — open, Escape,
outside click, close button all work (scrim dims, token z-index); card 20 —
open, two-stage Escape (clear → close), outside click, window x. Console clean
on fresh load (the ReferenceError seen mid-session was a vite HMR intermediate
between two sequential edits, gone after reload).

Deliberately NOT overlaid (recorded in changelog): `createModalElementStore`
(render-slot store, not chrome), `LeftModal`/`Modal2` drawer (gesture-driven,
no scrim), `ModalWrapper`/Input helpers (backdrop-less by design, hosted inside
another modal slot).

Close-out complete: fresh-page card-13/20 spot checks passed, changelog +
my.md updated, `npm run build` OK, committed.

## Queue after this session

- **A3 (BREAKING)** dead `menuR.tsx` removal — only in a deliberate breaking version.
- **A10 breaking leftovers** — raw `ListenApi` narrowing; removal of deprecated
  `onCLickClose`/`keySave`/`DragArea`.
- Then Ready queue: common2 1.0.66-1.0.70 adoption (useMediaSource, Peer SDK
  adapter, WebRTC recipe), context-menu controller split, chart canvas wrapper.
- New Inbox item 2026-07-10: React Native / mobile version of the library's
  functionality (see `doc/target/my.md` Inbox + verbatim dictation) — A9 Overlay
  was already shaped with that in mind (DOM isolated in one leaf).
