import {createColumnState} from "../src/common/src/grid/columnState/columnState";

test("createColumnState presentGate is runtime-only and intersects actual presence", () => {
    const cs = createColumnState({
        key: "test.columnState.presentGate",
        columns: [
            {key: "name", title: "Name", fixed: true},
            {key: "price", title: "Price"},
            {key: "empty", title: "Empty"},
        ],
    });

    expect(cs.api.getPresent()).toBeNull();
    expect(cs.api.getConfig().visible.empty).toBe(true);

    cs.api.setPresentGate(["name", "price"]);
    expect(cs.api.getPresent()).toEqual({name: true, price: true});
    expect(cs.api.isPresent("empty")).toBe(false);
    expect(cs.api.getConfig().visible.empty).toBe(true);

    cs.api.setPresent(["name", "empty"]);
    expect(cs.api.getPresent()).toEqual({name: true});

    cs.api.setPresentGate(null);
    expect(cs.api.getPresent()).toEqual({name: true, empty: true});

    cs.api.setPresent(null);
    expect(cs.api.getPresent()).toBeNull();
});
