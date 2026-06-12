/* qa.tsx — ОДИН стенд для ручной проверки библиотеки.
 *
 * Запуск:  npm run testReact   (vite → http://localhost:3000)
 * Каждая карточка: живой элемент + «что сделать» + «что ожидается».
 * Кнопками ✓/✗ отмечаешь результат по ходу. Это же — критерии приёмки правок из REFACTOR_PLAN.md.
 */

import React, { useState, useMemo, useEffect } from "react";
import { MenuBase, mouseMenuApi, renderBy, updateBy, logsApi, EditParams2, EditParams3, ParametersReact, ModalProvider, useModal, useAgGrid, AgGridMy, type BufferTable } from "../api";
import type { ColDef } from "ag-grid-community";
import { Params } from "wenay-common2";
import { Button, ButtonHover, DivOutsideClick } from "../src/hooks";
import { DivRnd3 } from "../src/components";
import { MyChartEngine } from "../src/myChart/chartEngine/chartEngineReact";
import { GridExample, tt } from "./useGrid";
import { TestParams } from "./testParams";

/* ---------- обёртка-карточка ---------- */
const card: React.CSSProperties = { border: "1px solid #d0d7de", borderRadius: 10, margin: "14px 0", background: "#fff", overflow: "hidden", fontFamily: "system-ui, sans-serif" };
const head: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f6f8fa", borderBottom: "1px solid #d0d7de" };
const badge: React.CSSProperties = { width: 24, height: 24, borderRadius: 12, background: "#0969da", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 };
const stageS: React.CSSProperties = { padding: 14, position: "relative" };
const row: React.CSSProperties = { padding: "6px 14px", fontSize: 13, lineHeight: 1.5, borderTop: "1px dashed #e1e4e8" };
const btn = (on: boolean, color: string): React.CSSProperties => ({ border: `1px solid ${color}`, background: on ? color : "#fff", color: on ? "#fff" : color, borderRadius: 6, padding: "3px 8px", fontSize: 12, cursor: "pointer" });

function Check(p: { n: number; title: string; do: string; expect: string; note?: string; tall?: boolean; children: React.ReactNode }) {
    const [ok, setOk] = useState<null | boolean>(null);
    return (
        <section style={{ ...card, outline: ok === true ? "2px solid #1a7f37" : ok === false ? "2px solid #cf222e" : "none" }}>
            <div style={head}>
                <span style={badge}>{p.n}</span>
                <b style={{ flex: 1 }}>{p.title}</b>
                <button style={btn(ok === true, "#1a7f37")} onClick={() => setOk(true)}>✓ работает</button>
                <button style={btn(ok === false, "#cf222e")} onClick={() => setOk(false)}>✗ баг</button>
            </div>
            <div style={{ ...stageS, minHeight: p.tall ? 340 : 80 }}>{p.children}</div>
            <div style={row}><b>Сделать:</b> {p.do}</div>
            <div style={{ ...row, color: "#1a7f37" }}><b>Ожидается:</b> {p.expect}</div>
            {p.note && <div style={{ ...row, color: "#9a6700" }}><b>Заметка:</b> {p.note}</div>}
        </section>
    );
}

/* ---------- 1. Реактивность: updateBy / renderBy ---------- */
const shared = { count: 0 };
const Subscriber = () => { updateBy(shared); return <span style={{ fontSize: 22, fontWeight: 700 }}>count = {shared.count}</span>; };
const ReactivityDemo = () => (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Subscriber />
        <button onClick={() => { shared.count++; renderBy(shared); }}>+1 и renderBy</button>
        <button onClick={() => { shared.count++; }}>+1 БЕЗ renderBy</button>
        <button onClick={() => renderBy(shared)}>только renderBy</button>
    </div>
);

// Клик-вне через DivOutsideClick напрямую: display:inline-block → зона закрытия облегает
// содержимое (нет «полосы на всю ширину», как у Button+outClick).
// Попап — position:absolute: иначе он раздувает прямоугольник обёртки, и клик правее кнопки
// (в пределах ширины попапа) попадает в саму обёртку → contains() считает его «внутри».
const OutsideDemo = () => {
    const [open, setOpen] = useState(false);
    return (
        <DivOutsideClick status={open} outsideClick={() => setOpen(false)} style={{ display: "inline-block", position: "relative" }}>
            <div onClick={() => setOpen(v => !v)} style={{ display: "inline-block", padding: "6px 12px", border: "1px solid #6e7781", borderRadius: 6, cursor: "pointer", background: open ? "#6e7781" : "#fff", color: open ? "#fff" : "#000" }}>open</div>
            {open && <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 8, padding: 16, width: 220, border: "1px solid #6e7781", borderRadius: 8, background: "#fafbfc", zIndex: 5 }}>закроюсь по клику в любом месте, кроме этой плашки и кнопки</div>}
        </DivOutsideClick>
    );
};

// Логи: добавляем запись с time:Date и смотрим колонку «time» (раньше всегда пустая).
const LogsDemo = () => {
    const PageLogs = logsApi.React.PageLogs;
    return (
        <div>
            <button style={{ marginBottom: 8 }} onClick={() => logsApi.addLogs({ id: "demo", var: 1, time: new Date(), txt: "лог " + new Date().toLocaleTimeString() })}>добавить лог</button>
            <div style={{ height: 260 }}><PageLogs /></div>
        </div>
    );
};

// EditParams3 (баг: сохраняет до-правочные значения) vs EditParams2 (корректно).
const paramsDefSave = new class extends Params.CParams {
    test = { value: 1, range: { min: 1, max: 10, step: 1 } };
    test2 = { value: 1, range: { min: 1, max: 10, step: 1 } };
};
const simpleSave = Params.GetSimpleParams(paramsDefSave);
const makeInfos = () => Params.mergeParamValuesToInfos(paramsDefSave, simpleSave);
const fmt = (d: any) => { try { return JSON.stringify(d, null, 2); } catch { return String(d); } };

const ParamsSaveDemo = () => {
    const [saved3, setSaved3] = useState("(ещё не сохраняли)");
    const [saved2, setSaved2] = useState("(ещё не сохраняли)");
    return (
        <div style={{ display: "flex", gap: 24 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#cf222e" }}>EditParams3 — ожидается БАГ</div>
                <EditParams3 params={async () => [makeInfos()]} onSave={(d: any) => { console.log("EditParams3 → onSave:", d); setSaved3(fmt(d)); }} />
                <div style={{ fontSize: 12, marginTop: 6 }}>что ушло в onSave:</div>
                <pre style={{ background: "#f6f8fa", padding: 8, borderRadius: 6, maxHeight: 150, overflow: "auto", fontSize: 11 }}>{saved3}</pre>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#1a7f37" }}>EditParams2 — корректно</div>
                <EditParams2 params={async () => makeInfos()} onSave={(d: any) => { console.log("EditParams2 → onSave:", d); setSaved2(fmt(d)); }} />
                <div style={{ fontSize: 12, marginTop: 6 }}>что ушло в onSave:</div>
                <pre style={{ background: "#f6f8fa", padding: 8, borderRadius: 6, maxHeight: 150, overflow: "auto", fontSize: 11 }}>{saved2}</pre>
            </div>
        </div>
    );
};

const DebounceDemo = () => {
    const [count, setCount] = useState(0);
    const infos = useMemo(() => makeInfos(), []);
    return (
        <div>
            <div style={{ marginBottom: 8 }}>onChange вызван: <b style={{ fontSize: 18 }}>{count}</b> раз <button onClick={() => setCount(0)}>сброс</button></div>
            <ParametersReact params={infos} onChange={() => setCount((c) => c + 1)} />
        </div>
    );
};

/* ---------- 12. agGrid4: контроллер + внешний буфер ---------- */
type tQARow = { id: string; name: string; price: number };
const agQABuffer: BufferTable<tQARow> = {}; // модульный буфер — переживает ремаунт грида
const agQACols = [
    { field: "name", headerName: "Название" },
    { field: "price", headerName: "Цена" },
] satisfies ColDef<tQARow>[];
const rndPrice = () => +(Math.random() * 1000).toFixed(2);

const AgGrid4Inner = () => {
    const grid = useAgGrid<tQARow>({ externalBuffer: agQABuffer });
    return (
        <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <button onClick={() => grid.updateData({ newData: [{ id: "tsla", name: "Tesla", price: rndPrice() }] })}>добавить/обновить Tesla</button>
                <button onClick={() => grid.updateData({ newData: [{ id: "aapl", name: "Apple", price: rndPrice() }] })}>добавить/обновить Apple</button>
                <button onClick={() => grid.updateData({ removeData: [{ id: "tsla" }] })}>удалить Tesla</button>
            </div>
            <div style={{ height: 220 }}><AgGridMy<tQARow> controller={grid} columnDefs={agQACols} /></div>
        </div>
    );
};

const AgGrid4Demo = () => {
    const [on, setOn] = useState(true);
    return (
        <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <button onClick={() => setOn(v => !v)}>{on ? "размонтировать грид" : "смонтировать грид"}</button>
                <button onClick={() => { agQABuffer["msft"] = { id: "msft", name: "Microsoft (мимо грида)", price: rndPrice() }; }}>записать MSFT прямо в буфер</button>
            </div>
            {on ? <AgGrid4Inner /> : <div style={{ padding: 20, color: "#57606a" }}>грид размонтирован — буфер живёт в модуле</div>}
        </div>
    );
};

/* ---------- 13. ModalProvider / useModal ---------- */
const ModalOpener = () => {
    const setModal = useModal();
    return (
        <button onClick={() => setModal(
            <div style={{ background: "#fff", padding: 24, borderRadius: 8, minWidth: 260 }}>
                <b>Модалка через useModal</b>
                <div style={{ margin: "10px 0", fontSize: 13 }}>Закрой: Escape, клик вне, или кнопкой.</div>
                <button onClick={() => setModal(null)}>закрыть</button>
            </div>
        )}>открыть модалку</button>
    );
};
const ModalDemo = () => <ModalProvider><ModalOpener /></ModalProvider>;

/* ---------- borad ---------- */
function ActiveChecks() {
    return (
        <>
            <Check n={1} title="Реактивность updateBy / renderBy"
                   do="Нажми «+1 и renderBy», потом «+1 БЕЗ renderBy», потом «только renderBy»."
                   expect="«+1 и renderBy» → число растёт. «+1 БЕЗ renderBy» → число НЕ меняется на экране. «только renderBy» → показывает накопленное."
                   note="Это и есть «изменение и уведомление разнесены». После миграции на стор: app.set(...) делает оба шага сразу.">
                <ReactivityDemo />
            </Check>

            <Check n={2} title="Drag + Resize (DivRnd3 / RNDFunc3)"
                   do="Нажми «window» → потяни окно за заголовок, измени размер за края, закрой крестиком. Открой консоль (F12)."
                   expect="Окно плавно двигается и ресайзится; крестик закрывает; при повторном открытии позиция/размер восстановлены (keyForSave)."
                   note="Баг плана: в консоли НЕ должно быть спама «xxx» (RNDFunc3:532); переподписка listeners на каждый тик — кандидат на usePointerDrag."
                   tall>
                <Button button={(e: any) => <div style={{ display: "inline-block", padding: "6px 12px", border: "1px solid #0969da", borderRadius: 6, cursor: "pointer", background: e ? "#0969da" : "#fff", color: e ? "#fff" : "#0969da" }}>window</div>}>
                    {(api: any) => (
                        <DivRnd3 keyForSave={"qa-rnd"} key={"qa-rnd"} size={{ height: 220, width: 280 }}
                                 className={"fon border fonLight"} moveOnlyHeader={true} onCLickClose={api.onClose} limit={{ y: { min: 0 } }} onUpdate={() => {}}>
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#eef2f6" }}>тяни за верх / ресайзь / закрой</div>
                        </DivRnd3>
                    )}
                </Button>
            </Check>

            <Check n={3} title="Вложенное меню (MenuBase) + наведение"
                   do="Наведись на «menu», затем веди курсор к подпункту с ▶ и в его подменю."
                   expect="Меню раскрывается ТОЛЬКО при наведении на сам «menu» (а не на всю ширину строки)."
                   note="БАГ lib подтверждён: ButtonHover оборачивает в <div> без ширины (блок на всю строку), в отличие от ButtonBase (width:min-content). В стенде обёрнуто width:min-content как обход; в библиотеку добавить width:min-content в ButtonHover.">
                <div style={{ width: "min-content" }}>
                    <ButtonHover button={() => <div style={{ display: "inline-block", padding: "6px 12px", border: "1px solid #888", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }}>menu</div>}>
                        <MenuBase zIndex={50} coordinate={{ x: 0, y: 0 }} data={[
                            { name: "пункт 1", onClick: () => alert("пункт 1") },
                            { name: "подменю ▶", next: () => [{ name: "лист A", onClick: () => alert("A") }, { name: "лист B", onClick: () => alert("B") }] },
                        ]} />
                    </ButtonHover>
                </div>
            </Check>

            <Check n={5} title="Грид + транзакции (applyTransactionAsyncUpdate)"
                   do="«обновить Tesla» — цена случайная (обновление по ID). Затем «удалить Tesla» — строка должна исчезнуть."
                   expect="Обновление по ID (без дублей). «удалить Tesla» убирает строку. ✅ Раньше удаление-только терялось (строка оставалась)."
                   note="Фикс: applyTransactionAsyncUpdate применяет remove один раз, НЕЗАВИСИМО от add/update (раньше при пустых add/update remove терялся; при обоих — дублировался)."
                   tall>
                <div>
                    <button style={{ marginBottom: 8 }} onClick={() => renderBy(tt)}>обновить Tesla (рандомная цена)</button>
                    <div style={{ height: 280 }}><GridExample /></div>
                </div>
            </Check>

            <Check n={6} title="График (MyChartEngine) — LOD min+max"
                   do="Дай графику накопить данные, затем ОТДАЛИ колесом (zoom out). Смотри на амплитуду линии."
                   expect="При отдалении линия сохраняет амплитуду — пики не «схлопываются» в прямую. ✅ Фикс: LOD берёт min+max на пиксель. Обе панели (линия + бары) целиком в карточке, ничего не уезжает вниз."
                   note="Исправлено: drawLineChartLOD теперь на каждый пиксель берёт min+max точки (а не первую) → пики/провалы не срезаются. Фикс высоты: у MyChartEngine была захардкожена height 600px → нижняя панель выходила за карточку; добавлен опциональный проп style (дефолт 600px не менялся). Перф (dirty-флаг/filter каждый кадр) — НЕ трогали."
                   tall>
                <div style={{ height: 300 }}><MyChartEngine style={{ height: "100%" }} /></div>
            </Check>

            <Check n={7} title="Параметры (ParametersReact / ParametersEngine)"
                   do="Подвигай слайдеры и поля. Поле «test3» имеет имя и комментарий при наведении."
                   expect="Значение меняется в UI при редактировании; range/number синхронны; при наведении показывается commentary."
                   note="Баги плана: EditParams3 теряет правку (Other.tsx); сломанный debounce и отсутствие cleanup ResizeObserver в ParametersEngine."
                   tall>
                <div style={{ minHeight: 260 }}><TestParams /></div>
            </Check>

            <Check n={12} title="agGrid4 — контроллер, удаление, внешний буфер"
                   do="«добавить/обновить Tesla» и «Apple» — строки появляются/обновляются. «удалить Tesla» — исчезает. Затем: «размонтировать грид» → «записать MSFT прямо в буфер» → «смонтировать грид»."
                   expect="Обновления по ID без дублей; удаление работает. После ремаунта грид сам догоняет буфер: Tesla/Apple на месте, MSFT появился (attach→sync). Тема — тёмная, как у прод-гридов (GridStyleDefault)."
                   note="Новый путь вместо applyTransactionAsyncUpdate (v1 помечен @deprecated). Ядро createGridBuffer работает и вне React."
                   tall>
                <AgGrid4Demo />
            </Check>

            <Check n={13} title="ModalProvider / useModal — Escape и клик вне"
                   do="Нажми «открыть модалку». Закрой её Escape. Открой снова — закрой кликом вне. Открой — закрой кнопкой «закрыть»."
                   expect="Все три способа закрывают. Затемнённый фон поверх всего (z-index из токена --wenay-z-modal)."
                   note="M1: Escape и опции closeOnEscape/closeOnOutsideClick добавлены; useModal и прежнее поведение без изменений. GetModalJSX помечен @deprecated.">
                <ModalDemo />
            </Check>

            <Check n={8} title="Закрытие по клику вне (DivOutsideClick)"
                   do="Нажми «open». Затем кликни ЛЮБОЕ место вне плашки — в т.ч. на той же горизонтали и ЧУТЬ ПРАВЕЕ кнопки open (в пределах ширины плашки — раньше там была мёртвая зона)."
                   expect="Клик в любом месте вне плашки/кнопки закрывает её — включая зону правее кнопки над плашкой. Клик по плашке или кнопке — НЕ закрывает."
                   note="БАГ lib (карточка раньше падала на нём): Button+outClick оборачивает в DivOutsideClick, а тот — блочный div на всю ширину → вся горизонтальная полоса считается «внутри». Здесь DivOutsideClick использован с display:inline-block, а попап — position:absolute (иначе он раздувает прямоугольник обёртки → мёртвая зона правее кнопки). Реальный фикс lib: дефолтно облегать содержимое (или дать Button сужать обёртку).">
                <OutsideDemo />
            </Check>
        </>
    );
}

function ArchiveChecks() {
    return (
        <>
            <Check n={4} title="Контекстное меню по правому клику (mouseMenuApi)"
                   do="Правый клик по серой области → меню. Затем правый клик в ДРУГОМ месте."
                   expect="Правый клик в другом месте закрывает прежнее меню и открывает новое с пунктами. ✅ Исправлено."
                   note="Фикс: menuR — снимок пунктов при открытии + menuMouse onConsume (инварианты bb / «без устаревших» сохранены)."
                   tall>
                <mouseMenuApi.ReactMouse zIndex={40}>
                    <div style={{ width: "100%", height: 300, background: "#e7ebef", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#57606a" }}
                         onMouseDown={(e) => {
                             if (e.button === 2) mouseMenuApi.map.set("sym", [
                                 { name: "действие 1", onClick: () => alert("действие 1") },
                                 { name: "подменю ▶", next: () => [{ name: "вложенное", onClick: () => alert("вложенное") }] },
                             ]);
                         }}>правый клик здесь</div>
                </mouseMenuApi.ReactMouse>
            </Check>

            <Check n={9} title="Логи — формат времени (valueFormatter)"
                   do="Нажми «добавить лог» несколько раз."
                   expect="В колонке «time» появляется время в формате чч:мм:сс. ✅ Исправлено."
                   note="Фикс: было e.value.time (у Date нет .time → всегда undefined) → стало e.value (сам Date). Затронуты logs.tsx и miniLogs.tsx."
                   tall>
                <LogsDemo />
            </Check>

            <Check n={10} title="EditParams3 vs EditParams2 — что уходит в onSave"
                   do="В КАЖДОЙ колонке поменяй значение (test/test2), затем нажми «save». Сравни «что ушло в onSave» и консоль (F12)."
                   expect="ОБА сохраняют ИЗМЕНЁННОЕ значение (EditParams3 совпадает с EditParams2). ✅ Исправлено (регресс-проверка)."
                   note="Фикс в Other.tsx: params[i]=z → params[i]=e (z был пустышкой и выбрасывал отредактированный клон e)."
                   tall>
                <ParamsSaveDemo />
            </Check>

            <Check n={11} title="Параметры — debounce onChange"
                   do="Быстро подвигай ползунок/число подряд, затем остановись."
                   expect="Счётчик растёт НЕ на каждое микродвижение, а примерно раз в ~200мс после остановки. ✅ Исправлено."
                   note="Фикс: timeoutId → useRef + очистка на unmount."
                   tall>
                <DebounceDemo />
            </Check>
        </>
    );
}

export function QABoard() {
    const [hash, setHash] = useState(typeof location !== "undefined" ? location.hash : "");
    useEffect(() => {
        const f = () => setHash(location.hash);
        window.addEventListener("hashchange", f);
        return () => window.removeEventListener("hashchange", f);
    }, []);
    const archive = hash === "#archive";
    const link = (on: boolean): React.CSSProperties => ({ padding: "4px 10px", borderRadius: 6, textDecoration: "none", color: on ? "#fff" : "#0969da", background: on ? "#0969da" : "#fff", border: "1px solid #0969da", fontSize: 13 });
    return (
        <div style={{ maxWidth: 920, margin: "0 auto", padding: 20, fontFamily: "system-ui, sans-serif" }}>
            <h2 style={{ margin: "0 0 4px" }}>QA-стенд wenay-react2</h2>
            <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
                <a href="#" style={link(!archive)}>Активные проверки</a>
                <a href="#archive" style={link(archive)}>Архив проверенного</a>
            </div>
            <div style={{ color: "#57606a", fontSize: 13, marginBottom: 8 }}>
                {archive ? "Проверенные и исправленные узлы — оставлены для повторной примерки." : "Тыкай элементы, сверяй с «Ожидается», отмечай ✓/✗. Регресс токенов (S1): внешний вид ВСЕХ карточек/меню/гридов не должен был измениться — переменные перенесены в tokens.css без смены значений."}
            </div>
            {archive ? <ArchiveChecks /> : <ActiveChecks />}
        </div>
    );
}
