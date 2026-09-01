/**
 * Base data types and the DataSet / DataModel factories.
 */

/**
 * Base data types
 */
export interface DataPoint {
    x: number;
    y: number;
}

export type ChartType = 'line' | 'bar';

export interface DataSetStyle {
    strokeColor?: string;
    fillColor?: string;
    barColor?: string;
    lineWidth?: number;
    gradientFill?: boolean;
}

export interface MinMaxChunk {
    xStart: number;
    xEnd: number;
    minY: number;
    maxY: number;
}

export interface DataSet {
    id: string;
    type: ChartType;
    data: DataPoint[];
    style: DataSetStyle;
    chunkSize: number;
    minMaxChunks: MinMaxChunk[];

    getMinMaxInRange(rangeX1: number, rangeX2: number): { minY: number; maxY: number };
    addData(newPoints: DataPoint | DataPoint[]): void;
}

export interface CreateDataSetParams {
    id: string;
    type?: ChartType;
    data?: DataPoint[];
    style?: DataSetStyle;
    chunkSize?: number;
}

/**
 * DataSet factory
 */
export function createDataSet(params: CreateDataSetParams): DataSet {
    const {
        id,
        type = 'line',
        data = [],
        style = {},
        chunkSize = 100
    } = params;

    const defaultStyle: DataSetStyle = {
        strokeColor: '#2299dd',
        fillColor: 'rgba(34,153,221,0.2)',
        barColor: '#66cc66',
        lineWidth: 2,
        gradientFill: true
    };
    const mergedStyle: DataSetStyle = { ...defaultStyle, ...style };

    let internalData = data.slice();
    let minMaxChunks: MinMaxChunk[] = [];

    function computeChunk(chunkIndex: number): MinMaxChunk {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, internalData.length);
        let minY = Infinity;
        let maxY = -Infinity;
        for (let i = start; i < end; i++) {
            const y = internalData[i].y;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
        return { xStart: internalData[start].x, xEnd: internalData[end - 1].x, minY, maxY };
    }

    function buildMinMaxChunks() {
        minMaxChunks = [];
        for (let c = 0; c * chunkSize < internalData.length; c++) {
            minMaxChunks.push(computeChunk(c));
        }
    }
    buildMinMaxChunks();

    function getMinMaxInRange(rangeX1: number, rangeX2: number) {
        if (internalData.length === 0) {
            return { minY: 0, maxY: 1 };
        }
        let overallMin = Infinity;
        let overallMax = -Infinity;
        // chunks inherit the data's x order, so the overlapping window is contiguous: binary
        // search its first chunk instead of scanning all of them. updatePanels calls this per
        // dataset per panel on every dirty frame, i.e. on every pan/zoom frame.
        let lo = 0, hi = minMaxChunks.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (minMaxChunks[mid].xEnd < rangeX1) lo = mid + 1; else hi = mid;
        }
        for (let i = lo; i < minMaxChunks.length; i++) {
            const chunk = minMaxChunks[i];
            if (chunk.xStart > rangeX2) break;
            if (chunk.minY < overallMin) overallMin = chunk.minY;
            if (chunk.maxY > overallMax) overallMax = chunk.maxY;
        }
        if (overallMin === Infinity || overallMax === -Infinity) {
            overallMin = 0;
            overallMax = 1;
        }
        return { minY: overallMin, maxY: overallMax };
    }

    function addData(newPoints: DataPoint | DataPoint[]) {
        const arr = Array.isArray(newPoints) ? newPoints : [newPoints];
        if (arr.length === 0) return;
        const oldLength = internalData.length;
        internalData.push(...arr);
        // recompute only the tail: previously crossing a chunk boundary rebuilt ALL chunks (O(n) per boundary)
        const firstChunk = Math.floor(oldLength / chunkSize);
        const lastChunk = Math.floor((internalData.length - 1) / chunkSize);
        for (let c = firstChunk; c <= lastChunk; c++) {
            minMaxChunks[c] = computeChunk(c);
        }
    }

    return {
        id,
        type,
        data: internalData,
        style: mergedStyle,
        chunkSize,
        // buildMinMaxChunks reassigns the local array, so use a getter instead of a stale snapshot
        get minMaxChunks() { return minMaxChunks; },
        getMinMaxInRange,
        addData
    };
}

/**
 * DataModel
 */
export interface DataModel {
    addDataSet(params: CreateDataSetParams): DataSet;
    getAllDataSets(): DataSet[];
    getGlobalMinMaxY(x1: number, x2: number, filterFn?: (ds: DataSet) => boolean): { minY: number; maxY: number };
}

export function createDataModel(): DataModel {
    const dataSets: DataSet[] = [];

    function addDataSet(params: CreateDataSetParams) {
        const ds = createDataSet(params);
        dataSets.push(ds);
        return ds;
    }

    function getAllDataSets() {
        return dataSets;
    }

    function getGlobalMinMaxY(x1: number, x2: number, filterFn?: (ds: DataSet) => boolean) {
        let globalMin = Infinity;
        let globalMax = -Infinity;
        for (const ds of dataSets) {
            if (filterFn && !filterFn(ds)) continue;
            const { minY, maxY } = ds.getMinMaxInRange(x1, x2);
            if (minY < globalMin) globalMin = minY;
            if (maxY > globalMax) globalMax = maxY;
        }
        if (globalMin === Infinity || globalMax === -Infinity) {
            globalMin = 0;
            globalMax = 1;
        }
        return { minY: globalMin, maxY: globalMax };
    }

    return {
        addDataSet,
        getAllDataSets,
        getGlobalMinMaxY
    };
}
