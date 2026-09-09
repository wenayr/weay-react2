import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

export type OwnedClient = {
    ready: PromiseLike<unknown> | (() => PromiseLike<unknown>)
    close(): void | PromiseLike<void>
}
export type UseOwnedClientOptions<C extends OwnedClient> = {
    /** Include every identity input (URL/token/account) in this stable key. */
    key: unknown
    enabled?: boolean
    /** Must return a NEW, exclusively owned resource for each invocation. */
    create: (signal: AbortSignal) => C | PromiseLike<C>
    /** Cleanup failures, including after unmount. Must not throw. */
    onCloseError?: (error: unknown) => void
}
export type OwnedClientController<C extends OwnedClient> = {
    client: C | null
    ready: boolean
    error: unknown
    /** Close this generation; reopen by changing key or toggling enabled. */
    close(): void
}

/** Own creation/readiness/disposal only. Transport, permissions and reconnect stay in the client. */
export function useOwnedClient<C extends OwnedClient>(options: UseOwnedClientOptions<C>): OwnedClientController<C> {
    const {key, enabled = true} = options
    const scope = useMemo(() => ({}), [key, enabled])
    const latest = useRef(options)
    latest.current = options
    const owner = useRef<{scope: object; stop: () => void} | null>(null)
    const [state, setState] = useState<{scope: object; client: C | null; ready: boolean; error: unknown}>(
        {scope, client: null, ready: false, error: null})

    useEffect(() => {
        let active = true
        let resource: C | null = null
        let disposed = false
        const abort = new AbortController()
        // Match cleanup reporting to the factory that owned this generation.
        const {create, onCloseError} = latest.current
        const publish = (client: C | null, ready: boolean, error: unknown) => {
            if (active) setState({scope, client, ready, error})
        }
        const dispose = () => {
            if (!resource || disposed) return
            disposed = true
            try {
                Promise.resolve(resource.close()).catch(error => { onCloseError?.(error) })
            } catch (error) { onCloseError?.(error) }
        }
        const stop = () => {
            if (!active) return
            active = false
            abort.abort()
            dispose()
        }
        owner.current = {scope, stop}
        publish(null, false, null)
        if (enabled) {
            // Deferring also captures a synchronous factory exception as a lifecycle error.
            void Promise.resolve().then(() => active ? create(abort.signal) : null).then(async client => {
                if (!client) return
                resource = client
                if (!active) {
                    // A ready promise may reject when close cancels startup. Consume it
                    // even when async acquisition completed after ownership ended.
                    if (typeof client.ready !== 'function') void Promise.resolve(client.ready).catch(() => {})
                    dispose()
                    return
                }
                publish(client, false, null)
                await (typeof client.ready === 'function' ? client.ready() : client.ready)
                publish(client, true, null)
            }).catch(error => {
                publish(null, false, error)
                dispose()
            })
        }
        return stop
    }, [scope, enabled])

    const close = useCallback(() => {
        if (owner.current?.scope !== scope) return
        owner.current.stop()
        setState({scope, client: null, ready: false, error: null})
    }, [scope])
    const current = state.scope === scope && enabled ? state : {client: null, ready: false, error: null}
    return useMemo(() => ({client: current.client, ready: current.ready, error: current.error, close}),
        [current.client, current.ready, current.error, close])
}

export class AsyncActionBusyError extends Error {
    constructor() { super('An action is already pending'); this.name = 'AsyncActionBusyError' }
}
export class AsyncActionUnavailableError extends Error {
    constructor() { super('The action controller is inactive'); this.name = 'AsyncActionUnavailableError' }
}
export type AsyncActionController = {
    pending: boolean
    error: unknown
    /** One active call per controller. Rejections retain the original error; no automatic retry. */
    run<R>(action: () => R | PromiseLike<R>): Promise<Awaited<R>>
    clearError(): void
}

/** Changing key starts a new UI scope, fencing the old result without cancelling its side effect. */
export function useAsyncAction(options: {key?: unknown; enabled?: boolean} = {}): AsyncActionController {
    const {key, enabled = true} = options
    const scope = useMemo(() => ({active: false, pending: false, generation: 0}), [key, enabled])
    const [state, setState] = useState<{scope: object; pending: boolean; error: unknown}>({scope, pending: false, error: null})
    useEffect(() => {
        scope.active = enabled
        ++scope.generation
        scope.pending = false
        setState({scope, pending: false, error: null})
        return () => { scope.active = false; ++scope.generation; scope.pending = false }
    }, [scope, enabled])
    const run = useCallback(async <R,>(action: () => R | PromiseLike<R>): Promise<Awaited<R>> => {
        if (!scope.active) throw new AsyncActionUnavailableError()
        if (scope.pending) throw new AsyncActionBusyError()
        scope.pending = true // Synchronous lock: even two clicks before React paints cannot both execute.
        const generation = scope.generation
        setState({scope, pending: true, error: null})
        const current = () => scope.active && scope.generation === generation
        try {
            return await action()
        } catch (error) {
            if (current()) setState({scope, pending: false, error})
            throw error
        } finally {
            if (current()) {
                scope.pending = false
                setState(previous => previous.scope === scope ? {...previous, pending: false} : previous)
            }
        }
    }, [scope])
    const clearError = useCallback(() => {
        if (scope.active) setState({scope, pending: scope.pending, error: null})
    }, [scope])
    return useMemo(() => ({pending: state.scope === scope && enabled && state.pending,
        error: state.scope === scope && enabled ? state.error : null, run, clearError}), [state, scope, enabled, run, clearError])
}

type Command = (requestId: string, ...args: any[]) => any
export type ServiceCommandMap = Record<string, Command>
type CommandArgs<F> = F extends (requestId: string, ...args: infer A) => unknown ? A : never
/** Correlated name/arguments, excluding the binding-owned request ID. */
export type ServiceCommandCall<C extends ServiceCommandMap> = {
    [K in keyof C & string]: [name: K, ...args: CommandArgs<C[K]>]
}[keyof C & string]
export type ServiceCommandsController<C extends ServiceCommandMap> = Omit<AsyncActionController, 'run'> & {
    run<K extends keyof C & string>(name: K, ...args: CommandArgs<C[NoInfer<K>]>): Promise<Awaited<ReturnType<C[K]>>>
    runTuple<T extends ServiceCommandCall<C>>(call: T): Promise<Awaited<ReturnType<C[T[0]]>>>
}

/** Structural command map only: no service definition, ACL, receipts or retry policy. */
export function useServiceCommands<C extends ServiceCommandMap>(commands: C | null | undefined,
    options: {requestId?: () => string} = {}): ServiceCommandsController<C> {
    const action = useAsyncAction({key: commands, enabled: commands != null})
    const requestId = useRef(options.requestId)
    requestId.current = options.requestId
    const run = useCallback(<K extends keyof C & string>(name: K, ...args: CommandArgs<C[NoInfer<K>]>) =>
        action.run(() => {
            const id = requestId.current ? requestId.current() : crypto.randomUUID()
            return commands![name](id, ...args) as ReturnType<C[K]>
        }), [action.run, commands])
    const runTuple = useCallback(<T extends ServiceCommandCall<C>>(call: T): Promise<Awaited<ReturnType<C[T[0]]>>> =>
        action.run(() => {
            const [name, ...args] = call
            const id = requestId.current ? requestId.current() : crypto.randomUUID()
            return commands![name](id, ...args) as ReturnType<C[T[0]]>
        }), [action.run, commands])
    return useMemo(() => ({...action, run, runTuple}), [action, run, runTuple])
}
