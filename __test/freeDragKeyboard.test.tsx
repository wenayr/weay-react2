import React, {StrictMode} from 'react';
import {act, fireEvent, render} from '@testing-library/react';
import {useDraggableApi} from '../src/react/index';
import type {UseDraggableApi, UseDraggableOptions} from '../src/react/index';

function setup(extra: UseDraggableOptions = {}) {
    const start = jest.fn(), move = jest.fn(), end = jest.fn(), cancel = jest.fn();
    let api!: UseDraggableApi, renders = 0;
    function Host({enabled = true, keyboard = extra.keyboard ?? true}) {
        renders++;
        api = useDraggableApi({holdMs: 0, trackState: false, onDragStart: start, onMove: move,
            onDragEnd: end, onDragCancel: cancel, ...extra, enabled, keyboard});
        return <><button {...api.handleProps}>move</button><textarea aria-label="text"/><select aria-label="select"><option>A</option></select><button>delete</button></>;
    }
    const view = render(<StrictMode><Host/></StrictMode>);
    return {...view, handle: view.container.querySelector('button')!, start, move, end, cancel,
        api: () => api, renders: () => renders,
        update: (enabled: boolean, keyboard = extra.keyboard ?? true) => view.rerender(<StrictMode><Host enabled={enabled} keyboard={keyboard}/></StrictMode>)};
}
test('keyboard shares start/move/end, configurable modifier, no per-move renders or native form submit', () => {
    const x = setup({keyboard: {step: 3, multiplier: 4, modifier: 'alt'}});
    act(() => x.handle.focus());
    fireEvent.keyDown(x.handle, {key: ' '});
    expect(x.api().inputMode).toBe('keyboard');
    expect(x.handle.getAttribute('aria-pressed')).toBe('true');
    const count = x.renders();
    fireEvent.keyDown(x.handle, {key: 'ArrowRight'});
    fireEvent.keyDown(x.handle, {key: 'ArrowDown', altKey: true});
    expect(x.api().getPosition()).toEqual({x: 3, y: 12});
    expect(x.renders()).toBe(count);
    fireEvent.keyDown(x.handle, {key: 'Enter', repeat: true});
    expect(x.end).not.toHaveBeenCalled();
    fireEvent.keyDown(x.handle, {key: 'Enter'});
    fireEvent.keyUp(x.handle, {key: 'Enter'});
    fireEvent.click(x.handle);
    expect(x.start).toHaveBeenCalledTimes(1);
    expect(x.end).toHaveBeenCalledTimes(1);
    expect(x.end).toHaveBeenCalledWith({x: 3, y: 12});
    expect(x.api().inputMode).toBeNull();
    expect(x.api().getPosition()).toEqual({x: 0, y: 0});
    expect(document.activeElement).toBe(x.handle);
    expect(x.handle.getAttribute('type')).toBe('button');
});
test('Escape and programmatic cancel notify once and never commit', () => {
    const x = setup();
    fireEvent.keyDown(x.handle, {key: 'Enter'});
    fireEvent.keyDown(x.handle, {key: 'ArrowRight', shiftKey: true});
    expect(x.move).toHaveBeenLastCalledWith({x: 50, y: 0});
    fireEvent.keyDown(x.handle, {key: 'Escape'});
    act(() => x.api().cancelDrag());
    fireEvent.mouseUp(document);
    expect(x.cancel).toHaveBeenCalledTimes(1);
    expect(x.end).not.toHaveBeenCalled();
});
test.each(['mouse', 'touch', 'keyboard'] as const)('%s cancellation fences late release and unmount', mode => {
    const x = setup();
    function begin() {
        if (mode === 'mouse') fireEvent.mouseDown(x.handle, {clientX: 5, clientY: 5});
        else if (mode === 'touch') fireEvent.touchStart(x.handle, {changedTouches: [{identifier: 7, clientX: 5, clientY: 5}]});
        else fireEvent.keyDown(x.handle, {key: ' '});
    }
    begin();
    expect(x.api().inputMode).toBe(mode);
    act(() => { x.api().cancelDrag(); fireEvent.mouseUp(document); });
    fireEvent.touchEnd(document, {changedTouches: [{identifier: 7}]});
    expect(x.end).not.toHaveBeenCalled();
    begin(); x.unmount();
    expect(x.cancel).toHaveBeenCalledTimes(2);
    expect(x.api().isDragging).toBe(false);
    fireEvent.mouseUp(document);
    expect(x.end).not.toHaveBeenCalled();
});
test('one gesture owner includes the pending hold; touch uses its own identifier', () => {
    jest.useFakeTimers();
    try {
        const x = setup({holdMs: 100});
        fireEvent.mouseDown(x.handle);
        fireEvent.keyDown(x.handle, {key: ' '});
        act(() => jest.advanceTimersByTime(100));
        expect(x.start).toHaveBeenCalledTimes(1);
        expect(x.api().inputMode).toBe('mouse');
        fireEvent.keyDown(x.handle, {key: 'Enter'});
        fireEvent.mouseUp(document);
        expect(x.end).toHaveBeenCalledTimes(1);
        fireEvent.keyDown(x.handle, {key: ' '});
        fireEvent.mouseDown(x.handle);
        act(() => jest.advanceTimersByTime(200));
        expect(x.api().inputMode).toBe('keyboard');
        act(() => x.api().cancelDrag());
        fireEvent.touchStart(x.handle, {changedTouches: [{identifier: 7, clientX: 10, clientY: 10}]});
        act(() => jest.advanceTimersByTime(100));
        fireEvent.touchEnd(document, {changedTouches: [{identifier: 8}]});
        expect(x.api().inputMode).toBe('touch');
        fireEvent.touchMove(document, {changedTouches: [{identifier: 7, clientX: 30, clientY: 40}]});
        expect(x.api().getPosition()).toEqual({x: 20, y: 30});
        fireEvent.touchCancel(document, {changedTouches: [{identifier: 7}]});
        expect(x.api().isDragging).toBe(false);
    } finally { jest.useRealTimers(); }
});
test('disabled input, keyboard opt-out, blur and independent controls', () => {
    const x = setup();
    expect(fireEvent.keyDown(x.handle, {key: 'ArrowDown'})).toBe(true);
    for (const control of [x.getByLabelText('text'), x.getByLabelText('select'), x.getByText('delete')]) {
        fireEvent.keyDown(control, {key: ' '}); fireEvent.mouseDown(control);
    }
    expect(x.start).not.toHaveBeenCalled();
    fireEvent.keyDown(x.handle, {key: ' '});
    x.update(false);
    expect(x.cancel).toHaveBeenCalledTimes(1);
    x.update(true, false);
    fireEvent.keyDown(x.handle, {key: ' '});
    expect(x.api().isDragging).toBe(false);
    x.update(true);
    fireEvent.keyDown(x.handle, {key: ' '});
    fireEvent.blur(x.handle);
    expect(x.cancel).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(x.handle, {key: ' '});
    fireEvent.blur(window);
    expect(x.cancel).toHaveBeenCalledTimes(3);
});
test('setters are silent, StrictMode preserves initial seed, trackState true renders moves', () => {
    const x = setup({initialPosition: {x: 2, y: 4}, trackState: true});
    expect(x.api().getPosition()).toEqual({x: 2, y: 4});
    act(() => x.api().setPosition({x: 6, y: 8}));
    fireEvent.keyDown(x.handle, {key: ' '});
    const count = x.renders();
    fireEvent.keyDown(x.handle, {key: 'ArrowLeft'});
    expect(x.renders()).toBeGreaterThan(count);
    expect(x.api().getPosition()).toEqual({x: -4, y: 8});
    act(() => x.api().resetPosition());
    expect(x.api().isDragging).toBe(true);
    expect(x.move).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(x.handle, {key: 'Enter'});
    expect(x.end).toHaveBeenCalledWith({x: 0, y: 0});
});
test('separate instances keep separate positions and cancellation', () => {
    const a = setup(), b = setup();
    fireEvent.keyDown(a.handle, {key: ' '});
    fireEvent.keyDown(b.handle, {key: ' '});
    fireEvent.keyDown(a.handle, {key: 'ArrowRight'});
    expect(b.api().getPosition()).toEqual({x: 0, y: 0});
    act(() => a.api().cancelDrag());
    expect(b.api().isDragging).toBe(true);
});

test('pending holds cancel/unmount silently and never restart', () => {
    jest.useFakeTimers();
    try {
        const x = setup({holdMs: 500});
        fireEvent.mouseDown(x.handle);
        act(() => x.api().cancelDrag());
        fireEvent.touchStart(x.handle, {changedTouches: [{identifier: 1, clientX: 0, clientY: 0}]});
        x.unmount();
        act(() => jest.advanceTimersByTime(1000));
        expect(x.start).not.toHaveBeenCalled();
        expect(x.end).not.toHaveBeenCalled();
        expect(x.cancel).not.toHaveBeenCalled();
    } finally { jest.useRealTimers(); }
});
test('consumer constraints set the next keyboard baseline; callback cancel releases immediately', () => {
    let current!: UseDraggableApi;
    const x = setup({onMove: p => current.setPosition({x: Math.min(p.x, 15), y: p.y})});
    current = x.api();
    fireEvent.keyDown(x.handle, {key: ' '});
    fireEvent.keyDown(x.handle, {key: 'ArrowRight', shiftKey: true});
    expect(current.getPosition().x).toBe(15);
    fireEvent.keyDown(x.handle, {key: 'ArrowLeft'});
    expect(current.getPosition().x).toBe(5);
    x.update(true, false);
    expect(x.cancel).toHaveBeenCalledTimes(1);
    expect(current.inputMode).toBeNull();
    const y = setup({onDragStart: () => y.api().cancelDrag()});
    fireEvent.mouseDown(y.handle);
    fireEvent.mouseMove(document, {clientX: 50, clientY: 50});
    fireEvent.mouseUp(document);
    expect(y.api().isDragging).toBe(false);
    expect(y.cancel).toHaveBeenCalledTimes(1);
    expect(y.end).not.toHaveBeenCalled();
});
test('touch confirmation delivers one final delta and rejects competing mouse start', () => {
    const x = setup();
    fireEvent.touchStart(x.handle, {changedTouches: [{identifier: 1, clientX: 20, clientY: 30}]});
    fireEvent.mouseDown(x.handle);
    fireEvent.touchMove(document, {changedTouches: [{identifier: 1, clientX: 55, clientY: 45}]});
    fireEvent.touchEnd(document, {changedTouches: [{identifier: 1}]});
    fireEvent.touchEnd(document, {changedTouches: [{identifier: 1}]});
    expect(x.start).toHaveBeenCalledTimes(1);
    expect(x.end).toHaveBeenCalledTimes(1);
    expect(x.end).toHaveBeenCalledWith({x: 35, y: 15});
});
