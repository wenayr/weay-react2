import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useMediaSource, usePeer, useStoreNode } from "../../api";
import { Media, Peer, listen as createListen } from "wenay-common2";
import { PeerCallDemo, PeerPresenceDemo, MediaRelayAclDemo, MediaRelayAudioDemo, PeerCallVideoAudioDemo } from "../../demo/peerMedia";
import { ConferenceCallDemo } from "../../demo/peerConference";
import { Check, btn } from "../standKit";


/* ---------- 51. Peer packet mesh: dynamic multi-hop routing ---------- */
const PACKET_MESH_NODES = {
    client: "Client",
    "edge-a": "Edge A",
    "edge-b": "Edge B",
    server: "Server",
} as const;

type PacketMeshPayload = {type: "package" | "group"; name: string; bytes: number};
type PacketMeshNodeId = keyof typeof PACKET_MESH_NODES;
type PacketMeshOffers = ReturnType<typeof Peer.createPeerPacketOffers<PacketMeshPayload>>;

function createPacketMeshLink(
    from: PacketMeshNodeId,
    to: PacketMeshNodeId,
    cost: number,
    offers: Record<PacketMeshNodeId, PacketMeshOffers>,
) {
    const [emitFrom, messagesFrom] = createListen<[Peer.PeerPacketWire<PacketMeshPayload>]>();
    const [emitTo, messagesTo] = createListen<[Peer.PeerPacketWire<PacketMeshPayload>]>();
    let active = false;
    let removeFrom: (() => void) | null = null;
    let removeTo: (() => void) | null = null;

    function offer(
        self: PacketMeshNodeId,
        peer: PacketMeshNodeId,
        messages: typeof messagesFrom,
        emitPeer: typeof emitFrom,
    ): Peer.PeerPacketOffer<PacketMeshPayload> {
        return {
            id: `${self}->${peer}`,
            peerId: peer,
            priority: cost,
            connect() {
                return {
                    peerId: peer,
                    messages,
                    send(message) {
                        if (!active) return false;
                        window.setTimeout(() => { if (active) emitPeer(message); }, 0);
                        return true;
                    },
                    close() {},
                };
            },
        };
    }

    function install() {
        if (active) return;
        active = true;
        removeFrom = offers[from].control.upsert(offer(from, to, messagesFrom, emitTo));
        removeTo = offers[to].control.upsert(offer(to, from, messagesTo, emitFrom));
    }

    function cut() {
        if (!active) return;
        active = false;
        removeFrom?.();
        removeTo?.();
        removeFrom = null;
        removeTo = null;
    }

    return {from, to, cost, active: () => active, install, cut};
}

function createPacketMeshQaNetwork() {
    const nodeIds = Object.keys(PACKET_MESH_NODES) as PacketMeshNodeId[];
    const offers = Object.fromEntries(nodeIds.map(id => [id, Peer.createPeerPacketOffers<PacketMeshPayload>()])) as Record<PacketMeshNodeId, PacketMeshOffers>;
    const links = [
        createPacketMeshLink("client", "edge-a", 7, offers),
        createPacketMeshLink("edge-a", "edge-b", 9, offers),
        createPacketMeshLink("edge-b", "server", 11, offers),
        createPacketMeshLink("client", "edge-b", 40, offers),
        createPacketMeshLink("client", "server", 65, offers),
    ];
    links.forEach(link => link.install());
    const meshes = Object.fromEntries(nodeIds.map(id => [id, Peer.createPeerPacketMesh<PacketMeshPayload>({
        meshId: "wenay-react2-qa",
        nodeId: id,
        offers: offers[id].api,
        reconnectMs: 100,
        probeIntervalMs: 0,
    })])) as Record<PacketMeshNodeId, Peer.PeerPacketMesh<PacketMeshPayload>>;
    const primary = links.find(link => link.from === "edge-a" && link.to === "edge-b")!;

    return {
        meshes,
        links,
        primary,
        snapshot() {
            const route = meshes.client.routes().find(item => item.targetId === "server") ?? null;
            return {
                route,
                primaryActive: primary.active(),
                links: links.map(link => ({from: link.from, to: link.to, cost: link.cost, active: link.active()})),
                nodes: nodeIds.map(id => ({id, stats: meshes[id].stats()})),
            };
        },
        close() {
            Object.values(meshes).forEach(mesh => mesh.close());
            links.forEach(link => link.cut());
            Object.values(offers).forEach(registry => registry.control.clear());
        },
    };
}

type PacketMeshQaNetwork = ReturnType<typeof createPacketMeshQaNetwork>;
type PacketMeshQaSnapshot = ReturnType<PacketMeshQaNetwork["snapshot"]>;

function PacketMeshQaDemo() {
    const networkRef = useRef<PacketMeshQaNetwork | null>(null);
    const packetNo = useRef(0);
    const [snapshot, setSnapshot] = useState<PacketMeshQaSnapshot | null>(null);
    const [events, setEvents] = useState<string[]>([]);
    const sync = useCallback(() => {
        const network = networkRef.current;
        if (network) setSnapshot(network.snapshot());
    }, []);
    const note = useCallback((message: string) => {
        setEvents(current => [`${new Date().toLocaleTimeString()} · ${message}`, ...current].slice(0, 7));
    }, []);

    useEffect(() => {
        const network = createPacketMeshQaNetwork();
        networkRef.current = network;
        const offs: Array<() => void> = [];
        Object.entries(network.meshes).forEach(([id, mesh]) => {
            offs.push(mesh.routeChanges.on(sync));
            offs.push(mesh.statusChanges.on(sync));
            offs.push(mesh.packets.on((packet, meta) => {
                note(`${PACKET_MESH_NODES[id as PacketMeshNodeId]} получил ${packet.name}: ${meta.path.map(node => PACKET_MESH_NODES[node as PacketMeshNodeId] ?? node).join(" → ")}`);
                sync();
            }));
        });
        const timer = window.setInterval(sync, 250);
        sync();
        return () => {
            window.clearInterval(timer);
            offs.forEach(off => off());
            network.close();
            networkRef.current = null;
        };
    }, [note, sync]);

    const send = async () => {
        const network = networkRef.current;
        if (!network) return;
        const name = `packet-${++packetNo.current}`;
        const result = await network.meshes.client.send("server", {type: "package", name, bytes: 64 * 1024});
        note(result.ok ? `Client передал ${name}; первый hop ${PACKET_MESH_NODES[result.nextHopId as PacketMeshNodeId] ?? result.nextHopId}` : `${name}: ${result.reason}`);
        sync();
    };
    const broadcast = async () => {
        const network = networkRef.current;
        if (!network) return;
        const name = `group-${++packetNo.current}`;
        const results = await network.meshes.client.broadcast(["edge-a", "edge-b", "server"], {type: "group", name, bytes: 4096});
        note(`Групповой ${name}: ${results.filter(result => result.ok).length}/3 маршрутизировано`);
        sync();
    };
    const togglePrimary = () => {
        const network = networkRef.current;
        if (!network) return;
        if (network.primary.active()) {
            network.primary.cut();
            note("Канал Edge A ⇄ Edge B отключён — ищем fallback");
        } else {
            network.primary.install();
            note("Канал Edge A ⇄ Edge B восстановлен");
        }
        sync();
    };
    const label = (id: string) => PACKET_MESH_NODES[id as PacketMeshNodeId] ?? id;

    return <div style={{display: "grid", gap: 12}}>
        <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
            <button disabled={!snapshot?.route} onClick={() => void send()}>Отправить Client → Server</button>
            <button disabled={!snapshot?.route} onClick={() => void broadcast()}>Группа: 3 узла</button>
            <button disabled={!snapshot} onClick={togglePrimary}>{snapshot?.primaryActive ? "Отключить лучший канал" : "Восстановить лучший канал"}</button>
            <b style={{color: snapshot?.route ? "#1a7f37" : "#cf222e"}}>
                {snapshot?.route ? `${snapshot.route.path.map(label).join(" → ")} · cost ${snapshot.route.cost}` : "Маршрут строится…"}
            </b>
        </div>
        <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
            {snapshot?.links.map(link => {
                const selected = snapshot?.route?.path.some((id, index, path) => id === link.from && path[index + 1] === link.to)
                    || snapshot?.route?.path.some((id, index, path) => id === link.to && path[index + 1] === link.from);
                return <span key={`${link.from}-${link.to}`} style={{padding: "5px 8px", borderRadius: 999, border: `1px solid ${selected ? "#0969da" : "#d0d7de"}`, background: link.active ? (selected ? "#ddf4ff" : "#fff") : "#ffebe9", color: link.active ? "#24292f" : "#cf222e", fontSize: 12}}>
                    {label(link.from)} ⇄ {label(link.to)} · {link.cost}
                </span>;
            })}
        </div>
        <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 8}}>
            {snapshot?.nodes.map(node => <div key={node.id} style={{border: "1px solid #d0d7de", borderRadius: 8, padding: 9}}>
                <b>{label(node.id)}</b>
                <div style={{fontSize: 11, color: "#57606a", marginTop: 4}}>sent {node.stats.sent} · forwarded {node.stats.forwarded} · delivered {node.stats.delivered}</div>
            </div>)}
        </div>
        <div style={{minHeight: 48, padding: 8, borderRadius: 8, background: "#f6f8fa", fontFamily: "ui-monospace, monospace", fontSize: 11}}>
            {events.length ? events.map(event => <div key={event}>{event}</div>) : "Отправьте пакет или отключите лучший канал."}
        </div>
    </div>;
}

/* ---------- 38/39. Media sources: common2 capture + viewer helpers ---------- */
type MediaVideoMode = "balanced" | "max";

const MediaVideoCapture = ({mode}: {mode: MediaVideoMode}) => {
    const media = useMediaSource("video", mode === "max"
        ? {fps: 0, codec: "webp", replay: {history: 32, current: "last"}}
        : {fps: 12, width: 960, codec: "webp", replay: {history: 32, current: "last"}});
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [stats, setStats] = useState({frames: 0, drawn: 0, perSec: 0, ageMs: 0, sourceFps: 0, mbps: 0, dropped: 0});
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const view = Media.attachVideoCanvas(media.listen, canvas, {onError: e => setError(String(e))});
        let previousBytes = 0;
        let previousAt = performance.now();
        const timer = window.setInterval(() => {
            const source = media.stats();
            const now = performance.now();
            const bytesPerSecond = Math.max(0, source.bytes - previousBytes) * 1000 / Math.max(1, now - previousAt);
            previousBytes = source.bytes;
            previousAt = now;
            setStats({...view.stats(), sourceFps: source.fps, mbps: bytesPerSecond * 8 / 1_000_000, dropped: source.dropped});
        }, 500);
        return () => { window.clearInterval(timer); view.off(); };
    }, [media]);
    return <div style={{display: "grid", gap: 8}}>
        <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
            <button onClick={() => void media.start()}>start camera</button>
            <button onClick={media.stop}>stop</button>
            <b>state: {media.state}</b>
            <span style={{fontSize: 12}}>capture {stats.sourceFps.toFixed(1)} fps · wire {stats.mbps.toFixed(2)} Mbit/s · drawn {stats.perSec.toFixed(1)}/s · age {Math.round(stats.ageMs)}ms · dropped {stats.dropped}</span>
        </div>
        {error && <div style={{color: "#cf222e"}}>viewer error: {error}</div>}
        <canvas ref={canvasRef} width={320} height={180} style={{width: 320, height: 180, background: "#111", borderRadius: 8}} />
    </div>;
};

const MediaVideoDemo = () => {
    const [mode, setMode] = useState<MediaVideoMode>("balanced");
    return <div style={{display: "grid", gap: 10}}>
        <div style={{display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap"}}>
            <span style={{fontSize: 12, color: "#57606a"}}>Capture policy:</span>
            <button aria-pressed={mode === "balanced"} onClick={() => setMode("balanced")} style={btn(mode === "balanced", "#0969da")}>Balanced · 12 fps</button>
            <button aria-pressed={mode === "max"} onClick={() => setMode("max")} style={btn(mode === "max", "#8250df")}>MAX · unpaced</button>
            {mode === "max" && <b style={{fontSize: 11, color: "#8250df"}}>fps: 0 · source resolution</b>}
        </div>
        <MediaVideoCapture key={mode} mode={mode} />
    </div>;
};

const MediaAudioDemo = () => {
    const media = useMediaSource("audio", {mode: "pcm", bufferSize: 4096, replay: {history: 64, current: "last"}});
    const playerRef = useRef<ReturnType<typeof Media.attachAudioPlayer> | null>(null);
    const [stats, setStats] = useState({frames: 0, played: 0, dropped: 0, perSec: 0, ageMs: 0});
    useEffect(() => {
        const player = Media.attachAudioPlayer(media.listen, {maxBacklogSec: .35});
        playerRef.current = player;
        const timer = window.setInterval(() => setStats(player.stats()), 500);
        return () => { window.clearInterval(timer); player.off(); playerRef.current = null; };
    }, [media.listen]);
    return <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
        <button onClick={() => { playerRef.current?.enable(); void media.start(); }}>enable + start mic</button>
        <button onClick={media.stop}>stop</button>
        <b>state: {media.state}</b>
        <span style={{fontSize: 12}}>played {stats.played}, dropped {stats.dropped}, {stats.perSec}/s</span>
    </div>;
};

/* ---------- 40. Peer SDK: in-process mirrored store ---------- */
const PeerSdkDemo = () => {
    const pair = useMemo(() => {
        const host = Peer.createPeerHost();
        const a = Peer.createPeerClient<{value: number}>({remote: host.connection("qa-peer-a").fragment, account: "qa-peer-a", initial: {value: 0}});
        const b = Peer.createPeerClient<{value: number}>({remote: host.connection("qa-peer-b").fragment, account: "qa-peer-b", initial: {value: 0}});
        return {host, a, b};
    }, []);
    useEffect(() => () => { pair.a.close(); pair.b.close(); }, [pair]);
    const remote = usePeer(pair.b, "qa-peer-a");
    const value = useStoreNode(remote.store.node.value);
    return <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
        <button onClick={() => { pair.a.store.state.value += 1; }}>peer A +1</button>
        <button onClick={() => void remote.resync()}>resync B</button>
        <b>mirrored value: {value.value}</b>
        <span style={{fontSize: 12}}>ready={String(remote.ready)} route={remote.route} state={remote.state} seq={remote.seq()}</span>
    </div>;
};


/* ---------- card wrappers ---------- */

export function Card51() {
    return (
    <Check id="peer-packet-mesh" n={51} title="common2 Peer packet mesh — multi-hop routing + fallback"
                       do="Send a packet and a group packet. Then disable the best Edge A ⇄ Edge B link, wait for route reconciliation, and send again. Restore the link."
                       expect="The first route follows Client → Edge A → Edge B → Server. After the link disappears, the mesh selects an available higher-cost fallback without rebuilding the React UI or losing the packet API. Server delivery and per-node forwarding counters grow."
                       note="New in wenay-common2 1.0.90. The stand uses real createPeerPacketOffers/createPeerPacketMesh registries, reusable sessions, route advertisements and loop/TTL protection. In production every relay remains a trust boundary; origin/path metadata is informational unless the adapter or payload adds provenance."
                       tall>
                    <PacketMeshQaDemo />
                </Check>
    );
}

export function Card38() {
    return (
    <Check n={38} title="Media video — balanced / MAX unpaced capture diagnostics"
                       do="Start in Balanced and grant camera permission. Note capture fps and wire throughput, stop, select MAX, start again, and compare the live numbers. Switching policy deliberately stops the old source."
                       expect="Balanced targets 12 fps at 960 px. MAX uses fps:0, preserves the source resolution and starts the next capture only after the previous frame was encoded. The line reports actual capture/draw throughput instead of a promised cap; the canvas still bypasses React per frame."
                       note="MAX/unpaced semantics are new in wenay-common2 1.0.90. It is an explicit diagnostic/publishing policy because CPU and bandwidth rise with the camera and encoder; the calls product keeps a balanced default and has no hard-coded participant cap.">
                    <MediaVideoDemo />
                </Check>
    );
}

export function Card39() {
    return (
    <Check n={39} title="Media audio - mic lifecycle + sequential player"
                       do="Press enable + start mic, grant permission, speak briefly, then stop. If browser autoplay blocks audio, press the same button again."
                       expect="Audio activation happens in a user gesture; common2 player keeps a short live backlog and reports played/dropped frames. React renders only the half-second stats snapshot."
                       note="The PCM player is common2 imperative code. This card proves the React wrapper's start/stop cleanup and gesture boundary, not an audio implementation in React.">
                    <MediaAudioDemo />
                </Check>
    );
}

export function Card40() {
    return (
    <Check n={40} title="Peer SDK - mirrored store + explicit resync"
                       do="Click peer A +1 several times. Watch mirrored value on peer B. Press resync B; the mirror must stay coherent."
                       expect="Peer SDK owns relay journal and repair. React reads the peer store normally and exposes route/ready/seq as low-frequency control state; no transport or patch protocol is reimplemented here."
                       note="In-process host replaces a fake UI mock: this card proves the actual Peer.createPeerClient contract. Direct WebRTC needs the app's real signaling/rtc factory and remains a separate browser recipe.">
                    <PeerSdkDemo />
                </Check>
    );
}

export function Card41() {
    return (
    <Check n={41} title="Peer calls - ring, accept, hangup"
                       do="Click call B. On B press accept; both sides become active. Then hang up from A. Repeat and decline on B."
                       expect="The incoming ring, active state and terminal reason propagate through the existing Peer signal hub. React only renders manager state; common2 owns call IDs, busy/glare resolution and timeout/offline verdicts."
                       note="In-process host, no fake call protocol: usePeerCalls binds Peer.createCallManager. A real app supplies its server-side authorize policy before allowing media viewers.">
                    <PeerCallDemo />
                </Check>
    );
}

export function Card42() {
    return (
    <Check n={42} title="Peer presence - snapshot plus online/offline edges"
                       do="Observe both accounts online. Toggle B connection off and on."
                       expect="The list updates on connection edges without polling. The hook subscribes before it reads the snapshot, so it follows the host protocol rather than creating a second presence store."
                       note="Presence is common2 host state. React receives only list/edge data and does not decide authentication or account validity.">
                    <PeerPresenceDemo />
                </Check>
    );
}

export function Card43() {
    return (
    <Check n={43} title="Media relay - actual camera stream with live ACL revoke"
                       do="Start camera and grant permission: the right canvas must show the relayed stream. Revoke ACL: the viewer frame counter stops while capture keeps running. Grant it again: frames resume. Stop camera."
                       expect="The path is camera → Media source → common2 relay → policy-filtered viewer canvas. ACL revocation gates an already-open viewer without trusting React to detach it; the source stats continue because publishing and viewing are separate responsibilities."
                       note="This is an in-process relay, so it proves the React/lifecycle seam and live policy filter. A deployed app exposes publishOf/watchOf through its RPC server and keeps canWatch plus call authorization on the server.">
                    <MediaRelayAclDemo />
                </Check>
    );
}

export function Card44() {
    return (
    <Check n={44} title="Audio relay - actual microphone stream with live ACL revoke"
                       do="Press enable + start relay mic and grant permission, then speak. Revoke ACL: playback and viewer counters stop while capture remains live. Grant it again and confirm playback resumes."
                       expect="The path is microphone → Media source → common2 audio relay → policy-filtered AudioContext player. Audio activation is a user gesture; ACL gates the existing viewer without React deciding access."
                       note="This uses the relay's short lossless audio queue. In production publishOf/watchOf/canWatch are exposed by the server next to the call authorization policy.">
                    <MediaRelayAudioDemo />
                </Check>
    );
}

export function Card45() {
    return (
    <Check n={45} title="Peer call with live video and audio relay"
                       do="Enable camera + mic, call B, then accept on B. The canvas starts receiving video only after accept; speak to hear the relayed audio. Hang up: the viewer detaches."
                       expect="One real scenario: call state gates server-style relay access and viewer lifecycle. Before/after the active call, capture may run but B receives no media."
                       note="This is the complete in-process consumer demo exported from wenay-react2/demo/peer-media; production keeps the same ACL decision on its server.">
                    <PeerCallVideoAudioDemo />
                </Check>
    );
}

export function Card46() {
    return (
    <Check n={46} title="Conference: 3-way star room over the media relay + policy-routed direct focus" tall
                       do="Ring conf-b and conf-c from the host and accept on both seats: all six grid tiles start moving (each seat watches the other two). Hang up conf-b: only its tiles freeze (live membership ACL); re-ring and re-accept to resume. In the focus panel pick an owner and press go direct: the chip walks relay -> direct:connecting -> direct while the frame counter stays strictly monotonic (no reset, no jump). Press back to relay. Toggle policy: force relay and promote again - denied with reason policy: mustRelay. Untoggle it, toggle server: refuse endpoint exposure and promote - the offer is rejected, the link lands in fallback and frames continue on relay. Clear the toggles, promote, then press server revoke: the live direct session dies server-side and the tile auto-falls back without losing frames. Re-promote and press kill direct transport: the same visible fallback from the transport side. If real WebRTC is unavailable here, keep simulate RTC checked - the loopback runtime negotiates the same signaling."
                       expect="The grid is Peer.createMediaRelay fan-out with canWatch reading room membership derived from pairwise host-star calls (group calling is composed, not native: the host holds N-1 concurrent outgoing calls on ONE CallManager). The focus tile is Replay.createRouteCoordinator over ONE owner-sequenced line served by BOTH routes - an in-proc serveReplayChannel relay hop and a WebRTC datachannel via createWebRtcConnector/acceptWebRtcDirect - so every hand-off is gap-free by seq. Client policy hooks and the host authorize gate are separate boundaries and both fail loudly as result objects, never exceptions; server revoke and transport death both auto-fall back to relay."
                       note="Frames are JSON snapshots because the replay channel wire is text (connector info binary: false); real-camera binary frames through attachVideoCanvas stay proven by cards 43-45. Exactly one host.connection per account: the signal hub delivers to the LAST registered port, and the call manager, webrtc connector and acceptor deliberately share it. Never route the coordinator through relay.watchOf lines - those are per-watcher re-sequenced journals and a hand-off would silently drop frames. Exported as wenay-react2/demo/peer-conference.">
                    <ConferenceCallDemo />
                </Check>
    );
}
