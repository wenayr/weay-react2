import React, {useLayoutEffect} from 'react'
import {act, render, screen, waitFor} from '@testing-library/react'
import {listen} from 'wenay-common2/client'
import * as Observe from 'wenay-common2/observe'
import type * as Ai from 'wenay-common2/ai'
import type * as Resource from 'wenay-common2/resource'
import {useAiRunClient, useFileJobClient} from '../src/react'

function aiStore(): Ai.AiRunStore {
    return {runs: {run: {
        id: 'run', owner: 'me', requestId: 'request', kind: 'assistant', resourceIds: [],
        state: 'queued', progress: 0, artifacts: [], createdAt: 1, updatedAt: 1,
    }}, approvals: {}, inputs: {}}
}

test('useAiRunClient follows the durable Store, semantic events and ready lifecycle without leaks', async () => {
    const store = Observe.createStore(aiStore())
    const [emit, events] = listen<[Ai.AiRunEvent]>()
    let resolveReady!: () => void
    const ready = new Promise<void>(resolve => { resolveReady = resolve })
    const client = {store, events, ready} as unknown as Ai.AiRunClient

    function Probe() {
        const ai = useAiRunClient(client)
        return <>
            <output data-testid="ready">{String(ai.ready)}</output>
            <output data-testid="state">{ai.runs.run?.state}</output>
            <output data-testid="event">{ai.lastEvent?.type ?? 'none'}</output>
        </>
    }

    const view = render(<React.StrictMode><Probe/></React.StrictMode>)
    expect(screen.getByTestId('ready').textContent).toBe('false')
    expect(store.count()).toBe(1)
    expect(events.count()).toBe(1)

    await act(async () => resolveReady())
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'))

    await act(async () => {
        store.state.runs.run.state = 'running'
        await Observe.flushReactive(store.state)
        emit({type: 'started', runId: 'run'})
    })
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('running'))
    expect(screen.getByTestId('event').textContent).toBe('started')

    view.unmount()
    expect(store.count()).toBe(0)
    expect(events.count()).toBe(0)
})

test('useFileJobClient observes Resource file/job state through the same client-store seam', async () => {
    const store = Observe.createStore<Resource.FileJobStore>({
        files: {file: {id: 'file', owner: 'me', name: 'report.csv', size: 10, mime: 'text/csv', state: 'uploaded', createdAt: 1, updatedAt: 1}},
        jobs: {},
    })
    const client = {store, ready: Promise.resolve()} as unknown as Resource.FileJobClient

    function Probe() {
        const files = useFileJobClient(client)
        return <>
            <output data-testid="file">{files.files.file?.state}</output>
            <output data-testid="job">{files.jobs.job?.progress ?? 'none'}</output>
        </>
    }

    render(<Probe/>)
    expect(screen.getByTestId('file').textContent).toBe('uploaded')
    await act(async () => {
        store.state.jobs.job = {id: 'job', fileId: 'file', owner: 'me', state: 'running', progress: 60, createdAt: 1, updatedAt: 2}
        await Observe.flushReactive(store.state)
    })
    await waitFor(() => expect(screen.getByTestId('job').textContent).toBe('60'))
})

test('a late ready from a replaced client cannot mark the current client ready', async () => {
    const firstStore = Observe.createStore(aiStore())
    const secondStore = Observe.createStore(aiStore())
    const [, firstEvents] = listen<[Ai.AiRunEvent]>()
    const [, secondEvents] = listen<[Ai.AiRunEvent]>()
    let resolveFirst!: () => void
    let resolveSecond!: () => void
    const first = {store: firstStore, events: firstEvents, ready: new Promise<void>(resolve => { resolveFirst = resolve })} as unknown as Ai.AiRunClient
    const second = {store: secondStore, events: secondEvents, ready: new Promise<void>(resolve => { resolveSecond = resolve })} as unknown as Ai.AiRunClient

    function Probe({client}: {client: Ai.AiRunClient}) {
        return <output data-testid="ready">{String(useAiRunClient(client).ready)}</output>
    }

    const view = render(<Probe client={first}/>)
    view.rerender(<Probe client={second}/>)
    await act(async () => resolveFirst())
    expect(screen.getByTestId('ready').textContent).toBe('false')
    await act(async () => resolveSecond())
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'))
    view.unmount()
    expect(firstStore.count()).toBe(0)
    expect(secondStore.count()).toBe(0)
})

test('a Store mutation between render and effect is not missed', async () => {
    const store = Observe.createStore(aiStore())
    const [, events] = listen<[Ai.AiRunEvent]>()
    const client = {store, events, ready: Promise.resolve()} as unknown as Ai.AiRunClient

    function MutateBeforePassiveSubscriptions() {
        useLayoutEffect(() => {
            store.state.runs.run.state = 'running'
        }, [])
        return null
    }

    function Probe() {
        return <output data-testid="race-state">{useAiRunClient(client).runs.run?.state}</output>
    }

    const view = render(<><Probe/><MutateBeforePassiveSubscriptions/></>)
    await waitFor(() => expect(screen.getByTestId('race-state').textContent).toBe('running'))
    view.unmount()
    expect(store.count()).toBe(0)
    expect(events.count()).toBe(0)
})

test('a replacement client never renders lifecycle or events from the previous identity', async () => {
    const firstStore = Observe.createStore(aiStore())
    const secondStore = Observe.createStore(aiStore())
    const [emitFirst, firstEvents] = listen<[Ai.AiRunEvent]>()
    const [, secondEvents] = listen<[Ai.AiRunEvent]>()
    let rejectFirst!: (error: unknown) => void
    let resolveSecond!: () => void
    const first = {
        store: firstStore,
        events: firstEvents,
        ready: new Promise<void>((_, reject) => { rejectFirst = reject }),
    } as unknown as Ai.AiRunClient
    const second = {
        store: secondStore,
        events: secondEvents,
        ready: new Promise<void>(resolve => { resolveSecond = resolve }),
    } as unknown as Ai.AiRunClient
    const firstError = new Error('first failed')
    const secondRenders: Array<{ready: boolean, error: unknown, event: string}> = []

    function Probe({client}: {client: Ai.AiRunClient}) {
        const ai = useAiRunClient(client)
        if (client === second) {
            secondRenders.push({
                ready: ai.ready,
                error: ai.error,
                event: ai.lastEvent?.type ?? 'none',
            })
        }
        return <output data-testid="identity-state">
            {String(ai.ready)}|{ai.error instanceof Error ? ai.error.message : 'none'}|{ai.lastEvent?.type ?? 'none'}
        </output>
    }

    const view = render(<Probe client={first}/>)
    await act(async () => rejectFirst(firstError))
    await waitFor(() => expect(screen.getByTestId('identity-state').textContent).toContain('first failed'))
    act(() => emitFirst({type: 'started', runId: 'run'}))
    expect(screen.getByTestId('identity-state').textContent).toContain('started')

    view.rerender(<Probe client={second}/>)
    expect(secondRenders[0]).toEqual({ready: false, error: null, event: 'none'})
    expect(screen.getByTestId('identity-state').textContent).toBe('false|none|none')

    await act(async () => resolveSecond())
    await waitFor(() => expect(screen.getByTestId('identity-state').textContent).toBe('true|none|none'))
    view.unmount()
    expect(firstStore.count()).toBe(0)
    expect(secondStore.count()).toBe(0)
    expect(firstEvents.count()).toBe(0)
    expect(secondEvents.count()).toBe(0)
})
