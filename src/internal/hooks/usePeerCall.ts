import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import * as Peer from "wenay-common2/peer";

export type PeerPresence = {account: string, online: boolean};

/** React binding for common2 host presence. Subscribe before list(): `changes` is the
 * authoritative edge stream and React does not create its own presence transport. */
export function usePeerPresence(presence: Peer.PeerRemote["presence"] | undefined) {
    const [accounts, setAccounts] = useState<string[]>([]);
    useEffect(() => {
        if (!presence) { setAccounts([]); return; }
        let alive = true;
        const edges = new Map<string, boolean>();
        setAccounts([]);
        const off = presence.changes.on(({account, online}) => {
            if (!alive) return;
            // Keep edges received while list() is in flight. A late snapshot is older
            // than those events and must be reconciled rather than overwrite them.
            edges.set(account, online);
            setAccounts(current => online
                ? current.includes(account) ? current : [...current, account].sort()
                : current.filter(value => value !== account));
        });
        void Promise.resolve()
            .then(() => presence.list())
            .then(list => {
                if (!alive) return;
                const current = new Set(list);
                for (const [account, online] of edges) {
                    if (online) current.add(account);
                    else current.delete(account);
                }
                setAccounts([...current].sort());
            }, () => {
                // Presence has no error field in this compatibility API. Keep the
                // authoritative edges already observed and consume list rejections.
            });
        return () => { alive = false; off(); };
    }, [presence]);
    return useMemo(() => ({accounts, online: (account: string) => accounts.includes(account)}), [accounts]);
}

/** Thin UI binding over common2 CallManager. Signaling, busy/glare policy, timeout,
 * offline verdict and lifecycle ownership stay in common2; callers own manager.close(). */
export function usePeerCalls(manager: Peer.CallManager) {
    const calls = useRef(new Map<string, Peer.CallHandle>());
    const callOffs = useRef(new Map<string, () => void>());
    const registerRef = useRef<((call: Peer.CallHandle) => void) | null>(null);
    const aliveRef = useRef(false);
    const [version, setVersion] = useState(0);
    const [readiness, setReadiness] = useState(() => ({manager, ready: false}));
    // Effects reset the state after commit. The identity tag also makes the very first
    // render with a replacement manager synchronously false instead of leaking old readiness.
    const ready = readiness.manager === manager && readiness.ready;
    const touch = useCallback(() => {
        if (aliveRef.current) setVersion(value => value + 1);
    }, []);
    useEffect(() => {
        let active = true;
        const publishReady = (next: boolean) => setReadiness(current =>
            current.manager === manager && current.ready === next
                ? current
                : {manager, ready: next}
        );
        aliveRef.current = true;
        publishReady(false);
        // A manager replacement must not render handles owned by the previous manager.
        calls.current.clear();
        callOffs.current.forEach(off => off());
        callOffs.current.clear();
        setVersion(value => value + 1);

        const register = (call: Peer.CallHandle) => {
            if (!active) return;
            if (calls.current.has(call.id)) return;
            calls.current.set(call.id, call);
            callOffs.current.set(call.id, call.changed.on(() => {
                if (active && calls.current.get(call.id) === call) touch();
            }));
            const finish = () => {
                // A previous manager may settle after its replacement has reused the id.
                // Its cleanup must never remove the replacement manager's live handle.
                if (calls.current.get(call.id) !== call) return;
                callOffs.current.get(call.id)?.();
                callOffs.current.delete(call.id);
                const removed = calls.current.delete(call.id);
                if (active && removed) touch();
            };
            // `ended` is a lifecycle signal, not an error surface for React. Handle both
            // outcomes so a transport-side rejection cannot become an unhandled promise.
            void call.ended.then(finish, finish);
            touch();
        };
        registerRef.current = register;
        const offRings = manager.rings.on(register);
        // Readiness belongs only to manager.ready; call/ring changes must not imply it.
        void manager.ready.then(
            () => { if (active) publishReady(true); },
            () => { if (active) publishReady(false); },
        );
        return () => {
            active = false;
            aliveRef.current = false;
            if (registerRef.current === register) registerRef.current = null;
            offRings();
            callOffs.current.forEach(off => off());
            callOffs.current.clear();
            calls.current.clear();
        };
    }, [manager, touch]);
    const call = useCallback((account: string, meta?: unknown) => {
        const handle = manager.call(account, meta);
        // Outgoing calls do not arrive through `rings`; register them immediately.
        registerRef.current?.(handle);
        return handle;
    }, [manager]);
    return useMemo(() => {
        const known = [...calls.current.values()];
        return {
            ready,
            active: manager.active(),
            rings: known.filter(handle => handle.state() === "ringing"),
            calls: known,
            call,
        };
    }, [manager, call, ready, version]);
}
