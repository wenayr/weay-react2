import {createGridBuffer, type GridApiLike} from "../src/internal/grid/agGrid4/core";

type Row = {id: string, name: string, price?: number};

function fakeGrid() {
    const rows = new Map<string, Row>();
    const log: any[] = [];
    const api: GridApiLike<Row> = {
        getRowNode: id => rows.has(id) ? {data: rows.get(id)} : undefined,
        forEachNode: cb => { for (const data of rows.values()) cb({data}); },
        applyTransaction: tx => {
            log.push(tx);
            for (const r of tx.add ?? []) rows.set(r.id, r);
            for (const r of tx.update ?? []) rows.set(r.id, r);
            for (const r of tx.remove ?? []) rows.delete(r.id);
        },
        applyTransactionAsync: tx => api.applyTransaction(tx),
    };
    return {api, rows, log};
}

test("mirror core: rows survive detach/attach through the buffer, remove is applied once", () => {
    const core = createGridBuffer<Row>({getId: r => String(r.id)});
    const g1 = fakeGrid();
    core.control.attach(g1.api);
    core.api.updateData({newData: [{id: "tsla", name: "Tesla", price: 1}]});
    core.api.updateData({newData: [{id: "aapl", name: "Apple", price: 2}]});
    expect([...g1.rows.keys()]).toEqual(["tsla", "aapl"]);
    core.api.updateData({removeData: [{id: "tsla"}]});
    expect([...g1.rows.keys()]).toEqual(["aapl"]);

    core.control.detach();
    core.api.updateData({newData: [{id: "msft", name: "Microsoft"}]}); // written while unmounted
    const g2 = fakeGrid();
    core.control.attach(g2.api);
    expect([...g2.rows.keys()].sort()).toEqual(["aapl", "msft"]);
    expect(g2.rows.get("aapl")?.price).toBe(2);
});
