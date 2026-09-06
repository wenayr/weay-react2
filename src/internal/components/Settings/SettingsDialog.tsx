import React, {useDeferredValue, useEffect, useMemo, useRef, useState} from "react";
import {createUpdateApi} from "../../updateBy.js";
import {FloatingWindowBase} from "../Dnd/FloatingWindow.js";
import {Overlay} from "../Overlay.js";
import {createSearchHistory} from "../../utils/searchHistory.js";
import {createPersistedController} from "../../utils/persistedController.js";
import {cx as classNames} from "../../utils/cx.js";
import {buildSettingsTree, getTreeSignature, getBranchKeys, getCurrentBranchKeys, filterSettingsTree} from "./settingsTree.js";
import type {SettingsSection, SettingsTreeNode, SettingsTree, SettingsTreeFilter} from "./settingsTree.js";
import {getSearchTerms, renderHighlightedLabel} from "./searchText.js";
import type {SettingsSearchTerm} from "./searchText.js";
export type {SettingsSearchSource, SettingsSection} from "./settingsTree.js";
export type {SettingsTreeNode, SettingsTree, SettingsTreeFilter} from "./settingsTree.js";
export type {SettingsSearchTerm} from "./searchText.js";

type SettingsDialogLayoutState = {
    navWidth: number
    expandedKeys?: string[]
    active?: string
}

const settingsDialogSize = {width: 820, height: 560}
const settingsDialogPosition = {x: -settingsDialogSize.width / 2, y: -settingsDialogSize.height / 2}
const settingsDialogNav = {min: 160, def: 220, max: 360}

// Module singleton (closure + updateBy subscription, no React context): any module
// registers a section on mount and removes it on unmount; the dialog re-renders on changes.
const registry = {list: [] as SettingsSection[]}
const registryApi = createUpdateApi(registry)
const settingsSearchHistory = createSearchHistory({key: "SettingsDialog.searchHistory", max: 8})
const settingsDialogSlot = createPersistedController<SettingsDialogLayoutState>({
    key: "SettingsDialog.layout",
    def: {navWidth: settingsDialogNav.def},
})
const settingsDialogLayout = settingsDialogSlot.state

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
    /** Applies a search-history entry. Not a hook despite the name - kept as-is because this
     *  is the published controller shape; internally it is `applyHistoryItem`. */
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
    const [active, setActiveState] = useState(() => settingsDialogLayout.active ?? props.defaultSection)
    const [search, setSearch] = useState("")
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set(settingsDialogLayout.expandedKeys))
    const [historyOpen, setHistoryOpen] = useState(false)
    const [navWidth, setNavWidth] = useState(() => clampSettingsNavWidth(settingsDialogLayout.navWidth))
    const [navResizing, setNavResizing] = useState(false)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const searchBoxRef = useRef<HTMLDivElement>(null)
    const navResizeRef = useRef<{startX: number, startWidth: number} | null>(null)
    const navWidthRef = useRef(navWidth)
    const activeRef = useRef(active)
    const expandedRef = useRef(expanded)
    const treeInitializedRef = useRef(false)
    registryApi.use()
    const searchHistory = settingsSearchHistory.use()

    const sections = [...(props.sections ?? []), ...registry.list]
    const tree = buildSettingsTree(sections)
    const treeSignature = getTreeSignature(tree.ordered)
    const branchKeys = getBranchKeys(tree.ordered)
    // The input itself stays urgent - typing must never wait on the tree - while the filter runs
    // against the settled query, so React keeps showing the previous result instead of re-walking
    // every section between two keystrokes.
    const deferredSearch = useDeferredValue(search)
    const searchTerms = getSearchTerms(deferredSearch)
    // While a search is active this walks section.render() for EVERY section; unmemoised it
    // re-ran on renders that had nothing to do with the query - notably setNavWidth on each
    // pointermove of the splitter drag. treeSignature covers the structure, search the query.
    const filtered = useMemo(
        () => filterSettingsTree(tree.roots, searchTerms),
        [treeSignature, deferredSearch],
    )
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
        activeRef.current = active
    }, [active])

    useEffect(() => {
        expandedRef.current = expanded
    }, [expanded])

    useEffect(() => {
        if (!open) return
        const knownKeys = new Set(branchKeys)
        setExpanded(prev => {
            if (!treeInitializedRef.current) {
                treeInitializedRef.current = true
                if (settingsDialogLayout.expandedKeys == null) return getCurrentBranchKeys(currentNode)
            }
            return new Set([...prev].filter(key => knownKeys.has(key)))
        })
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
        const next = new Set(expandedRef.current)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        saveExpanded(next)
        setExpanded(next)
    }

    function setActive(nextValue: React.SetStateAction<string | undefined>) {
        const next = typeof nextValue == 'function' ? nextValue(activeRef.current) : nextValue
        activeRef.current = next
        settingsDialogSlot.commit(cur => { cur.active = next })
        setActiveState(next)
    }

    function expandAll() {
        const next = new Set(branchKeys)
        saveExpanded(next)
        setExpanded(next)
    }

    function collapseAll() {
        const next = new Set<string>()
        saveExpanded(next)
        setExpanded(next)
    }

    function collapseOutsideCurrent() {
        const next = getCurrentBranchKeys(currentNode)
        saveExpanded(next)
        setExpanded(next)
    }

    function saveExpanded(next: Set<string>) {
        expandedRef.current = next
        settingsDialogSlot.commit(cur => { cur.expandedKeys = [...next] })
    }

    function commitSearch(value = search) {
        settingsSearchHistory.add(value)
        setHistoryOpen(false)
    }

    function commitNavWidth(value: number) {
        const next = clampSettingsNavWidth(value)
        setNavWidth(next)
        settingsDialogSlot.commit(cur => { cur.navWidth = next })
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

    // NOT a hook - it is called from event handlers. Named applyHistoryItem so react-hooks
    // lint stops flagging those call sites; the controller field keeps its public name.
    function applyHistoryItem(value: string) {
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
        useHistoryItem: applyHistoryItem,
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
        useHistoryItem: applyHistoryItem,
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
        {open && (
            <Overlay
                scrimClassName="wenayDlgScrim"
                outsideClassName="wenayDlgOutside"
                outsideStatus={open}
                onOutsideClick={() => setOpen(false)}
                /* no onEscape: the controller owns the two-stage Escape (clear search, then close) */
            >
                    <FloatingWindowBase
                        portal={false}
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
                                            applyHistoryItem(searchHistory[0])
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
                                        onClick={() => applyHistoryItem(item)}
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
            </Overlay>
        )}
    </>
}
