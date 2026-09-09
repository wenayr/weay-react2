import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {useFloatingWindowController} from '../src/windows/index.js';
import {createContextMenu} from '../src/internal/menu/menuMouse.js';
import {flushAnimationFrames} from './setup';

function Probe() {
    const drag = useFloatingWindowController({position: {x: 40, y: 50}, snappable: false});
    return <div>
        <div data-testid="handle" onMouseDown={drag.onHeaderMouseDown}
            onTouchStart={drag.onHeaderTouchStart}>Move window</div>
        <div data-testid="stop" onMouseUp={e => e.stopPropagation()}
            onTouchEnd={e => e.stopPropagation()}>Interactive content</div>
        <output data-testid="state">{String(drag.dragging)}:{drag.position.x},{drag.position.y}</output>
    </div>;
}

test.each([1, 2])('mouse button %s must not arm window dragging', button => {
    render(<Probe/>);
    fireEvent.mouseDown(screen.getByTestId('handle'), {button, clientX: 60, clientY: 60});
    expect(screen.getByTestId('state').textContent).toBe('false:40,50');
});

test('release over an element that stops bubbling ends the drag and flushes its last move', () => {
    render(<Probe/>);
    fireEvent.mouseDown(screen.getByTestId('handle'), {button: 0, clientX: 60, clientY: 60});
    fireEvent.mouseMove(document, {buttons: 1, clientX: 120, clientY: 100});
    fireEvent.mouseUp(screen.getByTestId('stop'));
    expect(screen.getByTestId('state').textContent).toBe('false:100,90');
    fireEvent.mouseMove(document, {buttons: 1, clientX: 200, clientY: 200});
    act(() => { flushAnimationFrames(); });
    expect(screen.getByTestId('state').textContent).toBe('false:100,90');
});

test('a context-menu long press does not swallow window drag termination', () => {
    const menu = createContextMenu({name: 'drag-end'});
    render(<menu.Layer other={() => [{name: 'Header action'}]}><Probe/></menu.Layer>);
    const point = {identifier: 1, clientX: 60, clientY: 60, screenX: 60, screenY: 60};
    fireEvent.touchStart(screen.getByTestId('handle'), {touches: [point], changedTouches: [point]});
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 400);
    try {
        fireEvent.touchEnd(screen.getByTestId('handle'), {touches: [], changedTouches: [point]});
        expect(screen.getByText('Header action')).not.toBeNull();
        expect(screen.getByTestId('state').textContent).toBe('false:40,50');
    } finally { now.mockRestore(); }
});
