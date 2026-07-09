import React, {StrictMode, useRef, useState} from "react";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {Observe, Replay} from "wenay-common2";
import {useReplayRouteSubscribe, useStoreReplayEach, useStoreReplayRouteMirror} from "../src/common/src/hooks/useReplay";
import {useStoreNode} from "../src/common/src/hooks/useObserveStore";

type Rows = Record<string, {qty: number}>;
type RowsRemote = Replay.ReplayRemote<[Observe.StorePatch]>;

function EachFeedProbe({remote}: {remote: RowsRemote}) {
    const logRef = useRef<string[]>([]);
    const rowsRef = useRef<Rows>({});
    const [, setTick] = useState(0);
    const [enabled, setEnabled] = useState(true);
    const feed = useStoreReplayEach<Rows>(remote, (key, value) => {
        logRef.current.push(value === undefined ? `-${key}` : `${key}=${value.qty}`);
        if (value === undefined) delete rowsRef.current[key];
        else rowsRef.current[key] = value;
        setTick(t => t + 1);
    }, {enabled, drain: "micro"});

    return <div>
        <output data-testid="feed-ready">{String(feed.ready)}</output>
        <output data-testid="feed-rows">{Object.keys(rowsRef.current).sort().map(k => `${k}=${rowsRef.current[k].qty}`).join(" ")}</output>
        <output data-testid="feed-log">{logRef.current.join(" ")}</output>
        <output data-testid="feed-store">{Object.keys(feed.store.state).sort().join(",")}</output>
        <label>
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}/>
            feed enabled
        </label>
    </div>;
}

async function mutateServer<T extends object>(store: Observe.Store<T>, fn: () => void) {
    await act(async () => {
        fn();
        await Observe.flushReactive(store.state);
    });
}

test("useStoreReplayEach folds keyframe expansion, per-key updates, deletes and tail catch-up (StrictMode)", async () => {
    const server = Observe.createStore<Rows>({a: {qty: 1}, b: {qty: 2}});
    const exposed = Observe.exposeStoreReplay(server, {history: 64});

    render(<StrictMode><EachFeedProbe remote={exposed.api.replay}/></StrictMode>);

    // first delivery = the keyframe expanded per key (cold start is not a special case)
    await waitFor(() => expect(screen.getByTestId("feed-ready").textContent).toBe("true"));
    await waitFor(() => expect(screen.getByTestId("feed-rows").textContent).toBe("a=1 b=2"));

    // per-key update: deeper dirt (state.a.qty) reports 'a' once
    await mutateServer(server, () => { server.state.a.qty = 5; });
    await waitFor(() => expect(screen.getByTestId("feed-rows").textContent).toBe("a=5 b=2"));

    // key add + key delete
    await mutateServer(server, () => { server.state.c = {qty: 3}; });
    await waitFor(() => expect(screen.getByTestId("feed-rows").textContent).toBe("a=5 b=2 c=3"));
    await mutateServer(server, () => { delete server.state.b; });
    await waitFor(() => expect(screen.getByTestId("feed-rows").textContent).toBe("a=5 c=3"));
    expect(screen.getByTestId("feed-log").textContent).toContain("-b");

    // the mirror store is exposed for direct reads / extra subscriptions
    expect(screen.getByTestId("feed-store").textContent).toBe("a,c");

    // enabled off -> server mutates -> re-enable: catches up through the journal tail on top of kept state
    fireEvent.click(screen.getByText("feed enabled"));
    await mutateServer(server, () => { server.state.a.qty = 7; server.state.d = {qty: 4}; });
    expect(screen.getByTestId("feed-rows").textContent).toBe("a=5 c=3");
    fireEvent.click(screen.getByText("feed enabled"));
    await waitFor(() => expect(screen.getByTestId("feed-rows").textContent).toBe("a=7 c=3 d=4"));
});

type NumRemote = Replay.ReplayRemote<[number]>;

type World = {qty: number};
type WorldRemote = Replay.ReplayRemote<[Observe.StorePatch]>;

function failingRemote<Z extends any[]>(): Replay.ReplayRemote<Z> {
    const fail = () => { throw new Error("bad route"); };
    return {
        line: {on: () => () => {}},
        since: async () => fail(),
        keyframe: async () => fail(),
    };
}

function RouteProbe({remoteA, remoteB, bad}: {remoteA: NumRemote, remoteB: NumRemote, bad: NumRemote}) {
    const valuesRef = useRef<number[]>([]);
    const [, setTick] = useState(0);
    const route = useReplayRouteSubscribe(remoteA, value => {
        valuesRef.current.push(value);
        setTick(v => v + 1);
    }, {label: "relay"});

    return <div>
        <output data-testid="route-ready">{String(route.ready)}</output>
        <output data-testid="route-active">{String(route.active())}</output>
        <output data-testid="route-label">{route.label() ?? "-"}</output>
        <output data-testid="route-phase">{route.route?.phase ?? "-"}</output>
        <output data-testid="route-error">{route.error instanceof Error ? route.error.message : String(route.error ?? "")}</output>
        <output data-testid="route-values">{valuesRef.current.join(",")}</output>
        <button onClick={() => { void route.switchRoute(remoteB, {label: "direct"}).catch(() => {}); }}>switch direct</button>
        <button onClick={() => { void route.switchRoute(bad, {label: "bad"}).catch(() => {}); }}>switch bad</button>
    </div>;
}

function StoreRouteProbe({remoteA, remoteB, bad}: {remoteA: WorldRemote, remoteB: WorldRemote, bad: WorldRemote}) {
    const mirror = useStoreReplayRouteMirror<World>(remoteA, {qty: 0}, {label: "relay"});
    const qty = useStoreNode(mirror.store.node.qty);

    return <div>
        <output data-testid="store-route-ready">{String(mirror.ready)}</output>
        <output data-testid="store-route-label">{mirror.label() ?? "-"}</output>
        <output data-testid="store-route-error">{mirror.error instanceof Error ? mirror.error.message : String(mirror.error ?? "")}</output>
        <output data-testid="store-route-qty">{qty.value}</output>
        <button onClick={() => { void mirror.switchRoute(remoteB, {label: "direct"}).catch(() => {}); }}>store switch direct</button>
        <button onClick={() => { void mirror.switchRoute(bad, {label: "bad"}).catch(() => {}); }}>store switch bad</button>
    </div>;
}

test("useReplayRouteSubscribe switches routes explicitly and keeps old route after failed replacement", async () => {
    let last = 0;
    const [emit, replay] = Replay.replayListen<[number]>({history: 64, current: () => [last]});
    const remoteA = Replay.exposeReplay(replay);
    const remoteB = Replay.exposeReplay(replay);
    const bad = failingRemote<[number]>();

    const view = render(<StrictMode><RouteProbe remoteA={remoteA} remoteB={remoteB} bad={bad}/></StrictMode>);

    await waitFor(() => expect(screen.getByTestId("route-ready").textContent).toBe("true"));
    await waitFor(() => expect(screen.getByTestId("route-values").textContent).toBe("0"));

    await act(async () => { last = 1; emit(1); });
    await waitFor(() => expect(screen.getByTestId("route-values").textContent).toBe("0,1"));

    fireEvent.click(screen.getByText("switch direct"));
    await waitFor(() => expect(screen.getByTestId("route-label").textContent).toBe("direct"));
    await waitFor(() => expect(screen.getByTestId("route-phase").textContent).toBe("ready"));

    await act(async () => { last = 2; emit(2); });
    await waitFor(() => expect(screen.getByTestId("route-values").textContent).toBe("0,1,2"));

    fireEvent.click(screen.getByText("switch bad"));
    await waitFor(() => expect(screen.getByTestId("route-error").textContent).toContain("bad route"));
    expect(screen.getByTestId("route-label").textContent).toBe("direct");
    expect(screen.getByTestId("route-active").textContent).toBe("true");

    await act(async () => { last = 3; emit(3); });
    await waitFor(() => expect(screen.getByTestId("route-values").textContent).toBe("0,1,2,3"));

    view.unmount();
    await waitFor(() => expect((remoteB.line as any).count()).toBe(0));
});

test("useStoreReplayRouteMirror switches store replay routes and converges after failed replacement", async () => {
    const server = Observe.createStore<World>({qty: 1});
    const exposed = Observe.exposeStoreReplay(server, {history: 64});
    const remoteA = exposed.api.replay;
    const remoteB = exposed.api.replay;
    const bad = failingRemote<[Observe.StorePatch]>();

    render(<StrictMode><StoreRouteProbe remoteA={remoteA} remoteB={remoteB} bad={bad}/></StrictMode>);

    await waitFor(() => expect(screen.getByTestId("store-route-ready").textContent).toBe("true"));
    await waitFor(() => expect(screen.getByTestId("store-route-qty").textContent).toBe("1"));

    await mutateServer(server, () => { server.state.qty = 2; });
    await waitFor(() => expect(screen.getByTestId("store-route-qty").textContent).toBe("2"));

    fireEvent.click(screen.getByText("store switch direct"));
    await waitFor(() => expect(screen.getByTestId("store-route-label").textContent).toBe("direct"));

    await mutateServer(server, () => { server.state.qty = 3; });
    await waitFor(() => expect(screen.getByTestId("store-route-qty").textContent).toBe("3"));

    fireEvent.click(screen.getByText("store switch bad"));
    await waitFor(() => expect(screen.getByTestId("store-route-error").textContent).toContain("bad route"));
    expect(screen.getByTestId("store-route-label").textContent).toBe("direct");

    await mutateServer(server, () => { server.state.qty = 4; });
    await waitFor(() => expect(screen.getByTestId("store-route-qty").textContent).toBe("4"));
});
