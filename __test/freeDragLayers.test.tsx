import React from 'react';
import {act, fireEvent, render} from '@testing-library/react';
import {Card58} from '../src/stand/testUseReact/cards/freeDragKeyboard';

test('demo layer controls retain DOM, text and saved position without committing', () => {
    const view = render(<Card58/>);
    const a = view.container.querySelector<HTMLElement>('[data-free-note="A"]')!;
    const b = view.container.querySelector<HTMLElement>('[data-free-note="B"]')!;
    const text = view.getByLabelText('Текст A');
    fireEvent.change(text, {target: {value: 'keep draft'}});
    fireEvent.click(view.getByRole('button', {name: 'A на передний план'}));
    expect(a.style.zIndex).toBe('2');
    expect(b.style.zIndex).toBe('1');
    expect(a.style.left).toBe('30px');
    expect(a.textContent).toContain('сохранений: 0');
    expect(view.container.querySelector('[data-free-note="A"]')).toBe(a);
    expect((text as HTMLTextAreaElement).value).toBe('keep draft');
    act(() => view.getByLabelText('Текст B').focus());
    expect(b.style.zIndex).toBe('2');
    expect(document.activeElement).toBe(view.getByLabelText('Текст B'));
    fireEvent.pointerDown(text);
    expect(a.style.zIndex).toBe('2');
});

test('demo keyboard pickup raises persistently through cancel and drop', () => {
    const view = render(<Card58/>);
    const a = view.container.querySelector<HTMLElement>('[data-free-note="A"]')!;
    const handle = view.getByRole('button', {name: 'Переместить A'});
    fireEvent.keyDown(handle, {key: ' '});
    fireEvent.keyDown(handle, {key: 'ArrowRight'});
    fireEvent.keyDown(handle, {key: 'Escape'});
    expect(a.style.zIndex).toBe('2');
    expect(a.textContent).toContain('сохранений: 0');
    fireEvent.keyDown(handle, {key: ' '});
    fireEvent.keyDown(handle, {key: 'ArrowRight'});
    fireEvent.keyDown(handle, {key: 'Enter'});
    expect(a.style.zIndex).toBe('2');
    expect(a.style.left).toBe('40px');
    expect(a.textContent).toContain('сохранений: 1');
    fireEvent.click(view.getByRole('button', {name: 'Удалить A'}));
    expect(view.queryByRole('button', {name: 'A на передний план'})).toBeNull();
    expect(view.container.querySelector<HTMLElement>('[data-free-note="B"]')!.style.zIndex).toBe('1');
});
