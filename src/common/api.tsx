// ... existing code ...
import "../style/menuRight.css"
import "../style/style.css"

// 0. СТИЛИ - независимые
export * from "./src/styles/styleGrid";

// 1. БАЗОВЫЙ СЛОЙ - никаких зависимостей внутри проекта
export * from "./updateBy";

// 2. ХУКИ - зависят только от updateBy
export * from "./src/hooks";

// 4. DND компоненты - зависят от updateBy
export * from "./src/components/Dnd";

// 5. UTILS - теперь зависят от Dnd (mapMemory импортирует ExRNDMap3, mapResiReact)
export * from "./src/utils";

// 6. БАЗОВЫЕ КОМПОНЕНТЫ - зависят от hooks
export * from "./src/components/Buttons";
export * from "./src/components/MyResizeObserver";
export * from "./src/components/Other";

// 7. Parameters - зависит от utils
export * from "./src/components/Parameters";

// 8. ParametersEngine - зависит от Parameters и utils
export * from "./src/components/ParametersEngine";

// 9. Input - зависит от hooks и Dnd
export * from "./src/components/Input";

// 10. Modal - зависит от Input и updateBy
export * from "./src/components/Modal";

// 11. Menu - зависит от hooks, Dnd и Modal
export * from "./src/components/Menu";

// 12. МЕНЮ - зависят от компонентов
export * from "./src/menu/menu";
export * from "./src/menu/menuMouse";
export * from "./src/menu/menuR";

// 13. ЛОГИ - зависят от utils/mapMemory, menu и components/ParametersEngine
export * from "./src/logs/logs";
export * from "./src/logs/logs3";
export * from "./src/logs/miniLogs";


// 14. ГРАФИКИ - самый высокий уровень
export * from "./src/myChart/1/myChart";
export * from "./src/myChart/1/myChartTest";
export * from "./src/myChart/chartEngine/chartEngineReact";

export function test() {
    return 5;
}
// ... existing code ...