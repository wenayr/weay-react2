import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Peer} from "wenay-common2";

export type PeerPresence = {account: string, online: boolean};

/** React binding for common2 host presence. Subscribe before list(): `changes` is the
 * authoritative edge stream and React does not create its own presence transport. */
export function usePeerPresence(presence: Peer.PeerRemote["presence"] | undefined) {
    const [accounts, setAccounts] = useState<string[]>([]);
    useEffect(() => {
        if (!presence) { setAccounts([]); return; }
        let alive = true;
        const off = presence.changes.on(({account, online}) => {
            if (!alive) return;
            setAccounts(current => online
                ? current.includes(account) ? current : [...current, account].sort()
                : current.filter(value => value !== account));
        });
        Promise.resolve(presence.list()).then(list => {
            if (alive) setAccounts([...new Set(list)].sort());
        });
        return () => { alive = false; off(); };
    }, [presence]);
    return useMemo(() => ({accounts, online: (account: string) => accounts.includes(account)}), [accounts]);
}

/** Thin UI binding over common2 CallManager. Signaling, busy/glare policy, timeout,
 * offline verdict and lifecycle ownership stay in common2; callers own manager.close(). */
export function usePeerCalls(manager: Peer.CallManager) {
    const calls = useRef(new Map<string, Peer.CallHandle>());
    const [version, setVersion] = useState(0);
    const touch = useCallback(() => setVersion(value => value + 1), []);
    useEffect(() => {
        let alive = true;
        const offs = new Map<string, () => void>();
        const watch = (call: Peer.CallHandle) => {
            if (calls.current.has(call.id)) return;
            calls.current.set(call.id, call);
            offs.set(call.id, call.changed.on(touch));
            void call.ended.then(() => {
                offs.get(call.id)?.();
                offs.delete(call.id);
                calls.current.delete(call.id);
                if (alive) touch();
            });
            touch();
        };
        const offRings = manager.rings.on(watch);
        void manager.ready.then(() => { if (alive) touch(); });
        return () => {
            alive = false;
            offRings();
            offs.forEach(off => off());
            calls.current.clear();
        };
    }, [manager, touch]);
    const call = useCallback((account: string, meta?: unknown) => {
        const handle = manager.call(account, meta);
        // Outgoing calls do not arrive through `rings`; register them immediately.
        calls.current.set(handle.id, handle);
        const off = handle.changed.on(touch);
        void handle.ended.then(() => { off(); calls.current.delete(handle.id); touch(); });
        touch();
        return handle;
    }, [manager, touch]);
    return useMemo(() => {
        const known = [...calls.current.values()];
        return {
            ready: version > 0,
            active: manager.active(),
            rings: known.filter(handle => handle.state() === "ringing"),
            calls: known,
            call,
        };
    }, [manager, call, version]);
}