import {createPersistedController} from "../src/internal/persist/persistedController";
import {memoryGetOrCreate, memoryGet, memoryCache} from "../src/internal/persist/memoryStore";

/** The reason this primitive exists: five controllers repeated read -> subscribe -> mutate/
 *  render/markDirty, and none of them could notice that the shape on disk predates the code.
 *  These tests pin the migration hook and the announce contract. */

test("commit renders subscribers and marks the cache dirty", () => {
    const c = createPersistedController<{n: number}>({key: "test.pc.commit", def: {n: 0}});
    let renders = 0;
    const off = c.api.on(() => { renders++ });

    c.commit(cur => { cur.n = 5 });

    expect(c.state.n).toBe(5);
    expect(renders).toBe(1);
    expect(memoryCache.isDirty()).toBe(true);
    off();
});

test("migrate runs once for an entry stored without a version and stamps it", () => {
    const key = "test.pc.migrate.unversioned";
    // an entry written by an older build: no `v` at all
    memoryGetOrCreate<{n: number}>(key, {n: 1});
    const seen: Array<number | undefined> = [];

    const first = createPersistedController<{n: number; v?: number}>({
        key, def: {n: 0}, version: 3,
        migrate: (state, from) => { seen.push(from); state.n = state.n + 100 },
    });
    expect(seen).toEqual([undefined]);
    expect(first.state.n).toBe(101);
    expect(first.state.v).toBe(3);

    // a second controller over the same key sees the stamped version and does not re-migrate
    const second = createPersistedController<{n: number; v?: number}>({
        key, def: {n: 0}, version: 3,
        migrate: (state, from) => { seen.push(from); state.n = state.n + 100 },
    });
    expect(seen).toEqual([undefined]);
    expect(second.state.n).toBe(101);
});

test("migrate receives the previous version when the schema is bumped", () => {
    const key = "test.pc.migrate.bump";
    createPersistedController<{n: number}>({key, def: {n: 7}, version: 1});
    expect((memoryGet(key) as {v?: number}).v).toBe(1);

    let from: number | undefined = -1;
    const next = createPersistedController<{n: number; v?: number}>({
        key, def: {n: 0}, version: 2,
        migrate: (_state, previous) => { from = previous },
    });

    expect(from).toBe(1);
    expect(next.state.v).toBe(2);
    // migrate mutates in place, so untouched fields survive the bump
    expect(next.state.n).toBe(7);
});

test("no version means no stamping at all", () => {
    const key = "test.pc.noversion";
    const c = createPersistedController<{n: number}>({key, def: {n: 1}});
    expect((c.state as {v?: number}).v).toBeUndefined();
});
