import {restoreDates} from '../src/persist/index.js';
import {restoreDates as internal} from '../src/internal/persist/cache.js';

const iso = '2026-09-10T12:34:56.789Z';
test('public and cache use the same date restorer, including nested arrays', () => {
    expect(restoreDates).toBe(internal);
    const data: any = {when: iso, rows: [iso, {when: iso}, [iso]], nothing: null};
    const rows = data.rows;
    expect(restoreDates(data)).toBeUndefined();
    expect(data.rows).toBe(rows);
    for (const value of [data.when, data.rows[0], data.rows[1].when, data.rows[2][0]]) {
        expect(value).toBeInstanceOf(Date);
        expect(value.toISOString()).toBe(iso);
    }
});
test('idempotent, cyclic/shared objects and existing Dates are safe', () => {
    const date = new Date(iso);
    const shared = {when: iso};
    const data: any = {date, shared, again: shared}; data.self = data;
    restoreDates(data); restoreDates(data);
    expect(data.date).toBe(date);
    expect(data.again).toBe(shared);
    expect(shared.when).toBeInstanceOf(Date);
    expect(data.self).toBe(data);
});
test('leaves unsupported strings and primitive roots alone', () => {
    const values = ['2026-09-10', 'hello', '2026-09-10T12:34:56+03:00', '2026-99-10T12:34:56Z'];
    const data = [...values]; restoreDates(data); expect(data).toEqual(values);
    for (const value of [null, undefined, 42, true, iso]) expect(restoreDates(value)).toBeUndefined();
});
