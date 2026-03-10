Вот расширенное руководство по API (с типизацией и примерами использования). Этот формат отлично подойдет для документации, чтобы другие разработчики (или AI-ассистенты) могли сразу понимать, какие пропсы принимает компонент и как его внедрять.

---

## 🛠 Справочник API (Components & Hooks)

### 🪟 Модальные и плавающие окна (MDI)

#### `DivRnd3`
Обертка для создания окон со свободным перемещением, изменением размеров (resize) и сохранением состояния.

**Типизация:**
```typescript
type tDivRndBase = {
    children: React.ReactElement | ((update: number) => React.ReactElement);
    position?: { x: number; y: number };
    size?: { height: number | string; width: number | string };
    keyForSave?: string;        // Ключ для кэширования позиции/размера в памяти
    limit?: { x?: { max?: number; min?: number }, y?: { max?: number; min?: number } };
    onCLickClose?: () => void;  // Добавляет крестик закрытия окна
    header?: React.ReactElement | boolean; // Шапка для перетаскивания (иначе тянется за весь блок)
    zIndex?: number;
}
```

**Пример:**
```textmate
<DivRnd3 
    keyForSave="my_tool_window" 
    size={{ width: 300, height: 200 }} 
    onCLickClose={() => setOpen(false)}
    header={<div>Мой инструмент</div>}
>
    <div>Контент окна</div>
</DivRnd3>
```


#### `GetModalJSX()`
Фабрика глобальных модальных окон. Позволяет вызывать окна из бизнес-логики без привязки к локальному стейту компонента.

**Пример:**
```textmate
const myModal = GetModalJSX();

// 1. В корневом файле приложения (App.tsx):
<myModal.Render />

// 2. В любом месте логики:
myModal.set(<div onClick={() => myModal.set(null)}>Закрыть меня</div>);
// Для множественных окон: myModal.addJSX( <Component/> )
```


---

### 🖱 Drag-and-Drop и Взаимодействие (Hooks & Wrappers)

#### `useOutside` / `DivOutsideClick`
Отслеживание клика вне элемента (полезно для закрытия дропдаунов и меню).

**Типизация:**
```typescript
// Hook
function useOutside(params: { outsideClick: () => void, status?: boolean, ref?: RefObject }): RefObject;

// Component
type Props = { outsideClick: () => void, status?: boolean, zIndex?: number } & HTMLAttributes;
```

**Пример:**
```textmate
<DivOutsideClick outsideClick={() => setDropdownOpen(false)} status={isOpen}>
    <div className="dropdown-menu">...</div>
</DivOutsideClick>
```


#### `Drag22`
Отслеживает сдвиг мыши/пальца и возвращает новые координаты, не вмешиваясь в CSS напрямую.

**Типизация:**
```typescript
type Drag2Props = {
    x?: number; y?: number;               // Стартовые/текущие координаты
    onX?: (val: number) => void;          // Коллбек изменения X
    onY?: (val: number) => void;          // Коллбек изменения Y
    onStart?: () => void; onStop?: () => void;
    children: ReactNode;
};
```


---

### 📋 Контекстные меню (`MenuR` / `mouseMenuApi`)

Умные контекстные меню. Вызываются на ПК (ПКМ) и мобилках (долгий тап / дабл-тап). Поддерживают асинхронную генерацию элементов.

**Типизация элемента меню (`tMenuReactStrictly`):**
```typescript
type tMenuReactStrictly = {
    name: string | ((status?: any) => string);
    onClick?: (e: any) => void | Promise<any> | Promise<any>[]; // Поддержка промисов со счетчиком ok/error
    status?: boolean; // Раскрыто ли подменю
    next?: () => tMenuReact[] | Promise<tMenuReact[]>; // Вложенное меню
    func?: () => React.ReactElement | Promise<React.ReactElement>; // Кастомный рендер при наведении
};
```

**Примеры:**
```textmate
// 1. Использование компонента-обертки
const menuItems = () => [
    { name: "Копировать", onClick: () => copy() },
    { name: "Опции", next: () => [{ name: "Опция 1", onClick: () => {} }] }
];

<MenuR other={menuItems}>
    <div className="item">Кликни меня правой кнопкой</div>
</MenuR>

// 2. Глобальный вызов через API
mouseMenuApi.map.set("global_action", [{ name: "Глобальное действие", onClick: () => {} }]);
```


---

### 📊 Обновление таблиц Ag-Grid (`applyTransactionAsyncUpdate2`)

Функция для безопасного, пакетного и асинхронного обновления данных таблицы, синхронизированного с локальным буфером (кэшем).

**Типизация:**
```typescript
type Params<T> = {
    gridRef?: React.RefObject<GridReadyEvent<T, any>>;
    newData: Partial<T>[];                         // Массив новых данных
    getId: (row: Partial<T>) => string;            // Функция получения ID
    bufTable: { [id: string]: Partial<T> };        // Локальный кэш-словарь
    option?: { update?: boolean, add?: boolean, updateBuffer?: boolean, sync?: boolean };
};
```

**Пример:**
```textmate
// Мгновенно обновляет кэш и отправляет транзакцию в Ag-Grid
applyTransactionAsyncUpdate2({
    gridRef: apiGrid,
    newData: [{ id: "user_1", balance: 500 }],
    getId: (e) => e.id,
    bufTable: myLocalBuffer,
    option: { update: true, add: true }
});
```


---

### ⚙️ Автогенерация UI настроек (`ParametersReact`)

Движок, который принимает объект со схемой данных и рендерит готовую форму управления (инпуты, слайдеры, селекты).

**Типизация:**
Схема строится на основе типов `Params.IParamsExpandableReadonly`. 
Поддерживаются типы: `number`, `string`, `boolean`, `Date`, массивы, вложенные объекты.

**Пример:**
```textmate
const mySettings = {
    showGrid: true, // Сгенерирует Checkbox
    opacity: { 
        value: 0.5, 
        range: { min: 0, max: 1, step: 0.1 }, 
        name: "Прозрачность" 
    }, // Сгенерирует Range Slider + Number Input
    theme: {
        value: "dark",
        range: ["dark", "light", "system"]
    } // Сгенерирует Select
};

<ParametersReact 
    params={mySettings} 
    onChange={(newParams) => {
        console.log("Новое значение:", newParams.opacity.value);
    }} 
/>
```


---

### 📜 Система логирования (`logsApi`)

Регистрация логов, таблица их просмотра и система всплывающих уведомлений (toasts). 

**API:**
```typescript
// 1. Добавление лога
logsApi.addLogs({
    id: "system",
    var: 10,           // Важность (важно для фильтрации уведомлений)
    time: new Date(),
    txt: "Соединение разорвано"
});

// 2. Рендер компонентов (обычно где-то в корне):
<logsApi.React.Message zIndex={9999} /> // Всплывающие уведомления справа сверху
<logsApi.React.PageLogs />              // Таблица всех логов Ag-Grid
```
Да, в кодовой базе есть еще несколько очень важных архитектурных паттернов и UI-компонентов, которые активно используются и обязательно должны быть в документации, чтобы другой разработчик (или ИИ) понимал, как строить интерфейсы в этом проекте.

Вот вторая часть дополнений для `README.md`:

---

### 🗂 Боковая навигация (Sidebar)

#### `ApiLeftMenu`
Готовое API для управления левым выдвижным меню (Sidebar). Поддерживает свайпы, плавную доводку (snap scrolling) и императивное управление вкладками.

**API и Типизация:**
```typescript
type MenuItem = {
    el: () => React.JSX.Element;   // Компонент вкладки
    button?: React.JSX.Element;    // Кастомная кнопка (опционально)
    color?: ColorString;           // Цвет фона
    textB?: string;                // Текст по умолчанию для кнопки
};

// Регистрация пунктов меню:
ApiLeftMenu.setMenu(items: MenuItem[], key?: string);
```

**Пример использования:**
```textmate
// 1. Регистрация вкладок (можно делать где угодно в логике):
ApiLeftMenu.setMenu([
    { textB: "Дашборд", el: () => <Dashboard />, color: "rgb(92,50,213)" },
    { textB: "Настройки", el: () => <Settings /> }
], "main_menu");

// 2. Рендер самого меню в корневом Layout:
export function AppLayout() {
    return <ApiLeftMenu.Modal2 zIndex={20} />;
}
```


---

### 🎛 Интерактивные элементы и Кнопки

#### `Button` (из `useOutside.tsx`) / `MiniButton`
Продвинутые компоненты кнопок, которые инкапсулируют логику раскрывающихся списков (dropdowns), всплывающих панелей и отслеживают клик снаружи для автоматического закрытия.

**Типизация `Button`:**
```typescript
type tButton = {
    button: ReactElement | ((status: boolean) => ReactElement); // Сама кнопка (может менять вид от статуса)
    children: ReactNode | ((api: {onClose: () => void}) => ReactNode); // Выпадающий контент
    outClick?: boolean | (() => void); // Закрывать ли по клику вне области (true по умолчанию)
    statusDef?: boolean; // Начальное состояние (открыто/закрыто)
};
```

**Пример:**
```textmate
<Button 
    outClick={true}
    button={(isOpen) => <div className={isOpen ? "active" : ""}>Опции</div>}
>
    {({ onClose }) => (
        <div className="dropdown-panel">
            <div onClick={() => { doSomething(); onClose(); }}>Действие 1</div>
        </div>
    )}
</Button>
```


#### `FResizableReact`
Обертка над `re-resizable`. Позволяет делать панели с изменяемым размером (например, колонки или нижние логи), сохраняя их размер в кэш.

**Пример:**
```textmate
<FResizableReact 
    keyForSave="bottom_panel_size" 
    size={{ height: 200, width: "100%" }}
    moveWith={false} // Разрешить ресайз только по высоте
>
    <LogsTable />
</FResizableReact>
```


---

### 🔄 Глобальная реактивность (Паттерн `renderBy` / `updateBy`)

*(Примечание: это важнейший концепт проекта, используемый вместо классического `useState` / `Redux` для сложной бизнес-логики).*

Во многих местах проекта используется мутабельный подход к состоянию: вы меняете свойства обычного JS-объекта и вызываете `renderBy(obj)`, чтобы принудительно обновить все компоненты, которые подписаны на этот объект через `updateBy(obj)`.

**Пример паттерна:**
```textmate
import { renderBy, updateBy } from "./updateBy";

// 1. Глобальное или локальное состояние (обычный объект)
const myState = {
    count: 0,
    text: "hello"
};

// 2. Компонент-потребитель
function CounterViewer() {
    // Компонент подписывается на изменения myState
    updateBy(myState); 
    
    return <div>{myState.count}</div>;
}

// 3. Изменение состояния (где угодно, даже вне React)
function increment() {
    myState.count += 1;
    renderBy(myState); // Триггерит ререндер CounterViewer
}
```


---

### 📊 Полезные утилиты для Ag-Grid

#### `GridStyleDefault` и `StyleCSSHeadGrid`
Быстрое применение единого корпоративного стиля ко всем таблицам приложения.

**Пример внедрения в корень проекта:**
```typescript
import { GridStyleDefault, StyleCSSHeadGrid } from "./styleGrid";

// Применяет темную тему, сжимает отступы, центрирует заголовки
GridStyleDefault();
StyleCSSHeadGrid();
```


#### `getComparatorGrid`
Фабрика для создания кастомных функций сортировки колонок Ag-Grid, корректно обрабатывающая `undefined`, `NaN` и инверсию.
**Пример:**
```textmate
const columnDefs = [
    { 
        field: "price", 
        comparator: getComparatorGrid() // Безопасная сортировка чисел
    }
];
```


---

### ⌨️ Глобальные хуки

#### `useAddDownAnyKey`
Регистрирует глобальный слушатель нажатий клавиатуры и сохраняет последнюю нажатую клавишу в экспортируемый реактивный объект `KeyDown`.

**Пример использования:**
```textmate
import { KeyDown, useAddDownAnyKey } from "./useAddDownAnyKey";
import { updateBy } from "./updateBy";

function HotkeyListener() {
    useAddDownAnyKey(); // Инициализация хука
    updateBy(KeyDown);  // Подписка на нажатия

    if (KeyDown.key === "Escape") {
        return <div>Нажат Escape!</div>;
    }
    return null;
}
```
