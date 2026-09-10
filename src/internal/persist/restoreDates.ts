const ISO_DATE_RE = /^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\.[0-9]+)?(Z)?$/;

/** Mutates writable JSON-shaped objects/arrays, restoring ISO date-time string values.
 * Returns void; does not change the static input type. A bare string cannot be replaced.
 * Date-only strings and timezone offsets are intentionally not inferred as dates.
 * Existing Dates and repeated/cyclic references are safe. Not a schema validator.
 */
export function restoreDates(obj: unknown): void {
    const seen = new WeakSet<object>();
    function visit(value: unknown): void {
        if (!value || typeof value !== 'object' || value instanceof Date || seen.has(value)) return;
        seen.add(value);
        for (const [key, item] of Object.entries(value)) {
            if (typeof item === 'string' && ISO_DATE_RE.test(item)) {
                const date = new Date(item);
                if (Number.isFinite(date.getTime())) (value as Record<string, unknown>)[key] = date;
            } else visit(item);
        }
    }
    visit(obj);
}
