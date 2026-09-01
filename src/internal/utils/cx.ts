/** Class-name join. Six near-identical private copies of this lived across gridChrome,
 *  SettingsDialog, RightMenu, CardList, ColumnDots and columnGrid - two of them under the name
 *  `classNames`, one taking rest args and the rest an array.
 *
 *  Deliberately NOT re-exported from utils/index.ts: that barrel is part of the root public
 *  surface, and a one-line helper is not something the library should commit to supporting.
 *  Import it by path. */
type ClassPart = string | false | null | undefined;

/** Accepts both call shapes the old copies used: `cx(["a", cond && "b"])` and `cx("a", cond && "b")`. */
export function cx(...parts: Array<ClassPart | ClassPart[]>): string {
    const out: string[] = [];
    for (const part of parts) {
        if (Array.isArray(part)) {
            for (const inner of part) if (inner) out.push(inner);
        } else if (part) out.push(part);
    }
    return out.join(" ");
}
