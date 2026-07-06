/* replayVideo.tsx - QA demos for the Replay stack hooks (useReplaySubscribe / useReplayHistory / useStoreReplayMirror).
 *
 * Everything is in-proc: a synthetic "video" producer emits jpeg frames on a replay line
 * (keyframe = last frame), a simulated slow wire + conflateReplay gate shows per-client
 * frame dropping, archiveReplay + openHistory power the time-travel scrubber.
 * The transport itself is already proven in wenay-common2 (replay/video-socket.demo);
 * these cards exercise the React lifecycle side.
 */

import React, {useEffect, useMemo, useRef, useState} from "react";
import {ObserveAll2, Replay} from "wenay-common2";
import {useReplaySubscribe, useReplayHistory, useStoreReplayMirror, useStoreNode, useStoreKeys} from "../src/hooks";

type tFrame = {n: number, w: number, h: number, ts: number, jpeg: string};
type tFrameRemote = Replay.ReplayRemote<[tFrame]>;

const FPS = 10;
export const videoResolutions = [{w: 160, h: 90}, {w: 320, h: 180}, {w: 640, h: 360}] as const;

/* ---------- producer + line + wire + archive (module singleton, starts on first use) ---------- */

function createVideoDemo() {
    let res: {w: number, h: number} = videoResolutions[1];
    let frameN = 0;
    let last: tFrame | null = null;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    const [emit, replay] = Replay.UseReplayListen<[tFrame]>({
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

/* ---------- card 23: video line - direct client, conflated slow client, time travel ---------- */

export const ReplayVideoDemo = () => {
    const demo = useMemo(() => getVideoDemo(), []);
    const [resIdx, setResIdx] = useState(1);
    const [slow, setSlow] = useState(true);
    const [mountedA, setMountedA] = useState(true);
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
        </div>
    </div>;
};

/* ---------- card 24: store replay sync - useStoreReplayMirror over exposeStoreReplay ---------- */

type tWorld = {ticks: number, price: number, note: string, bag: Record<string, number>};

function createStoreReplayDemo() {
    const store = ObserveAll2.createStore<tWorld>({ticks: 0, price: 100, note: "start", bag: {a: 1}});
    const exposed = ObserveAll2.exposeStoreReplay(store, {history: 128});
    setInterval(() => {
        store.state.ticks++;
        store.state.price = Math.round((store.state.price + (Math.random() - 0.5) * 2) * 100) / 100;
    }, 800);
    return {store, remote: exposed.api.replay};
}

type tStoreDemo = ReturnType<typeof createStoreReplayDemo>;
let storeDemo: tStoreDemo | null = null;
const getStoreReplayDemo = () => storeDemo ??= createStoreReplayDemo();

export const ReplayStoreDemo = () => {
    const demo = useMemo(() => getStoreReplayDemo(), []);
    const [enabled, setEnabled] = useState(true);
    const mirror = useStoreReplayMirror<tWorld>(demo.remote, {ticks: 0, price: 0, note: "", bag: {}}, {enabled});
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
        </div>
        <div style={{display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13}}>
            <span>ready: <b>{String(mirror.ready)}</b></span>
            <span>seq: <b>{mirror.seq()}</b></span>
            <span>mirror ticks: <b>{ticks.value}</b></span>
            <span>mirror price: <b>{price.value}</b></span>
            <span>mirror note: <b>{note.value}</b></span>
            <span>bag keys: <b>{bagKeys.stringKeys.join(",") || "-"}</b></span>
        </div>
        {mirror.error != null && <div style={{color: "#cf222e"}}>error: {String(mirror.error)}</div>}
    </div>;
};
