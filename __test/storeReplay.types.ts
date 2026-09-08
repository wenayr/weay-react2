// Compile-only public API contracts, included by tsconfig.test.json.
import type * as Observe from 'wenay-common2/observe';
import {
    useStoreReplaySync, useStoreReplayRouteSync, useStoreReplayMirror,
    useStoreReplayRouteMirror, useStoreReplayEach,
    type StoreReplayRouteSyncController,
} from '../src/react/index.js';

type State = {qty: number};
type Wrong = {qty: string};

export function replayTypeContracts(store: Observe.Store<State>, remote: Observe.StoreReplayRemote<State>,
    wrong: Observe.StoreReplayRemote<Wrong>, legacy: Observe.StoreReplayRemote) {
    useStoreReplaySync(store, remote);
    useStoreReplaySync(store, legacy); // Untyped upstream contracts remain an explicit escape hatch.
    // @ts-expect-error The remote must not widen the destination's inferred type.
    useStoreReplaySync(store, wrong);
    // @ts-expect-error The route source must match the existing Store.
    useStoreReplayRouteSync(store, wrong);
    // @ts-expect-error Inferred initial state is numeric, not string.
    useStoreReplayMirror(wrong, {qty: 0});
    // @ts-expect-error Explicit mirror state rejects a different remote state.
    useStoreReplayMirror<State>(wrong, {qty: 0});
    // @ts-expect-error Route mirrors preserve the initial state's type too.
    useStoreReplayRouteMirror(wrong, {qty: 0});
    const route = useStoreReplayRouteSync(store, remote);
    const mirror = useStoreReplayRouteMirror(remote, {qty: 0});
    route.switchRoute(remote);
    mirror.switchRoute(remote);
    // @ts-expect-error A later route cannot silently change state shape.
    route.switchRoute(wrong);
    // @ts-expect-error Mirror controllers retain the same route restriction.
    mirror.switchRoute(wrong);
    const saved: StoreReplayRouteSyncController<State> = route;
    // @ts-expect-error An explicitly stored controller retains state checking.
    saved.switchRoute(wrong);
    const each = useStoreReplayEach(remote, (_key, value) => {
        const qty: number | undefined = value;
        // @ts-expect-error The callback infers number from the remote, not any.
        const text: string = value;
        void [qty, text];
    }, {initial: {qty: 0}});
    const qty: number = each.store.state.qty;
    // @ts-expect-error Typed source rejects a differently typed initial value.
    useStoreReplayEach(remote, () => {}, {initial: {qty: 'wrong'}});
    useStoreReplayMirror(remote, {qty: 0}, {chunkedKeyframe: {
        budgetBytes: 32768,
        onProgress: progress => {
            const count: number = progress.received;
            // @ts-expect-error Progress counts are numeric.
            const text: string = progress.total;
            void [count, text];
        },
    }});
    void qty;
}
