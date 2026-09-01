/* standKit.tsx - shared scaffolding for the QA stand: card wrapper, showcase blocks,
 * shared card styles, and the card descriptor type. No heavy feature deps here. */
import React, { useState } from "react";

/* ---------- card wrapper ---------- */
const card: React.CSSProperties = { border: "1px solid #d0d7de", borderRadius: 10, margin: "14px 0", background: "#fff", overflow: "hidden", fontFamily: "system-ui, sans-serif" };
const head: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f6f8fa", borderBottom: "1px solid #d0d7de" };
const badge: React.CSSProperties = { width: 24, height: 24, borderRadius: 12, background: "#0969da", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 };
const stageS: React.CSSProperties = { padding: 14, position: "relative" };
const row: React.CSSProperties = { padding: "6px 14px", fontSize: 13, lineHeight: 1.5, borderTop: "1px dashed #e1e4e8" };
export const btn = (on: boolean, color: string): React.CSSProperties => ({ border: `1px solid ${color}`, background: on ? color : "#fff", color: on ? "#fff" : color, borderRadius: 6, padding: "3px 8px", fontSize: 12, cursor: "pointer" });

// Verdicts live in a module map keyed by card id (or n), so ✓/✗ marks survive
// switching between Active/Archive tabs (which unmounts the whole card list).
const cardVerdicts = new Map<string, null | boolean>();

export function Check(p: { id?: string; n: number; title: string; do: string; expect: string; note?: string; tall?: boolean; children: React.ReactNode }) {
    const key = p.id ?? "n" + p.n;
    const [ok, setOk] = useState<null | boolean>(() => cardVerdicts.get(key) ?? null);
    const mark = (v: boolean) => { cardVerdicts.set(key, v); setOk(v); };
    return (
        <section id={p.id} style={{ ...card, outline: ok === true ? "2px solid #1a7f37" : ok === false ? "2px solid #cf222e" : "none" }}>
            <div style={head}>
                <span style={badge}>{p.n}</span>
                <b style={{ flex: 1 }}>{p.title}</b>
                <button style={btn(ok === true, "#1a7f37")} onClick={() => mark(true)}>✓ works</button>
                <button style={btn(ok === false, "#cf222e")} onClick={() => mark(false)}>✗ bug</button>
            </div>
            <div style={{ ...stageS, minHeight: p.tall ? 340 : 80 }}>{p.children}</div>
            <div style={row}><b>Do:</b> {p.do}</div>
            <div style={{ ...row, color: "#1a7f37" }}><b>Expected:</b> {p.expect}</div>
            {p.note && <div style={{ ...row, color: "#9a6700" }}><b>Note:</b> {p.note}</div>}
        </section>
    );
}

/* ---------- showcase building blocks: the stand teaches a public integration, not just a test ---------- */
export function ShowcasePanel(p: { eyebrow: string; title: string; children: React.ReactNode; tone?: "blue" | "violet" | "green" }) {
    return <section className={`wenayQaShowcasePanel wenayQaShowcasePanel_${p.tone ?? "blue"}`}>
        <div className="wenayQaShowcaseEyebrow">{p.eyebrow}</div>
        <h3 className="wenayQaShowcaseTitle">{p.title}</h3>
        {p.children}
    </section>;
}

export function ExampleCode(p: { children: string }) {
    return <pre className="wenayQaExampleCode"><code>{p.children.trim()}</code></pre>;
}

export function DemoHint(p: { children: React.ReactNode }) {
    return <div className="wenayQaDemoHint"><span aria-hidden>↗</span><span>{p.children}</span></div>;
}

/* ---------- card descriptor: one entry per stand card, rendered by the registry ---------- */
export type QaCard = {
    id?: string;
    n: number;
    section: "active" | "archive";
    title: string;
    tall?: boolean;
    Component: React.ComponentType;
};
