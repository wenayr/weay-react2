import {useCallback, useEffect, useMemo, useState} from 'react'
import type {Contract} from 'wenay-common2'

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
    const [version, setVersion] = useState(0)
    const [lastEvent, setLastEvent] = useState<Contract.ContractBindingEvent | null>(null)

    useEffect(() => {
        setLastEvent(null)
        setVersion(value => value + 1)
        if (!runtime) return
        const offStatus = runtime.api.status.node.on(() => setVersion(value => value + 1))
        const offChanged = runtime.api.changed.on(event => {
            if (event.slotId == slotId) setLastEvent(event)
        })
        return () => {
            offStatus()
            offChanged()
        }
    }, [runtime, slotId])

    const status = useMemo(() => {
        if (!runtime) return idleSlot(slotId)
        return runtime.api.status.node.snapshot().slots[slotId] ?? idleSlot(slotId)
    }, [runtime, slotId, version])

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
