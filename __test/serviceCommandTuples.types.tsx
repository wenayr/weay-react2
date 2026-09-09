import React from 'react'
import {useServiceCommands} from '../src/react/index.js'
import type {ServiceCommandCall, ServiceCommandMap, ServiceCommandsController} from '../src/react/index.js'

const map = {
    save: async (_id: string, input: {title: string}) => input.title.length,
    remove: async (_id: string, index: number, force: boolean) => force && index >= 0,
    ping: (_id: string) => 'pong',
}
type Call = ServiceCommandCall<typeof map>
function Child({call, execute}: {call: Call; execute: ServiceCommandsController<typeof map>['runTuple']}) {
    return <button onClick={() => { void execute(call).catch(() => {}) }}>Run</button>
}
function Middle(props: {call: Call; execute: ServiceCommandsController<typeof map>['runTuple']}) { return <Child {...props}/> }
function Parent() {
    const actions = useServiceCommands(map)
    return <Middle call={['save', {title: 'one'}]} execute={actions.runTuple}/>
}
function generic<C extends ServiceCommandMap>(controller: ServiceCommandsController<C>, call: ServiceCommandCall<C>) {
    return controller.runTuple(call)
}
function exact(controller: ServiceCommandsController<typeof map>, call: Call) {
    const save: Promise<number> = controller.runTuple(['save', {title: 'one'}])
    const remove: Promise<boolean> = controller.runTuple(['remove', 0, true])
    const ping: Promise<string> = controller.runTuple(['ping'])
    const union: Promise<number | boolean | string> = controller.runTuple(call)
    // @ts-expect-error unknown name
    controller.runTuple(['bad'])
    // @ts-expect-error another command's payload
    controller.runTuple(['save', 0, true])
    // @ts-expect-error required second argument
    controller.runTuple(['remove', 0])
    // @ts-expect-error request ID is supplied by the hook
    controller.runTuple(['ping', 'extra'])
    // @ts-expect-error correlated tuple rejects mismatched input at the component boundary
    const wrong: Call = ['save', {index: 0}]
    return {save, remove, ping, union, wrong}
}
