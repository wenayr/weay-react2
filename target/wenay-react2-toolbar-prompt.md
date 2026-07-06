# Task: `createToolbar` — a customizable, self-describing toolbar primitive for wenay-react2

## Goal
A reusable primitive for a small bar of action elements (icon buttons, toggles,
window-openers) that the end user can customize: which elements are shown, in
what order, and at what visual density (icons only vs icons + short label).

The customization UI must be a **standalone, pure component over a serializable
config**, so the exact same editor can be mounted in two places without changes:
1. a local popover behind a ⚙ button on the bar itself, and
2. a global settings menu (e.g. a registered settings section / SettingsDialog).

This mirrors an existing precedent in this library, `createUiSlot` (placement
persisted via staticProps/Cash) — reuse the same persistence mechanism and the
same component-returning factory shape.

## Non-goals (v1)
- Automatic overflow / "more" menu when items don't fit. Space is managed by the
  user via per-item visibility. (Leave a note where overflow would hook in later.)
- Grouping / sections inside one bar.
- Cross-bar drag (moving an item from one bar to another).

## Three decoupled layers (hard requirement)
1. **config** — plain serializable data, the single source of truth, persisted.
2. **Bar** — renders visible items, in config order, at config density.
3. **Settings** — a pure editor that only reads/writes `config`. No knowledge of
   how items render on the bar beyond their descriptors.

Because Settings is pure over config, it is trivially portable into the settings
menu "already as settings".

## Public API (factory, returns components — like createUiSlot)

```ts
type tDensityKey = 'icon' | 'label'   // extensible registry, not a hard union in impl

type ToolbarItem = {
    key: string           // stable id (persist key)
    title: string         // full human name — shown in the Settings list
    short?: string        // short caption for 'label' density (falls back to title)
    icon: ReactNode       // compact glyph/icon for 'icon' density
    render?: (density: tDensityKey) => ReactNode  // full custom render; default = icon [+ short]
    defaultVisible?: boolean   // default true
    fixed?: boolean            // cannot be hidden or reordered (optional)
}

type ToolbarConfig = {
    order: string[]                       // item keys, display order
    visible: { [key: string]: boolean }
    density: tDensityKey
}

createToolbar(opts: {
    key: string                  // persistence key (staticProps/Cash), like createUiSlot
    items: ToolbarItem[]         // descriptors (registry, `as const`-friendly)
    def?: Partial<ToolbarConfig> // defaults; missing → derived from items
}) => {
    Bar: () => JSX.Element                     // renders the live bar
    Settings: () => JSX.Element                // the pure editor (drop anywhere)
    api: {                                     // outward surface
        useConfig(): ToolbarConfig             // reactive read
        setConfig(next: ToolbarConfig): void
        reset(): void
        onChange: UseListen<[ToolbarConfig]>   // expose the stream outward
    }
}
```

New items appended to items that are absent from a persisted config must be
merged in (appended to order, visible defaulted) — never dropped, never crash
on stale/partial persisted state. Removed items must be ignored gracefully.

## Bar behavior

- Render items where visible[key] !== false, in order, applying density.
- Default item render:
  - density === 'icon' → icon only (title in title= tooltip).
  - density === 'label' → icon + short ?? title.
- If an item provides render(density), use it verbatim.
- Optional convenience: a built-in ⚙ trigger prop on Bar that opens Settings
  in a popover (reuse the library's existing popover/DivRnd3/Button primitives).
  Keep it optional — some consumers mount Settings only in the global menu.

## Settings editor behavior (pure over config)

- Density: a segmented control listing the density registry (icon / label…).
- Item list: one row per item, in order:
  - a checkbox → toggles visible[key] (disabled for fixed items),
  - the item's title (full name) + a small preview of its icon,
  - a drag handle → reorder (updates order). fixed items are not draggable.
- Every edit writes back through setConfig (so persistence + onChange fire).
- No app-specific styling; expose className hooks like the rest of the library
  (e.g. sectionClassName, activeClassName, matching SettingsDialog props).

## Reorder primitive

The only non-trivial piece. Prefer @dnd-kit/sortable (headless, tree-shakeable)
or a minimal built-in pointer-based vertical list-sort. Do NOT use DivRnd3 for this
(that's free-floating windows, wrong tool). Keep the sortable list accessible
(keyboard reorder) if cheap.

## Persistence

Reuse the exact mechanism createUiSlot uses (staticProps → Cash), keyed by
opts.key. Config is the persisted unit. Support multiple independent toolbars by
distinct keys. Two tabs / remounts must converge on the same persisted config.

## Multiple bars in one settings menu

Because Settings is pure and keyed, a global settings section can render several
Settings editors (one per bar) stacked, each labeled. No extra API needed.

## Code style (this library's conventions — follow exactly)

- Closure factories, not classes; DI at the boundary (opts), closures inside.
- Return an object-of-functions facade; split api (outward) if a second audience
  appears. Expose event streams via UseListen outward (onChange).
- == / != (not strict) unless strict is genuinely needed.
- No function return-type annotations (let inference work) unless it aids the reader.
- Single quotes, 4-space indent, no semicolons.
- Named functions for anything non-trivial / anything that can throw / handlers.
- Registries (items, density list) as as const with inferred literal types.

## Acceptance criteria

1. createToolbar({key, items}) renders a Bar; hiding an item in Settings
   removes it from the bar; reordering in Settings reorders the bar; switching
   density switches icon ↔ icon+label — all persisted across reload.
2. The same Settings element renders identically whether mounted in a local
   popover or a global settings section (no prop changes).
3. Adding a new item to items after a config was persisted shows it (appended,
   default-visible) without wiping the user's existing order/visibility.
4. api.onChange emits the new config on every edit; reset() restores defaults.
5. Zero app-specific dependencies; only React + the chosen sortable lib + existing
   wenay-react2 persistence primitives.

## Решения, принятые при реализации (2026-07-06)

- Плотность: 2 встроенных уровня (icon/label) через РАСШИРЯЕМЫЙ модульный реестр
  (registerToolbarDensity, по образцу registerSettingsSection) — третий "full/текст"
  = просто ещё одна запись.
- Сортировка: минимальный встроенный pointer-сорт (без @dnd-kit — новых зависимостей
  в библиотеку не тащим) + клавиатурный reorder на drag handle (стрелки).
- Персист: staticGetAdd + staticMarkDirty + renderBy/updateBy — ровно как createUiSlot;
  "новый стандарт" связи данных с кэшем не заводился, существующего достаточно
  (конфиг = один персист-юнит на opts.key).
