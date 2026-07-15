import React from 'react'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {createRightClickMenu} from '../src/common/src/menu/menuR'

afterEach(() => cleanup())

function renderMenu(props: {captureGlobal?: boolean, statusOn?: boolean, onConsume?: () => void} = {}) {
    const rightClick = createRightClickMenu()

    render(<>
        <rightClick.MenuR
            captureGlobal={props.captureGlobal}
            statusOn={props.statusOn}
            onConsume={props.onConsume}
            other={() => [{name: 'global action'}]}
        >
            <div>inside</div>
        </rightClick.MenuR>
        <div>outside</div>
    </>)

    return rightClick
}

test('MenuR keeps global right clicks disabled by default', () => {
    renderMenu()
    const outside = screen.getByText('outside')
    const contextMenu = new MouseEvent('contextmenu', {bubbles: true, cancelable: true})

    expect(outside.dispatchEvent(contextMenu)).toBe(true)
    fireEvent.mouseUp(outside, {button: 2, clientX: 40, clientY: 50})

    expect(screen.queryByText('global action')).toBeNull()
})

test('MenuR can capture a global right click and suppress the native menu', () => {
    const onConsume = jest.fn()
    renderMenu({captureGlobal: true, onConsume})
    const outside = screen.getByText('outside')
    const contextMenu = new MouseEvent('contextmenu', {bubbles: true, cancelable: true})

    expect(outside.dispatchEvent(contextMenu)).toBe(false)
    fireEvent.mouseUp(outside, {button: 2, clientX: 40, clientY: 50})

    expect(screen.getByText('global action')).toBeTruthy()
    expect(onConsume).toHaveBeenCalledTimes(1)
})

test('MenuR global capture respects statusOn and is removed on unmount', () => {
    const onConsume = jest.fn()
    const rightClick = renderMenu({captureGlobal: true, statusOn: false, onConsume})
    const outside = screen.getByText('outside')
    const contextMenu = new MouseEvent('contextmenu', {bubbles: true, cancelable: true})

    expect(outside.dispatchEvent(contextMenu)).toBe(true)
    fireEvent.mouseUp(outside, {button: 2, clientX: 40, clientY: 50})
    expect(onConsume).not.toHaveBeenCalled()
    expect(rightClick.bb()).toBe(false)

    cleanup()
    fireEvent.mouseUp(document, {button: 2, clientX: 40, clientY: 50})
    expect(onConsume).not.toHaveBeenCalled()
})
