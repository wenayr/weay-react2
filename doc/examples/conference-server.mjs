// Conference bridge server: the REAL-backend variant of QA card 46 / demo/peer-conference.
// One Node process owns the peer host (call signaling + WebRTC negotiation pass-through),
// the media relay and the ROOM policy; browser seats connect over Socket.IO from
// conference-client.html. Media rides the server relay (technology 1); the peer-store
// links between seats can promote to a real RTCPeerConnection datachannel negotiated
// through this same signal hub (technology 2) and re-interpose back.
//
// Run:  node doc/examples/conference-server.mjs   (needs `socket.io` installed)
// Then open the client page from the wenay-react2 stand dev server in 2-3 tabs:
//   /doc/examples/conference-client.html?me=a&peers=b,c&host=1
//   /doc/examples/conference-client.html?me=b&peers=a,c
//   /doc/examples/conference-client.html?me=c&peers=a,b
import {createServer} from "node:http";
import {Server as SocketIOServer} from "socket.io";
import {createRpcServerAuto, listen, Peer} from "wenay-common2";

const PORT = Number(process.env.PORT ?? 8391);

// ============== room policy: an accepted call joins BOTH parties to its room ==============
// Membership is reference-counted per (room, account): in a host-star each member holds
// one call to the host, while the host holds one call per member. canWatch/canSignal ask
// "do these two accounts share a live room" — the ONLY media/endpoint authority here.
function createRoomPolicy() {
    const calls = new Map(); // pair -> {caller, callee, room, state, timer}
    const rooms = new Map(); // room -> Map<account, refCount>

    function join(room, account) {
        const members = rooms.get(room) ?? new Map();
        members.set(account, (members.get(account) ?? 0) + 1);
        rooms.set(room, members);
    }
    function leave(room, account) {
        const members = rooms.get(room);
        if (!members) return;
        const count = (members.get(account) ?? 0) - 1;
        if (count > 0) members.set(account, count); else members.delete(account);
        if (!members.size) rooms.delete(room);
    }
    function sameRoom(a, b) {
        for (const members of rooms.values()) if (members.has(a) && members.has(b)) return true;
        return false;
    }
    function finish(pair, reason) {
        const call = calls.get(pair);
        if (!call) return;
        calls.delete(pair);
        clearTimeout(call.timer);
        if (call.state === "active") {
            leave(call.room, call.caller);
            leave(call.room, call.callee);
        }
        console.log(`[conf] call down: ${call.caller} <-> ${call.callee} in "${call.room}" (${reason})`);
    }

    function authorize(env) {
        if (env.type === "ring") {
            const room = typeof env.session?.room === "string" ? env.session.room : null;
            if (!env.pair.startsWith("call:") || env.from === env.to || !room || calls.has(env.pair)) return false;
            const timer = setTimeout(() => finish(env.pair, "expired"), 35_000);
            timer.unref?.();
            calls.set(env.pair, {caller: env.from, callee: env.to, room, state: "ringing", timer});
            return true;
        }
        if (env.type === "accept" || env.type === "decline" || env.type === "hangup") {
            const call = calls.get(env.pair);
            if (!call) return false;
            const reverse = env.from === call.callee && env.to === call.caller;
            const participant = reverse || (env.from === call.caller && env.to === call.callee);
            if (env.type === "accept") {
                if (call.state !== "ringing" || !reverse) return false;
                call.state = "active";
                clearTimeout(call.timer);
                join(call.room, call.caller);
                join(call.room, call.callee);
                console.log(`[conf] call up: ${call.caller} <-> ${call.callee} joined "${call.room}"`);
                return true;
            }
            if (env.type === "decline" && (!reverse || call.state !== "ringing")) return false;
            if (!participant) return false;
            finish(env.pair, env.type);
            return true;
        }
        // WebRTC direct negotiation (offer/answer/ice) is endpoint exposure: the server
        // only brokers it between accounts that currently share a room.
        if (env.type === "offer" || env.type === "answer" || env.type === "ice") {
            return sameRoom(env.from, env.to);
        }
        return true; // close/revoke pass through (session teardown)
    }

    function dropAccount(account) {
        for (const [pair, call] of calls) {
            if (call.caller === account || call.callee === account) finish(pair, "offline");
        }
    }

    return {
        authorize,
        canWatch: (watcher, owner) => watcher !== owner && sameRoom(watcher, owner),
        dropAccount,
    };
}

const policy = createRoomPolicy();
const media = Peer.createMediaRelay({lines: {cam: "video"}, videoHistory: 8, canWatch: policy.canWatch});
const host = Peer.createPeerHost({authorize: policy.authorize});

host.presence.changes.on(change => {
    console.log(`[conf] presence: ${change.account} ${change.online ? "online" : "offline"}`);
    if (change.online) return;
    // media BEFORE policy: relay.dropAccount closes watcher views through their
    // policy proxies, so the grants must still be alive while it runs (common2
    // 1.0.74 throws on already-revoked views — see peer-media-relay dropAccount)
    try { media.dropAccount(change.account); } catch (error) { console.log(`[conf] media drop ${change.account}: ${error}`); }
    policy.dropAccount(change.account);
});

const httpServer = createServer((_req, res) => { res.statusCode = 404; res.end("conference signaling server"); });
const ioServer = new SocketIOServer(httpServer, {cors: {origin: true}, maxHttpBufferSize: 1e7});

ioServer.on("connection", socket => {
    const account = String(socket.handshake.auth?.account ?? "anon");
    const peer = host.connection(account);
    const [disconnect, disconnectListen] = listen();
    socket.on("disconnect", () => { disconnect(); peer.close(); });
    createRpcServerAuto({
        socket: {emit: (key, data) => socket.emit(key, data), on: (key, cb) => socket.on(key, cb)},
        socketKey: "app",
        object: {
            serverTime: () => new Date().toISOString(),
            // the fragment is exposed verbatim: the browser's CallManager, peer-store
            // client and WebRTC connector all ride this one signal port over the socket
            peer: peer.fragment,
            media: {
                publish: media.publishOf(account),
                watch: media.watchOf(account),
            },
        },
        disconnectListen,
    });
    console.log(`[conf] ${account} connected`);
});

httpServer.listen(PORT, () => {
    console.log(`[conf] conference bridge is up on :${PORT}`);
    console.log("[conf] open the client page from the stand dev server, e.g.");
    console.log("  /doc/examples/conference-client.html?me=a&peers=b,c&host=1");
    console.log("  /doc/examples/conference-client.html?me=b&peers=a,c");
    console.log("  /doc/examples/conference-client.html?me=c&peers=a,b");
});
