import {useCallback, useEffect, useMemo, useState} from 'react'
import type * as Contract from 'wenay-common2/contract'
import {structEqual} from '../utils/structEqual.js'

function idleSlot(slotId: string): Contract.ContractSlotStatus {
    return {
        slotId,
        state: 'idle',
        demand: null,
        binding: null,
        previous: null,
        candidates: [],
        error: null,
    }
}

export type ContractSlotController = {
    runtime: Contract.ContractRuntime | null
    slotId: string
    status: Contract.ContractSlotStatus
    state: Contract.tContractSlotState
    binding: Contract.ContractBinding | null
    lastEvent: Contract.ContractBindingEvent | null
    acquire<T extends object>(): Contract.ContractLease<T>
    explain(): Contract.ContractExplanation | null
    history(): Contract.ContractBindingEvent[]
}

/**
 * React view over one slot of an already-created common2 Contract runtime.
 * Discovery, loading, policy, replacement, leases and runtime ownership stay
 * outside React; this hook only projects low-frequency status/binding changes.
 */
export function useContractSlot(
    runtime: Contract.ContractRuntime | null | undefined,
    slotId: string,
): ContractSlotController {
    const [lastEvent, setLastEvent] = useState<Contract.ContractBindingEvent | null>(null)
    // The status channel fires for the WHOLE runtime, so a version counter re-rendered every
    // slot consumer on every event and handed each one a freshly snapshotted object. Holding
    // this slot's status in state and comparing structurally keeps both the render and the
    // identity stable when nothing about THIS slot changed.
    const readSlot = () => runtime
        ? runtime.api.status.node.snapshot().slots[slotId] ?? idleSlot(slotId)
        : idleSlot(slotId)
    const [status, setStatus] = useState<Contract.ContractSlotStatus>(readSlot)

    useEffect(() => {
        setLastEvent(null)
        setStatus(prev => { const next = readSlot(); return structEqual(prev, next) ? prev : next })
        if (!runtime) return
        const offStatus = runtime.api.status.node.on(() => {
            setStatus(prev => { const next = readSlot(); return structEqual(prev, next) ? prev : next })
        })
        const offChanged = runtime.api.changed.on(event => {
            if (event.slotId == slotId) setLastEvent(event)
        })
        return () => {
            offStatus()
            offChanged()
        }
    }, [runtime, slotId])

    const acquire = useCallback(<T extends object>() => {
        if (!runtime) throw new Error(`useContractSlot: runtime is unavailable for ${slotId}`)
        return runtime.api.acquire<T>(slotId)
    }, [runtime, slotId])
    const explain = useCallback(() => runtime?.api.explain(slotId) ?? null, [runtime, slotId])
    const history = useCallback(
        () => runtime?.api.history().filter(event => event.slotId == slotId) ?? [],
        [runtime, slotId],
    )

    return useMemo(() => ({
        runtime: runtime ?? null,
        slotId,
        status,
        state: status.state,
        binding: status.binding,
        lastEvent,
        acquire,
        explain,
        history,
    }), [runtime, slotId, status, lastEvent, acquire, explain, history])
}
