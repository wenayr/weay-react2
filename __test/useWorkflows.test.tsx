import React from 'react'
import {act, render, screen, waitFor} from '@testing-library/react'
import {listen, Observe} from 'wenay-common2'
import type {Ai, Resource} from 'wenay-common2'
import {useAiRunClient, useFileJobClient} from '../src/common/src/hooks/useWorkflows'

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
