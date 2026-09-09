import React, {useId, useMemo, useState} from 'react'
import {createPortal} from 'react-dom'
import {useReorderBoard, useServiceCommands} from '../../../react/index.js'
import type {BoardColumn, ServiceCommandCall, ServiceCommandsController} from '../../../react/index.js'
import {Check, DemoHint, ExampleCode} from '../standKit.js'

type Commands = {move: (id: string, next: BoardColumn[]) => void; reset: (id: string) => void}
type Call = ServiceCommandCall<Commands>
type Execute = ServiceCommandsController<Commands>['runTuple']
function CommandButton({call, execute}: {call: Call; execute: Execute}) {
    return <button onClick={() => { void execute(call).catch(() => {}) }}>Сбросить доску</button>
}
function CommandBar(props: {call: Call; execute: Execute}) { return <CommandButton {...props}/> }
const initial = (): BoardColumn[] => [
    {key: 'План', items: Array.from({length: 12}, (_, i) => `Задача ${i + 1}`)},
    {key: 'Работа', items: ['Проверка', 'Подготовка']}, {key: 'Готово', items: []}, {key: 'Архив', items: []},
]

function AccessibleBoard() {
    const [columns, setColumns] = useState(initial)
    const [allowed, setAllowed] = useState(true)
    const [scroll, setScroll] = useState(true)
    const [commits, setCommits] = useState(0)
    const [last, setLast] = useState('Изменений пока нет')
    const description = useId()
    const commands = useMemo<Commands>(() => ({
        move(id, next) { setColumns(next); setCommits(n => n + 1); setLast(`Перенос сохранён · ${id.slice(0, 8)}`) },
        reset() { setColumns(initial()); setCommits(0); setLast('Доска восстановлена') },
    }), [])
    const actions = useServiceCommands(commands)
    const board = useReorderBoard({columns, canDrag: () => allowed && !actions.pending,
        autoScroll: scroll ? {canScroll: el => el.dataset.reorderScroll === 'true'} : false,
        commit: next => { void actions.runTuple(['move', next]).catch(() => {}) },
    })
    const status = board.dragKey && board.over
        ? `${board.dragKey} → ${board.over.col}, позиция ${board.over.index + 1}. Enter — сохранить, Escape — отменить.`
        : `${last}. Переносов: ${commits}.`
    return <div className="wenayQaAccessibleBoard">
        <h3>Органайзер: мышь, касание или клавиатура</h3>
        <p id={description}>Tab — выбрать ручку. Space / Enter — поднять и подтвердить. ↑ ↓ — позиция, ← → — колонка. Escape — отменить.</p>
        <div className="wenayQaAccessibleControls">
            <label><input type="checkbox" checked={allowed} onChange={e => setAllowed(e.target.checked)}/> Разрешить перенос</label>
            <label><input type="checkbox" checked={scroll} onChange={e => setScroll(e.target.checked)}/> Автопрокрутка</label>
            <CommandBar call={['reset']} execute={actions.runTuple}/>
            <button onClick={board.cancel}>Отменить перенос</button>
        </div>
        <p role="status" aria-live="polite" aria-atomic="true">{status}</p>
        <div className="wenayQaAccessibleTrack" data-reorder-scroll="true" aria-label="Прокрутка доски">
            {columns.map(col => <section key={col.key} className="wenayQaAccessibleColumn">
                <h4>{col.key} <small>{col.items.length}</small></h4>
                <div className="wenayQaAccessibleItems" data-reorder-scroll="true" ref={board.columnRef(col.key)} aria-label={`Колонка ${col.key}`}>
                    {col.items.map(key => {
                        const item = board.item(key)
                        return <article key={key} className="wenayQaAccessibleTask"
                            style={{...item.style, visibility: item.dragging && board.overlay && board.inputMode === 'pointer' ? 'hidden' : undefined}}>
                            <button {...item.handleProps} aria-label={`Перенести ${key}`} aria-describedby={description}>⠿</button>
                            <span>{key}</span>
                            <input aria-label={`Заметка ${key}`} placeholder="Заметка"/>
                            <button onClick={() => setLast(`Открыта ${key}`)} aria-label={`Открыть ${key}`}>↗</button>
                        </article>
                    })}
                </div>
            </section>)}
        </div>
        {board.overlay && createPortal(<div className="wenayQaAccessibleGhost" aria-hidden="true"
            style={{...board.overlay.style, zIndex: 100000}}>⠿ {board.overlay.key}</div>, document.body)}
        <DemoHint>При переносе подведите курсор к краю колонки или доски. Прокручивается разрешённый контейнер; копия карточки остаётся под курсором. Права, текст объявлений и команда сохранения задаются приложением.</DemoHint>
        <ExampleCode>{`const board = useReorderBoard({
  columns, canDrag, autoScroll: {canScroll},
  commit: next => actions.runTuple(['move', next]),
});
const item = board.item(key);
// Put item.style on the whole card; handleProps on a button:
<button {...item.handleProps} aria-label="Перенести задачу" />
// Across component boundaries, without a cast:
type Call = ServiceCommandCall<typeof commands>;
<CommandBar call={['reset']} execute={actions.runTuple} />`}</ExampleCode>
    </div>
}
export function Card57() {
    return <Check n={57} id="reorder-accessible" title="Accessible organizer — keyboard, handles, edge scroll, command tuples"
        do="Move Task 1 down and to the empty Done column with keyboard; cancel once and confirm once. Repeat with the button handle using mouse/touch. Edit a note/use an action. Toggle permissions mid-drag. Hold near the inner bottom and board right edge; disable auto-scroll and repeat."
        expect="One command per changed drop; Escape commits nothing. Focus returns to the moved handle. Independent controls do not drag. Permission/data changes cancel. Only allowed scroll containers move, bounded and only near the edge; overlay remains under the pointer."
        note="Library hooks with a local organizer-shaped consumer, not the deployed pizzeria. The app owns announcements, persistence/roles and scroll allow-list. The reset command tuple passes through two components with no casts.">
        <AccessibleBoard/>
    </Check>
}
