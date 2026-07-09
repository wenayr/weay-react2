/* replayVideo.tsx - QA demos for the Replay stack hooks (useReplaySubscribe / useReplayHistory / useStoreReplayMirror).
 *
 * Everything is in-proc: a synthetic "video" producer emits jpeg frames on a replay line
 * (keyframe = last frame), a simulated slow wire + conflateReplay gate shows per-client
 * frame dropping, archiveReplay + openHistory power the time-travel scrubber.
 * The transport itself is already proven in wenay-common2 (replay/video-socket.demo);
 * these cards exercise the React lifecycle side.
 */

import React, {StrictMode, useEffect, useMemo, useRef, useState} from "react";
import {Observe, Replay} from "wenay-common2";
import {useReplaySubscribe, useReplayRouteSubscribe, useReplayFrame, useReplayHistory, useStoreReplayMirror, useStoreReplayEach, useStoreNode, useStoreKeys} from "../src/hooks";

type tFrame = {n: number, w: number, h: number, ts: number, jpeg: string};
type tFrameRemote = Replay.ReplayRemote<[tFrame]>;

const FPS = 10;
export const videoResolutions = [{w: 160, h: 90}, {w: 320, h: 180}, {w: 640, h: 360}] as const;

/* ---------- producer + line + wire + archive (module singleton, starts on first use) ---------- */

function createVideoDemo() {
    let res: {w: number, h: number} = videoResolutions[1];
    let frameN = 0;
    let last: tFrame | null = null;
    let stalled = false;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    const [emit, replay] = Replay.replayListen<[tFrame]>({
        history: 256,
        current: () => last ? [last] : undefined,   // keyframe source: every frame fully defines the picture
    });

    function drawScene(t: number) {
        if (canvas.width != res.w) canvas.width = res.w;
        if (canvas.height != res.h) canvas.height = res.h;
        const g = ctx.createLinearGradient(0, 0, res.w, res.h);
        g.addColorStop(0, `hsl(${Math.round(t / 40) % 360}, 65%, 42%)`);
        g.addColorStop(1, "#16213e");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, res.w, res.h);
        const bx = res.w / 2 + Math.sin(t / 400) * res.w * 0.35;
        const by = res.h / 2 + Math.cos(t / 300) * res.h * 0.3;
        ctx.beginPath();
        ctx.arc(bx, by, Math.min(res.w, res.h) * 0.09, 0, Math.PI * 2);
        ctx.fillStyle = "#ffd33d";
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.max(11, Math.round(res.h / 9))}px monospace`;
        ctx.fillText(`#${frameN}  ${res.w}x${res.h}`, 8, Math.max(14, Math.round(res.h / 7)));
    }

    setInterval(() => {
        if (stalled) return;                            // freshness QA: producer stops emitting, line stays subscribed
        frameN++;
        drawScene(performance.now());
        const frame: tFrame = {n: frameN, w: res.w, h: res.h, ts: Date.now(), jpeg: canvas.toDataURL("image/jpeg", 0.55)};
        last = frame;
        emit(frame);
    }, 1000 / FPS);

    // fast client path: direct in-proc "wire"
    const remoteDirect: tFrameRemote = Replay.exposeReplay(replay);

    // slow client path: artificial outgoing buffer + per-connection conflation gate
    const wire = (() => {
        const buf: Replay.ReplayEvent<[tFrame]>[] = [];
        const listeners = new Set<(ev: Replay.ReplayEvent<[tFrame]>) => void>();
        let rateMs = 400;                              // one envelope per rateMs = the "bad link"
        const gate = Replay.conflateReplay(replay, {
            pending: () => buf.length,                 // this client's outgoing buffer
            highWater: 4,
            lowWater: 1,
            keyOf: () => "frame",                      // frames are absolute -> keep only the last while lagged
        });
        gate.api.line.on(ev => { buf.push(ev); });
        (function pump() {
            setTimeout(() => {
                const ev = buf.shift();
                if (ev) listeners.forEach(cb => cb(ev));
                pump();
            }, rateMs);
        })();
        const remote: tFrameRemote = {
            line: {on: (cb: (ev: Replay.ReplayEvent<[tFrame]>) => void) => {
                listeners.add(cb);
                return () => listeners.delete(cb);
            }},
            since: seq => gate.api.since(seq),
            keyframe: () => gate.api.keyframe(),
        };
        return {
            remote,
            stats: () => gate.stats(),
            buffered: () => buf.length,
            setRateMs: (ms: number) => { rateMs = ms; },
            getRateMs: () => rateMs,
        };
    })();

    // archive + time machine
    const storage = Replay.createMemoryReplayStorage<[tFrame]>({maxEvents: 600});
    Replay.archiveReplay(replay, {storage, everyEvents: 25});
    const history = Replay.openHistory(storage, replay);   // archive -> live handover

    return {
        replay,
        remoteDirect,
        wire,
        history,
        setResolution: (r: {w: number, h: number}) => { res = r; },
        getResolution: () => res,
        setStalled: (v: boolean) => { stalled = v; },
    };
}

type tVideoDemo = ReturnType<typeof createVideoDemo>;
let videoDemo: tVideoDemo | null = null;
const getVideoDemo = () => videoDemo ??= ((window as any).__replayVideoDemo = createVideoDemo());   // window exposure: QA debugging

/* ---------- frame sink: async jpeg decode, latest requested frame wins ---------- */

function makeFrameSink(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
    let want = -1;
    return (frame: tFrame) => {
        want = frame.n;
        const img = new Image();
        img.onload = () => {
            if (frame.n != want) return;               // a newer frame superseded this decode (or we seeked back)
            const canvas = canvasRef.current;
            if (!canvas) return;
            if (canvas.width != frame.w) canvas.width = frame.w;
            if (canvas.height != frame.h) canvas.height = frame.h;
            canvas.getContext("2d")?.drawImage(img, 0, 0);
        };
        img.src = frame.jpeg;
    };
}

function useTick(ms: number) {
    const [, setTick] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setTick(v => v + 1), ms);
        return () => clearInterval(t);
    }, [ms]);
}

const canvasStyle: React.CSSProperties = {width: 320, background: "#000", borderRadius: 6, display: "block", border: "1px solid #d0d7de"};
const statLine: React.CSSProperties = {fontSize: 12, marginTop: 4, fontFamily: "monospace"};

function LiveClient(p: {remote: tFrameRemote, since?: number, onSeq?: (seq: number) => void}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sink = useMemo(() => makeFrameSink(canvasRef), []);
    const framesRef = useRef(0);
    const sub = useReplaySubscribe(p.remote, (frame) => { framesRef.current++; sink(frame); }, {since: p.since, onSeq: p.onSeq});
    useTick(500);
    return <div>
        <canvas ref={canvasRef} style={canvasStyle}/>
        <div style={statLine}>ready {String(sub.ready)} · seq {sub.seq()} · frames {framesRef.current}{sub.error != null ? ` · error ${String(sub.error)}` : ""}</div>
    </div>;
}

/* freshness client: no useTick — the ONLY re-render sources are ready/stale transitions.
 * React.memo shields it from the parent's 500ms tick, so the render counter is the proof
 * that a fresh 10 fps line causes zero per-event renders. Wrapped in StrictMode by the card:
 * double-effect must not leak a second watchdog or flicker the badge. */
const STALE_MS = 2000;
const staleBadge: React.CSSProperties = {padding: "1px 8px", borderRadius: 4, color: "#fff", fontWeight: 700};

const StaleClient = React.memo(function StaleClient(p: {remote: tFrameRemote, staleMs: number}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sink = useMemo(() => makeFrameSink(canvasRef), []);
    const framesRef = useRef(0);
    const rendersRef = useRef(0);
    rendersRef.current++;
    const sub = useReplaySubscribe(p.remote, (frame) => { framesRef.current++; sink(frame); }, {staleMs: p.staleMs});
    return <div>
        <canvas ref={canvasRef} style={canvasStyle}/>
        <div style={statLine}>
            {sub.stale
                ? <span style={{...staleBadge, background: "#cf222e"}}>STALE</span>
                : <span style={{...staleBadge, background: "#2da44e"}}>fresh</span>}
            {" "}· renders {rendersRef.current} · frames {framesRef.current}
            {" "}· lastTs {sub.lastTs() > 0 ? new Date(sub.lastTs()).toLocaleTimeString() : "-"}
        </div>
    </div>;
});

/* pull client (useReplayFrame): NO live subscription — a timer around remote.frame(seq).
 * The canvas advances at the PULL cadence while the producer runs at 10 fps: each pull folds
 * the whole journal tail since our seq (frames counter jumps by ~pace×fps), the sink's
 * latest-wins decode draws only the last one. The remote is wrapped to count frame() calls —
 * also QA-proves a hand-wrapped remote works. Pace switches resubscribe but keep the seq
 * (keepSeq), so no keyframe restart. */
function PullClient(p: {remote: tFrameRemote}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sink = useMemo(() => makeFrameSink(canvasRef), []);
    const framesRef = useRef(0);
    const pullsRef = useRef(0);
    const [intervalMs, setIntervalMs] = useState(1000);
    const remote = useMemo<tFrameRemote>(() => ({
        ...p.remote,
        frame: (seq, hint) => { pullsRef.current++; return p.remote.frame!(seq, hint); },
    }), [p.remote]);
    const pf = useReplayFrame(remote, (frame) => { framesRef.current++; sink(frame); }, {intervalMs});
    useTick(500);
    return <div>
        <canvas ref={canvasRef} style={canvasStyle}/>
        <div style={{display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap"}}>
            <span style={{fontSize: 12}}>pull every:</span>
            {[250, 1000, 3000].map(ms =>
                <button key={ms} style={{fontWeight: ms == intervalMs ? 700 : 400}} onClick={() => setIntervalMs(ms)}>{ms}ms</button>)}
            <button onClick={() => void pf.pull()}>pull now</button>
        </div>
        <div style={statLine}>ready {String(pf.ready)} · seq {pf.seq()} · pulls {pullsRef.current} · frames {framesRef.current}{pf.error != null ? ` · error ${String(pf.error)}` : ""}</div>
    </div>;
}

function failingFrameRemote(): tFrameRemote {
    const fail = () => { throw new Error("route failed"); };
    return {
        line: {on: () => () => {}},
        since: async () => fail(),
        keyframe: async () => fail(),
    };
}

function RouteHandoffClient(p: {direct: tFrameRemote, relay: tFrameRemote}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sink = useMemo(() => makeFrameSink(canvasRef), []);
    const framesRef = useRef(0);
    const eventsRef = useRef<string[]>([]);
    const [, setEventTick] = useState(0);
    const badRemote = useMemo(() => failingFrameRemote(), []);
    const route = useReplayRouteSubscribe(p.relay, frame => {
        framesRef.current++;
        sink(frame);
    }, {
        label: "relay",
        onRoute: ev => {
            eventsRef.current = [`${ev.phase}:${ev.from ?? "-"}->${ev.to ?? "-"}@${ev.seq}`, ...eventsRef.current].slice(0, 4);
            setEventTick(v => v + 1);
        },
    });
    useTick(500);
    const err = route.error instanceof Error ? route.error.message : String(route.error ?? "");

    return <div style={{display: "grid", gap: 6, maxWidth: 360}}>
        <canvas ref={canvasRef} style={canvasStyle}/>
        <div style={{display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center"}}>
            <button onClick={() => { void route.switchRoute(p.direct, {label: "direct"}).catch(() => {}); }}>switch direct</button>
            <button onClick={() => { void route.switchRoute(p.relay, {label: "relay"}).catch(() => {}); }}>switch relay</button>
            <button onClick={() => { void route.switchRoute(badRemote, {label: "bad"}).catch(() => {}); }}>fail route</button>
        </div>
        <div style={statLine}>ready {String(route.ready)} · switching {String(route.switching)} · active {String(route.active())} · label {route.label() ?? "-"}</div>
        <div style={statLine}>seq {route.seq()} · frames {framesRef.current}{err ? ` · error ${err}` : ""}</div>
        <div style={{...statLine, whiteSpace: "normal"}}>route events: {eventsRef.current.join(" | ") || "-"}</div>
    </div>;
}

export const ReplayRouteDemo = () => {
    const demo = useMemo(() => getVideoDemo(), []);
    return <div style={{display: "grid", gap: 8}}>
        <div style={{fontSize: 13, color: "#57606a"}}>
            One canvas, one logical fold. The old route remains live while the replacement catches up by seq.
        </div>
        <RouteHandoffClient direct={demo.remoteDirect} relay={demo.wire.remote}/>
    </div>;
};
/* ---------- card 23: video line - direct client, conflated slow client, time travel ---------- */

export const ReplayVideoDemo = () => {
    const demo = useMemo(() => getVideoDemo(), []);
    const [resIdx, setResIdx] = useState(1);
    const [slow, setSlow] = useState(true);
    const [stalled, setStalled] = useState(false);
    const [mountedA, setMountedA] = useState(true);
    const [genD, setGenD] = useState(0);
    const lastSeqA = useRef<number | undefined>(undefined);
    useTick(500);

    const ttCanvasRef = useRef<HTMLCanvasElement>(null);
    const ttSink = useMemo(() => makeFrameSink(ttCanvasRef), []);
    const tt = useReplayHistory(demo.history, ttSink, {head: () => demo.replay.head()});

    const wireStats = demo.wire.stats();
    return <div style={{display: "grid", gap: 10}}>
        <div style={{display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center"}}>
            <span style={{fontSize: 13}}>resolution:</span>
            {videoResolutions.map((r, i) =>
                <button key={r.w} style={{fontWeight: i == resIdx ? 700 : 400}}
                        onClick={() => { setResIdx(i); demo.setResolution(r); }}>{r.w}x{r.h}</button>)}
            <label style={{fontSize: 13, marginLeft: 12}}>
                <input type="checkbox" checked={slow} onChange={e => { setSlow(e.target.checked); demo.wire.setRateMs(e.target.checked ? 400 : 66); }}/>
                slow network for client B (1 envelope / {demo.wire.getRateMs()}ms)
            </label>
            <label style={{fontSize: 13, marginLeft: 12}}>
                <input type="checkbox" checked={stalled} onChange={e => { setStalled(e.target.checked); demo.setStalled(e.target.checked); }}/>
                stall producer (freshness for D)
            </label>
            <span style={{fontSize: 12, color: "#57606a"}}>producer: {FPS} fps · head seq {demo.replay.head()}</span>
        </div>
        <div style={{display: "flex", gap: 16, flexWrap: "wrap"}}>
            <div>
                <div style={{fontSize: 13, fontWeight: 700, marginBottom: 4}}>
                    A: direct client{" "}
                    <button onClick={() => setMountedA(v => !v)}>{mountedA ? "unmount" : "remount (tail via since)"}</button>
                </div>
                {mountedA
                    ? <LiveClient remote={demo.remoteDirect} since={lastSeqA.current} onSeq={seq => { lastSeqA.current = seq; }}/>
                    : <div style={{...canvasStyle, height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e"}}>unmounted · kept seq {lastSeqA.current ?? "-"}</div>}
            </div>
            <div>
                <div style={{fontSize: 13, fontWeight: 700, marginBottom: 4}}>B: slow wire + conflateReplay gate</div>
                <LiveClient remote={demo.wire.remote}/>
                <div style={statLine}>
                    wire buffer {demo.wire.buffered()} · conflating {String(wireStats.conflating)}<br/>
                    dropped {wireStats.dropped} · coalesced {wireStats.coalesced} · recoveries {wireStats.flushes} (keyframes {wireStats.keyframes})
                </div>
            </div>
            <div>
                <div style={{fontSize: 13, fontWeight: 700, marginBottom: 4}}>C: time travel (archive + openHistory)</div>
                <canvas ref={ttCanvasRef} style={canvasStyle}/>
                <div style={{display: "flex", gap: 8, alignItems: "center", marginTop: 4}}>
                    <button onClick={() => tt.live ? tt.pause() : tt.play()}>{tt.live ? "⏸ pause" : "▶ live"}</button>
                    <input type="range" style={{width: 200}}
                           min={Math.max(0, tt.head - 550)} max={Math.max(0, tt.head)}
                           value={tt.seq < 0 ? 0 : tt.seq}
                           onChange={e => tt.seek({seq: Number(e.target.value)})}/>
                    <span style={{fontSize: 12, fontFamily: "monospace"}}>{tt.seq}/{tt.head} {tt.live ? "live" : "paused"}</span>
                </div>
            </div>
            <div>
                <div style={{fontSize: 13, fontWeight: 700, marginBottom: 4}}>
                    D: freshness (staleMs={STALE_MS}, StrictMode){" "}
                    <button onClick={() => setGenD(v => v + 1)}>new client (keyframe)</button>
                </div>
                <StrictMode>
                    <StaleClient key={genD} remote={demo.remoteDirect} staleMs={STALE_MS}/>
                </StrictMode>
                <div style={{fontSize: 12, color: "#57606a", maxWidth: 320, marginTop: 4}}>
                    counters refresh only on fresh↔stale flips: a flat "renders" while frames grow is the
                    no-per-event-render proof
                </div>
            </div>
            <div>
                <div style={{fontSize: 13, fontWeight: 700, marginBottom: 4}}>E: pull at own pace (useReplayFrame)</div>
                <PullClient remote={demo.remoteDirect}/>
            </div>
        </div>
    </div>;
};

/* ---------- card 24: store replay sync - useStoreReplayMirror over exposeStoreReplay ---------- */

type tWorld = {ticks: number, price: number, note: string, bag: Record<string, number>};

function createStoreReplayDemo() {
    let stalled = false;
    const store = Observe.createStore<tWorld>({ticks: 0, price: 100, note: "start", bag: {a: 1}});
    const exposed = Observe.exposeStoreReplay(store, {history: 128});
    setInterval(() => {
        if (stalled) return;
        store.state.ticks++;
        store.state.price = Math.round((store.state.price + (Math.random() - 0.5) * 2) * 100) / 100;
    }, 800);
    return {store, remote: exposed.api.replay, setStalled: (v: boolean) => { stalled = v; }};
}

type tStoreDemo = ReturnType<typeof createStoreReplayDemo>;
let storeDemo: tStoreDemo | null = null;
const getStoreReplayDemo = () => storeDemo ??= createStoreReplayDemo();

export const ReplayStoreDemo = () => {
    const demo = useMemo(() => getStoreReplayDemo(), []);
    const [enabled, setEnabled] = useState(true);
    const [stalled, setStalled] = useState(false);
    const mirror = useStoreReplayMirror<tWorld>(demo.remote, {ticks: 0, price: 0, note: "", bag: {}}, {enabled, staleMs: 2500});
    const ticks = useStoreNode(mirror.store.node.ticks);
    const price = useStoreNode(mirror.store.node.price);
    const note = useStoreNode(mirror.store.node.note);
    const bagKeys = useStoreKeys(mirror.store.node.bag);
    useTick(500);

    return <div style={{display: "grid", gap: 8}}>
        <div style={{display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center"}}>
            <button onClick={() => { demo.store.state.note = "srv " + new Date().toLocaleTimeString(); }}>server note</button>
            <button onClick={() => { demo.store.state.bag["k" + (Object.keys(demo.store.state.bag).length + 1)] = Date.now() % 1000; }}>server add key</button>
            <button onClick={() => {
                const keys = Object.keys(demo.store.state.bag);
                if (keys.length) delete demo.store.state.bag[keys[keys.length - 1]];
            }}>server delete key</button>
            <label style={{fontSize: 13}}>
                <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}/>
                sync enabled (uncheck, mutate, recheck -&gt; catches up via journal tail)
            </label>
            <button onClick={() => mirror.restart()}>restart (tail)</button>
            <label style={{fontSize: 13}}>
                <input type="checkbox" checked={stalled} onChange={e => { setStalled(e.target.checked); demo.setStalled(e.target.checked); }}/>
                stall producer (stale after 2.5s)
            </label>
        </div>
        <div style={{display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13}}>
            <span>ready: <b>{String(mirror.ready)}</b></span>
            <span>stale: <b style={{color: mirror.stale ? "#cf222e" : "#2da44e"}}>{String(mirror.stale)}</b></span>
            <span>lastTs: <b>{mirror.lastTs() > 0 ? new Date(mirror.lastTs()).toLocaleTimeString() : "-"}</b></span>
            <span>seq: <b>{mirror.seq()}</b></span>
            <span>mirror ticks: <b>{ticks.value}</b></span>
            <span>mirror price: <b>{price.value}</b></span>
            <span>mirror note: <b>{note.value}</b></span>
            <span>bag keys: <b>{bagKeys.stringKeys.join(",") || "-"}</b></span>
        </div>
        {mirror.error != null && <div style={{color: "#cf222e"}}>error: {String(mirror.error)}</div>}
    </div>;
};

/* ---------- card 25: per-key feed - useStoreReplayEach over exposeStoreReplay ---------- */

type tRow = {qty: number, px: number};
type tRows = Record<string, tRow>;
type tRowsRemote = Replay.ReplayRemote<[Observe.StorePatch]>;

function createStoreEachDemo() {
    let n = 2;
    const store = Observe.createStore<tRows>({r1: {qty: 5, px: 101}, r2: {qty: 3, px: 202}});
    const exposed = Observe.exposeStoreReplay(store, {history: 256});
    setInterval(() => {
        const keys = Object.keys(store.state);
        if (!keys.length) return;
        const k = keys[Math.floor(Math.random() * keys.length)];   // ONE random row per tick
        store.state[k].px = Math.round(store.state[k].px * (1 + (Math.random() - 0.5) / 40) * 100) / 100;
    }, 700);
    return {
        store,
        remote: exposed.api.replay,
        add: () => { n++; store.state["r" + n] = {qty: 1 + n % 7, px: 100 + n}; },
        del: () => { const keys = Object.keys(store.state); if (keys.length) delete store.state[keys[keys.length - 1]]; },
        replaceAll: () => {
            n += 2;
            store.replace({["r" + (n - 1)]: {qty: 2, px: 100 + n}, ["r" + n]: {qty: 4, px: 200 + n}});
        },
    };
}

type tEachDemo = ReturnType<typeof createStoreEachDemo>;
let eachDemo: tEachDemo | null = null;
const getStoreEachDemo = () => eachDemo ??= createStoreEachDemo();

const EachClient = ({remote}: {remote: tRowsRemote}) => {
    // the fold target lives OUTSIDE React state: a plain Map of rows, exactly like a grid api would
    const rowsRef = useRef(new Map<string, tRow & {calls: number}>());
    const callsRef = useRef(0);
    const [, setTick] = useState(0);
    const feed = useStoreReplayEach<tRows>(remote, (key, row) => {
        callsRef.current++;
        if (row === undefined) rowsRef.current.delete(key);
        else rowsRef.current.set(key, {...row, calls: (rowsRef.current.get(key)?.calls ?? 0) + 1});
        setTick(t => t + 1);
    }, {drain: 100, staleMs: 2500});

    const rows = [...rowsRef.current.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, {numeric: true}));
    return <div style={{display: "grid", gap: 6}}>
        <div style={{display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13}}>
            <span>ready: <b>{String(feed.ready)}</b></span>
            <span>stale: <b style={{color: feed.stale ? "#cf222e" : "#2da44e"}}>{String(feed.stale)}</b></span>
            <span>seq: <b>{feed.seq()}</b></span>
            <span>cb calls: <b>{callsRef.current}</b></span>
            <span>store keys: <b>{Object.keys(feed.store.state).length}</b></span>
        </div>
        <table style={{fontSize: 13, fontFamily: "monospace", borderCollapse: "collapse", width: "fit-content"}}>
            <thead><tr>{["row", "qty", "px", "cb calls"].map(h =>
                <th key={h} style={{border: "1px solid #d0d7de", padding: "2px 10px", background: "#f6f8fa"}}>{h}</th>)}</tr></thead>
            <tbody>{rows.map(([key, r]) => <tr key={key}>
                <td style={{border: "1px solid #d0d7de", padding: "2px 10px"}}>{key}</td>
                <td style={{border: "1px solid #d0d7de", padding: "2px 10px"}}>{r.qty}</td>
                <td style={{border: "1px solid #d0d7de", padding: "2px 10px"}}>{r.px}</td>
                <td style={{border: "1px solid #d0d7de", padding: "2px 10px"}}>{r.calls}</td>
            </tr>)}</tbody>
        </table>
        {feed.error != null && <div style={{color: "#cf222e"}}>error: {String(feed.error)}</div>}
    </div>;
};

export const ReplayStoreEachDemo = () => {
    const demo = useMemo(() => getStoreEachDemo(), []);
    const [gen, setGen] = useState(0);

    return <div style={{display: "grid", gap: 8}}>
        <div style={{display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center"}}>
            <button onClick={demo.add}>server add row</button>
            <button onClick={demo.del}>server delete row</button>
            <button onClick={demo.replaceAll}>server replace ALL (root replace)</button>
            <button onClick={() => setGen(v => v + 1)}>remount client (fresh keyframe)</button>
        </div>
        <StrictMode>
            <EachClient key={gen} remote={demo.remote}/>
        </StrictMode>
        <div style={{fontSize: 12, color: "#57606a", maxWidth: 560}}>
            per-key contract: the producer touches ONE random row per tick, so between your clicks only that
            row's "cb calls" counter grows — the whole dict is never re-delivered. keyframe / replace ALL are
            the only events that touch every row (expansion), delete arrives as (key, undefined).
        </div>
    </div>;
};
