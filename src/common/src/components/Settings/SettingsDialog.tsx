import React, {useEffect, useState} from "react";
import {createPortal} from "react-dom";
import {renderBy, updateBy} from "../../../updateBy";

export type tSettingsSection = {key: string, name: string, render: () => React.ReactNode}

// Module singleton (closure + updateBy subscription, no React context): any module
// registers a section on mount and removes it on unmount; the dialog re-renders on changes.
const registry = {list: [] as tSettingsSection[]}

/** Register an external section. Re-register with the same key replaces the previous one.
 *  The returned function removes exactly this registration (a no-op if it was replaced). */
export function registerSettingsSection(s: tSettingsSection): () => void {
    const i = registry.list.findIndex(e => e.key == s.key)
    if (i == -1) registry.list.push(s)
    else registry.list.splice(i, 1, s)
    renderBy(registry)
    return () => {
        const j = registry.list.indexOf(s)
        if (j != -1) {
            registry.list.splice(j, 1)
            renderBy(registry)
        }
    }
}

/** Current external sections (static props sections are not included). */
export function getSettingsSections(): readonly tSettingsSection[] {
    return registry.list
}

/** Centered settings dialog: sections column on the left, active section content on the right.
 *  Sections = props.sections (first) + everything from registerSettingsSection.
 *  Look is themed via --dlg-* CSS variables (dark defaults), same contract as --wnd-*. */
export function SettingsDialog(props: {
    trigger: React.ReactNode
    sections?: tSettingsSection[]
    defaultSection?: string
    /** Section buttons: apps pass their own .chip / .chipActive; defaults are minimal library styles */
    sectionClassName?: string
    sectionActiveClassName?: string
}) {
    const [open, setOpen] = useState(false)
    const [active, setActive] = useState(props.defaultSection)
    updateBy(registry)

    useEffect(() => {
        if (!open) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key == 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [open])

    const sections = [...(props.sections ?? []), ...registry.list]
    // fall back to the first section when active was never set or its section unmounted
    const current = sections.find(s => s.key == active) ?? sections[0]
    const base = props.sectionClassName ?? "wenayDlgSection"
    const activeCls = props.sectionActiveClassName ?? "wenayDlgSectionActive"

    return <>
        <span onClick={() => setOpen(true)} style={{display: "inline-block", cursor: "pointer"}}>
            {props.trigger}
        </span>
        {open && createPortal(
            <div className="wenayDlgScrim" onClick={e => {
                if (e.target == e.currentTarget) setOpen(false)
            }}>
                <div className="wenayDlg">
                    <div className="wenayDlgNav">
                        {sections.map(s => (
                            <div key={s.key}
                                 className={s.key == current?.key ? `${base} ${activeCls}` : base}
                                 onClick={() => setActive(s.key)}>{s.name}</div>
                        ))}
                    </div>
                    <div className="wenayDlgContent">
                        {current?.render()}
                    </div>
                    <div className="wenayCloseBtn wenayDlgClose" title="Close" onClick={() => setOpen(false)}>
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                            <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                        </svg>
                    </div>
                </div>
            </div>,
            document.body
        )}
    </>
}
