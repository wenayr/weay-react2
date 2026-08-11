import {useEffect, useMemo, useRef, useState} from 'react'
import type * as Ai from 'wenay-common2/ai'
import type * as Observe from 'wenay-common2/observe'
import type * as Resource from 'wenay-common2/resource'

type AiRunClient = Ai.AiRunClient
type AiRunEvent = Ai.AiRunEvent
type AiRunStore = Ai.AiRunStore
type FileJobClient = Resource.FileJobClient
type FileJobStore = Resource.FileJobStore

/** A common2 client owns transport/replay; React only observes its local Store. */
export type StoreBackedClient<T extends object> = {
    store: Observe.Store<T>
    ready?: Promise<void>
}

export type ClientStoreController<T extends object> = {
    client: StoreBackedClient<T> | null
    state: T | null
    ready: boolean
    error: unknown
}

/**
 * Observe an already-created common2 client without creating, reconnecting, or closing it.
 * The generation guard makes a late `ready` from a previous client/remount harmless.
 */
export function useClientStore<T extends object>(client: StoreBackedClient<T> | null | undefined): ClientStoreController<T> {
    const [version, setVersion] = useState(0)
    const [lifecycle, setLifecycle] = useState<{
        client: StoreBackedClient<T> | null
        ready: boolean
        error: unknown
    }>({client: null, ready: false, error: null})
    const generation = useRef(0)
    const activeClient = client ?? null

    useEffect(() => {
        const current = ++generation.current
        setLifecycle({client: activeClient, ready: false, error: null})
        if (!client) return

        // `current: true` closes the render-to-effect window: if the Store changed
        // before this subscription was installed, the immediate current delivery
        // schedules a fresh snapshot instead of waiting for a later mutation.
        const off = client.store.node.on(() => setVersion(value => value + 1), {current: true})
        const readyPromise = client.ready ?? Promise.resolve()
        readyPromise.then(
            () => {
                if (generation.current == current)
                    setLifecycle({client, ready: true, error: null})
            },
            nextError => {
                if (generation.current == current)
                    setLifecycle({client, ready: false, error: nextError})
            },
        )
        return () => {
            ++generation.current
            off()
        }
    }, [activeClient])

    const state = useMemo(() => client ? client.store.node.snapshot() : null, [client, version])
    // Effects run after render. Never pair a newly supplied client with lifecycle
    // state that was produced by the previous client, even for that first render.
    const ready = lifecycle.client === activeClient && lifecycle.ready
    const error = lifecycle.client === activeClient ? lifecycle.error : null
    return useMemo(() => ({client: client ?? null, state, ready, error}), [client, state, ready, error])
}

export type AiRunClientController = ClientStoreController<AiRunStore> & {
    client: AiRunClient | null
    runs: AiRunStore['runs']
    approvals: AiRunStore['approvals']
    inputs: AiRunStore['inputs']
    lastEvent: AiRunEvent | null
}

/** React view over an existing `Ai.createAiRunClient` resource. */
export function useAiRunClient(client: AiRunClient | null | undefined): AiRunClientController {
    const state = useClientStore(client)
    const activeClient = client ?? null
    const [eventState, setEventState] = useState<{
        client: AiRunClient | null
        event: AiRunEvent | null
    }>({client: null, event: null})

    useEffect(() => {
        setEventState({client: activeClient, event: null})
        if (!client) return
        return client.events.on(event => setEventState({client, event}))
    }, [activeClient])

    const empty: AiRunStore = {runs: {}, approvals: {}, inputs: {}}
    const value = state.state ?? empty
    const lastEvent = eventState.client === activeClient ? eventState.event : null
    return useMemo(() => ({
        ...state,
        client: client ?? null,
        runs: value.runs,
        approvals: value.approvals,
        inputs: value.inputs,
        lastEvent,
    }), [state, client, value, lastEvent])
}

export type FileJobClientController = ClientStoreController<FileJobStore> & {
    client: FileJobClient | null
    files: FileJobStore['files']
    jobs: FileJobStore['jobs']
}

/** React view over an existing `Resource.createFileJobClient` resource. */
export function useFileJobClient(client: FileJobClient | null | undefined): FileJobClientController {
    const state = useClientStore(client)
    const empty: FileJobStore = {files: {}, jobs: {}}
    const value = state.state ?? empty
    return useMemo(() => ({
        ...state,
        client: client ?? null,
        files: value.files,
        jobs: value.jobs,
    }), [state, client, value])
}
