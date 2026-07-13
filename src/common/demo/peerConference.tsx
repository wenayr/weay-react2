/**
 * Shipped conference demonstration: a 3-way host-star room where media travels over
 * BOTH technologies at once — the shared media relay (Peer.createMediaRelay, the grid)
 * and a policy-routed WebRTC direct line (Replay.createRouteCoordinator, the focus tile).
 * The QA board imports this exact component; consumers can import it from
 * `wenay-react2/demo/peer-conference`.
 *
 * Load-bearing invariant: the focus link's relay hop and its WebRTC direct route both
 * serve the SAME owner-sequenced routed line (replayListen per seat). Route hand-offs
 * resume from `lastDelivered` and silently drop lower seq, so serving two different
 * journals (e.g. a relay.watchOf line — per-watcher re-sequenced) would freeze frames
 * after a switch. Never "simplify" the relay hop to watchOf.
 *
 * Frames are JSON (SVG data-URL snapshots): the replay channel wire is text and the
 * webrtc connector declares binary:false. Real-camera binary frames through
 * Media.attachVideoCanvas stay covered by QA cards 43-45.
 */
import React, {useEffect, useMemo, useRef, useState} from "react";
import {listen as createListen, Peer, Replay} from "wenay-common2";
import {usePeerCalls} from "../src/hooks/usePeerCall";
import {useRouteState} from "../src/hooks/useRoute";
import {createFakeRtcNet} from "./fakeRtcLoopback";

export type ConfFrame = {n: number, at: number, image: string};
export type ConfLine = [ConfFrame, number];

export type ConferenceWorldOptions = {
    /** Seat accounts; the FIRST one is the room host (places the star calls) and the focus viewer. */
    accounts?: string[];
    /** Injected WebRTC runtime, `() => new RTCPeerConnection(cfg)` in a browser. */
    rtc?: () => Replay.RtcPeerConnection;
    /** Transport-death drill; defaults to closing every RTCPeerConnection this world created. */
    killTransport?: () => void;
    /** Synthetic painter fps; 0 disables timers (drive frames via tick() in tests). */
    fps?: number;
    /** Frame factory override for environments without DOM/canvas semantics. */
    frame?: (account: string, n: number) => ConfFrame;
    room?: string;
};

const seatHue = (account: string) => {
    let hash = 0;
    for (const ch of account) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
    return hash;
};

const defaultFrame = (account: string, n: number): ConfFrame => {
    const hue = seatHue(account);
    const cx = 16 + (n * 9) % 128;
    const cy = 24 + (n * 5) % 44;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90">` +
        `<rect width="160" height="90" fill="hsl(${hue},65%,42%)"/>` +
        `<circle cx="${cx}" cy="${cy}" r="7" fill="#fff" opacity="0.9"/>` +
        `<text x="8" y="82" font-size="12" font-family="monospace" fill="#fff">${account} #${n}</text></svg>`;
    return {n, at: Date.now(), image: "data:image/svg+xml," + encodeURIComponent(svg)};
};

/* ---------- in-proc text channel pair for the relay hop ---------- */
type HopChannel = Replay.ReplayMessageChannel & {close: () => void};

function makeChannelPair(): [HopChannel, HopChannel] {
    let closed = false;
    function side(other: () => any): any {
        let onMsg: ((data: string) => void) | null = null;
        let onCls: (() => void) | null = null;
        const me: any = {
            send: (data: string) => { if (!closed) setTimeout(function deliverHop() { if (!closed) other().deliver(data); }, 0); },
            onMessage: (cb: (data: string) => void) => { onMsg = cb; },
            onClose: (cb: () => void) => { onCls = cb; },
            close: () => {
                if (closed) return;
                closed = true;
                setTimeout(function closeHop() { me.fireClose(); other().fireClose(); }, 0);
            },
            deliver: (data: string) => onMsg?.(data),
            fireClose: () => onCls?.(),
        };
        return me;
    }
    let a: any, b: any;
    a = side(() => b);
    b = side(() => a);
    return [a, b];
}

/** Hand-built relay-route connector: a fresh serveReplayChannel hop over an in-proc text
 *  channel per open(). Fresh-per-open matters: the coordinator closes the relay connector
 *  on a successful promote and calls connect(ref, "relay") anew on every demote. */
function makeRelayHopConnector(line: Replay.ListenReplayApi<ConfLine>): Replay.RouteConnector<ConfLine> {
    let state: Replay.tConnectorState = "idle";
    let stopServe: (() => void) | null = null;
    let serverEnd: HopChannel | null = null;
    return {
        info: {label: "relay", kind: "relay", ordered: true, reliable: true},
        open() {
            state = "opening";
            const [server, client] = makeChannelPair();
            serverEnd = server;
            stopServe = Replay.serveReplayChannel<ConfLine>(Replay.exposeReplay(line) as Replay.ReplayRemote<ConfLine>, server);
            state = "open";
            return Replay.channelReplayRemote<ConfLine>(client);
        },
        close() {
            stopServe?.();
            stopServe = null;
            serverEnd?.close();
            serverEnd = null;
            state = "closed";
        },
        state: () => state,
    };
}

/* ---------- the headless conference world ---------- */
export function createConferenceWorld(options: ConferenceWorldOptions = {}) {
    const accounts = options.accounts ?? ["conf-a", "conf-b", "conf-c"];
    const hostAccount = accounts[0];
    const room = options.room ?? "qa-conference";
    const frameOf = options.frame ?? defaultFrame;

    // client policy refs (the coordinator hooks read them live) + the server-side gate
    const policy = {forceRelay: false, allowEndpoint: true};

    const host = Peer.createPeerHost({
        authorize: env => env.type === "offer" ? policy.allowEndpoint : true,
    });

    // exactly ONE connection per account: the signal hub delivers to the LAST registered
    // port, and the call manager, webrtc connector and acceptor deliberately share it
    const connections = new Map(accounts.map(account => [account, host.connection(account)] as const));
    const managers = new Map(accounts.map(account => [account,
        Peer.createCallManager({port: Peer.callPortOf(connections.get(account)!.fragment), self: account})] as const));

    // roster = host + every member whose host-star call is active; it is the single
    // authority for BOTH media planes (relay ACL and direct accept/canDirect)
    const roster = new Set<string>([hostAccount]);
    const [emitChanged, changed] = createListen<[]>();
    const hostCalls = new Map<string, Peer.CallHandle>();

    function ring(member: string) {
        const existing = hostCalls.get(member);
        if (existing && existing.state() !== "ended") return existing;
        const handle = managers.get(hostAccount)!.call(member, {room});
        hostCalls.set(member, handle);
        handle.changed.on(function onStarCallState(state) {
            if (state === "active") roster.add(member);
            emitChanged();
        });
        void handle.ended.then(function onStarCallEnd() {
            roster.delete(member);
            if (hostCalls.get(member) === handle) hostCalls.delete(member);
            emitChanged();
        });
        emitChanged();
        return handle;
    }

    const relay = Peer.createMediaRelay({
        lines: {cam: "video"},
        videoHistory: 8,
        canWatch: (watcher, owner) => watcher !== owner && roster.has(watcher) && roster.has(owner),
    });

    // one owner-sequenced routed line per seat: the seq authority BOTH routes serve
    const routed = new Map(accounts.map(account => {
        const [emit, line] = Replay.replayListen<ConfLine>({history: 8, current: "last"});
        return [account, {emit, line}] as const;
    }));

    const frameNumbers = new Map<string, number>(accounts.map(account => [account, 0]));
    const publishers = new Map(accounts.map(account => [account, relay.publishOf(account)] as const));

    /** Seats stream only while in the room (the host always is): leaving freezes every
     *  consumer of that seat on any route, joining resumes them. */
    function tick(only?: string) {
        for (const account of accounts) {
            if (only && account !== only) continue;
            if (!roster.has(account)) continue;
            const n = (frameNumbers.get(account) ?? 0) + 1;
            frameNumbers.set(account, n);
            const frame = frameOf(account, n);
            publishers.get(account)!("cam", frame, frame.at);
            routed.get(account)!.emit(frame, frame.at);
        }
    }

    const fps = options.fps ?? 8;
    const painter = fps > 0 ? setInterval(function paintConference() { tick(); }, Math.max(16, Math.round(1000 / fps))) : null;

    // WebRTC runtime: injected factory or the browser's real RTCPeerConnection
    const livePcs = new Set<Replay.RtcPeerConnection>();
    const baseRtc = options.rtc ?? (() => new (globalThis as any).RTCPeerConnection() as Replay.RtcPeerConnection);
    const rtc = () => {
        const pc = baseRtc();
        livePcs.add(pc);
        return pc;
    };

    // every seat serves ITS OWN routed line to direct viewers; membership gates accept
    const acceptorStops = accounts.map(owner => Replay.acceptWebRtcDirect<ConfLine>({
        port: connections.get(owner)!.fragment.signal,
        rtc,
        self: owner,
        serve: env => env.pair === "media:" + owner + ">" + env.from
            ? Replay.exposeReplay(routed.get(owner)!.line) as Replay.ReplayRemote<ConfLine>
            : null,
        accept: env => roster.has(env.from) && roster.has(owner),
    }));

    // focus coordinator for the first seat: directional signaling pair "media:OWNER>VIEWER"
    // (the coordinator's own ref.key is symmetric — never reuse it for signaling)
    const viewer = hostAccount;
    const ownerOf = (ref: Replay.RoutePairRef) => ref.a === viewer ? ref.b : ref.a;
    const coordinator = Replay.createRouteCoordinator<ConfLine>({
        policy: {
            mustRelay: () => policy.forceRelay,
            canDirect: ctx => roster.has(ownerOf(ctx)),
        },
        connect: (ref, kind) => {
            const owner = ownerOf(ref);
            if (kind === "relay") return makeRelayHopConnector(routed.get(owner)!.line);
            return Replay.createWebRtcConnector<ConfLine>({
                port: connections.get(viewer)!.fragment.signal,
                rtc,
                self: viewer,
                peer: owner,
                pair: "media:" + owner + ">" + viewer,
                openTimeoutMs: 8000,
            });
        },
    });
    const focusLinks = new Map<string, ReturnType<typeof coordinator.pair>>();
    function focus(owner: string) {
        let link = focusLinks.get(owner);
        if (!link) {
            link = coordinator.pair(viewer, owner);
            focusLinks.set(owner, link);
        }
        return link;
    }

    /** Server-side revoke of the viewer's live direct session; the connector fails and
     *  the coordinator auto-falls back to the relay hop without losing frames. */
    function revokeDirect(owner: string) {
        host.revoke("media:" + owner + ">" + viewer, [viewer], "server revoke");
    }

    /** Transport-death drill: the direct channel dies mid-flight (not a policy event). */
    function killDirect() {
        if (options.killTransport) { options.killTransport(); return; }
        for (const pc of livePcs) pc.close();
        livePcs.clear();
    }

    let closed = false;
    function close() {
        if (closed) return;
        closed = true;
        if (painter) clearInterval(painter);
        coordinator.close();
        for (const stop of acceptorStops) stop();
        for (const handle of hostCalls.values()) if (handle.state() !== "ended") handle.hangup();
        for (const manager of managers.values()) manager.close();
        relay.close();
        for (const entry of routed.values()) entry.line.close();
        for (const connection of connections.values()) connection.close();
        host.close();
    }

    return {
        accounts,
        hostAccount,
        viewer,
        room,
        managers,
        relay,
        coordinator,
        focus,
        ring,
        hostCalls,
        roster: () => [...roster].sort(),
        inRoster: (account: string) => roster.has(account),
        changed,
        lineOf: (account: string) => routed.get(account)!.line,
        frameNumber: (account: string) => frameNumbers.get(account) ?? 0,
        tick,
        setForceRelay(on: boolean) { policy.forceRelay = on; emitChanged(); },
        setAllowEndpoint(on: boolean) { policy.allowEndpoint = on; emitChanged(); },
        getPolicy: () => ({...policy}),
        revokeDirect,
        killDirect,
        close,
    };
}

export type ConferenceWorld = ReturnType<typeof createConferenceWorld>;

/* ---------- React demo: 3 seats, relay grid, direct focus ---------- */
const tileStyle: React.CSSProperties = {width: 160, height: 90, background: "#111", borderRadius: 6, objectFit: "cover"};
const panelStyle: React.CSSProperties = {border: "1px solid #d0d7de", borderRadius: 8, padding: 8, display: "grid", gap: 6, alignContent: "start"};

const SeatPanel = (p: {world: ConferenceWorld, account: string}) => {
    const manager = p.world.managers.get(p.account)!;
    const calls = usePeerCalls(manager);
    const isHost = p.account === p.world.hostAccount;
    const members = p.world.accounts.filter(account => account !== p.world.hostAccount);
    const incoming = calls.rings.find(call => call.direction === "in");
    const live = calls.calls.filter(call => call.state() === "active");
    return <div style={panelStyle}>
        <b>{p.account}{isHost ? " (host)" : ""} {p.world.inRoster(p.account) ? "· in room" : ""}</b>
        {isHost && members.map(member => {
            const handle = p.world.hostCalls.get(member);
            const state = handle?.state();
            return <div key={member} style={{display: "flex", gap: 6, alignItems: "center"}}>
                {(!handle || state === "ended") && <button onClick={() => p.world.ring(member)}>ring {member}</button>}
                {state === "ringing" && <span>ringing {member}…</span>}
                {state === "active" && <button onClick={() => handle!.hangup()}>hang up {member}</button>}
            </div>;
        })}
        {!isHost && incoming && <div style={{display: "flex", gap: 6}}>
            <button onClick={() => incoming.accept()}>accept</button>
            <button onClick={() => incoming.decline()}>decline</button>
        </div>}
        {!isHost && live.map(call => <button key={call.id} onClick={() => call.hangup()}>hang up ({call.peer})</button>)}
        <span style={{fontSize: 11, color: "#57606a"}}>calls: {calls.calls.map(call => `${call.peer}:${call.state()}`).join(" ") || "none"}</span>
    </div>;
};

const GridTile = (p: {world: ConferenceWorld, viewer: string, owner: string}) => {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const counter = useRef({n: 0, at: 0});
    const [snapshot, setSnapshot] = useState({n: 0, ageMs: 0});
    useEffect(() => {
        // watchOf hides owners the ACL denies (the property reads as undefined), so the
        // tile attaches lazily and retries whenever room membership changes
        let off: (() => void) | null = null;
        const tryAttach = () => {
            if (off) return;
            const watch: any = p.world.relay.watchOf(p.viewer);
            const line = watch[p.owner];
            if (!line) return;
            off = line.cam.on((frame: ConfFrame) => {
                counter.current = {n: frame.n, at: frame.at};
                if (imgRef.current) imgRef.current.src = frame.image;
            });
        };
        tryAttach();
        const offChanged = p.world.changed.on(tryAttach);
        const timer = window.setInterval(() => setSnapshot({
            n: counter.current.n,
            ageMs: counter.current.at ? Date.now() - counter.current.at : 0,
        }), 500);
        return () => { off?.(); offChanged(); window.clearInterval(timer); };
    }, [p.world, p.viewer, p.owner]);
    return <figure style={{margin: 0, display: "grid", gap: 2, justifyItems: "start"}}>
        <img ref={imgRef} alt={`${p.viewer} watches ${p.owner}`} style={tileStyle} />
        <figcaption style={{fontSize: 11, color: "#57606a"}}>{p.viewer} ← {p.owner} · #{snapshot.n} · {Math.round(snapshot.ageMs / 100) / 10}s</figcaption>
    </figure>;
};

const FocusPanel = (p: {world: ConferenceWorld}) => {
    const members = p.world.accounts.filter(account => account !== p.world.viewer);
    const [owner, setOwner] = useState(members[0]);
    const link = useMemo(() => p.world.focus(owner), [p.world, owner]);
    const route = useRouteState(p.world.coordinator, link);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const counter = useRef({n: 0, seq: 0});
    const [snapshot, setSnapshot] = useState({n: 0, seq: 0});
    const [lastOp, setLastOp] = useState("");
    const [forceRelay, setForceRelay] = useState(false);
    const [allowEndpoint, setAllowEndpoint] = useState(true);
    useEffect(() => {
        let off: (() => void) | null = null;
        let seq = () => 0;
        try {
            const sub = link.subscribe(frame => {
                counter.current = {n: frame.n, seq: seq()};
                if (imgRef.current) imgRef.current.src = frame.image;
            });
            seq = sub.seq;
            off = sub;
        } catch (error) {
            setLastOp("subscribe failed: " + String(error));
        }
        const timer = window.setInterval(() => setSnapshot({...counter.current}), 500);
        return () => { off?.(); window.clearInterval(timer); };
    }, [link]);
    const run = (label: string, op: Promise<Replay.RouteOpResult>) => void op
        .then(result => setLastOp(`${label}: ${result.ok ? "ok" : "denied"} → ${result.state}${result.reason ? ` (${String(result.reason)})` : ""}`))
        .catch(error => setLastOp(`${label}: ${String(error)}`));
    const chipColor = route.state === "direct" ? "#1a7f37" : route.state.startsWith("direct") ? "#9a6700" : route.state === "fallback" ? "#cf222e" : "#0969da";
    return <div style={{...panelStyle, minWidth: 320}}>
        <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
            <b>focus: {p.world.viewer} ←</b>
            <select value={owner} onChange={event => setOwner(event.target.value)}>
                {members.map(member => <option key={member} value={member}>{member}</option>)}
            </select>
            <span style={{padding: "2px 8px", borderRadius: 10, fontSize: 12, color: "#fff", background: chipColor}}>{route.state}</span>
        </div>
        <img ref={imgRef} alt={`focus on ${owner}`} style={{...tileStyle, width: 240, height: 135}} />
        <span style={{fontSize: 11, color: "#57606a"}}>frame #{snapshot.n} · seq {snapshot.seq}
            {route.metrics?.relay ? ` · relay:${route.metrics.relay.state}` : ""}{route.metrics?.direct ? ` · direct:${route.metrics.direct.state}` : ""}</span>
        <div style={{display: "flex", gap: 6, flexWrap: "wrap"}}>
            <button onClick={() => run("promote", link.promoteDirect({timeoutMs: 8000}))}>go direct</button>
            <button onClick={() => run("relay", link.reinterposeRelay("manual"))}>back to relay</button>
            <button onClick={() => p.world.revokeDirect(owner)}>server revoke</button>
            <button onClick={() => p.world.killDirect()}>kill direct transport</button>
        </div>
        <label style={{fontSize: 12}}><input type="checkbox" checked={forceRelay}
            onChange={event => { setForceRelay(event.target.checked); p.world.setForceRelay(event.target.checked); }} /> policy: force relay</label>
        <label style={{fontSize: 12}}><input type="checkbox" checked={!allowEndpoint}
            onChange={event => { setAllowEndpoint(!event.target.checked); p.world.setAllowEndpoint(!event.target.checked); }} /> server: refuse endpoint exposure</label>
        {lastOp && <span style={{fontSize: 12}}>{lastOp}</span>}
        {route.log.length > 0 && <span style={{fontSize: 11, color: "#57606a"}}>
            {route.log.map(entry => `${entry.from}→${entry.to}${entry.reason ? ` (${String(entry.reason)})` : ""}`).join(" | ")}</span>}
    </div>;
};

export const ConferenceCallDemo = () => {
    const hasRealRtc = typeof (globalThis as any).RTCPeerConnection === "function";
    const [simulateRtc, setSimulateRtc] = useState(!hasRealRtc);
    const setup = useMemo(() => {
        const net = simulateRtc ? createFakeRtcNet() : null;
        const world = createConferenceWorld(net ? {rtc: net.pc, killTransport: net.killLiveChannels} : {});
        return {net, world};
    }, [simulateRtc]);
    useEffect(() => () => setup.world.close(), [setup]);
    const [, setVersion] = useState(0);
    useEffect(() => setup.world.changed.on(() => setVersion(value => value + 1)), [setup]);
    const world = setup.world;
    const pairs = world.accounts.flatMap(viewer => world.accounts.filter(owner => owner !== viewer).map(owner => ({viewer, owner})));
    return <div style={{display: "grid", gap: 10}}>
        <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
            <b>room: {world.roster().join(", ")}</b>
            <label style={{fontSize: 12}}><input type="checkbox" checked={simulateRtc}
                onChange={event => setSimulateRtc(event.target.checked)} /> simulate RTC (loopback runtime{hasRealRtc ? "" : "; real RTCPeerConnection unavailable here"})</label>
        </div>
        <div style={{display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr))", gap: 8}}>
            {world.accounts.map(account => <SeatPanel key={account} world={world} account={account} />)}
        </div>
        <div style={{display: "flex", gap: 12, flexWrap: "wrap", alignItems: "start"}}>
            <div style={{display: "grid", gridTemplateColumns: "repeat(3, auto)", gap: 8}}>
                {pairs.map(pair => <GridTile key={pair.viewer + "<" + pair.owner} world={world} viewer={pair.viewer} owner={pair.owner} />)}
            </div>
            <FocusPanel world={world} />
        </div>
    </div>;
};
