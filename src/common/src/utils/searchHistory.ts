import {createUpdateApi} from "../../updateBy";
import {memoryGetOrCreate, memoryMarkDirty} from "./memoryStore";

export type SearchHistoryState = {
    items: string[];
};

export type SearchHistoryApi = ReturnType<typeof createSearchHistory>;

function normalizeSearchHistoryItem(value: string) {
    return value.replace(/\s+/g, " ").trim();
}

export function createSearchHistory(opts: {key: string, max?: number}) {
    const max = Math.max(1, opts.max ?? 8);
    const st = memoryGetOrCreate<SearchHistoryState>(opts.key, {items: []});
    const stApi = createUpdateApi(st);

    /** Pure derivation - reads must not rewrite the persisted object (a getter that
     *  mutates state silently marks nothing dirty and surprises memoryCache diffing). */
    function normalized(): string[] {
        const seen = new Set<string>();
        return st.items
            .map(normalizeSearchHistoryItem)
            .filter(Boolean)
            .filter(item => {
                const k = item.toLocaleLowerCase();
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
            })
            .slice(0, max);
    }

    function emit() {
        st.items = normalized(); // normalization happens on WRITE, announced below
        stApi.render();
        memoryMarkDirty(opts.key);
    }

    return {
        get items() {
            return normalized();
        },
        use() {
            stApi.use();
            return normalized();
        },
        add(value: string) {
            const item = normalizeSearchHistoryItem(value);
            if (!item) return;
            st.items = [item, ...st.items.filter(e => e.toLocaleLowerCase() != item.toLocaleLowerCase())];
            emit();
        },
        remove(value: string) {
            const item = normalizeSearchHistoryItem(value);
            const next = st.items.filter(e => e.toLocaleLowerCase() != item.toLocaleLowerCase());
            if (next.length == st.items.length) return;
            st.items = next;
            emit();
        },
        clear() {
            if (st.items.length == 0) return;
            st.items = [];
            emit();
        },
    };
}
