import {useEffect, useMemo, useState} from "react";
import {Peer} from "wenay-common2";

/** Thin React view over common2 Peer SDK. The SDK keeps route/repair ownership;
 * consumers use `store` with useStoreNode/useStoreKeys as usual. */
export function usePeer<T extends object>(client: Peer.PeerClient<T>, account: string) {
    const peer = useMemo(() => client.peer(account), [client, account]);
    const [epoch, setEpoch] = useState(0);
    const [ready, setReady] = useState(false);
    useEffect(() => {
        let alive = true;
        setReady(false);
        peer.ready.then(() => { if (alive) setReady(true); });
        const off = client.onRoute(() => setEpoch(v => v + 1));
        return () => { alive = false; off(); };
    }, [client, peer]);

    return useMemo(() => ({
        store: peer.store,
        ready,
        route: peer.route(),
        state: peer.state(),
        seq: peer.seq,
        promoteDirect: peer.promoteDirect,
        reinterposeRelay: peer.reinterposeRelay,
        fallback: peer.fallback,
        block: peer.block,
        resync: client.resync,
        close: peer.close,
    }), [client, peer, ready, epoch]);
}