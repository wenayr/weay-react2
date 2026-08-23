import React, { useState, useMemo, useEffect } from "react";
import { useStoreMirror, useStoreNode, useStoreKeys, useStoreSelect, useStoreChangedPaths, useListenEffect, useListenArgs, useListenValue, useAiRunClient, useFileJobClient, useContractSlot } from "../../api.js";
import { listen as createListen } from "wenay-common2/client";
import * as Contract from "wenay-common2/contract";
import * as Observe from "wenay-common2/observe";
import type * as Ai from "wenay-common2/ai";
import type * as Resource from "wenay-common2/resource";
import { ReplayVideoDemo, ReplayRouteDemo, ReplayStoreDemo, ReplayStoreEachDemo } from "../replayVideo.js";
import { Check, ShowcasePanel, ExampleCode, DemoHint } from "../standKit.js";


/* ---------- 48. common2 AI run client: React observes Store + semantic Replay ---------- */
// Lazy: the Observe stores and semantic-event listener are created on first render,
// so importing this module does not spin up runtime stores. The cached singleton keeps
// stable references across renders (the hooks depend on identity).
let qaAiCache: ReturnType<typeof buildQaAi> | null = null;
function buildQaAi() {
    const qaAiStore = Observe.createStore<Ai.AiRunStore>({runs: {}, approvals: {}, inputs: {}});
    const [emitQaAiEvent, qaAiEvents] = createListen<[Ai.AiRunEvent]>();
    const qaAiClient = {store: qaAiStore, events: qaAiEvents, ready: Promise.resolve()} as unknown as Ai.AiRunClient;
    const qaFileStore = Observe.createStore<Resource.FileJobStore>({files: {}, jobs: {}});
    const qaFileClient = {store: qaFileStore, ready: Promise.resolve()} as unknown as Resource.FileJobClient;
    return {qaAiStore, emitQaAiEvent, qaAiClient, qaFileStore, qaFileClient};
}
const qaAi = () => qaAiCache ??= buildQaAi();

const AiRunClientDemo = () => {
    const {qaAiStore, emitQaAiEvent, qaAiClient, qaFileStore, qaFileClient} = qaAi();
    const ai = useAiRunClient(qaAiClient);
    const files = useFileJobClient(qaFileClient);
    const run = ai.runs["qa-ai"];
    async function start() {
        const now = Date.now();
        qaAiStore.state.runs["qa-ai"] = {
            id: "qa-ai", owner: "qa", requestId: "qa-request", kind: "assistant", resourceIds: [],
            state: "running", progress: 20, message: "Собираю ответ", artifacts: [], createdAt: now, updatedAt: now,
        };
        await Observe.flushReactive(qaAiStore.state);
        emitQaAiEvent({type: "started", runId: "qa-ai"});
    }
    async function finish() {
        const liveRun = qaAiStore.state.runs["qa-ai"];
        if (!liveRun) return;
        liveRun.state = "completed";
        liveRun.progress = 100;
        liveRun.result = {summary: "Готово"};
        liveRun.updatedAt = Date.now();
        await Observe.flushReactive(qaAiStore.state);
        emitQaAiEvent({type: "completed", runId: "qa-ai", result: liveRun.result});
    }
    async function completeFileJob() {
        const now = Date.now();
        qaFileStore.state.files["qa-file"] = {id: "qa-file", owner: "qa", name: "report.csv", size: 2048, mime: "text/csv", state: "uploaded", createdAt: now, updatedAt: now};
        qaFileStore.state.jobs["qa-job"] = {id: "qa-job", fileId: "qa-file", owner: "qa", state: "ready", progress: 100, createdAt: now, updatedAt: now};
        await Observe.flushReactive(qaFileStore.state);
    }
    return <div className="wenayQaShowcaseGrid">
        <ShowcasePanel eyebrow="LIVE STATE" title="React показывает уже созданный workflow-клиент" tone="green">
            <DemoHint>Сценарий имитирует локальный Store и semantic Replay; реальный runner и RPC остаются за границей React.</DemoHint>
            <div className="wenayQaActionRow">
                <button onClick={start}>1. Начать AI-run</button>
                <button onClick={finish} disabled={!run || run.state === "completed"}>2. Завершить AI-run</button>
            </div>
            <div className="wenayQaMetricGrid">
                <span>ready <b>{String(ai.ready)}</b></span><span>state <b>{run?.state ?? "idle"}</b></span>
                <span>progress <b>{run?.progress ?? 0}%</b></span><span>event <b>{ai.lastEvent?.type ?? "—"}</b></span>
            </div>
            <div className="wenayQaWorkflowDivider" />
            <div className="wenayQaActionRow">
                <b style={{fontSize: 13}}>Файл + job</b>
                <button onClick={completeFileJob}>Завершить upload/job</button>
            </div>
            <div className="wenayQaMetricGrid"><span>file <b>{files.files["qa-file"]?.state ?? "idle"}</b></span><span>job <b>{files.jobs["qa-job"]?.state ?? "idle"}</b></span><span>progress <b>{files.jobs["qa-job"]?.progress ?? 0}%</b></span></div>
        </ShowcasePanel>
        <ShowcasePanel eyebrow="OWNERSHIP" title="Клиент создаётся у RPC-границы, hook — только view" tone="blue">
            <ExampleCode>{`
// application boundary, outside React
const aiClient = Ai.createAiRunClient({remote: rpc.func.ai})
const fileClient = Resource.createFileJobClient({remote: rpc.func.files})

function AssistantPanel() {
  const ai = useAiRunClient(aiClient)
  const files = useFileJobClient(fileClient)
  return <RunState runs={ai.runs} files={files.files} />
}`}</ExampleCode>
            <div className="wenayQaMiniChecklist">
                <span>✓ Store, ready и AI semantic event</span>
                <span>✓ Без raw prompt в React state</span>
                <span>✓ Provider, ACL, storage и retry — ответственность приложения</span>
            </div>
        </ShowcasePanel>
    </div>;
};

/* ---------- 50. common2 Contract runtime: React observes one stable slot ---------- */
type QaContractEditorApi = {format(value: string): string};

// Lazy: the contract runtime is created on first render instead of at import time.
let qaContractRuntimeCache: ReturnType<typeof Contract.createContractRuntime> | null = null;
const qaContractRuntime = () => qaContractRuntimeCache ??= Contract.createContractRuntime({drainTimeoutMs: 250});
const qaContractOffer = (
    id: string,
    implementationVersion: string,
    priority: number,
): Contract.ContractOffer<QaContractEditorApi> => ({
    id,
    priority,
    descriptor: {
        protocol: 1,
        contractId: "qa.editor",
        contractVersion: "1.0.0",
        implementationId: "qa-editor",
        implementationVersion,
        capabilities: ["format"],
    },
    open: () => ({
        api: {format: value => `${implementationVersion}: ${value}`},
        close() {},
    }),
});
const qaContractV1 = qaContractOffer("qa.editor.v1", "v1", 10);
const qaContractV2 = qaContractOffer("qa.editor.v2", "v2", 20);
const qaContractDemand: Contract.ContractDemand = {
    slotId: "main.editor",
    contractId: "qa.editor",
    versionRange: "1.0.0",
    generation: 1,
    authorityId: "qa-backend",
    authorityEpoch: 1,
    required: true,
    capabilities: ["format"],
};

const ContractRuntimeDemo = () => {
    const runtime = qaContractRuntime();
    const slot = useContractSlot(runtime, qaContractDemand.slotId);
    const [result, setResult] = useState("—");
    const [v2Added, setV2Added] = useState(false);
    const [v2Revoked, setV2Revoked] = useState(false);
    const [actionError, setActionError] = useState("");
    const run = (action: () => Promise<void>) => {
        setActionError("");
        void action().catch(error => setActionError(String(error?.message ?? error)));
    };
    const startV1 = () => run(async () => {
        await runtime.control.addOffer(qaContractV1);
        await runtime.control.require(qaContractDemand);
    });
    const addV2 = () => run(async () => {
        await runtime.control.addOffer(qaContractV2);
        setV2Added(true);
        setV2Revoked(false);
    });
    const toggleV2 = () => run(async () => {
        if (v2Revoked) {
            await runtime.control.restoreOffer(qaContractV2.id);
            setV2Revoked(false);
        } else {
            await runtime.control.revokeOffer(qaContractV2.id, "QA revoke");
            setV2Revoked(true);
        }
    });
    const callActive = () => {
        try {
            const lease = slot.acquire<QaContractEditorApi>();
            try { setResult(lease.api.format("saved")); }
            finally { lease.release(); }
        } catch (error: any) {
            setActionError(String(error?.message ?? error));
        }
    };
    return <div className="wenayQaShowcaseGrid">
        <ShowcasePanel eyebrow="LIVE SLOT" title="Версия меняется, логический editor остаётся" tone="green">
            <DemoHint>Runtime создан вне React. Hook читает только status Store и binding events одного slot.</DemoHint>
            <div className="wenayQaActionRow">
                <button onClick={startV1}>1. Bind v1</button>
                <button onClick={addV2} disabled={v2Added}>2. Add preferred v2</button>
                <button onClick={toggleV2} disabled={!v2Added}>{v2Revoked ? "4. Restore v2" : "3. Revoke v2"}</button>
                <button onClick={callActive} disabled={!slot.binding}>Call through lease</button>
            </div>
            <div className="wenayQaMetricGrid">
                <span>state <b>{slot.state}</b></span>
                <span>implementation <b>{slot.binding?.descriptor.implementationVersion ?? "—"}</b></span>
                <span>binding generation <b>{slot.binding?.bindingGeneration ?? 0}</b></span>
                <span>last event <b>{slot.lastEvent?.reason ?? "—"}</b></span>
                <span>lease result <b>{result}</b></span>
                <span>history <b>{slot.history().length}</b></span>
            </div>
            <div className="wenayQaStatus">candidates: {slot.status.candidates.map(candidate => `${candidate.offerId}:${candidate.accepted ? "ok" : candidate.reason}`).join(" · ") || "—"}</div>
            {actionError && <div style={{color: "#cf222e"}}>{actionError}</div>}
        </ShowcasePanel>
        <ShowcasePanel eyebrow="OWNERSHIP" title="React не загружает и не переключает модули" tone="blue">
            <ExampleCode>{`
// application/loader boundary, outside React
const runtime = Contract.createContractRuntime({offers, policy})
await runtime.control.require(demand)

function EditorStatus() {
  const slot = useContractSlot(runtime, "main.editor")
  const save = async () => {
    const lease = slot.acquire<EditorApi>()
    try { await lease.api.save() }
    finally { lease.release() }
  }
  return <Status state={slot.state} binding={slot.binding} />
}`}</ExampleCode>
            <div className="wenayQaMiniChecklist">
                <span>✓ Prepare-before-switch и fallback остаются в common2</span>
                <span>✓ Store/replay живут вне сменяемой реализации</span>
                <span>✓ Hook не владеет runtime и не исполняет загруженный код</span>
            </div>
        </ShowcasePanel>
    </div>;
};

/* ---------- 18. Observe local store/listen hooks ---------- */
type tObserveLocalState = {
    count: number;
    meta: { status: string };
    items: Record<string, number>;
};

const observeLocalMask = { count: true, meta: { status: true }, items: { a: true } } as const;

const ObserveStoreLocalDemo = () => {
    const store = useMemo(() => Observe.createStore<tObserveLocalState>({
        count: 0,
        meta: { status: "idle" },
        items: { a: 1, b: 2 },
    }), []);
    const count = useStoreNode<number>(store.node.at("count"));
    const status = useStoreNode(store.node.meta.status);
    const itemKeys = useStoreKeys(store.node.items);
    const selection = useStoreSelect(useMemo(() => store.update(observeLocalMask), [store]), { drain: "micro" });
    const [emit, listen] = useMemo(() => createListen<[number, string]>(), []);
    const listenArgs = useListenArgs(listen, { initial: [0, "initial"] });
    const listenValue = useListenValue<number, [number, string]>(listen, { initial: 0, map: (n) => n });

    function mutatePlainState() {
        store.state.meta.status = "plain " + new Date().toLocaleTimeString();
        void Observe.flushReactive(store.state);
    }

    return <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => count.replace((count.value ?? 0) + 1)}>node.at("count") +1</button>
            <button onClick={() => status.replace("replace " + new Date().toLocaleTimeString())}>replace status</button>
            <button onClick={() => { store.state.items.c = Date.now(); void Observe.flushReactive(store.state); }}>add key c</button>
            <button onClick={() => { delete store.state.items.b; void Observe.flushReactive(store.state); }}>delete key b</button>
            <button onClick={mutatePlainState}>plain state mutation + flush</button>
            <button onClick={() => emit(Date.now(), status.value ?? "-")}>emit listen</button>
            <button onClick={() => store.replace({ count: 0, meta: { status: "reset" }, items: { a: 1, b: 2 } })}>replace whole store</button>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
            <span>count exists: <b>{String(count.exists)}</b></span>
            <span>count value: <b>{count.value}</b></span>
            <span>status: <b>{status.value}</b></span>
            <span>item keys: <b>{itemKeys.stringKeys.join(",")}</b></span>
            <span>listen value: <b>{listenValue}</b></span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <pre style={{ background: "#f6f8fa", padding: 8, borderRadius: 6, overflow: "auto", fontSize: 11 }}>selection\n{JSON.stringify(selection.value, null, 2)}</pre>
            <pre style={{ background: "#f6f8fa", padding: 8, borderRadius: 6, overflow: "auto", fontSize: 11 }}>listen args\n{JSON.stringify(listenArgs, null, 2)}</pre>
        </div>
    </div>;
};

/* ---------- 17. Observe store mirror hooks over HTTP/SSE ---------- */
type tObserveQaState = {
    value: number;
    nested: { label: string };
    updatedAt: string;
    events: number;
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

const observeMirrorMask = { value: true, nested: { label: true }, updatedAt: true, events: true, bag: true, deep: { level1: { level2: { leaf: true, counters: true } } } } as const;
const observeLabelMask = { nested: { label: true }, events: true } as const;

function createSseChangedListen(url: string) {
    const listeners = new Set<() => void>();
    let source: EventSource | null = null;

    function notify() {
        listeners.forEach(listener => listener());
    }

    function ensureSource() {
        if (source || typeof EventSource == "undefined") return;
        source = new EventSource(url);
        source.addEventListener("changed", notify);
        source.onerror = () => {
            // EventSource reconnects itself; the visible QA state comes from fetch errors/successes.
        };
    }

    return {
        on(cb: () => void) {
            listeners.add(cb);
            ensureSource();
            return () => {
                listeners.delete(cb);
                if (listeners.size == 0) {
                    source?.close();
                    source = null;
                }
            };
        },
    };
}


function createSseChangedPathsListen(url: string) {
    const listeners = new Set<(change: { paths: PropertyKey[][] }) => void>();
    let source: EventSource | null = null;

    function ensureSource() {
        if (source || typeof EventSource == "undefined") return;
        source = new EventSource(url);
        source.addEventListener("changedPaths", event => {
            const change = JSON.parse((event as MessageEvent).data) as { paths: PropertyKey[][] };
            listeners.forEach(listener => listener(change));
        });
        source.onerror = () => {};
    }

    return {
        on(cb: (change: { paths: PropertyKey[][] }) => void) {
            listeners.add(cb);
            ensureSource();
            return () => {
                listeners.delete(cb);
                if (listeners.size == 0) {
                    source?.close();
                    source = null;
                }
            };
        },
    };
}
async function postObserveMutation(body: object) {
    const res = await fetch("/__qa/observe-store/mutate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

const ObserveStoreMirrorDemo = () => {
    const remote = useMemo(() => {
        const changed = createSseChangedListen("/__qa/observe-store/events");
        const changedPaths = createSseChangedPathsListen("/__qa/observe-store/events-paths");
        return {
            changed,
            changedPaths,
            async get(mask?: any) {
                const url = new URL("/__qa/observe-store/get", window.location.origin);
                if (mask !== undefined) url.searchParams.set("mask", JSON.stringify(mask));
                const res = await fetch(url);
                if (!res.ok) throw new Error(await res.text());
                return res.json() as Promise<tObserveQaState>;
            },
        };
    }, []);
    const initial = useMemo<tObserveQaState>(() => ({
        value: 0,
        nested: { label: "client initial" },
        updatedAt: "",
        events: 0,
        bag: {},
        deep: { level1: { level2: { leaf: "client deep initial", counters: {} } } },
    }), []);
    const mirror = useStoreMirror<tObserveQaState, typeof observeMirrorMask>(remote, initial, { mask: observeMirrorMask, current: true, drain: 50 });
    const value = useStoreNode(mirror.store.node.value);
    const label = useStoreNode(mirror.store.node.nested.label);
    const bagKeys = useStoreKeys(mirror.store.node.bag);
    const deepLeaf = useStoreNode(mirror.store.node.deep.level1.level2.leaf);
    const deepCounterKeys = useStoreKeys(mirror.store.node.deep.level1.level2.counters);
    const labelSelection = useStoreSelect(useMemo(() => mirror.store.update(observeLabelMask), [mirror.store]), { drain: 50 });
    const pathEvents = useStoreChangedPaths(remote.changedPaths);
    const [pushes, setPushes] = useState(0);
    const [lastPost, setLastPost] = useState("-");

    useListenEffect(remote.changed, () => setPushes(v => v + 1));

    async function mutate(body: object) {
        setLastPost("posting...");
        try {
            const data = await postObserveMutation(body);
            setLastPost(JSON.stringify(data));
        } catch (e) {
            setLastPost(String(e));
        }
    }

    return <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => mutate({ type: "inc" })}>server +1</button>
            <button onClick={() => mutate({ type: "label", label: "srv " + new Date().toLocaleTimeString() })}>server label</button>
            <button onClick={() => mutate({ type: "bag-add", key: "c", value: Date.now() })}>server add key c</button>
            <button onClick={() => mutate({ type: "bag-delete", key: "b" })}>server delete key b</button>
            <button onClick={() => mutate({ type: "deep-leaf", value: "deep " + new Date().toLocaleTimeString() })}>server deep leaf</button>
            <button onClick={() => mutate({ type: "deep-add", key: "z", value: Date.now() })}>server deep add z</button>
            <button onClick={() => mutate({ type: "deep-delete", key: "y" })}>server deep delete y</button>
            <button onClick={() => mutate({ type: "reset" })}>server reset</button>
            <button onClick={() => value.replace((value.value ?? 0) + 1000)}>local mirror +1000</button>
            <button onClick={() => mirror.sync()}>manual sync</button>
            <button onClick={() => mirror.stop()}>stop sync</button>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
            <span>ready: <b>{String(mirror.ready)}</b></span>
            <span>syncing: <b>{String(mirror.syncing)}</b></span>
            <span>SSE pushes: <b>{pushes}</b></span>
            <span>path pushes: <b>{pathEvents.count}</b></span>
            <span>node value: <b>{value.value}</b></span>
            <span>node label: <b>{label.value}</b></span>
            <span>bag keys: <b>{bagKeys.stringKeys.join(",")}</b></span>
            <span>deep leaf: <b>{deepLeaf.value}</b></span>
            <span>deep keys: <b>{deepCounterKeys.stringKeys.join(",")}</b></span>
        </div>
        {mirror.error != null && <div style={{ color: "#cf222e" }}>error: {String(mirror.error)}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <pre style={{ background: "#f6f8fa", padding: 8, borderRadius: 6, overflow: "auto", fontSize: 11 }}>mirror.value\n{JSON.stringify(mirror.value, null, 2)}</pre>
            <pre style={{ background: "#f6f8fa", padding: 8, borderRadius: 6, overflow: "auto", fontSize: 11 }}>label selection\n{JSON.stringify(labelSelection.value, null, 2)}\n\nchanged paths\n{JSON.stringify(pathEvents.paths)}\n\nlast POST\n{lastPost}</pre>
        </div>
    </div>;
};


/* ---------- card wrappers ---------- */

export function Card18() {
    return (
    <Check n={18} title="Observe hooks - local store and listen"
                       do="Click node.at(count) +1, replace status, plain state mutation + flush, emit listen, and replace whole store."
                       expect="Leaf node, selection, direct state mutation after flush, add/delete object keys, and listen hooks all rerender. The count key is read through node.at(count), so it does not conflict with node.count()."
                       note="This isolates the React adapter from transport: no fetch/SSE/RPC involved."
                       tall>
                    <ObserveStoreLocalDemo />
                </Check>
    );
}

export function Card17() {
    return (
    <Check n={17} title="Observe hooks - store mirror over HTTP/SSE"
                       do="Click server +1, label, add/delete key, deep leaf/deep add/deep delete, local mirror +1000, stop sync, then manual sync."
                       expect="Server buttons POST to the Vite QA server, including add/delete object keys and deep mutations. SSE pushes changedPaths; mirror pulls only the intersecting mask when possible. Local mirror edits render immediately and are overwritten by the next server sync."
                       note="This checks the React adapter only in wenay-react2: common2 remains React-free; transport policy stays outside the hook."
                       tall>
                    <ObserveStoreMirrorDemo />
                </Check>
    );
}

export function Card23() {
    return (
    <Check n={23} title="Replay hooks - video line, conflation, time travel, freshness"
                       do="Watch A and B play the same synthetic video. Toggle slow network for B, switch resolution, unmount/remount A. In C drag the slider (playback pauses), then press live. In D: note the renders counter while the line is fresh, check stall producer, wait 2s, uncheck; while stalled press new client (keyframe). In E: switch pull pace (250ms/1s/3s), press pull now."
                       expect="A plays smoothly at 10 fps. B on slow network stays CURRENT (bounded latency): frames drop (dropped/coalesced counters grow), the wire buffer never grows past highWater, and each recovery is one coalesced last-frame envelope. Resolution switches on all clients within a frame. Remounting A continues from the kept seq (seq does not reset, frames counter continues from the tail). C seeks to any archived seq via keyframe+tail fold and hands over to live seamlessly. D: renders stays FLAT while frames grow (no per-event re-renders); on stall the STALE badge appears after ~2s and disappears on the first frame after resume; a client mounted during a stall goes STALE within staleMs (this in-proc keyframe is stamped at request time; a tail/keyframe carrying an old producer ts goes stale from the first paint); StrictMode double-effect leaves one watchdog and no badge flicker. E advances ONLY at the pull cadence: frames jumps by ~pace×10fps per pull while pulls grows by one; seq keeps up with head; switching pace keeps the position (no keyframe restart, frames does not re-fold); pull now folds immediately."
                       note="All in-proc: the socket transport is already proven in wenay-common2 (replay/video-socket.demo, canvas-socket.test). This card tests the React side: useReplaySubscribe lifecycle (off on unmount, reconnect by since), useReplayHistory scrubber, frames drawn to canvas via ref - bypassing VDOM, stale/staleMs mirroring common2's edge-triggered watchdog into React state, useReplayFrame pull path (timer around remote.frame(), rev2 frame model; policy:'frame'/hint ride ReplaySubscribeOpts but need a server frameLine - the wire test lives in common2 replay/rpc-auto.test.ts). The producer starts on first render and runs until page reload."
                       tall>
                    <ReplayVideoDemo />
                </Check>
    );
}

export function Card24() {
    return (
    <Check n={24} title="Replay hooks - store sync (useStoreReplayMirror)"
                       do="Watch ticks/price advance. Click server note / add key / delete key. Uncheck sync enabled, mutate the server a few times, recheck. Click restart. Check stall producer, wait 2.5s, then click server note."
                       expect="Mirror follows the server store with seq ascending over Store Replay V2. The batches counter grows once per physical V2 envelope. While sync is disabled the mirror freezes; on re-enable it catches up through the V2 journal tail (seq jumps to head, no reset flicker). Object key add/delete replicate. restart resubscribes from the kept seq. On stall the stale flag flips true after 2.5s and lastTs freezes; any server mutation flips it back to fresh."
                       note="wenay-common2 2.0.0 exposes one JSON Store Replay V2 facade directly at api.replay. Legacy single-patch replay, numbered codecs, negotiation and RPB binary wires were removed. useStoreReplayMirror keeps the same React lifecycle and onBatch hook over the sole V2 stream.">
                    <ReplayStoreDemo />
                </Check>
    );
}

export function Card33() {
    return (
    <Check n={33} title="Replay hooks - per-key feed (useStoreReplayEach)"
                       do="Watch the table for a few producer ticks. Click server add row, server delete row, server replace ALL, then remount client (fresh keyframe)."
                       expect="On mount every row appears with cb calls=1 (keyframe expanded per key). Between clicks only the mutated row's cb calls counter grows - the whole dict is never re-delivered per tick. Delete removes the row via (key, undefined). replace ALL swaps the table: removed rows leave, new rows enter with cb calls=1. Remount folds a fresh keyframe (all counters reset to 1); StrictMode double-effect does not double-count."
                       note="React counterpart of Observe.syncStoreReplayEach (wenay-common2 1.0.62): internal mirror store + syncStoreReplay + store.each(). The mirror lives in a ref, so in-mount resubscribes reconnect by journal tail on top of kept state; the fold target is a plain Map (grid-api style), not React state. drain:100 coalesces multiple writes to one key into one call per window."
                       tall>
                    <ReplayStoreEachDemo />
                </Check>
    );
}

export function Card34() {
    return (
    <Check n={34} title="Replay hooks - route hand-off (useReplayRouteSubscribe)"
                       do="Watch one canvas draw the synthetic video. Click switch direct, then switch relay, then fail route. Repeat while the producer is moving."
                       expect="The canvas keeps advancing as one logical fold: route switches catch up by seq before the old route closes, so frames do not reset or duplicate. The label changes to direct/relay only after ready. fail route reports an error but keeps the previous active route alive and the canvas continues."
                       note="React wrapper over wenay-common2 1.0.65 Replay.replayRouteSubscribe. Route hand-off is explicit through switchRoute(); changing the remote prop remains a fresh subscription boundary. This route helper does not expose stale/lastTs, so freshness stays on the non-route hooks until common2 grows that surface."
                       tall>
                    <ReplayRouteDemo />
                </Check>
    );
}

export function Card48() {
    return (
    <Check id="ai-run-client" n={48} title="common2 AI run — React Store/Replay adapter"
                       do="Start run, then complete run. Watch durable state/progress and the last semantic event. Then complete the file job below."
                       expect="React renders the local account-filtered client Stores and can react to AI semantic Replay events. The hooks do not create hosts, send prompts, own RPC, retry provider calls, or store raw input: common2 and the application keep those responsibilities."
                       note="useAiRunClient and useFileJobClient are the React-facing adapters for the common2 AI and resource clients. Apps supply their own storage, runner, ACL and presentation.">
                    <AiRunClientDemo />
                </Check>
    );
}

export function Card50() {
    return (
    <Check id="contract-runtime" n={50} title="common2 Contract runtime — versioned binding view"
                       do="Bind v1 and call through its lease. Add preferred v2: the binding generation advances and new calls use v2. Revoke v2: the slot falls back to v1 without becoming ownerless. Restore v2 and call again."
                       expect="React follows one stable slot through status Store and binding events. common2 resolves, prepares, atomically switches, drains leases, falls back and restores; the hook never loads an implementation or owns the runtime."
                       note="useContractSlot is the React-facing adoption of common2 1.0.89. Contract demand authority, compatibility/integrity policy, loaders, Store/replay continuity and runtime.close remain at the application boundary.">
                    <ContractRuntimeDemo />
                </Check>
    );
}
