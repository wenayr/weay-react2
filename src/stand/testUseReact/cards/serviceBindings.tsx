import React, {useEffect, useRef, useState} from 'react'
import {createStore, exposeStoreReplay, syncStoreReplay} from 'wenay-common2/observe'
import {useClientStore, useOwnedClient, useServiceCommands} from '../../../react/index.js'
import {Check, DemoHint, ExampleCode, ShowcasePanel} from '../standKit.js'

// Local service-shaped fixture; real common2 Store/Replay, no transport or authorization simulation.
function createSession(account: string, report: (message: string) => void) {
    const source = createStore({account, tasks: [] as string[]})
    const exposed = exposeStoreReplay(source)
    const store = createStore({account: '', tasks: [] as string[]})
    const sync = syncStoreReplay(store, exposed.api.replay)
    let closed = false
    const timers = new Map<ReturnType<typeof setTimeout>, () => void>()
    const delay = () => new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { timers.delete(timer); resolve() }, 700)
        timers.set(timer, () => reject(new Error('Сессия закрыта')))
    })
    const ready = Promise.all([sync.ready, delay()]).then(() => {})
    report(`Создана сессия ${account}`)
    return {
        store, ready,
        commands: {
            async add(requestId: string, input: {fail: boolean}) {
                await delay()
                if (closed) throw new Error('Сессия закрыта')
                if (input.fail) throw new Error('Проверочная ошибка команды')
                const label = `Задача ${source.state.tasks.length + 1}`
                source.state.tasks.push(label)
                report(`${account}: ${label} · ${requestId.slice(0, 8)}`)
                return {label, requestId}
            },
        },
        close() {
            closed = true
            for (const [timer, reject] of timers) { clearTimeout(timer); reject() }
            timers.clear()
            sync()
            exposed.close()
            report(`Освобождена сессия ${account}`)
        },
    }
}

function SessionDemo() {
    const [account, setAccount] = useState('A')
    const [enabled, setEnabled] = useState(true)
    const [attempt, setAttempt] = useState(0)
    const [fail, setFail] = useState(false)
    const [events, setEvents] = useState<string[]>([])
    const mounted = useRef(false)
    useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
    const report = (message: string) => { if (mounted.current) setEvents(old => [...old.slice(-5), message]) }
    const owned = useOwnedClient({key: `${account}:${attempt}`, enabled,
        create: () => createSession(account, report)})
    const observed = useClientStore(owned.client)
    const commands = useServiceCommands(owned.ready ? owned.client?.commands : null)
    const error = owned.error ?? commands.error
    const tasks = observed.state?.tasks ?? []
    const stateLabel = !enabled ? 'Отключено' : owned.ready ? 'Готово' : 'Подключение…'
    return <div className="wenayQaShowcaseGrid" style={{textTransform: 'none', color: '#334155'}}>
        <ShowcasePanel eyebrow="ЖИЗНЕННЫЙ ЦИКЛ" title="Одна сессия — один владелец">
            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                <button onClick={() => setAccount(old => old === 'A' ? 'B' : 'A')}>Сменить аккаунт ({account})</button>
                <button onClick={() => setEnabled(old => !old)}>{enabled ? 'Отключить' : 'Подключить'}</button>
                <button onClick={() => { setAttempt(old => old + 1); setEnabled(true) }}>Пересоздать</button>
                <button onClick={() => { owned.close(); setEnabled(false) }}>Закрыть ресурс</button>
            </div>
            <div role="status">{stateLabel} · аккаунт {account} · {commands.pending ? 'Команда выполняется…' : 'Нет активной команды'}</div>
            <label><input type="checkbox" checked={fail} onChange={e => setFail(e.target.checked)}/> Проверочная ошибка</label>
            <button disabled={!owned.ready} onClick={() => {
                void commands.run('add', {fail}).catch(() => {})
            }}>{commands.pending ? 'Нажать повторно (будет отклонено)' : 'Добавить задачу'}</button>
            {error != null && <div role="alert">{error instanceof Error ? error.message : String(error)} <button onClick={commands.clearError}>Убрать ошибку</button></div>}
            <section style={{padding: 12, minHeight: 65, border: '1px solid #cbd5e1', borderRadius: 8}} aria-label="Задачи сессии">
                <b>Задачи аккаунта {observed.state?.account || account}</b>
                {tasks.length ? <ul>{tasks.map(task => <li key={task}>{task}</li>)}</ul> : <p>Пока нет задач</p>}
            </section>
            <DemoHint>Смените аккаунт во время подключения или команды. Старый результат не попадёт в новую сессию. Двойное нажатие создаёт только одну задачу.</DemoHint>
        </ShowcasePanel>
        <ShowcasePanel eyebrow="ПОДКЛЮЧЕНИЕ" title="Без своей обвязки эффектов" tone="green">
            <ExampleCode>{`const session = useOwnedClient({
  key: sessionKey,
  enabled: signedIn,
  create: signal => createClient({
    url, token, signal,
  }),
});
const client = session.client;
const view = useClientStore(
  client?.views.tasks,
);
const actions = useServiceCommands(
  session.ready
    ? client?.commands : null,
);
await actions.run('add', {
  title: 'Задача',
});`}</ExampleCode>
            <div aria-label="Журнал ресурсов" style={{fontSize: 12, lineHeight: 1.6}}>{events.map((event, index) => <div key={index}>{event}</div>)}</div>
            <p style={{fontSize: 12}}>Здесь локальный Store/Replay common2 с задержкой 700 мс. Настоящие сеть, разрешения, обновление токена и повтор команды остаются клиенту и приложению.</p>
        </ShowcasePanel>
    </div>
}

export function Card56() {
    return <Check id="service-bindings" n={56} title="Owned client + typed commands — session lifecycle"
        do="Switch accounts during connection and pending command; toggle enabled, close and recreate. Press Add twice quickly, test rejection, clear the error and run again. Leave the page with a pending operation."
        expect="Exactly one owned session is current. Old sessions close; stale work cannot update the new UI. Duplicate calls do not execute or allocate a new request ID. Successful commands update the real Store/Replay view."
        note="React owns lifecycle and action UI, not roles, reconnect, receipts or domain rules. Existing externally owned clients still use useClientStore without ownership.">
        <SessionDemo/>
    </Check>
}
