import {useEffect, useMemo, useRef, useState} from 'react'
import type {Ai, Observe, Resource} from 'wenay-common2'

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
    const [ready, setReady] = useState(false)
    const [error, setError] = useState<unknown>(null)
    const generation = useRef(0)

    useEffect(() => {
        setReady(false)
        setError(null)
        if (!client) return
        const current = ++generation.current
        const off = client.store.node.on(() => setVersion(value => value + 1))
        const readyPromise = client.ready ?? Promise.resolve()
        readyPromise.then(
            () => { if (generation.current == current) setReady(true) },
            nextError => { if (generation.current == current) setError(nextError) },
        )
        return () => {
            ++generation.current
            off()
        }
    }, [client])

    const state = useMemo(() => client ? client.store.node.snapshot() : null, [client, version])
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
    const [lastEvent, setLastEvent] = useState<AiRunEvent | null>(null)

    useEffect(() => {
        setLastEvent(null)
        if (!client) return
        return client.events.on(event => setLastEvent(event))
    }, [client])

    const empty: AiRunStore = {runs: {}, approvals: {}, inputs: {}}
    const value = state.state ?? empty
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
