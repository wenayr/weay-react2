import React, {useState} from 'react';
import {restoreDates} from '../../../persist/index.js';
import {Check, DemoHint, ExampleCode} from '../standKit.js';

const iso = '2026-09-10T12:34:56.789Z';
function DateExample() {
    const [result, setResult] = useState('Ещё не преобразовано');
    return <div style={{color: '#263247'}}>
        <button onClick={() => {
            const payload: {when: unknown; nested: unknown[]; label: string} = JSON.parse(JSON.stringify({when: iso, nested: [iso], label: '2026-09-10'}));
            const nested = payload.nested;
            restoreDates(payload);
            const date = payload.when;
            restoreDates(payload);
            setResult(`Поле: ${payload.when instanceof Date ? 'Date' : 'ошибка'}; массив: ${payload.nested[0] instanceof Date ? 'Date' : 'ошибка'}; дата без времени: ${payload.label}; ссылки сохранены: ${nested === payload.nested && date === payload.when ? 'да' : 'нет'}`);
        }}>Восстановить даты из JSON</button>
        <p role="status" aria-label="Результат восстановления дат">{result}</p>
        <DemoHint>Вход изменяется на месте, возврат — void. Повторный вызов сохраняет Date и ссылки. Это не проверка схемы RPC.</DemoHint>
        <ExampleCode>{`import {restoreDates} from 'wenay-react2/persist';
const payload = JSON.parse(json);
restoreDates(payload); // object fields AND array elements
// Use runtime validation to establish the application's data type.`}</ExampleCode>
    </div>;
}
export function Card59() {
    return <Check n={59} id="restore-dates" title="Public persist — restore JSON dates"
        do="Press restore twice; inspect Date types, unchanged date-only text and preserved references."
        expect="Field and array element become Date; repeated restoration keeps references."
        note="Public /persist API; no RPC or storage backend is simulated."><DateExample/></Check>;
}
