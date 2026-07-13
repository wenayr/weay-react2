import {useEffect, useMemo, useState} from "react";
import {Replay} from "wenay-common2";

export type RouteLogEntry = {at: number, from: Replay.tRouteState, to: Replay.tRouteState, reason?: unknown};

/** React binding for one route-coordinator link: live route state, the last denial or
 * failure reason, connector metrics on a 500ms snapshot, and a short hand-off log.
 * Route ownership stays in common2 — the hook only mirrors coordinator events; callers
 * own coordinator/link lifecycle (close), exactly like usePeerCalls over CallManager. */
export function useRouteState<Z extends any[]>(
    coordinator: Pick<Replay.RouteCoordinator<Z>, "onRoute"> | null,
    link: Pick<Replay.RouteLink<Z>, "ref" | "state" | "reason" | "metrics"> | null,
) {
    const [state, setState] = useState<Replay.tRouteState>(() => link?.state() ?? "closed");
    const [reason, setReason] = useState<unknown>(() => link?.reason());
    const [metrics, setMetrics] = useState<ReturnType<Replay.RouteLink<Z>["metrics"]> | null>(() => link?.metrics() ?? null);
    const [log, setLog] = useState<RouteLogEntry[]>([]);
    useEffect(() => {
        if (!coordinator || !link) return;
        setState(link.state());
        setReason(link.reason());
        setMetrics(link.metrics());
        setLog([]);
        const off = coordinator.onRoute(event => {
            if (event.key !== link.ref.key) return;
            setState(event.to);
            setReason(event.reason);
            setMetrics(link.metrics());
            setLog(current => [...current.slice(-3), {at: Date.now(), from: event.from, to: event.to, reason: event.reason}]);
        });
        const timer = setInterval(() => setMetrics(link.metrics()), 500);
        return () => { off(); clearInterval(timer); };
    }, [coordinator, link]);
    return useMemo(() => ({state, reason, metrics, log}), [state, reason, metrics, log]);
}
