/** Settings tree model of SettingsDialog: section descriptors, the tree built from them (nested
 *  `children` / `parentKey`), and the pure filter that decides which nodes a search shows.
 *  Split out of SettingsDialog.tsx unchanged; the dialog file keeps the controller and the view. */
import type React from "react";
import {sectionMatches, type SettingsSearchTerm} from "./searchText.js";

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

export type SettingsTreeNode = {
    section: SettingsSection
    children: SettingsTreeNode[]
    parent?: SettingsTreeNode
    depth: number
}

export type SettingsTree = {
    roots: SettingsTreeNode[]
    ordered: SettingsTreeNode[]
    byKey: Map<string, SettingsTreeNode>
}

export type SettingsTreeFilter = {
    visibleKeys: Set<string>
    matchedKeys: Set<string>
    expandedKeys: Set<string>
}

export function buildSettingsTree(sections: SettingsSection[]): SettingsTree {
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

export function getTreeSignature(nodes: SettingsTreeNode[]) {
    return nodes.map(node => `${node.section.key}:${node.parent?.section.key ?? ""}:${node.children.map(child => child.section.key).join(",")}`).join("|")
}

export function getBranchKeys(nodes: SettingsTreeNode[]) {
    return nodes.filter(node => node.children.length != 0).map(node => node.section.key)
}

export function getCurrentBranchKeys(node?: SettingsTreeNode) {
    const keys = new Set<string>()
    let current = node
    while (current != null) {
        if (current.children.length != 0) keys.add(current.section.key)
        current = current.parent
    }
    return keys
}

export function filterSettingsTree(roots: SettingsTreeNode[], terms: SettingsSearchTerm[]): SettingsTreeFilter {
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
