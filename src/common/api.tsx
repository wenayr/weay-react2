// ... existing code ...
import "../style/menuRight.css"
import "../style/style.css"

// Папки с index.ts
export * from "./src/components";
export * from "./src/hooks";
export * from "./src/styles";
export * from "./src/utils";

// Папки без index.ts, экспортируем каждый файл отдельно
export * from "./src/menu/menu";
export * from "./src/menu/menuMouse";
export * from "./src/menu/menuR";

export * from "./src/logs/logs";
export * from "./src/logs/logs3";
export * from "./src/logs/miniLogs";

export * from "./src/myChart/1/myChart";
export * from "./src/myChart/1/myChartTest";
export * from "./src/myChart/chartEngine/chartEngineReact";

// Файлы в корне src/common
export * from "./updateBy";

export function test() {
    return 5;
}
// ... existing code ...