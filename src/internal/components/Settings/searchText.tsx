/** Search half of SettingsDialog: query normalisation (with ru<->en keyboard-layout variants),
 *  text extraction from a section's rendered React tree, the per-descriptor text cache and the
 *  label highlighter. Pure functions over the descriptor types in settingsTree.ts; split out of
 *  SettingsDialog.tsx unchanged. */
import React from "react";
import type {SettingsSearchSource, SettingsSection} from "./settingsTree.js";

export type SettingsSearchTerm = {
    variants: string[]
}

export function normalizeSearch(value: string) {
    return value.toLocaleLowerCase().replace(/\s+/g, " ").trim()
}

export const enKeyboard = "`qwertyuiop[]asdfghjkl;'zxcvbnm,./"

export const ruKeyboard = "ёйцукенгшщзхъфывапролджэячсмитьбю."

export const ruToEnKeyboard = new Map(Array.from(ruKeyboard).map((char, i) => [char, enKeyboard[i]]))

export const enToRuKeyboard = new Map(Array.from(enKeyboard).map((char, i) => [char, ruKeyboard[i]]))

export function convertKeyboardLayout(value: string, map: Map<string, string>) {
    return Array.from(value).map(char => map.get(char) ?? char).join("")
}

export function uniqueSearchVariants(token: string) {
    return Array.from(new Set([
        token,
        convertKeyboardLayout(token, ruToEnKeyboard),
        convertKeyboardLayout(token, enToRuKeyboard),
    ].filter(Boolean)))
}

export function getSearchTerms(value: string): SettingsSearchTerm[] {
    return normalizeSearch(value).split(" ").filter(Boolean).map(text => ({
        variants: uniqueSearchVariants(text),
    }))
}

export function isIterableNode(value: React.ReactNode): value is Iterable<React.ReactNode> {
    return typeof value == "object" && value != null && Symbol.iterator in value
}

export function reactNodeText(node: React.ReactNode): string {
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

export function searchSourceText(source: SettingsSearchSource) {
    const value = typeof source == "function" ? source() : source
    return reactNodeText(value)
}

/** section.render() is invoked and walked for EVERY section on every filter pass - by far the
 *  most expensive thing the dialog does, and it re-ran on every keystroke. The text depends only
 *  on the descriptor, so it is memoised per descriptor object: a consumer that builds its
 *  sections inline (the usual literal) hands over a new object and gets a fresh walk, while a
 *  stable descriptor is walked once. A descriptor kept stable across a content change should
 *  declare `searchText` rather than expect the re-walk. */
export const sectionSearchTextCache = new WeakMap<SettingsSection, string>()

export function sectionSearchText(section: SettingsSection) {
    const cached = sectionSearchTextCache.get(section)
    if (cached != null) return cached
    const parts = [section.key, section.name, ...(section.keywords ?? [])]
    if (section.searchText != null) parts.push(searchSourceText(section.searchText))
    try {
        parts.push(reactNodeText(section.render()))
    } catch {
        // Search should not break the dialog if a consumer render throws outside its normal path.
    }
    const text = normalizeSearch(parts.join(" "))
    sectionSearchTextCache.set(section, text)
    return text
}

export function sectionMatches(section: SettingsSection, terms: SettingsSearchTerm[]) {
    const text = sectionSearchText(section)
    return terms.every(term => term.variants.some(variant => text.includes(variant)))
}

export function getLabelMatchRanges(label: string, terms: SettingsSearchTerm[]) {
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

export function renderHighlightedLabel(label: string, terms: SettingsSearchTerm[]) {
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
