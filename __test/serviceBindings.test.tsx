import React, {StrictMode} from 'react'
import {act, renderHook, waitFor} from '@testing-library/react'
import {createAiRunClient, createAiRunHost} from 'wenay-common2/ai'
import {useOwnedClient, useAsyncAction, useServiceCommands, useAiRunClient,
    AsyncActionBusyError, AsyncActionUnavailableError} from '../src/react/index.js'

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
    return {promise, resolve, reject}
}
const settle = () => act(async () => { await Promise.resolve() })

test('owned creation is exclusive, StrictMode-safe, stable across inline factories and closes once', async () => {
    const clients: Array<{ready: Promise<void>; close: jest.Mock}> = []
    const create = jest.fn(() => {
        const client = {ready: Promise.resolve(), close: jest.fn()}
        clients.push(client)
        return client
    })
    const {result, rerender, unmount} = renderHook(({key, enabled}) =>
        useOwnedClient({key, enabled, create: () => create()}),
    {initialProps: {key: 'one', enabled: true}, wrapper: StrictMode})
    await waitFor(() => expect(result.current.ready).toBe(true))
    const first = result.current.client!
    const calls = create.mock.calls.length
    rerender({key: 'one', enabled: true})
    expect(create).toHaveBeenCalledTimes(calls)
    expect(result.current.client).toBe(first)
    rerender({key: 'two', enabled: true})
    expect(result.current.client).toBeNull()
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(first.close).toHaveBeenCalledTimes(1)
    act(() => { result.current.close(); result.current.close() })
    expect(result.current.client).toBeNull()
    await settle()
    expect(create).toHaveBeenCalledTimes(calls + 1)
    rerender({key: 'two', enabled: false})
    rerender({key: 'two', enabled: true})
    await waitFor(() => expect(result.current.ready).toBe(true))
    unmount()
    clients.forEach(client => expect(client.close).toHaveBeenCalledTimes(1))
})

test.each(['resolve', 'reject'] as const)('late old readiness %s never changes new identity', async outcome => {
    const old = deferred<void>()
    const first = {ready: () => old.promise, close: jest.fn()}
    const second = {ready: () => Promise.resolve(), close: jest.fn()}
    const {result, rerender, unmount} = renderHook(({key}) =>
        useOwnedClient({key, create: () => key === 'a' ? first : second}), {initialProps: {key: 'a'}})
    await waitFor(() => expect(result.current.client).toBe(first))
    rerender({key: 'b'})
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(async () => outcome === 'resolve' ? old.resolve() : old.reject(new Error('old')))
    expect(result.current).toMatchObject({client: second, ready: true, error: null})
    expect(first.close).toHaveBeenCalledTimes(1)
    unmount()
})

test('late asynchronous acquisition after unmount is closed without starting ready', async () => {
    const acquisition = deferred<{ready: jest.Mock; close: jest.Mock}>()
    const client = {ready: jest.fn(async () => {}), close: jest.fn()}
    let signal!: AbortSignal
    const {unmount} = renderHook(() => useOwnedClient({key: 'one', create: abort => {
        signal = abort; return acquisition.promise
    }}))
    await settle()
    unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => acquisition.resolve(client))
    expect(client.ready).not.toHaveBeenCalled()
    expect(client.close).toHaveBeenCalledTimes(1)
})

test('factory/ready exceptions surface, failed owned client closes and cleanup rejection is handled', async () => {
    const error = new Error('failed')
    const cleanupError = new Error('cleanup')
    const onCloseError = jest.fn()
    const client = {ready: () => { throw error }, close: jest.fn(() => Promise.reject(cleanupError))}
    const {result, rerender, unmount} = renderHook(({key}) => useOwnedClient({key, onCloseError, create: () => {
        if (key === 'factory') throw error
        return client
    }}), {initialProps: {key: 'factory'}})
    await waitFor(() => expect(result.current.error).toBe(error))
    rerender({key: 'ready'})
    await waitFor(() => expect(result.current.error).toBe(error))
    await waitFor(() => expect(onCloseError).toHaveBeenCalledWith(cleanupError))
    expect(result.current.client).toBeNull()
    unmount()
    expect(client.close).toHaveBeenCalledTimes(1)
})

test('late acquisition consumes readiness rejected by close after explicit disposal', async () => {
    const acquisition = deferred<{ready: Promise<void>; close: jest.Mock}>()
    const ready = deferred<void>()
    const client = {ready: ready.promise, close: jest.fn(() => ready.reject(new Error('closed')))}
    const {result, unmount} = renderHook(() => useOwnedClient({key: 1, create: () => acquisition.promise}))
    await settle()
    act(() => result.current.close())
    await act(async () => acquisition.resolve(client))
    expect(result.current).toMatchObject({client: null, ready: false, error: null})
    expect(client.close).toHaveBeenCalledTimes(1)
    unmount()
})

test('readiness preserves the receiver and never closes an unrelated external resource', async () => {
    const external = {close: jest.fn()}
    const client = {value: 'owned', ready: jest.fn(function (this: {value: string}) {
        expect(this.value).toBe('owned'); return Promise.resolve()
    }), close: jest.fn()}
    const {result, unmount} = renderHook(() => useOwnedClient({key: 1, create: () => client}))
    await waitFor(() => expect(result.current.ready).toBe(true))
    unmount()
    expect(client.close).toHaveBeenCalledTimes(1)
    expect(external.close).not.toHaveBeenCalled()
})

test('disabled ownership creates nothing and stale close cannot close the new scope', async () => {
    const create = jest.fn(() => ({ready: Promise.resolve(), close: jest.fn()}))
    const {result, rerender, unmount} = renderHook(({key, enabled}) => useOwnedClient({key, enabled, create}),
        {initialProps: {key: 1, enabled: false}})
    await settle()
    expect(create).not.toHaveBeenCalled()
    rerender({key: 1, enabled: true})
    await waitFor(() => expect(result.current.ready).toBe(true))
    const oldClose = result.current.close
    rerender({key: 2, enabled: true})
    await waitFor(() => expect(result.current.ready).toBe(true))
    act(() => oldClose())
    expect(result.current.ready).toBe(true)
    expect(result.current.client!.close).not.toHaveBeenCalled()
    unmount()
})

test('owns a real common2 client, observes its Store, and releases its subscriptions', async () => {
    const host = createAiRunHost({runner: {run: async () => ({result: 'done'})}})
    const connection = host.connection('qa-owner')
    const clients: ReturnType<typeof createAiRunClient>[] = []
    const {result, unmount} = renderHook(() => {
        const owned = useOwnedClient({key: connection, create: () => {
            const client = createAiRunClient({remote: connection.fragment})
            jest.spyOn(client, 'close')
            clients.push(client)
            return client
        }})
        return {owned, view: useAiRunClient(owned.client)}
    }, {wrapper: StrictMode})
    try {
        await waitFor(() => expect(result.current.owned.ready).toBe(true))
        await act(async () => { await result.current.owned.client!.createRun({requestId: 'one', kind: 'test', input: {}}) })
        await waitFor(() => expect(Object.values(result.current.view.runs)[0]?.state).toBe('completed'))
        unmount()
        clients.forEach(client => {
            expect(client.close).toHaveBeenCalledTimes(1)
            expect(client.store.count()).toBe(0)
            expect(client.events.count()).toBe(0)
        })
    } finally { unmount(); connection.close(); host.close() }
})

test('actions lock synchronously, preserve result/error and can be retried explicitly', async () => {
    const pending = deferred<number>()
    const {result, unmount} = renderHook(() => useAsyncAction(), {wrapper: StrictMode})
    let first!: Promise<number>
    const duplicate = jest.fn()
    act(() => { first = result.current.run(() => pending.promise) })
    expect(result.current.pending).toBe(true)
    await expect(result.current.run(duplicate)).rejects.toBeInstanceOf(AsyncActionBusyError)
    expect(duplicate).not.toHaveBeenCalled()
    await act(async () => pending.resolve(42))
    expect(await first).toBe(42)
    expect(result.current.pending).toBe(false)
    const error = {code: 'denied'}
    await act(async () => { await expect(result.current.run(() => { throw error })).rejects.toBe(error) })
    expect(result.current.error).toBe(error)
    act(() => result.current.clearError())
    expect(result.current.error).toBeNull()
    await act(async () => { expect(await result.current.run(() => 'ok')).toBe('ok') })
    unmount()
})

test('old action rejection cannot overwrite a replacement scope; retained run is inert after unmount', async () => {
    const old = deferred<void>()
    const {result, rerender, unmount} = renderHook(({key}) => useAsyncAction({key}), {initialProps: {key: 1}})
    let pending!: Promise<void>
    act(() => { pending = result.current.run(() => old.promise) })
    const handled = pending.catch(error => error)
    rerender({key: 2})
    await act(async () => { await result.current.run(() => 'new') })
    await act(async () => old.reject('old'))
    expect(await handled).toBe('old')
    expect(result.current).toMatchObject({pending: false, error: null})
    const run = result.current.run
    unmount()
    const invocation = jest.fn()
    await expect(run(invocation)).rejects.toBeInstanceOf(AsyncActionUnavailableError)
    expect(invocation).not.toHaveBeenCalled()
})

test('typed command binding allocates one id per accepted run and preserves method receiver', async () => {
    const work = deferred<string>()
    const commands = {save: jest.fn(function (this: unknown, id: string, value: number) {
        expect(this).toBe(commands); expect(id).toBe('id-1'); expect(value).toBe(7); return work.promise
    })}
    const requestId = jest.fn(() => 'id-1')
    const {result, rerender, unmount} = renderHook(({enabled}) => useServiceCommands(enabled ? commands : null, {requestId}),
        {initialProps: {enabled: true}})
    let pending!: Promise<string>
    act(() => { pending = result.current.run('save', 7) })
    await expect(result.current.run('save', 8)).rejects.toBeInstanceOf(AsyncActionBusyError)
    expect(requestId).toHaveBeenCalledTimes(1)
    await act(async () => work.resolve('saved'))
    expect(await pending).toBe('saved')
    expect(commands.save).toHaveBeenCalledTimes(1)
    rerender({enabled: false})
    await expect(result.current.run('save', 7)).rejects.toBeInstanceOf(AsyncActionUnavailableError)
    expect(requestId).toHaveBeenCalledTimes(1)
    unmount()
})

test('command rejection is preserved without retry and uses the latest request-id factory', async () => {
    const failure = new Error('offline')
    const commands = {save: jest.fn(async (_id: string) => { throw failure })}
    const first = jest.fn(() => 'one')
    const second = jest.fn(() => 'two')
    const {result, rerender, unmount} = renderHook(({requestId}) => useServiceCommands(commands, {requestId}),
        {initialProps: {requestId: first}})
    rerender({requestId: second})
    await act(async () => { await expect(result.current.run('save')).rejects.toBe(failure) })
    expect(result.current).toMatchObject({pending: false, error: failure})
    expect(commands.save).toHaveBeenCalledTimes(1)
    expect(commands.save).toHaveBeenCalledWith('two')
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    unmount()
})

test('default request ids use crypto.randomUUID once per accepted command', async () => {
    const uuid = jest.spyOn(crypto, 'randomUUID')
    const commands = {echo: async (id: string) => id}
    const {result, unmount} = renderHook(() => useServiceCommands(commands))
    try {
        await act(async () => { expect(await result.current.run('echo')).toMatch(/^[0-9a-f-]{36}$/i) })
        expect(uuid).toHaveBeenCalledTimes(1)
    } finally { unmount(); uuid.mockRestore() }
})

test('tuple and direct calls share one lock, request ID and original rejection without retry', async () => {
    const work = deferred<number>()
    const requestId = jest.fn(() => 'tuple-id')
    const failure = new Error('tuple failed')
    const commands = {save: jest.fn((_id: string, value: number, enabled: boolean) => work.promise)}
    const {result, unmount} = renderHook(() => useServiceCommands(commands, {requestId}))
    let pending!: Promise<number>
    act(() => { pending = result.current.runTuple(['save', 7, true]) })
    const handled = pending.catch(error => error)
    await expect(result.current.run('save', 8, false)).rejects.toBeInstanceOf(AsyncActionBusyError)
    await expect(result.current.runTuple(['save', 9, false])).rejects.toBeInstanceOf(AsyncActionBusyError)
    expect(requestId).toHaveBeenCalledTimes(1)
    expect(commands.save).toHaveBeenCalledWith('tuple-id', 7, true)
    await act(async () => work.reject(failure))
    expect(await handled).toBe(failure)
    expect(result.current).toMatchObject({pending: false, error: failure})
    expect(commands.save).toHaveBeenCalledTimes(1)
    unmount()
})
