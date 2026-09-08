import React, {useEffect, useState} from 'react';
import * as Observe from 'wenay-common2/observe';
import {useStoreNode, useStoreReplayMirror} from '../../../react/index.js';
import {Check, DemoHint, ExampleCode, ShowcasePanel} from '../standKit.js';

type Inventory = Record<string, {name: string; stock: number; details: string}>;
type Remote = Observe.StoreReplayRemote<Inventory>;

function InventoryClient({remote, budget}: {remote: Remote; budget: number}) {
    const [progress, setProgress] = useState<Observe.StoreReplayChunkedProgress | null>(null);
    const mirror = useStoreReplayMirror<Inventory>(remote, {}, {
        chunkedKeyframe: budget === 0 ? false : {budgetBytes: budget, onProgress: setProgress},
    });
    const inventory = useStoreNode(mirror.store.node, {mode: 'snapshot'});
    const rows = Object.values(inventory.value);
    return <div>
        <p role="status">{mirror.error ? String(mirror.error) : mirror.ready
            ? `Каталог готов: ${rows.length} товаров` : 'Загружаем каталог…'}</p>
        {budget > 0 && <div>
            <progress aria-label="Загрузка каталога" value={progress?.received ?? 0} max={progress?.total ?? 1}/>
            <span> {progress ? `${progress.received} / ${progress.total} частей` : 'Ожидание снимка'}</span>
        </div>}
        <table style={{width: '100%', textAlign: 'left'}}>
            <thead><tr><th>Товар</th><th>Остаток</th></tr></thead>
            <tbody>{rows.slice(0, 5).map(row => <tr key={row.name}><td>{row.name}</td><td>{row.stock}</td></tr>)}</tbody>
        </table>
        <small>{rows.length ? 'Показаны первые 5 товаров. Изменения остатков поступают после загрузки.' : 'Частичный снимок ещё не показан.'}</small>
    </div>;
}

export function Card55() {
    const [session, setSession] = useState<{remote: Remote; server: Observe.Store<Inventory>} | null>(null);
    const [budget, setBudget] = useState(16 * 1024);
    const [generation, setGeneration] = useState(0);
    useEffect(() => {
        const initial: Inventory = Object.fromEntries(Array.from({length: 96}, (_, i) =>
            [`item-${i}`, {name: `Товар ${i + 1}`, stock: 100 + i, details: 'Описание товара. '.repeat(128)}]));
        const server = Observe.createStore(initial);
        const source = Observe.exposeStoreReplay(server);
        // A delayed transport over the real common2 chunk facade makes progress visible.
        const chunks = source.api.replay.chunks!;
        const remote: Remote = {...source.api.replay, chunks: {...chunks,
            pull: async (id, index) => {
                await new Promise(resolve => setTimeout(resolve, 80));
                return chunks.pull(id, index);
            },
        }};
        setSession({remote, server});
        return () => source.close();
    }, []);
    return <Check id="store-replay-chunks" n={55} title="Store Replay — typed inventory and chunked loading"
        do="Load at 16 KiB, then choose 64 KiB and reload; compare chunk counts. Choose a single snapshot. Change stock after loading. Reload and navigate to Archive during loading."
        expect="Progress completes before all 96 products appear together; larger budgets need fewer chunks. Single-snapshot mode has no chunk progress. Stock changes stay live. Leaving the card cleans up the subscription."
        note="The app owns the remote, access control and presentation. common2 assembles snapshots; React exposes configuration/progress and fences notifications from closed subscriptions.">
        <ShowcasePanel eyebrow="Каталог склада" title="Загрузка большого каталога">
            <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
                <label>Размер частей <select aria-label="Размер частей" value={budget} onChange={e => {setBudget(Number(e.target.value)); setGeneration(v => v + 1);}}>
                    <option value={16384}>16 KiB</option><option value={65536}>64 KiB</option><option value={0}>Один снимок</option>
                </select></label>
                <button onClick={() => setGeneration(v => v + 1)}>Загрузить заново</button>
                <button onClick={() => {if (session) session.server.state['item-0'].stock++;}}>Добавить остаток</button>
            </div>
            {session && <InventoryClient key={generation} remote={session.remote} budget={budget}/>}
        </ShowcasePanel>
        <ExampleCode>{`import {useStoreReplayMirror} from "wenay-react2/react";
const mirror = useStoreReplayMirror<Inventory>(remote, {}, {
  chunkedKeyframe: {budgetBytes: 16 * 1024, onProgress: setProgress},
}); // remote: StoreReplayRemote<Inventory>
// chunkedKeyframe: false — one snapshot; ready — fully applied state.`}</ExampleCode>
        <DemoHint>Прогресс относится к передаче снимка. React получает готовый каталог целиком; новые остатки затем приходят через ту же подписку.</DemoHint>
    </Check>;
}
