import * as root from "../src/index";
import * as core from "../src/core/index";
import * as react from "../src/react/index";
import * as grid from "../src/grid/index";
import * as windows from "../src/windows/index";
import * as logs from "../src/logs/index";
import * as communication from "../src/communication/index";
import * as native from "../src/native/index";

/** The subpath barrels are hand-maintained lists over the same modules the root
 *  `export *` already covers, so they drift silently: `renderByRevers` sat in the root
 *  surface but was missing from ./react. Type-only exports vanish at runtime, so this
 *  compares runtime values -- exactly the half that breaks a consumer's import.
 *
 *  ./native is the documented exception (doc/native.md): a DOM/CSS/ag-grid-free React
 *  Native entrypoint. Its absence from the root barrel is the point -- the root pulls in
 *  react-dom and ag-grid -- so it gets the opposite assertion. */
const mirrored: [string, Record<string, unknown>][] = [
    ["./core", core],
    ["./react", react],
    ["./grid", grid],
    ["./windows", windows],
    ["./logs", logs],
    ["./communication", communication],
];

const runtimeNames = (module: Record<string, unknown>) =>
    Object.keys(module).filter(name => name != "default" && module[name] !== undefined);

describe("package barrels", () => {
    test.each(mirrored)("%s exports nothing the root barrel lacks", (_label, module) => {
        const missing = runtimeNames(module).filter(name => !(name in root));
        expect(missing).toEqual([]);
    });

    test.each(mirrored)("%s re-exports the same binding as the root barrel", (_label, module) => {
        const diverged = runtimeNames(module).filter(
            name => name in root && (root as Record<string, unknown>)[name] !== module[name],
        );
        expect(diverged).toEqual([]);
    });

    test("./native stays out of the root barrel so it keeps no DOM dependency", () => {
        const names = runtimeNames(native);
        expect(names.length).toBeGreaterThan(0);
        expect(names.filter(name => name in root)).toEqual([]);
    });
});

/** Inverse direction: the root is `export *` over everything, so a new module lands there
 *  by default and nobody notices it never reached a subpath. Every root-only runtime name
 *  must be on this list - a deliberate root-only surface (legacy components, the chart
 *  engine, modal/menu kits) - so adding a module makes you choose its subpath explicitly. */
const ROOT_ONLY = [
    "AbsoluteButton", "Button", "DropdownMenu", "FResizableReact", "FileInputModal", "FileInputPanel",
    "FreeModal", "GridStyleDefault", "HoverButton", "LeftModal", "Menu", "MenuItemElement", "MenuProgress",
    "MessageEventLogs", "MiniButton", "MiniLogs", "ModalProvider", "OutsideButton", "OutsideClickArea",
    "Overlay", "PageLogs", "ParamLabelContent", "ParamRow", "ParamToggleLabel", "ParamsArrayEdit", "ParamsEdit",
    "ParamsEditor", "PopupButton", "SettingsDialog", "Sparkline", "StyleCSSHeadGrid", "StyleCSSHeadGridEdit",
    "StyleGridDefault", "TextInputModal", "TextInputPanel", "__observerStateForTests", "confirmModal",
    "contextMenu", "createChartEngine", "createContextMenu", "createDataModel", "createDataSet",
    "createInteraction", "createModalElementStore", "createModalRenderStore", "createPanelManager",
    "createRenderer", "createRightMenuController", "createToolbar", "createUiSlot", "floatingWindowMap",
    "getApiLeftMenu", "getLogsApi", "getSettingsSections", "getToolbarDensities", "inputModal", "logsApi",
    "mapResiReact", "mapRightMenu", "registerSettingsSection", "registerToolbarDensity",
    "removeResizeableElement", "setAutoStepForElement", "setResizeableElement", "toolbarItemIcon", "updateBy",
    "useFileInputPanel", "useModal", "useParamsEditorController", "useRightMenuController",
    "useSettingsDialogController", "useTextInputPanel",
].sort();

test("root-only runtime names are exactly the documented root-only surface", () => {
    const inSubpath = new Set(mirrored.flatMap(([, module]) => runtimeNames(module)));
    const rootOnly = runtimeNames(root as Record<string, unknown>).filter(name => !inSubpath.has(name)).sort();
    expect(rootOnly).toEqual(ROOT_ONLY);
});
