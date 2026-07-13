// Browser seat for conference-server.mjs — the real-backend variant of demo/peer-conference.
// One tab = one participant. Media tiles ride the SERVER relay (room-gated fan-out);
// each peer row is a peer-store link that starts on the server relay and can promote to
// a real RTCPeerConnection datachannel (negotiated through the same server signal hub),
// then re-interpose back — the two technologies of the conference bridge, cross-tab.
//
// Serve this page from the wenay-react2 dev stand (vite transpiles the .ts):
//   /doc/examples/conference-client.html?me=a&peers=b,c&host=1&room=demo
import {io} from "socket.io-client";
import {createRpcClientHub, Peer} from "wenay-common2";

type SeatWorld = {name: string, hue: number, beat: number, status: string};
type ConfFrame = {n: number, at: number, image: string};

const params = new URLSearchParams(location.search);
const me = params.get("me") ?? "a";
const peers = (params.get("peers") ?? (me === "a" ? "b,c" : "a")).split(",").map(value => value.trim()).filter(Boolean);
const isHost = params.get("host") === "1" || me === "a";
const room = params.get("room") ?? "demo";
const serverUrl = params.get("server") ?? `${location.protocol}//${location.hostname}:8391`;

const el = (id: string) => document.getElementById(id)!;
const logBox = el("log");
function log(line: string) {
    const row = document.createElement("div");
    row.textContent = `${new Date().toLocaleTimeString()}  ${line}`;
    logBox.prepend(row);
    while (logBox.children.length > 60) logBox.lastChild?.remove();
}

const seatHue = (account: string) => {
    let hash = 0;
    for (const ch of account) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
    return hash;
};
const paintFrame = (account: string, n: number): ConfFrame => {
    const hue = seatHue(account);
    const cx = 16 + (n * 9) % 128;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90">` +
        `<rect width="160" height="90" fill="hsl(${hue},65%,42%)"/>` +
        `<circle cx="${cx}" cy="${24 + (n * 5) % 44}" r="7" fill="#fff" opacity="0.9"/>` +
        `<text x="8" y="82" font-size="12" font-family="monospace" fill="#fff">${account} #${n}</text></svg>`;
    return {n, at: Date.now(), image: "data:image/svg+xml," + encodeURIComponent(svg)};
};

async function main() {
    document.title = `conf seat ${me}`;
    el("who").textContent = `seat ${me}${isHost ? " (host)" : ""} · room "${room}" · peers: ${peers.join(", ")}`;

    const hub = createRpcClientHub(
        () => io(serverUrl, {transports: ["websocket"], auth: {account: me}}),
        r => ({app: r<any>("app")}) as const,
    );
    const clients = await hub.setToken(null);
    await clients.app.readyStrict();
    const deep: any = clients.app.func;
    log("connected; server time " + await deep.serverTime());

    // ============== calls: host-star membership over the server policy ==============
    const manager = Peer.createCallManager({port: Peer.callPortOf(deep.peer), self: me});
    const live = new Map<string, any>();
    const controls = el("callControls");
    function renderCalls() {
        controls.innerHTML = "";
        const inRoom = [...live.values()].some(call => call.state() === "active");
        const state = document.createElement("b");
        state.textContent = inRoom ? "in room" : "not in room";
        controls.append(state);
        if (isHost) {
            for (const peer of peers) {
                const current = [...live.values()].find(call => call.peer === peer && call.state() !== "ended");
                const button = document.createElement("button");
                if (!current) {
                    button.textContent = `ring ${peer}`;
                    button.onclick = () => bindCall(manager.call(peer, {room}));
                } else if (current.state() === "ringing") {
                    button.textContent = `cancel ${peer}…`;
                    button.onclick = () => current.hangup();
                } else {
                    button.textContent = `hang up ${peer}`;
                    button.onclick = () => current.hangup();
                }
                controls.append(button);
            }
        } else {
            const incoming = [...live.values()].find(call => call.direction === "in" && call.state() === "ringing");
            if (incoming) {
                const accept = document.createElement("button");
                accept.textContent = `accept ${incoming.peer}`;
                accept.onclick = () => incoming.accept();
                const decline = document.createElement("button");
                decline.textContent = "decline";
                decline.onclick = () => incoming.decline();
                controls.append(accept, decline);
            }
            const active = [...live.values()].find(call => call.state() === "active");
            if (active) {
                const leave = document.createElement("button");
                leave.textContent = "leave room";
                leave.onclick = () => active.hangup();
                controls.append(leave);
            }
        }
    }
    function bindCall(call: any) {
        live.set(call.id, call);
        call.changed.on((state: string) => { log(`call ${call.peer}: ${state}${call.reason() ? ` (${call.reason()})` : ""}`); renderCalls(); });
        void call.ended.then(() => { live.delete(call.id); renderCalls(); });
        renderCalls();
    }
    manager.rings.on(bindCall);
    await manager.ready;
    renderCalls();
    const amInRoom = () => [...live.values()].some(call => call.state() === "active");

    // ============== technology 1: media grid through the server relay ==============
    let frameN = 0;
    setInterval(function publishSyntheticCam() {
        if (!amInRoom()) return; // stream only while in the room (the server ACL gates viewers anyway)
        frameN++;
        const frame = paintFrame(me, frameN);
        void deep.media.publish("cam", frame, frame.at);
    }, 125);

    const tiles = el("tiles");
    for (const peer of peers) {
        const figure = document.createElement("figure");
        const img = document.createElement("img");
        img.className = "tile";
        const caption = document.createElement("figcaption");
        caption.textContent = `${peer} · waiting`;
        figure.append(img, caption);
        tiles.append(figure);
        // the server's watch proxy resolves per access through canWatch: a subscription
        // made before the room grant lands on nothing, so keep re-attaching until the
        // FIRST FRAME proves the line is live (then stop churning)
        let off: (() => void) | null = null;
        let lastN = 0, lastAt = 0;
        const attach = () => {
            if (lastAt) return;
            try { off?.(); } catch { /* stale RPC handle */ }
            off = null;
            try {
                const line = deep.media.watch?.[peer]?.cam;
                if (!line?.on) return;
                off = line.on((frame: ConfFrame) => {
                    if (!lastAt) log(`watching ${peer} through the server relay`);
                    lastN = frame.n; lastAt = frame.at;
                    img.src = frame.image;
                });
            } catch (error) { log(`watch ${peer} failed: ${error}`); }
        };
        setInterval(attach, 1500);
        setInterval(() => {
            const age = lastAt ? Math.round((Date.now() - lastAt) / 100) / 10 : 0;
            caption.textContent = `${peer} · #${lastN}${lastAt ? ` · ${age}s ago` : " · waiting"}`;
        }, 500);
        attach();
    }

    // ============== technology 2: peer-store links, relay <-> direct per pair ==============
    const client = Peer.createPeerClient<SeatWorld>({
        remote: deep.peer,
        account: me,
        initial: {name: me, hue: seatHue(me), beat: 0, status: ""},
        rtc: () => new RTCPeerConnection(),
        drain: "micro",
    });
    client.onRoute((event: any) => log(`route ${event.key}: ${event.from} -> ${event.to}${event.reason ? ` (${String(event.reason)})` : ""}`));
    setInterval(function heartbeat() { client.store.state.beat++; }, 1000);
    (el("status") as HTMLInputElement).addEventListener("input", function onStatusInput(event) {
        client.store.state.status = (event.target as HTMLInputElement).value;
    });

    const peersBox = el("peers");
    for (const account of peers) {
        const link = client.peer(account);
        const row = document.createElement("div");
        row.className = "peerRow";
        const title = document.createElement("b");
        const chip = document.createElement("span");
        const info = document.createElement("span");
        info.className = "fine";
        const direct = document.createElement("button");
        direct.textContent = "go direct";
        direct.onclick = async () => {
            log(`promoteDirect ${account}…`);
            const result = await link.promoteDirect({timeoutMs: 8000});
            log(result.ok ? `direct with ${account}: ok (${result.state})` : `direct with ${account} denied: ${String(result.reason)}`);
        };
        const relay = document.createElement("button");
        relay.textContent = "back to relay";
        relay.onclick = async () => {
            const result = await link.reinterposeRelay("manual");
            log(result.ok ? `relay with ${account}` : `re-interpose ${account} failed: ${String(result.reason)}`);
        };
        row.append(title, chip, info, direct, relay);
        peersBox.append(row);
        setInterval(function renderPeerRow() {
            const mirrored: any = link.store.state;
            title.textContent = account;
            const route = link.route();
            chip.textContent = `${route} · ${link.state()}`;
            chip.className = "chip" + (route === "direct" ? " direct" : link.state() === "fallback" ? " fallback" : "");
            info.textContent = mirrored
                ? `beat ${mirrored.beat} · seq ${link.seq()}${mirrored.status ? ` · "${mirrored.status}"` : ""}`
                : "no mirror yet";
        }, 500);
    }
}

main().catch(error => { console.error(error); log("FATAL: " + error); });
