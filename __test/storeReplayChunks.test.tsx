import React, {StrictMode} from 'react';
import {act, renderHook, waitFor} from '@testing-library/react';
import * as Observe from 'wenay-common2/observe';
import {
    useStoreReplaySync, useStoreReplayMirror, useStoreReplayEach,
    useStoreReplayRouteSync, useStoreReplayRouteMirror,
} from '../src/react/index.js';

type State = Record<string, {qty: number; description: string}>;
type Remote = Observe.StoreReplayRemote<State>;
const budget = 16 * 1024;

function fixture() {
    const state: State = Object.fromEntries(Array.from({length: 48}, (_, i) =>
        [`row${i}`, {qty: i, description: 'x'.repeat(2048)}]));
    const server = Observe.createStore(state);
    const exposed = Observe.exposeStoreReplay(server);
    const source = exposed.api.replay;
    const begin = jest.fn(source.chunks!.begin);
    const keyframe = jest.fn(source.keyframe);
    const remote: Remote = {...source, keyframe, chunks: {...source.chunks!, begin}};
    return {server, exposed, remote, begin, keyframe};
}

type Kind = 'sync' | 'mirror' | 'each' | 'routeSync' | 'routeMirror';
function useConsumer(kind: Kind, store: Observe.Store<State>, remote: Remote, chunkedKeyframe: Observe.StoreReplayChunkedKeyframeOpt) {
    // Kind is fixed for the entire lifetime of each test's hook.
    const options = {chunkedKeyframe, keepSeq: false};
    if (kind === 'mirror') return useStoreReplayMirror<State>(remote, {}, options);
    if (kind === 'each') return useStoreReplayEach(remote, () => {}, {...options, initial: {}});
    if (kind === 'routeMirror') return useStoreReplayRouteMirror<State>(remote, {}, options);
    if (kind === 'routeSync') return {...useStoreReplayRouteSync(store, remote, options), store};
    return {...useStoreReplaySync(store, remote, options), store};
}

test.each<Kind>(['sync', 'mirror', 'each', 'routeSync', 'routeMirror'])('%s forwards chunk budget/progress, keeps inline callbacks stable, and disables chunks', async kind => {
    const f = fixture();
    const target = Observe.createStore<State>({});
    const progress = jest.fn();
    const {result, rerender, unmount} = renderHook(({enabled, size}) =>
        useConsumer(kind, target, f.remote, enabled ? {budgetBytes: size, onProgress: p => progress(p)} : false),
    {initialProps: {enabled: true, size: budget}, wrapper: StrictMode});
    try {
        await waitFor(() => expect(result.current.ready).toBe(true));
        expect(f.begin).toHaveBeenCalledWith({budgetBytes: budget});
        expect(f.keyframe).not.toHaveBeenCalled();
        const last = progress.mock.calls.at(-1)![0];
        expect(last.total).toBeGreaterThan(1);
        expect(last.received).toBe(last.total);
        expect(result.current.store.snapshot()).toEqual(f.server.snapshot());
        const starts = f.begin.mock.calls.length;
        rerender({enabled: true, size: budget});
        expect(f.begin).toHaveBeenCalledTimes(starts);
        // keepSeq:false deliberately requests a fresh snapshot on each config change.
        rerender({enabled: true, size: budget * 2});
        await waitFor(() => expect(f.begin).toHaveBeenCalledWith({budgetBytes: budget * 2}));
        await waitFor(() => expect(result.current.ready).toBe(true));
        rerender({enabled: false, size: budget * 2});
        await waitFor(() => expect(f.keyframe).toHaveBeenCalled());
        await waitFor(() => expect(result.current.ready).toBe(true));
        expect(result.current.store.snapshot()).toEqual(f.server.snapshot());
    } finally { unmount(); f.exposed.close(); }
});

test('progress uses the latest callback during assembly and stops after unmount', async () => {
    const f = fixture();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const pull = jest.fn(async (id: string, index: number) => { await gate; return f.remote.chunks!.pull(id, index); });
    const remote: Remote = {...f.remote, chunks: {...f.remote.chunks!, pull}};
    const first = jest.fn();
    const latest = jest.fn();
    const {result, rerender, unmount} = renderHook(({onProgress}) =>
        useStoreReplayMirror<State>(remote, {}, {chunkedKeyframe: {budgetBytes: budget, onProgress}}),
    {initialProps: {onProgress: first}});
    try {
        await waitFor(() => expect(pull).toHaveBeenCalled());
        expect(first).toHaveBeenCalledTimes(1);
        expect(Object.keys(result.current.store.state)).toHaveLength(0); // No partial snapshot applied.
        rerender({onProgress: latest});
        await act(async () => { release(); });
        await waitFor(() => expect(result.current.ready).toBe(true));
        expect(first).toHaveBeenCalledTimes(1);
        expect(latest).toHaveBeenCalled();
        expect(f.begin).toHaveBeenCalledTimes(1);
    } finally { unmount(); release(); f.exposed.close(); }

    const g = fixture();
    let unblock!: () => void;
    const pending = new Promise<void>(resolve => { unblock = resolve; });
    const late = jest.fn();
    const delayed: Remote = {...g.remote, chunks: {...g.remote.chunks!,
        begin: async opts => { await pending; return g.remote.chunks!.begin(opts); },
    }};
    const view = renderHook(() => useStoreReplayMirror<State>(delayed, {}, {
        chunkedKeyframe: {budgetBytes: budget, onProgress: late},
    }));
    view.unmount();
    await act(async () => { unblock(); });
    expect(late).not.toHaveBeenCalled();
    expect(Object.keys(view.result.current.store.state)).toHaveLength(0);
    g.exposed.close();
});

test('route handoff uses chunk options and an old host falls back to a single snapshot', async () => {
    const f = fixture();
    const g = fixture();
    const progress = jest.fn();
    const {result, unmount} = renderHook(() => useStoreReplayRouteMirror<State>(f.remote, {}, {
        chunkedKeyframe: {budgetBytes: budget, onProgress: progress},
    }));
    try {
        await waitFor(() => expect(result.current.ready).toBe(true));
        await act(async () => { await result.current.switchRoute(g.remote, {reset: true, since: -1, label: 'new'}); });
        expect(g.begin).toHaveBeenCalledWith({budgetBytes: budget});
        expect(result.current.label()).toBe('new');
        const {chunks: _chunks, ...legacy} = f.remote;
        await act(async () => { await result.current.switchRoute(legacy, {reset: true, since: -1, label: 'legacy'}); });
        expect(f.keyframe).toHaveBeenCalled();
        expect(result.current.store.snapshot()).toEqual(f.server.snapshot());
    } finally { unmount(); f.exposed.close(); g.exposed.close(); }
});
