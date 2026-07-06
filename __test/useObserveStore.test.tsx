import React, {useMemo, useState} from "react";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {ListenNext, ObserveAll2} from "wenay-common2";
import {
    useListenArgs,
    useListenValue,
    useStoreChangedPaths,
    useStoreKeys,
    useStoreMirror,
    useStoreNode,
    useStoreSelect,
    type RemoteStoreLike,
} from "../src/common/src/hooks/useObserveStore";

type LocalState = {
    count: number;
    meta: { status: string };
    items: Record<string, number>;
};

const localMask = {count: true, meta: {status: true}, items: {a: true}} as const;

function LocalStoreProbe() {
    const store = useMemo(() => ObserveAll2.createStore<LocalState>({
        count: 0,
        meta: {status: "idle"},
        items: {a: 1, b: 2},
    }), []);
    const count = useStoreNode<number>(store.node.at("count"));
    const status = useStoreNode(store.node.meta.status);
    const keys = useStoreKeys(store.node.items);
    const selection = useStoreSelect(useMemo(() => store.update(localMask), [store]), {drain: "micro"});
    const [emit, listen] = useMemo(() => ListenNext.UseListen<[number, string]>(), []);
    const listenArgs = useListenArgs(listen, {initial: [0, "initial"]});
    const listenValue = useListenValue<number, [number, string]>(listen, {initial: 0, map: n => n});

    return <div>
        <output data-testid="count">{count.value}</output>
        <output data-testid="status">{status.value}</output>
        <output data-testid="keys">{keys.stringKeys.join(",")}</output>
        <output data-testid="selection">{JSON.stringify(selection.value)}</output>
        <output data-testid="listen-args">{JSON.stringify(listenArgs)}</output>
        <output data-testid="listen-value">{listenValue}</output>
        <button onClick={() => count.replace((count.value ?? 0) + 1)}>count</button>
        <button onClick={() => status.replace("replace")}>replace status</button>
        <button onClick={() => { store.state.meta.status = "plain"; void ObserveAll2.flushReactive(store.state); }}>plain status</button>
        <button onClick={() => { store.state.items.c = 3; void ObserveAll2.flushReactive(store.state); }}>add key</button>
        <button onClick={() => { delete store.state.items.b; void ObserveAll2.flushReactive(store.state); }}>delete key</button>
        <button onClick={() => emit(7, status.value ?? "-")}>emit</button>
        <button onClick={() => store.replace({count: 0, meta: {status: "reset"}, items: {a: 1, b: 2}})}>replace store</button>
    </div>;
}

test("ObserveAll2 local hooks update leaf values, selections, object keys and listens", async () => {
    render(<LocalStoreProbe />);

    expect(screen.getByTestId("count").textContent).toBe("0");
    expect(screen.getByTestId("status").textContent).toBe("idle");
    expect(screen.getByTestId("keys").textContent).toBe("a,b");
    expect(screen.getByTestId("selection").textContent).toContain("\"a\":1");

    fireEvent.click(screen.getByText("count"));
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));

    fireEvent.click(screen.getByText("replace status"));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("replace"));

    fireEvent.click(screen.getByText("plain status"));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("plain"));

    fireEvent.click(screen.getByText("add key"));
    await waitFor(() => expect(screen.getByTestId("keys").textContent).toBe("a,b,c"));

    fireEvent.click(screen.getByText("delete key"));
    await waitFor(() => expect(screen.getByTestId("keys").textContent).toBe("a,c"));

    fireEvent.click(screen.getByText("emit"));
    await waitFor(() => expect(screen.getByTestId("listen-value").textContent).toBe("7"));
    expect(screen.getByTestId("listen-args").textContent).toContain("plain");

    fireEvent.click(screen.getByText("replace store"));
    await waitFor(() => expect(screen.getByTestId("keys").textContent).toBe("a,b"));
    expect(screen.getByTestId("count").textContent).toBe("0");
});

type MirrorState = {
    value: number;
    bag: Record<string, number>;
    deep: {
        level1: {
            level2: {
                leaf: string;
                counters: Record<string, number>;
            };
        };
    };
};

const mirrorMask = {value: true, bag: true, deep: {level1: {level2: {leaf: true, counters: true}}}} as const;
const inlineLeafMask = {value: true, deep: {level1: {level2: {leaf: true}}}} as const;
const mirrorInitial: MirrorState = {value: 0, bag: {}, deep: {level1: {level2: {leaf: "", counters: {}}}}};

function MirrorProbe({remote}: {remote: RemoteStoreLike<MirrorState>}) {
    const mirror = useStoreMirror<MirrorState, typeof mirrorMask>(remote, mirrorInitial, {mask: mirrorMask, current: true, drain: "micro"});
    const value = useStoreNode(mirror.store.node.value);
    const keys = useStoreKeys(mirror.store.node.bag);
    const deepLeaf = useStoreNode(mirror.store.node.deep.level1.level2.leaf);
    const deepKeys = useStoreKeys(mirror.store.node.deep.level1.level2.counters);
    const paths = useStoreChangedPaths(remote.changedPaths);

    return <div>
        <output data-testid="ready">{String(mirror.ready)}</output>
        <output data-testid="mirror-value">{value.value}</output>
        <output data-testid="mirror-keys">{keys.stringKeys.join(",")}</output>
        <output data-testid="deep-leaf">{deepLeaf.value}</output>
        <output data-testid="deep-keys">{deepKeys.stringKeys.join(",")}</output>
        <output data-testid="paths-count">{paths.count}</output>
        <output data-testid="paths">{JSON.stringify(paths.paths)}</output>
        <button onClick={() => mirror.stop()}>stop</button>
        <button onClick={() => { void mirror.sync(); }}>sync</button>
    </div>;
}

function InlineMaskProbe({remote}: {remote: RemoteStoreLike<MirrorState>}) {
    const [tick, setTick] = useState(0);
    const mirror = useStoreMirror<MirrorState, typeof inlineLeafMask>(remote, mirrorInitial, {
        mask: {value: true, deep: {level1: {level2: {leaf: true}}}} as typeof inlineLeafMask,
        current: true,
        drain: "micro",
    });
    const leaf = useStoreNode(mirror.store.node.deep.level1.level2.leaf);

    return <div>
        <output data-testid="inline-ready">{String(mirror.ready)}</output>
        <output data-testid="inline-leaf">{leaf.value}</output>
        <output data-testid="inline-tick">{tick}</output>
        <button onClick={() => setTick(v => v + 1)}>rerender</button>
    </div>;
}
function PartialToggleProbe({remote}: {remote: RemoteStoreLike<MirrorState>}) {
    const [partial, setPartial] = useState(true);
    const mirror = useStoreMirror<MirrorState, typeof mirrorMask>(remote, mirrorInitial, {
        mask: mirrorMask,
        current: true,
        drain: "micro",
        partial,
    });
    const value = useStoreNode(mirror.store.node.value);
    const deepKeys = useStoreKeys(mirror.store.node.deep.level1.level2.counters);

    return <div>
        <output data-testid="partial-ready">{String(mirror.ready)}</output>
        <output data-testid="partial-mode">{String(partial)}</output>
        <output data-testid="partial-value">{value.value}</output>
        <output data-testid="partial-deep-keys">{deepKeys.stringKeys.join(",")}</output>
        <button onClick={() => setPartial(false)}>full mode</button>
    </div>;
}

async function mutateRemote(store: ObserveAll2.Store<MirrorState>, fn: () => void) {
    await act(async () => {
        fn();
        await ObserveAll2.flushReactive(store.state);
    });
}

function createMirrorState(): MirrorState {
    return {
        value: 1,
        bag: {a: 1, b: 2},
        deep: {level1: {level2: {leaf: "one", counters: {x: 10, y: 20}}}},
    };
}

test("useStoreMirror uses changedPaths partial sync, follows remote deep add/delete keys, can stop and resync", async () => {
    const remoteStore = ObserveAll2.createStore<MirrorState>(createMirrorState());
    const exposed = ObserveAll2.exposeStore(remoteStore);
    const getMasks: any[] = [];
    const remote: RemoteStoreLike<MirrorState> = {
        ...exposed,
        get(mask?: any) {
            getMasks.push(mask);
            return exposed.get(mask as any) as any;
        },
    };

    render(<MirrorProbe remote={remote} />);

    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    expect(screen.getByTestId("mirror-value").textContent).toBe("1");
    expect(screen.getByTestId("mirror-keys").textContent).toBe("a,b");
    expect(screen.getByTestId("deep-leaf").textContent).toBe("one");
    expect(screen.getByTestId("deep-keys").textContent).toBe("x,y");
    expect(getMasks[0]).toEqual(mirrorMask);

    await mutateRemote(remoteStore, () => {
        remoteStore.state.value = 2;
        remoteStore.state.bag.c = 3;
    });
    await waitFor(() => expect(screen.getByTestId("mirror-value").textContent).toBe("2"));
    await waitFor(() => expect(screen.getByTestId("mirror-keys").textContent).toBe("a,b,c"));
    await waitFor(() => expect(Number(screen.getByTestId("paths-count").textContent)).toBeGreaterThan(0));
    expect(screen.getByTestId("paths").textContent).toContain("bag");
    expect(getMasks.at(-1)).not.toEqual(mirrorMask);

    await mutateRemote(remoteStore, () => {
        remoteStore.state.deep.level1.level2.leaf = "two";
        remoteStore.state.deep.level1.level2.counters.z = 30;
    });
    await waitFor(() => expect(screen.getByTestId("deep-leaf").textContent).toBe("two"));
    await waitFor(() => expect(screen.getByTestId("deep-keys").textContent).toBe("x,y,z"));
    expect(screen.getByTestId("paths").textContent).toContain("deep");
    expect(getMasks.at(-1)).not.toEqual(mirrorMask);

    await mutateRemote(remoteStore, () => {
        delete remoteStore.state.bag.b;
        delete remoteStore.state.deep.level1.level2.counters.y;
    });
    await waitFor(() => expect(screen.getByTestId("mirror-keys").textContent).toBe("a,c"));
    await waitFor(() => expect(screen.getByTestId("deep-keys").textContent).toBe("x,z"));

    fireEvent.click(screen.getByText("stop"));
    await mutateRemote(remoteStore, () => {
        remoteStore.state.value = 3;
        remoteStore.state.bag.d = 4;
        remoteStore.state.deep.level1.level2.leaf = "stopped";
    });
    expect(screen.getByTestId("mirror-value").textContent).toBe("2");
    expect(screen.getByTestId("mirror-keys").textContent).toBe("a,c");
    expect(screen.getByTestId("deep-leaf").textContent).toBe("two");

    fireEvent.click(screen.getByText("sync"));
    await waitFor(() => expect(screen.getByTestId("mirror-value").textContent).toBe("3"));
    await waitFor(() => expect(screen.getByTestId("mirror-keys").textContent).toBe("a,c,d"));
    await waitFor(() => expect(screen.getByTestId("deep-leaf").textContent).toBe("stopped"));
});

test("useStoreMirror falls back to full mask when changedPaths is absent", async () => {
    const remoteStore = ObserveAll2.createStore<MirrorState>(createMirrorState());
    const exposed = ObserveAll2.exposeStore(remoteStore);
    const getMasks: any[] = [];
    const remote: RemoteStoreLike<MirrorState> = {
        get(mask?: any) {
            getMasks.push(mask);
            return exposed.get(mask as any) as any;
        },
        changed: exposed.changed,
    };

    render(<MirrorProbe remote={remote} />);
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));

    await mutateRemote(remoteStore, () => {
        remoteStore.state.deep.level1.level2.counters.z = 30;
    });

    await waitFor(() => expect(screen.getByTestId("deep-keys").textContent).toBe("x,y,z"));
    expect(getMasks.at(-1)).toEqual(mirrorMask);
});

test("useStoreMirror restarts auto sync when partial option changes", async () => {
    const remoteStore = ObserveAll2.createStore<MirrorState>(createMirrorState());
    const exposed = ObserveAll2.exposeStore(remoteStore);
    const getMasks: any[] = [];
    const remote: RemoteStoreLike<MirrorState> = {
        ...exposed,
        get(mask?: any) {
            getMasks.push(mask);
            return exposed.get(mask as any) as any;
        },
    };

    render(<PartialToggleProbe remote={remote} />);
    await waitFor(() => expect(screen.getByTestId("partial-ready").textContent).toBe("true"));
    expect(getMasks[0]).toEqual(mirrorMask);

    await mutateRemote(remoteStore, () => {
        remoteStore.state.value = 2;
    });
    await waitFor(() => expect(screen.getByTestId("partial-value").textContent).toBe("2"));
    expect(getMasks.at(-1)).not.toEqual(mirrorMask);

    fireEvent.click(screen.getByText("full mode"));
    await waitFor(() => expect(screen.getByTestId("partial-mode").textContent).toBe("false"));
    await waitFor(() => expect(getMasks.at(-1)).toEqual(mirrorMask));

    await mutateRemote(remoteStore, () => {
        remoteStore.state.deep.level1.level2.counters.z = 30;
    });
    await waitFor(() => expect(screen.getByTestId("partial-deep-keys").textContent).toBe("x,y,z"));
    expect(getMasks.at(-1)).toEqual(mirrorMask);
});
test("useStoreMirror keeps an inline structurally equal mask from resyncing on rerender", async () => {
    const remoteStore = ObserveAll2.createStore<MirrorState>(createMirrorState());
    const exposed = ObserveAll2.exposeStore(remoteStore);
    const getMasks: any[] = [];
    const remote: RemoteStoreLike<MirrorState> = {
        ...exposed,
        get(mask?: any) {
            getMasks.push(mask);
            return exposed.get(mask as any) as any;
        },
    };

    render(<InlineMaskProbe remote={remote} />);
    await waitFor(() => expect(screen.getByTestId("inline-ready").textContent).toBe("true"));
    expect(screen.getByTestId("inline-leaf").textContent).toBe("one");
    expect(getMasks).toHaveLength(1);

    fireEvent.click(screen.getByText("rerender"));
    await waitFor(() => expect(screen.getByTestId("inline-tick").textContent).toBe("1"));
    expect(getMasks).toHaveLength(1);
});
