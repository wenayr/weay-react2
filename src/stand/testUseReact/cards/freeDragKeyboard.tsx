import React, {useEffect, useId, useRef, useState} from 'react';
import {useDraggableApi} from '../../../react/index.js';
import type {Position} from '../../../react/index.js';
import {Check, DemoHint, ExampleCode} from '../standKit.js';

function FreeNote({name, initial, enabled, step, layer, raise, remove}: {
    name: string; initial: Position; enabled: boolean; step: number;
    layer: number; raise(): void; remove(): void;
}) {
    const [saved, setSaved] = useState(initial);
    const [commits, setCommits] = useState(0);
    const [message, setMessage] = useState('Готова');
    const base = useRef(saved);
    const note = useRef<HTMLElement>(null);
    const preview = useRef<HTMLOutputElement>(null);
    const instructions = useId();
    function clear(position = base.current) {
        if (note.current) note.current.style.transform = '';
        if (preview.current) preview.current.textContent = `${position.x}, ${position.y}`;
    }
    function point(delta: Position) {
        return {x: Math.max(0, Math.min(520, base.current.x + delta.x)),
            y: Math.max(0, Math.min(210, base.current.y + delta.y))};
    }
    const drag = useDraggableApi({holdMs: 0, enabled, keyboard: {step, multiplier: 5}, trackState: false,
        onDragStart() { raise(); base.current = saved; setMessage('Перемещение'); },
        onMove(delta) {
            const next = point(delta);
            const constrained = {x: next.x - base.current.x, y: next.y - base.current.y};
            drag.setPosition(constrained);
            if (note.current) note.current.style.transform = `translate(${constrained.x}px, ${constrained.y}px)`;
            if (preview.current) preview.current.textContent = `${next.x}, ${next.y}`;
        },
        onDragEnd(delta) {
            const next = point(delta);
            clear(next); setSaved(next);
            if (next.x !== base.current.x || next.y !== base.current.y) setCommits(n => n + 1);
            setMessage('Сохранена');
        },
        onDragCancel() { clear(); setMessage('Отменена'); },
    });
    return <article ref={note} data-free-note={name} onPointerDownCapture={raise} onFocusCapture={raise}
        style={{position: 'absolute', left: saved.x, top: saved.y,
        width: 210, padding: 12, background: '#fff6ce', color: '#263247', border: '1px solid #cab96a',
        boxShadow: '0 4px 10px #0002', borderRadius: 8, zIndex: layer}}>
        <button {...drag.handleProps} aria-label={`Переместить ${name}`} aria-describedby={instructions}
            style={{...drag.handleProps.style, width: '100%', padding: 7, cursor: 'grab'}}>{name} · слой {layer} · ⠿</button>
        <small id={instructions}>Пробел/Enter — взять; стрелки; Shift ×5; Enter — сохранить; Esc — отменить.</small>
        <textarea aria-label={`Текст ${name}`} defaultValue="Общая идея" style={{width: '100%', boxSizing: 'border-box', marginTop: 6}}/>
        <div><button onMouseDown={e => e.preventDefault()} onClick={drag.cancelDrag}>Отменить {name}</button>{' '}
            <button aria-label={`Удалить ${name}`} onClick={remove}>Удалить</button></div>
        <div role="status">{message} · {drag.inputMode ?? 'idle'} · сохранений: {commits}</div>
        <div>Сохранено: {saved.x}, {saved.y} · Preview: <output ref={preview}>{saved.x}, {saved.y}</output></div>
    </article>;
}

function FreeBoard() {
    const [enabled, setEnabled] = useState(true);
    const [visible, setVisible] = useState(['A', 'B']);
    const [layers, setLayers] = useState(['A', 'B']);
    function raise(name: string) {
        setLayers(old => old[old.length - 1] === name ? old : [...old.filter(n => n !== name), name]);
    }
    const visibleLayers = layers.filter(name => visible.includes(name));
    const [step, setStep] = useState(10);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);
    return <div style={{color: '#263247'}}>
        <label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}/> Разрешить перенос</label>{' '}
        <label>Шаг <select aria-label="Шаг перемещения" value={step} onChange={e => setStep(Number(e.target.value))}>
            <option value={10}>10</option><option value={2}>2</option><option value={20}>20</option></select></label>{' '}
        <button onClick={() => { clearTimeout(timer.current); timer.current = setTimeout(() => setEnabled(false), 2500); }}>Отозвать через 2,5 с</button>{' '}
        <button onClick={() => { setVisible(['A', 'B']); setEnabled(true); }}>Вернуть заметки</button>
        <div style={{display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10}}>
            <span role="status" aria-label="Порядок слоёв">Снизу вверх: {visibleLayers.join(' → ') || 'нет заметок'}</span>
            {visible.map(name => <button key={name} onClick={() => raise(name)}
                aria-pressed={visibleLayers[visibleLayers.length - 1] === name}>{name} на передний план</button>)}
        </div>
        <div style={{overflow: 'auto', maxHeight: 420, marginTop: 12, border: '1px solid #a9b7c9'}} aria-label="Свободная поверхность">
            <div style={{width: 760, height: 470, position: 'relative', isolation: 'isolate', background: '#eef3fa'}}>
                {visible.map((name, i) => <FreeNote key={name} name={name} initial={{x: 30 + i * 300, y: 30 + i * 70}}
                    enabled={enabled} step={step} layer={visibleLayers.indexOf(name) + 1} raise={() => raise(name)}
                    remove={() => setVisible(old => old.filter(n => n !== name))}/>)}
            </div>
        </div>
        <DemoHint>Клик, фокус или захват поднимают заметку; после отпускания она остаётся сверху. Кнопки над доской позволяют достать перекрытую заметку. Порядок слоёв, границы и сохранение принадлежат примеру; сеть здесь не имитируется.</DemoHint>
        <ExampleCode>{`const drag = useDraggableApi({
  holdMs: 0, keyboard: {step: 10, multiplier: 5}, enabled,
  trackState: false, onDragStart: () => { raise(id); captureBase(); },
  onMove: previewDelta, onDragEnd: commitDelta, onDragCancel: clearPreview,
});
<button {...drag.handleProps} aria-label="Переместить заметку" />
// On external revision/room change: drag.cancelDrag()
// Bounds and delta-to-board conversion belong to previewDelta.`}</ExampleCode>
    </div>;
}
export function Card58() {
    return <Check n={58} id="free-drag-keyboard" title="Free notes — one mouse/touch/keyboard gesture"
        do="Overlap the notes and switch the front layer using the toolbar, click/focus or drag. Move A with Space/arrows/Shift/Enter; cancel once with Escape. Use timed revoke; edit text, delete B and scroll."
        expect="The selected note stays above the other after drop/cancel, with stable focus and text. One save per changed confirmation, none on cancellation/revoke/unmount. Layer changes do not save positions."
        note="R4, public useDraggableApi; local consumer only, no deployed organizer or network acceptance."><FreeBoard/></Check>;
}
