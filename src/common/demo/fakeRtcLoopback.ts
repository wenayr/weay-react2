/**
 * In-process fake WebRTC runtime for the conference demo and its tests, ported from
 * the wenay-common2 acceptance oracle (replay/route-webrtc.test.ts). SDP = pc id,
 * ICE trickle is simulated, a datachannel is a pair of in-proc endpoints. It is
 * injected exactly like a browser would inject `() => new RTCPeerConnection(cfg)`,
 * so the demo can run where real WebRTC is unavailable (jsdom, sandboxed panes).
 */
import {Replay} from "wenay-common2";

type PendingDc = {attach: (a: Replay.RtcDataChannel | null) => void, fireOpen: () => void};
type FakePc = {
    id: string;
    local: Replay.RtcSessionDescription | null;
    remote: Replay.RtcSessionDescription | null;
    pendingDcs: PendingDc[];
    linked: boolean;
    pc: Replay.RtcPeerConnection;
};

export function createFakeRtcNet() {
    let n = 0;
    const pcs = new Map<string, FakePc>();
    const stats = {ice: 0, channels: 0};
    const liveChannels = new Set<Replay.RtcDataChannel>();

    function makeDcPair(): [Replay.RtcDataChannel, Replay.RtcDataChannel] {
        let closed = false;
        function side(other: () => any): Replay.RtcDataChannel {
            const me: any = {onopen: null, onmessage: null, onclose: null, onerror: null};
            me.send = (data: string) => {
                if (closed) return;
                setTimeout(function deliverDc() { if (!closed) other().onmessage?.({data}); }, 0);
            };
            me.close = () => {
                if (closed) return;
                closed = true;
                liveChannels.delete(me);
                setTimeout(function closeDc() { me.onclose?.(); other().onclose?.(); }, 0);
            };
            return me;
        }
        let a: any, b: any;
        a = side(() => b);
        b = side(() => a);
        liveChannels.add(a);
        return [a, b];
    }

    function tryConnect(me: FakePc) {
        if (!me.local || !me.remote) return;
        const other = pcs.get(me.remote.sdp ?? "");
        if (!other || !other.local || !other.remote || other.remote.sdp !== me.id) return;
        const initiator = me.pendingDcs.length ? me : other;
        const responder = initiator === me ? other : me;
        if (!initiator.pendingDcs.length || initiator.linked) return;
        initiator.linked = responder.linked = true;
        for (const dc of initiator.pendingDcs) {
            const [a, b] = makeDcPair();
            // the pre-created local end is linked to its newborn twin
            dc.attach(a);
            stats.channels++;
            setTimeout(function announceChannel() {
                responder.pc.ondatachannel?.({channel: b});
                dc.fireOpen();
            }, 0);
        }
        initiator.pendingDcs = [];
    }

    function pc(): Replay.RtcPeerConnection {
        const id = "sdp-" + (++n);
        const me: FakePc = {id, local: null, remote: null, pendingDcs: [], linked: false, pc: null as any};
        const api: Replay.RtcPeerConnection = {
            createDataChannel() {
                // the local end exists BEFORE the connection: methods delegate after attach
                let real: Replay.RtcDataChannel | null = null;
                const shell: any = {onopen: null, onmessage: null, onclose: null, onerror: null};
                shell.send = (data: string) => real?.send(data);
                shell.close = () => real?.close();
                me.pendingDcs.push({
                    attach(a) {
                        real = a;
                        if (!a) return;
                        a.onmessage = (ev: {data: unknown}) => shell.onmessage?.(ev);
                        a.onclose = () => shell.onclose?.();
                    },
                    fireOpen() { shell.onopen?.(); },
                });
                return shell;
            },
            createOffer: async () => ({type: "offer", sdp: id}),
            createAnswer: async () => ({type: "answer", sdp: id}),
            setLocalDescription(d) {
                me.local = d;
                setTimeout(function trickleIce() { api.onicecandidate?.({candidate: {via: id}}); }, 0);
            },
            setRemoteDescription(d) {
                me.remote = d;
                tryConnect(me);
            },
            addIceCandidate() { stats.ice++; },
            close() {
                for (const dc of me.pendingDcs) dc.attach(null);
                me.pendingDcs = [];
            },
            onicecandidate: null,
            ondatachannel: null,
        };
        me.pc = api;
        pcs.set(id, me);
        return api;
    }

    /** The "kill direct transport" drill: closing a live end fires onclose on both
     *  sides, which the webrtc connector reports as a transport failure. */
    function killLiveChannels() {
        const doomed = [...liveChannels];
        for (const dc of doomed) dc.close();
        return doomed.length;
    }

    return {pc, stats, killLiveChannels};
}

export type FakeRtcNet = ReturnType<typeof createFakeRtcNet>;
