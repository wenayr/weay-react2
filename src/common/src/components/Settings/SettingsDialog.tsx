import React, {useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {createUpdateApi, renderBy} from "../../../updateBy";
import {OutsideClickArea} from "../../hooks/useOutside";
import {FloatingWindowBase} from "../Dnd/FloatingWindow";
import {createSearchHistory} from "../../utils/searchHistory";
import {memoryGetOrCreate, memoryMarkDirty} from "../../utils/memoryStore";

export type SettingsSearchSource = React.ReactNode | readonly React.ReactNode[] | (() => React.ReactNode | readonly React.ReactNode[])

export type SettingsSection = {
    key: string
    name: string
    render: () => React.ReactNode
    /** Nested sections for the left settings tree. Flat sections remain roots. */
    children?: SettingsSection[]
    /** Attach this section under another section key, useful for registered external sections. */
    parentKey?: string
    /** Extra searchable text for content that cannot be extracted from React children. */
    searchText?: SettingsSearchSource
    /** Semantic aliases: commands, domain terms, translated labels, etc. */
    keywords?: readonly string[]
}

type SettingsTreeNode = {
    section: SettingsSection
    children: SettingsTreeNode[]
    parent?: SettingsTreeNode
    depth: number
}

type SettingsTree = {
    roots: SettingsTreeNode[]
    ordered: SettingsTreeNode[]
    byKey: Map<string, SettingsTreeNode>
}

type SettingsTreeFilter = {
    visibleKeys: Set<string>
    matchedKeys: Set<string>
    expandedKeys: Set<string>
}

type SettingsSearchTerm = {
    variants: string[]
}

type SettingsDialogLayoutState = {
    navWidth: number
}

const settingsDialogSize = {width: 820, height: 560}
const settingsDialogPosition = {x: -settingsDialogSize.width / 2, y: -settingsDialogSize.height / 2}
const settingsDialogNav = {min: 160, def: 220, max: 360}

// Module singleton (closure + updateBy subscription, no React context): any module
// registers a section on mount and removes it on unmount; the dialog re-renders on changes.
const registry = {list: [] as SettingsSection[]}
const registryApi = createUpdateApi(registry)
const settingsSearchHistory = createSearchHistory({key: "SettingsDialog.searchHistory", max: 8})
const settingsDialogLayout = memoryGetOrCreate<SettingsDialogLayoutState>("SettingsDialog.layout", {navWidth: settingsDialogNav.def})

/** Register an external section. Re-register with the same key replaces the previous one.
 *  The returned function removes exactly this registration (a no-op if it was replaced). */
export function registerSettingsSection(s: SettingsSection): () => void {
    const i = registry.list.findIndex(e => e.key == s.key)
    if (i == -1) registry.list.push(s)
    else registry.list.splice(i, 1, s)
    registryApi.render()
    return () => {
        const j = registry.list.indexOf(s)
        if (j != -1) {
            registry.list.splice(j, 1)
            registryApi.render()
        }
    }
}

/** Current external sections (static props sections are not included). */
export function getSettingsSections(): readonly SettingsSection[] {
    return registry.list
}

function classNames(parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ")
}

function clampSettingsNavWidth(value: number) {
    return Math.max(settingsDialogNav.min, Math.min(settingsDialogNav.max, Math.round(value)))
}

function DefaultSettingsTrigger() {
    return <span className="wenayTb wenayDlgTriggerBar" title="Open settings" aria-hidden="true">
        <span className="wenayTbItem wenayDlgTriggerItem">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <circle cx="3" cy="7" r="1.25" fill="currentColor"/>
                <circle cx="7" cy="7" r="1.25" fill="currentColor"/>
                <circle cx="11" cy="7" r="1.25" fill="currentColor"/>
            </svg>
        </span>
    </span>
}

function buildSettingsTree(sections: SettingsSection[]): SettingsTree {
    const roots: SettingsTreeNode[] = []
    const ordered: SettingsTreeNode[] = []
    const byKey = new Map<string, SettingsTreeNode>()
    const parentByKey = new Map<string, string | undefined>()

    function collect(section: SettingsSection, nestedParentKey?: string) {
        if (byKey.has(section.key)) return
        const node: SettingsTreeNode = {section, children: [], depth: 0}
        byKey.set(section.key, node)
        ordered.push(node)
        parentByKey.set(section.key, section.parentKey ?? nestedParentKey)
        section.children?.forEach(child => collect(child, section.key))
    }

    sections.forEach(section => collect(section))
    ordered.forEach(node => {
        const parentKey = parentByKey.get(node.section.key)
        const parent = parentKey == null ? undefined : byKey.get(parentKey)
        if (parent != null && parent != node) {
            node.parent = parent
            parent.children.push(node)
        } else {
            roots.push(node)
        }
    })

    function assignDepth(nodes: SettingsTreeNode[], depth: number) {
        nodes.forEach(node => {
            node.depth = depth
            assignDepth(node.children, depth + 1)
        })
    }

    assignDepth(roots, 0)
    return {roots, ordered, byKey}
}

function getTreeSignature(nodes: SettingsTreeNode[]) {
    return nodes.map(node => `${node.section.key}:${node.parent?.section.key ?? ""}:${node.children.map(child => child.section.key).join(",")}`).join("|")
}

function getBranchKeys(nodes: SettingsTreeNode[]) {
    return nodes.filter(node => node.children.length != 0).map(node => node.section.key)
}

function normalizeSearch(value: string) {
    return value.toLocaleLowerCase().replace(/\s+/g, " ").trim()
}

const enKeyboard = "`qwertyuiop[]asdfghjkl;'zxcvbnm,./"
const ruKeyboard = "ёйцукенгшщзхъфывапролджэячсмитьбю."

const ruToEnKeyboard = new Map(Array.from(ruKeyboard).map((char, i) => [char, enKeyboard[i]]))
const enToRuKeyboard = new Map(Array.from(enKeyboard).map((char, i) => [char, ruKeyboard[i]]))

function convertKeyboardLayout(value: string, map: Map<string, string>) {
    return Array.from(value).map(char => map.get(char) ?? char).join("")
}

function uniqueSearchVariants(token: string) {
    return Array.from(new Set([
        token,
        convertKeyboardLayout(token, ruToEnKeyboard),
        convertKeyboardLayout(token, enToRuKeyboard),
    ].filter(Boolean)))
}

function getSearchTerms(value: string): SettingsSearchTerm[] {
    return normalizeSearch(value).split(" ").filter(Boolean).map(text => ({
        variants: uniqueSearchVariants(text),
    }))
}

function isIterableNode(value: React.ReactNode): value is Iterable<React.ReactNode> {
    return typeof value == "object" && value != null && Symbol.iterator in value
}

function reactNodeText(node: React.ReactNode): string {
    if (node == null || typeof node == "boolean") return ""
    if (typeof node == "string" || typeof node == "number" || typeof node == "bigint") return String(node)
    if (Array.isArray(node)) return node.map(reactNodeText).join(" ")
    if (React.isValidElement(node)) {
        const props = node.props as {
            children?: React.ReactNode
            title?: React.ReactNode
            "aria-label"?: React.ReactNode
            label?: React.ReactNode
        }
        return [props.title, props["aria-label"], props.label, props.children].map(reactNodeText).join(" ")
    }
    if (isIterableNode(node)) return Array.from(node).map(reactNodeText).join(" ")
    return ""
}

function searchSourceText(source: SettingsSearchSource) {
    const value = typeof source == "function" ? source() : source
    return reactNodeText(value)
}

function sectionSearchText(section: SettingsSection) {
    const parts = [section.key, section.name, ...(section.keywords ?? [])]
    if (section.searchText != null) parts.push(searchSourceText(section.searchText))
    try {
        parts.push(reactNodeText(section.render()))
    } catch {
        // Search should not break the dialog if a consumer render throws outside its normal path.
    }
    return normalizeSearch(parts.join(" "))
}

function sectionMatches(section: SettingsSection, terms: SettingsSearchTerm[]) {
    const text = sectionSearchText(section)
    return terms.every(term => term.variants.some(variant => text.includes(variant)))
}

function getCurrentBranchKeys(node?: SettingsTreeNode) {
    const keys = new Set<string>()
    let current = node
    while (current != null) {
        if (current.children.length != 0) keys.add(current.section.key)
        current = current.parent
    }
    return keys
}

function getLabelMatchRanges(label: string, terms: SettingsSearchTerm[]) {
    const lowerLabel = label.toLocaleLowerCase()
    const ranges: Array<{start: number, end: number}> = []
    terms.forEach(term => {
        const match = term.variants.reduce<{start: number, end: number} | undefined>((best, variant) => {
            const start = lowerLabel.indexOf(variant)
            if (start == -1) return best
            const range = {start, end: start + variant.length}
            if (best == null || range.start < best.start || (range.start == best.start && range.end > best.end)) return range
            return best
        }, undefined)
        if (match != null) ranges.push(match)
    })
    ranges.sort((a, b) => a.start - b.start || b.end - a.end)
    return ranges.reduce<Array<{start: number, end: number}>>((acc, range) => {
        const last = acc[acc.length - 1]
        if (last == null || range.start > last.end) acc.push({...range})
        else if (range.end > last.end) last.end = range.end
        return acc
    }, [])
}

function renderHighlightedLabel(label: string, terms: SettingsSearchTerm[]) {
    const ranges = getLabelMatchRanges(label, terms)
    if (ranges.length == 0) return label
    const parts: React.ReactNode[] = []
    let offset = 0
    ranges.forEach((range, i) => {
        if (range.start > offset) parts.push(label.slice(offset, range.start))
        parts.push(<mark className="wenayDlgTreeMark" key={`${range.start}-${range.end}-${i}`}>{label.slice(range.start, range.end)}</mark>)
        offset = range.end
    })
    if (offset < label.length) parts.push(label.slice(offset))
    return parts
}

function filterSettingsTree(roots: SettingsTreeNode[], terms: SettingsSearchTerm[]): SettingsTreeFilter {
    const visibleKeys = new Set<string>()
    const matchedKeys = new Set<string>()
    const expandedKeys = new Set<string>()

    function visit(node: SettingsTreeNode) {
        const selfMatches = terms.length == 0 || sectionMatches(node.section, terms)
        let childVisible = false
        node.children.forEach(child => {
            if (visit(child)) childVisible = true
        })
        const visible = terms.length == 0 || selfMatches || childVisible
        if (visible) visibleKeys.add(node.section.key)
        if (terms.length != 0 && selfMatches) matchedKeys.add(node.section.key)
        if (terms.length != 0 && childVisible) expandedKeys.add(node.section.key)
        return visible
    }

    roots.forEach(visit)
    return {visibleKeys, matchedKeys, expandedKeys}
}

export type SettingsDialogProps = {
    trigger?: React.ReactNode
    sections?: SettingsSection[]
    defaultSection?: string
    /** Section buttons: apps pass their own .chip / .chipActive; defaults are minimal library styles */
    sectionClassName?: string
    sectionActiveClassName?: string
}

export type SettingsDialogTreeToolState = "collapsed" | "expanded" | "branch"

export type SettingsDialogController = {
    open: boolean
    setOpen: React.Dispatch<React.SetStateAction<boolean>>
    active?: string
    setActive: React.Dispatch<React.SetStateAction<string | undefined>>
    search: string
    setSearch: React.Dispatch<React.SetStateAction<string>>
    expanded: Set<string>
    historyOpen: boolean
    setHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>
    navWidth: number
    navResizing: boolean
    searchInputRef: React.RefObject<HTMLInputElement | null>
    searchBoxRef: React.RefObject<HTMLDivElement | null>
    tree: SettingsTree
    filtered: SettingsTreeFilter
    current?: SettingsSection
    currentNode?: SettingsTreeNode
    firstVisibleNode?: SettingsTreeNode
    searchTerms: SettingsSearchTerm[]
    searchHistory: readonly string[]
    base: string
    activeCls: string
    treeToolsVisible: boolean
    treeToolState: SettingsDialogTreeToolState
    treeToolTitle: string
    openDialog(): void
    closeDialog(): void
    onTriggerKeyDown(e: React.KeyboardEvent<HTMLSpanElement>): void
    toggleExpanded(key: string): void
    commitSearch(value?: string): void
    useHistoryItem(value: string): void
    clearHistory(): void
    commitNavWidth(value: number): void
    beginNavResize(e: React.PointerEvent<HTMLDivElement>): void
    onNavResizeKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void
    closeHistoryWhenSearchFocusLeaves(e: React.FocusEvent<HTMLDivElement>): void
    cycleTreeTool(): void
}

export function useSettingsDialogController(props: SettingsDialogProps): SettingsDialogController {
    const [open, setOpen] = useState(false)
    const [active, setActive] = useState(props.defaultSection)
    const [search, setSearch] = useState("")
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
    const [historyOpen, setHistoryOpen] = useState(false)
    const [navWidth, setNavWidth] = useState(() => clampSettingsNavWidth(settingsDialogLayout.navWidth))
    const [navResizing, setNavResizing] = useState(false)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const searchBoxRef = useRef<HTMLDivElement>(null)
    const navResizeRef = useRef<{startX: number, startWidth: number} | null>(null)
    const navWidthRef = useRef(navWidth)
    registryApi.use()
    const searchHistory = settingsSearchHistory.use()

    const sections = [...(props.sections ?? []), ...registry.list]
    const tree = buildSettingsTree(sections)
    const treeSignature = getTreeSignature(tree.ordered)
    const branchKeys = getBranchKeys(tree.ordered)
    const searchTerms = getSearchTerms(search)
    const filtered = filterSettingsTree(tree.roots, searchTerms)
    const activeNode = active == null ? undefined : tree.byKey.get(active)
    const defaultNode = props.defaultSection == null ? undefined : tree.byKey.get(props.defaultSection)
    const firstVisibleNode = tree.ordered.find(node => filtered.visibleKeys.has(node.section.key))
    const firstMatchedNode = tree.ordered.find(node => filtered.matchedKeys.has(node.section.key))
    const fallbackNode = defaultNode ?? tree.ordered[0]
    const currentNode = searchTerms.length != 0
        ? (activeNode != null && filtered.matchedKeys.has(activeNode.section.key) ? activeNode : firstMatchedNode ?? firstVisibleNode ?? activeNode ?? fallbackNode)
        : activeNode ?? fallbackNode
    const current = currentNode?.section
    const base = props.sectionClassName ?? "wenayDlgSection"
    const activeCls = props.sectionActiveClassName ?? "wenayDlgSectionActive"
    const branchOpenCount = branchKeys.filter(key => expanded.has(key)).length
    const treeToolsVisible = branchKeys.length > 1
    const treeToolState: SettingsDialogTreeToolState = branchOpenCount == 0 ? "collapsed" : branchOpenCount == branchKeys.length ? "expanded" : "branch"
    const treeToolTitle = treeToolState == "expanded" ? "Show current branch only" : treeToolState == "branch" ? "Collapse tree" : "Expand tree"

    useEffect(() => {
        navWidthRef.current = navWidth
    }, [navWidth])

    useEffect(() => {
        if (!open) return
        setExpanded(new Set(branchKeys))
    }, [open, treeSignature])

    useEffect(() => {
        if (!navResizing) return
        const onPointerMove = (e: PointerEvent) => {
            const drag = navResizeRef.current
            if (drag == null) return
            setNavWidth(clampSettingsNavWidth(drag.startWidth + e.clientX - drag.startX))
        }
        const onPointerUp = () => {
            commitNavWidth(navWidthRef.current)
            navResizeRef.current = null
            setNavResizing(false)
        }
        document.addEventListener("pointermove", onPointerMove)
        document.addEventListener("pointerup", onPointerUp)
        return () => {
            document.removeEventListener("pointermove", onPointerMove)
            document.removeEventListener("pointerup", onPointerUp)
        }
    }, [navResizing])

    useEffect(() => {
        if (!open) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key != "Escape" || e.isComposing) return
            if (search != "") {
                e.preventDefault()
                setSearch("")
                searchInputRef.current?.focus()
                return
            }
            setOpen(false)
        }
        document.addEventListener("keydown", onKeyDown)
        return () => document.removeEventListener("keydown", onKeyDown)
    }, [open, search])

    function openDialog() {
        setSearch("")
        setHistoryOpen(false)
        setOpen(true)
    }

    function closeDialog() {
        setOpen(false)
    }

    function onTriggerKeyDown(e: React.KeyboardEvent<HTMLSpanElement>) {
        if (e.key != "Enter" && e.key != " ") return
        e.preventDefault()
        openDialog()
    }

    function toggleExpanded(key: string) {
        setExpanded(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    function expandAll() {
        setExpanded(new Set(branchKeys))
    }

    function collapseAll() {
        setExpanded(new Set())
    }

    function collapseOutsideCurrent() {
        setExpanded(getCurrentBranchKeys(currentNode))
    }

    function commitSearch(value = search) {
        settingsSearchHistory.add(value)
        setHistoryOpen(false)
    }

    function commitNavWidth(value: number) {
        const next = clampSettingsNavWidth(value)
        settingsDialogLayout.navWidth = next
        setNavWidth(next)
        renderBy(settingsDialogLayout)
        memoryMarkDirty("SettingsDialog.layout")
    }

    function beginNavResize(e: React.PointerEvent<HTMLDivElement>) {
        e.preventDefault()
        navResizeRef.current = {startX: e.clientX, startWidth: navWidth}
        setHistoryOpen(false)
        setNavResizing(true)
    }

    function onNavResizeKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
        if (e.key == "ArrowLeft") {
            e.preventDefault()
            commitNavWidth(navWidth - 16)
        } else if (e.key == "ArrowRight") {
            e.preventDefault()
            commitNavWidth(navWidth + 16)
        } else if (e.key == "Home") {
            e.preventDefault()
            commitNavWidth(settingsDialogNav.min)
        } else if (e.key == "End") {
            e.preventDefault()
            commitNavWidth(settingsDialogNav.max)
        } else if (e.key == "Enter" || e.key == " ") {
            e.preventDefault()
            commitNavWidth(settingsDialogNav.def)
        }
    }

    function useHistoryItem(value: string) {
        setSearch(value)
        settingsSearchHistory.add(value)
        setHistoryOpen(false)
        searchInputRef.current?.focus()
    }

    function clearHistory() {
        settingsSearchHistory.clear()
        setHistoryOpen(false)
        searchInputRef.current?.focus()
    }

    function closeHistoryWhenSearchFocusLeaves(e: React.FocusEvent<HTMLDivElement>) {
        const next = e.relatedTarget as Node | null
        if (next && e.currentTarget.contains(next)) return
        window.setTimeout(() => {
            const box = searchBoxRef.current
            if (box == null || !box.contains(document.activeElement)) setHistoryOpen(false)
        }, 0)
    }

    function cycleTreeTool() {
        if (treeToolState == "expanded") collapseOutsideCurrent()
        else if (treeToolState == "branch") collapseAll()
        else expandAll()
    }

    return {
        open,
        setOpen,
        active,
        setActive,
        search,
        setSearch,
        expanded,
        historyOpen,
        setHistoryOpen,
        navWidth,
        navResizing,
        searchInputRef,
        searchBoxRef,
        tree,
        filtered,
        current,
        currentNode,
        firstVisibleNode,
        searchTerms,
        searchHistory,
        base,
        activeCls,
        treeToolsVisible,
        treeToolState,
        treeToolTitle,
        openDialog,
        closeDialog,
        onTriggerKeyDown,
        toggleExpanded,
        commitSearch,
        useHistoryItem,
        clearHistory,
        commitNavWidth,
        beginNavResize,
        onNavResizeKeyDown,
        closeHistoryWhenSearchFocusLeaves,
        cycleTreeTool,
    }
}
/** Centered settings dialog with a searchable JetBrains-style settings tree on the left.
 *  Sections = props.sections (first) + everything from registerSettingsSection.
 *  Flat {key, name, render} sections remain valid; use children/parentKey for hierarchy.
 *  Look is themed via --dlg-* CSS variables (dark defaults), same contract as --wnd-*. */
export function SettingsDialog(props: SettingsDialogProps) {
    const {
        open,
        setOpen,
        setActive,
        search,
        setSearch,
        expanded,
        historyOpen,
        setHistoryOpen,
        navWidth,
        navResizing,
        searchInputRef,
        searchBoxRef,
        tree,
        filtered,
        current,
        firstVisibleNode,
        searchTerms,
        searchHistory,
        base,
        activeCls,
        treeToolsVisible,
        treeToolState,
        treeToolTitle,
        openDialog,
        onTriggerKeyDown,
        toggleExpanded,
        commitSearch,
        useHistoryItem,
        clearHistory,
        commitNavWidth,
        beginNavResize,
        onNavResizeKeyDown,
        closeHistoryWhenSearchFocusLeaves,
        cycleTreeTool,
    } = useSettingsDialogController(props)

    function renderTreeNode(node: SettingsTreeNode): React.ReactNode {
        if (!filtered.visibleKeys.has(node.section.key)) return null
        const key = node.section.key
        const hasChildren = node.children.length != 0
        const isOpen = expanded.has(key) || (searchTerms.length != 0 && filtered.expandedKeys.has(key))
        const isActive = key == current?.key
        const rowClass = classNames(["wenayDlgTreeRow", base, isActive && activeCls])

        function onRowKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
            if (e.key == "Enter" || e.key == " ") {
                e.preventDefault()
                setActive(key)
            }
            if (e.key == "ArrowRight" && hasChildren && !isOpen) {
                e.preventDefault()
                toggleExpanded(key)
            }
            if (e.key == "ArrowLeft" && hasChildren && isOpen) {
                e.preventDefault()
                toggleExpanded(key)
            }
        }

        return <React.Fragment key={key}>
            <div
                role="treeitem"
                aria-level={node.depth + 1}
                aria-expanded={hasChildren ? isOpen : undefined}
                aria-selected={isActive}
                tabIndex={0}
                className={rowClass}
                style={{paddingLeft: 6 + node.depth * 14}}
                onClick={() => setActive(key)}
                onKeyDown={onRowKeyDown}
            >
                <button
                    type="button"
                    className={classNames(["wenayDlgTreeToggle", !hasChildren && "wenayDlgTreeToggleEmpty", isOpen && "wenayDlgTreeToggleOpen"])}
                    disabled={!hasChildren}
                    aria-label={isOpen ? "Collapse" : "Expand"}
                    onClick={e => {
                        e.stopPropagation()
                        if (hasChildren) toggleExpanded(key)
                    }}
                />
                <span className="wenayDlgTreeLabel">{renderHighlightedLabel(node.section.name, searchTerms)}</span>
            </div>
            {hasChildren && isOpen && node.children.map(renderTreeNode)}
        </React.Fragment>
    }

    return <>
        <span
            role="button"
            tabIndex={0}
            aria-label={props.trigger == null ? "Open settings" : undefined}
            onClick={openDialog}
            onKeyDown={onTriggerKeyDown}
            style={{display: "inline-block", cursor: "pointer"}}
        >
            {props.trigger ?? <DefaultSettingsTrigger />}
        </span>
        {open && createPortal(
            <div className="wenayDlgScrim">
                <OutsideClickArea outsideClick={() => setOpen(false)} status={open} className="wenayDlgOutside">
                    <FloatingWindowBase
                        className="wenayDlgWindow"
                        size={settingsDialogSize}
                        position={settingsDialogPosition}
                        zIndex={10000}
                        moveOnlyHeader={true}
                        overflow={false}
                        onClickClose={() => setOpen(false)}
                        header={<div className="wenayDlgHeader">Settings</div>}
                    >
                        <div className={classNames(["wenayDlg", navResizing && "wenayDlg_resizing"])}>
                    <div className="wenayDlgNav" style={{width: navWidth}}>
                        <div className="wenayDlgNavTop">
                            <div ref={searchBoxRef} className="wenayDlgSearchBox" onBlur={closeHistoryWhenSearchFocusLeaves}>
                                <input
                                    ref={searchInputRef}
                                    className="wenayDlgSearch"
                                    value={search}
                                    placeholder="Search"
                                    aria-label="Search settings"
                                    onFocus={() => setHistoryOpen(searchHistory.length != 0)}
                                    onChange={e => {
                                        setSearch(e.currentTarget.value)
                                        setHistoryOpen(searchHistory.length != 0)
                                    }}
                                    onKeyDown={e => {
                                        if (e.key == "Enter") commitSearch()
                                        if (e.key == "ArrowDown" && searchHistory[0]) {
                                            e.preventDefault()
                                            useHistoryItem(searchHistory[0])
                                        }
                                    }}
                                />
                                {searchHistory.length != 0 && <button
                                    type="button"
                                    className="wenayDlgSearchHistoryBtn"
                                    title="Search history"
                                    aria-label="Search history"
                                    aria-expanded={historyOpen}
                                    onClick={() => {
                                        setHistoryOpen(v => !v)
                                        searchInputRef.current?.focus()
                                    }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                                        <path d="M7 2a5 5 0 1 1-4.4 2.6M2 2v3h3M7 4v3l2 1"/>
                                    </svg>
                                </button>}
                                {search != "" && <button
                                    type="button"
                                    className="wenayDlgSearchClear"
                                    title="Clear search"
                                    aria-label="Clear search"
                                    onClick={() => {
                                        setSearch("")
                                        setHistoryOpen(searchHistory.length != 0)
                                        searchInputRef.current?.focus()
                                    }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                                        <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                                    </svg>
                                </button>}
                                {historyOpen && searchHistory.length != 0 && <div className="wenayDlgSearchHistory" role="listbox">
                                    {searchHistory.map(item => <button
                                        key={item}
                                        type="button"
                                        className="wenayDlgSearchHistoryItem"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => useHistoryItem(item)}
                                    >{item}</button>)}
                                    <button
                                        type="button"
                                        className="wenayDlgSearchHistoryClear"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => {
                                            clearHistory()
                                        }}
                                    >Clear history</button>
                                </div>}
                            </div>
                            {treeToolsVisible && <button
                                className={classNames(["wenayDlgTreeTool", `wenayDlgTreeTool_${treeToolState}`])}
                                type="button"
                                title={treeToolTitle}
                                aria-label={treeToolTitle}
                                onClick={cycleTreeTool}
                            >
                                <span className="wenayDlgTreeToolDots" aria-hidden="true">
                                    <span/><span/><span/>
                                </span>
                            </button>}
                        </div>
                        <div className="wenayDlgTree" role="tree">
                            {tree.roots.map(renderTreeNode)}
                            {firstVisibleNode == null && <div className="wenayDlgNoResults">No settings found</div>}
                        </div>
                    </div>
                    <div
                        className="wenayDlgDivider"
                        role="separator"
                        aria-orientation="vertical"
                        aria-label="Resize settings navigation"
                        aria-valuemin={settingsDialogNav.min}
                        aria-valuemax={settingsDialogNav.max}
                        aria-valuenow={navWidth}
                        tabIndex={0}
                        title="Drag to resize navigation; double-click to reset"
                        onPointerDown={beginNavResize}
                        onDoubleClick={() => commitNavWidth(settingsDialogNav.def)}
                        onKeyDown={onNavResizeKeyDown}
                    ><span/></div>
                    <div className="wenayDlgContent">
                        {current?.render()}
                    </div>
                        </div>
                    </FloatingWindowBase>
                </OutsideClickArea>
            </div>,
            document.body
        )}
    </>
}
