import React, {useEffect, useId, useRef, useState} from 'react'
import type {GridApi} from 'ag-grid-community'
import {ColumnsMenu} from './columnState/ColumnsMenu'
import type {ColumnStateController} from './columnState/columnState'
import {contextMenu as defaultContextMenu, type ContextMenuAnchor} from '../menu/menuMouse'
import type {MenuItem} from '../menu/menu'

export type GridChromeGroup = 'columns' | 'size' | 'data' | 'table' | string

export type GridChromeCommandContext<T extends object> = {
    api: GridApi<T> | null
    columnState?: ColumnStateController
    close(): void
    report(message: string, kind?: 'success' | 'error'): void
}

export type GridChromeCommand<T extends object> = {
    key: string
    group: GridChromeGroup
    name: string
    title?: string
    ariaLabel?: string
    visible?: boolean | ((ctx: GridChromeCommandContext<T>) => boolean)
    disabled?: boolean | ((ctx: GridChromeCommandContext<T>) => boolean)
    /** Default true. Column editors may stay open with false. */
    closeOnRun?: boolean
    run(ctx: GridChromeCommandContext<T>): void | Promise<void>
}

/** Optional presentation metadata for a growing command group. Unknown command
 * groups still render, so this is additive rather than a second command API. */
export type GridChromeCommandGroup = {
    key: GridChromeGroup
    label?: string
    /** Lower values appear first among application-defined groups. */
    order?: number
    /** Lets infrequent/app-specific commands stay out of the initial menu scan. */
    collapsible?: boolean
    /** Used only when collapsible; defaults to true. The open choice stays local UI state. */
    defaultOpen?: boolean
}

export type GridChromeCopy<T extends object> = (data: {
    api: GridApi<T>
    rows: readonly T[]
    node: GridChromeRowNode<T> | null
    event?: Event
}) => void | Promise<void>

export type GridChromeRowNode<T extends object> = {
    isSelected?: () => boolean | undefined
    setSelected?: (selected: boolean, clearSelection?: boolean) => void
    data?: T
}

export type GridChromeCellContext<T extends object> = {
    api?: GridApi<T>
    node?: GridChromeRowNode<T> | null
    event?: Event | null
}

export type GridChromeContextMenu = Pick<typeof defaultContextMenu, 'openAt'>

export type GridChromeOptions<T extends object> = {
    /** Existing owner of column order/visibility/width. Grid Chrome never creates one. */
    columnState?: ColumnStateController
    /** Injected domain copy implementation; the library never serializes row data itself. */
    copy?: GridChromeCopy<T>
    /** Defaults to ag-grid autoSizeAllColumns when available. */
    autoSize?: (api: GridApi<T>) => void | Promise<void>
    /** Optional app persistence hook; column-state edits are already marked dirty locally. */
    saveColumns?: (ctx: GridChromeCommandContext<T>) => void | Promise<void>
    commands?: readonly GridChromeCommand<T>[]
    /** Declarative presentation for command groups; commands remain the source of actions. */
    commandGroups?: readonly GridChromeCommandGroup[]
    /** Existing app menu items, composed before the library copy item. */
    contextItems?: (event: GridChromeCellContext<T>) => readonly MenuItem[]
    contextMenu?: GridChromeContextMenu
    labels?: Partial<{
        trigger: string
        columns: string
        size: string
        data: string
        table: string
        copyRows: string
    }>
}

export type GridChromeProps = {
    className?: string
    style?: React.CSSProperties
}

function classNames(parts: Array<string | false | undefined>) {
    return parts.filter(Boolean).join(' ')
}

function asAnchor(event?: Event | null): ContextMenuAnchor {
    if (event && 'clientX' in event && typeof (event as MouseEvent).clientX == 'number') return event as MouseEvent
    return {x: 0, y: 0}
}

/** Select exactly the row under a context gesture; row-level selection is the only
 * ag-grid public API that can clear an existing multi-selection atomically. */
export function selectGridChromeContextRow<T extends object>(api: GridApi<T>, node: GridChromeRowNode<T> | null | undefined) {
    if (!node) return
    const selected = api.getSelectedNodes?.() ?? []
    if (selected.length == 1 && selected[0] == node) return
    // GridApi.setNodesSelected accepts no clearSelection option in the public API.
    // RowNode.setSelected does, so prefer it instead of silently accumulating rows.
    if (node.setSelected) {
        node.setSelected(true, true)
        return
    }
    // Lightweight/fake GridApi implementations may expose only the batch API.
    // Make the exclusive selection explicit in that fallback.
    const otherNodes = selected.filter(selectedNode => selectedNode != node)
    if (otherNodes.length) api.setNodesSelected({nodes: otherNodes as any, newValue: false})
    api.setNodesSelected({nodes: [node] as any, newValue: true})
}

/** Never mutate application menu arrays while adding the optional copy action. */
export function appendGridChromeMenuItem(items: readonly MenuItem[], item?: MenuItem) {
    return item ? [...items, item] : [...items]
}

/**
 * A compact command surface around one existing grid. It owns only popover UI and
 * a late-bound GridApi reference; column persistence remains in createColumnState.
 */
export function createGridChrome<T extends object>(opts: GridChromeOptions<T>) {
    let api: GridApi<T> | null = null
    const listeners = new Set<() => void>()
    const labels = {
        trigger: 'Команды таблицы',
        columns: 'Колонки',
        size: 'Размер',
        data: 'Данные',
        table: 'Таблица',
        copyRows: 'Копировать строки',
        ...opts.labels,
    }

    function emit() {
        for (const listener of [...listeners]) listener()
    }

    function attach(next: GridApi<T>) {
        if (api == next) return
        api = next
        emit()
    }

    function detach(current?: GridApi<T>) {
        if (current && api != current) return
        if (!api) return
        api = null
        emit()
    }

    function subscribe(listener: () => void) {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
    }

    function copyItem(event: GridChromeCellContext<T>): MenuItem | undefined {
        const current = event.api ?? api
        if (!current || !opts.copy) return undefined
        return {
            name: labels.copyRows,
            actionKey: 'grid-chrome.copy-rows',
            onClick: () => opts.copy?.({
                api: current,
                rows: current.getSelectedRows(),
                node: event.node ?? null,
                event: event.event ?? undefined,
            }),
        }
    }

    function contextMenuItems(event: GridChromeCellContext<T>, existing?: readonly MenuItem[]) {
        const current = event.api ?? api
        if (current) selectGridChromeContextRow(current, event.node)
        const appItems = existing ?? opts.contextItems?.({...event, api: current ?? undefined}) ?? []
        return appendGridChromeMenuItem(appItems, copyItem({...event, api: current ?? undefined}))
    }

    function openContextMenu(event: GridChromeCellContext<T>, existing?: readonly MenuItem[]) {
        const items = contextMenuItems(event, existing)
        if (!items.length) return false
        return (opts.contextMenu ?? defaultContextMenu).openAt(asAnchor(event.event), items, {source: 'grid-chrome'})
    }

    function Chrome(props: GridChromeProps = {}) {
        const [open, setOpen] = useState(false)
        const [feedback, setFeedback] = useState<{message: string, kind: 'success' | 'error'} | null>(null)
        const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
        const [, render] = useState(0)
        const rootRef = useRef<HTMLDivElement | null>(null)
        const triggerRef = useRef<HTMLButtonElement | null>(null)

        useEffect(() => subscribe(() => render(v => v + 1)), [])

        useEffect(() => {
            if (!feedback) return
            const timer = window.setTimeout(() => setFeedback(null), 1800)
            return () => window.clearTimeout(timer)
        }, [feedback])

        useEffect(() => {
            if (!open) return
            function onKeyDown(event: KeyboardEvent) {
                if (event.key != 'Escape') return
                event.preventDefault()
                setOpen(false)
                triggerRef.current?.focus()
            }
            function onPointerDown(event: MouseEvent | TouchEvent) {
                if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) setOpen(false)
            }
            document.addEventListener('keydown', onKeyDown)
            document.addEventListener('mousedown', onPointerDown)
            document.addEventListener('touchstart', onPointerDown)
            return () => {
                document.removeEventListener('keydown', onKeyDown)
                document.removeEventListener('mousedown', onPointerDown)
                document.removeEventListener('touchstart', onPointerDown)
            }
        }, [open])

        function report(message: string, kind: 'success' | 'error' = 'success') {
            setFeedback({message, kind})
        }

        function commandContext(): GridChromeCommandContext<T> {
            return {api, columnState: opts.columnState, close: () => setOpen(false), report}
        }

        async function run(command: GridChromeCommand<T>) {
            const context = commandContext()
            try {
                await command.run(context)
                report(command.name)
                if (command.closeOnRun != false) setOpen(false)
            } catch (error) {
                report(error instanceof Error ? error.message : command.name, 'error')
            }
        }

        const context = commandContext()
        const visible = (command: GridChromeCommand<T>) => typeof command.visible == 'function' ? command.visible(context) : command.visible != false
        const disabled = (command: GridChromeCommand<T>) => typeof command.disabled == 'function' ? command.disabled(context) : command.disabled == true
        const appCommands = (opts.commands ?? []).filter(visible)
        const groupConfig = (group: GridChromeGroup) => opts.commandGroups?.find(config => config.key == group)
        const groupTitle = (group: GridChromeGroup) => groupConfig(group)?.label ?? (group == 'columns' ? labels.columns : group == 'size' ? labels.size : group == 'data' ? labels.data : group == 'table' ? labels.table : group)
        const appGroups = [...new Set(appCommands.map(command => command.group))].map((group, index) => ({group, index})).sort((left, right) => {
            const leftOrder = groupConfig(left.group)?.order ?? 1000 + left.index
            const rightOrder = groupConfig(right.group)?.order ?? 1000 + right.index
            return leftOrder - rightOrder
        }).map(item => item.group)

        const sizeCommands: GridChromeCommand<T>[] = [
            {
                key: 'auto-size', group: 'size', name: 'По содержимому', title: 'Подобрать ширину колонок по содержимому',
                disabled: () => !api,
                run() {
                    if (!api) return
                    return opts.autoSize ? opts.autoSize(api) : api.autoSizeAllColumns?.()
                },
            },
            {
                key: 'fit-size', group: 'size', name: 'По ширине таблицы', title: 'Подогнать колонки по ширине таблицы',
                disabled: () => !api,
                run() { api?.sizeColumnsToFit() },
            },
        ]
        const dataCommands: GridChromeCommand<T>[] = opts.copy ? [{
            key: 'copy-rows', group: 'data', name: labels.copyRows, title: labels.copyRows,
            disabled: () => !api || api.getSelectedRows().length == 0,
            run() { if (api && opts.copy) return opts.copy({api, rows: api.getSelectedRows(), node: null}) },
        }] : []
        const columnCommands: GridChromeCommand<T>[] = opts.columnState ? [
            {
                key: 'reset-columns', group: 'columns', name: 'Сбросить', title: 'Сбросить колонки',
                run() { opts.columnState?.api.reset() },
            },
            {
                key: 'save-columns', group: 'columns', name: 'Сохранить', title: 'Сохранить состояние колонок',
                run(context) { return opts.saveColumns?.(context) },
            },
        ] : []

        function CommandButtons({commands}: {commands: readonly GridChromeCommand<T>[]}) {
            return <div className="wenayGridChromeCommands">
                {commands.map(command => <button key={command.key} type="button" className="wenayGridChromeCommand"
                    title={command.title ?? command.name} aria-label={command.ariaLabel ?? command.name}
                    disabled={disabled(command)} onClick={() => void run(command)}>{command.name}</button>)}
            </div>
        }

        function CommandGroup({group, commands, children}: {group: GridChromeGroup, commands: readonly GridChromeCommand<T>[], children?: React.ReactNode}) {
            if (!commands.length && !children) return null
            const contentId = useId()
            const config = groupConfig(group)
            const collapsible = config?.collapsible == true
            const expanded = expandedGroups[String(group)] ?? config?.defaultOpen ?? true
            const title = groupTitle(group)
            function toggle() {
                setExpandedGroups(current => ({...current, [String(group)]: !(current[String(group)] ?? config?.defaultOpen ?? true)}))
            }
            return <section className="wenayGridChromeGroup" aria-label={title}>
                {collapsible
                    ? <button type="button" className="wenayGridChromeGroupToggle" aria-expanded={expanded} aria-controls={contentId} onClick={toggle}><span>{title}</span><span className="wenayGridChromeGroupChevron" aria-hidden>⌄</span></button>
                    : <div className="wenayGridChromeGroupTitle">{title}</div>}
                <div id={contentId} className="wenayGridChromeGroupContent" role="group" aria-label={title} hidden={!expanded}>
                    {children}<CommandButtons commands={commands}/>
                </div>
            </section>
        }

        return <div ref={rootRef} className={classNames(['wenayGridChrome', open && 'wenayGridChrome_open', props.className])} style={props.style}>
            <button ref={triggerRef} type="button" className="wenayGridChromeTrigger" aria-label={labels.trigger}
                aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(v => !v)}
                onKeyDown={event => {
                    if (event.key != 'Enter' && event.key != ' ') return
                    event.preventDefault()
                    setOpen(v => !v)
                }}>⋮</button>
            {open && <div className="wenayGridChromePopover" role="dialog" aria-label={labels.trigger}>
                {opts.columnState && <CommandGroup group="columns" commands={columnCommands}><ColumnsMenu state={opts.columnState} compact /></CommandGroup>}
                <CommandGroup group="size" commands={sizeCommands}/>
                <CommandGroup group="data" commands={dataCommands}/>
                {appGroups.map(group => <CommandGroup key={group} group={group} commands={appCommands.filter(command => command.group == group)}/>) }
                {feedback && <div className={classNames(['wenayGridChromeFeedback', feedback.kind == 'error' && 'wenayGridChromeFeedback_error'])} role="status">{feedback.message}</div>}
            </div>}
            {!open && feedback && <div className={classNames(['wenayGridChromeFeedback', 'wenayGridChromeFeedback_toast', feedback.kind == 'error' && 'wenayGridChromeFeedback_error'])} role="status">{feedback.message}</div>}
        </div>
    }

    return {
        Chrome,
        grid: {attach, detach},
        api: {
            getApi: () => api,
            contextMenuItems,
            openContextMenu,
        },
        dispose() {
            api = null
            listeners.clear()
        },
    }
}

export type GridChromeController<T extends object> = ReturnType<typeof createGridChrome<T>>
