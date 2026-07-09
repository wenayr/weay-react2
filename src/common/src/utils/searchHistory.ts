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

    function normalize() {
        const seen = new Set<string>();
        st.items = st.items
            .map(normalizeSearchHistoryItem)
            .filter(Boolean)
            .filter(item => {
                const k = item.toLocaleLowerCase();
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
            })
            .slice(0, max);
        return st.items;
    }

    function emit() {
        normalize();
        stApi.render();
        memoryMarkDirty(opts.key);
    }

    return {
        get items() {
            return normalize().slice();
        },
        use() {
            stApi.use();
            return normalize().slice();
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
