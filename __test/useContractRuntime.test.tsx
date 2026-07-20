import React from 'react'
import {act, render, screen, waitFor} from '@testing-library/react'
import {Contract} from 'wenay-common2'
import {useContractSlot} from '../src/common/src/hooks/useContractRuntime'

type EditorApi = {format(value: string): string}

function editorOffer(id: string, implementationVersion: string, priority: number): Contract.ContractOffer<EditorApi> {
    return {
        id,
        priority,
        descriptor: {
            protocol: 1,
            contractId: 'qa.editor',
            contractVersion: '1.0.0',
            implementationId: 'qa-editor',
            implementationVersion,
            capabilities: ['format'],
        },
        open: () => ({api: {format: value => `${implementationVersion}:${value}`}, close() {}}),
    }
}

test('useContractSlot follows binding replacement and releases subscriptions', async () => {
    const runtime = Contract.createContractRuntime()

    function Probe() {
        const slot = useContractSlot(runtime, 'main.editor')
        return <>
            <output data-testid="state">{slot.state}</output>
            <output data-testid="implementation">{slot.binding?.descriptor.implementationVersion ?? 'none'}</output>
            <output data-testid="event">{slot.lastEvent?.reason ?? 'none'}</output>
        </>
    }

    const view = render(<React.StrictMode><Probe/></React.StrictMode>)
    expect(screen.getByTestId('state').textContent).toBe('idle')
    expect(runtime.api.status.count()).toBe(1)
    expect(runtime.api.changed.count()).toBe(1)

    await act(async () => {
        await runtime.control.addOffer(editorOffer('editor.v1', 'v1', 10))
        await runtime.control.require({
            slotId: 'main.editor',
            contractId: 'qa.editor',
            versionRange: '1.0.0',
            generation: 1,
            authorityId: 'qa',
            authorityEpoch: 1,
            required: true,
            capabilities: ['format'],
        })
    })
    await waitFor(() => expect(screen.getByTestId('implementation').textContent).toBe('v1'))

    const lease = runtime.api.acquire<EditorApi>('main.editor')
    expect(lease.api.format('saved')).toBe('v1:saved')
    lease.release()

    await act(async () => {
        await runtime.control.addOffer(editorOffer('editor.v2', 'v2', 20))
    })
    await waitFor(() => expect(screen.getByTestId('implementation').textContent).toBe('v2'))
    expect(screen.getByTestId('state').textContent).toBe('active')
    expect(screen.getByTestId('event').textContent).not.toBe('none')

    view.unmount()
    expect(runtime.api.status.count()).toBe(0)
    expect(runtime.api.changed.count()).toBe(0)
    runtime.close()
})
