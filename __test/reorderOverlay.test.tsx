import React, {useState} from 'react';
import {createPortal} from 'react-dom';
import {fireEvent, render, screen} from '@testing-library/react';
import {useReorder, useReorderBoard} from '../src/react/index.js';

function Harness({board = false}: {board?: boolean}) {
    const [columns, setColumns] = useState([{key: 'one', items: ['a']}, {key: 'two', items: ['b']}]);
    const [order, setOrder] = useState(['a', 'b']);
    const single = useReorder({order, commit: setOrder});
    const multi = useReorderBoard({columns, commit: setColumns});
    const drag = board ? multi : single;
    const item = (key: string) => {
        const it = drag.item(key);
        return <div key={key} data-testid={key} {...it.props}
            style={{...it.style, visibility: it.dragging && drag.overlay ? 'hidden' : undefined}}>{key}</div>;
    };
    return <>
        <div data-testid="clip" style={{overflow: 'hidden', transform: 'scale(2)'}}>
            {board ? columns.map(col => <div key={col.key} data-testid={col.key} ref={multi.columnRef(col.key)}>{col.items.map(item)}</div>)
                : <div ref={single.listRef} data-testid="list">{order.map(item)}</div>}
        </div>
        {drag.overlay && createPortal(<div data-testid="overlay" aria-hidden="true" style={drag.overlay.style}>{drag.overlay.key}</div>, document.body)}
        <output data-testid="result">{board ? columns.map(c => c.items.join(',')).join('|') : order.join(',')}</output>
    </>;
}

function rect(x: number, y: number, width: number, height: number): DOMRect {
    return {x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON() { return {}; }};
}
function layout(board: boolean) {
    const a = screen.getByTestId('a');
    const b = screen.getByTestId('b');
    for (const [el, x] of [[a, 0], [b, 100]] as const) {
        Object.defineProperties(el, {
            offsetLeft: {configurable: true, value: x}, offsetTop: {configurable: true, value: 0},
            offsetWidth: {configurable: true, value: 80}, offsetHeight: {configurable: true, value: 30},
        });
        el.getBoundingClientRect = () => rect(100 + x * 2, 50, 160, 60);
    }
    for (const key of board ? ['one', 'two'] : ['list']) {
        const el = screen.getByTestId(key);
        const x = key === 'two' ? 300 : 100;
        const width = board ? 200 : 400;
        Object.defineProperty(el, 'offsetWidth', {configurable: true, value: width / 2});
        el.getBoundingClientRect = () => rect(x, 50, width, 240);
    }
}

test.each([false, true])('viewport overlay escapes clipping at scale 2 and clears on drop (board=%s)', board => {
    const view = render(<Harness board={board}/>);
    layout(board);
    const source = screen.getByTestId('a');
    fireEvent.mouseDown(source, {button: 0, clientX: 120, clientY: 70});
    fireEvent.mouseMove(document, {clientX: 320, clientY: 80});
    const overlay = screen.getByTestId('overlay');
    expect(overlay.parentElement).toBe(document.body);
    expect(screen.getByTestId('clip').contains(overlay)).toBe(false);
    expect(overlay.style.position).toBe('fixed');
    expect(overlay.style.left).toBe('300px'); // full viewport delta, not divided by scale
    expect(overlay.style.top).toBe('60px');
    expect(overlay.style.width).toBe('160px');
    expect(overlay.style.height).toBe('60px');
    expect(overlay.style.pointerEvents).toBe('none');
    expect(source.style.visibility).toBe('hidden');
    expect(source.style.display).not.toBe('none');
    fireEvent.mouseUp(document);
    expect(screen.queryByTestId('overlay')).toBeNull();
    expect(screen.getByTestId('a').style.visibility).toBe('');
    expect(screen.getByTestId('result').textContent).toBe(board ? '|b,a' : 'b,a');
    view.unmount();
});

test('touch overlay preserves grab offset and is removed on unmount', () => {
    const view = render(<Harness board/>);
    layout(true);
    fireEvent.touchStart(screen.getByTestId('a'), {changedTouches: [{identifier: 7, clientX: 120, clientY: 70}]});
    fireEvent.touchMove(document, {changedTouches: [{identifier: 7, clientX: 160, clientY: 100}]});
    expect(screen.getByTestId('overlay').style.left).toBe('140px');
    expect(screen.getByTestId('overlay').style.top).toBe('80px');
    view.unmount();
    expect(screen.queryByTestId('overlay')).toBeNull();
    fireEvent.touchMove(document, {changedTouches: [{identifier: 7, clientX: 180, clientY: 120}]});
    expect(screen.queryByTestId('overlay')).toBeNull();
});
