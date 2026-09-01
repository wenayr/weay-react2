/* qa.tsx - ONE board for manual library checks.
 *
 * Run:  npm run testReact -- --host 127.0.0.1 --port 3002
 * Each card: a live element + what to do + what is expected.
 * Use the ✓/✗ buttons to mark results as you go. These are also the acceptance criteria for changes from REFACTOR_PLAN.md.
 *
 * This file is the stand entry point and the public "./demo/stand" export. The cards
 * themselves live in ./cards/*, the scaffolding in ./standKit, and their ordered
 * descriptors in ./registry. QABoard renders the registry through a hash router.
 */

import React, { useState, useEffect } from "react";
import { VideoMeetingPlatform } from "../calls/VideoMeetingPlatform.js";
import { qaCards } from "./registry.js";

export function QABoard() {
    const [hash, setHash] = useState(typeof location !== "undefined" ? location.hash : "");
    useEffect(() => {
        const f = () => setHash(location.hash);
        window.addEventListener("hashchange", f);
        return () => window.removeEventListener("hashchange", f);
    }, []);
    useEffect(() => {
        const id = hash.startsWith("#") ? hash.slice(1) : "";
        if (!id || id === "archive" || id === "video-calls" || id.startsWith("video-calls/")) return;
        const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({block: "start"}));
        return () => cancelAnimationFrame(frame);
    }, [hash]);
    const section = hash === "#archive" ? "archive" : hash.startsWith("#video-calls") ? "video-calls" : "active";
    const videoRoomMatch = hash.match(/^#video-calls\/room\/([^/?#]+)/);
    if (section === "video-calls") return <VideoMeetingPlatform roomId={videoRoomMatch ? decodeURIComponent(videoRoomMatch[1]) : undefined} />;
    const link = (on: boolean): React.CSSProperties => ({ padding: "4px 10px", borderRadius: 6, textDecoration: "none", color: on ? "#fff" : "#0969da", background: on ? "#0969da" : "#fff", border: "1px solid #0969da", fontSize: 13 });
    const shown: "active" | "archive" = section === "archive" ? "archive" : "active";
    return (
        <div style={{ maxWidth: 920, margin: "0 auto", padding: 20, fontFamily: "system-ui, sans-serif" }}>
            <h2 style={{ margin: "0 0 4px" }}>QA board wenay-react2</h2>
            <div style={{ display: "flex", gap: 8, margin: "8px 0", flexWrap: "wrap" }}>
                <a href="#" style={link(section === "active" && !hash)}>Active checks</a>
                <a href="#floating-window-stack" style={link(hash === "#floating-window-stack")}>Desktop windows</a>
                <a href="#video-calls" style={link(false)}>Видеозвонки</a>
                <a href="#archive" style={link(section === "archive")}>Verified archive</a>
            </div>
            <div style={{ color: "#57606a", fontSize: 13, marginBottom: 8 }}>
                {section === "archive" ? "Verified and fixed nodes are kept for repeated checks." : "Click elements, compare with Expected, and mark ✓/✗. Token regression (S1): the appearance of ALL cards/menus/grids should not have changed; variables were moved to tokens.css without changing values."}
            </div>
            {qaCards.filter(c => c.section === shown).map(c => <c.Component key={c.id ?? c.n} />)}
        </div>
    );
}
