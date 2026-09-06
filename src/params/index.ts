/** `wenay-react2/params` (3.0.0) - the ParamsEditor block: the editor component and its headless
 *  controller, the row renderers it is built from, the async save wrappers (ParamsEdit /
 *  ParamsArrayEdit) and the numeric-input auto-step helper the editor installs on its inputs.
 *  Depends on ./react (updateBy, MyResizeObserver) and on the wenay-common2 `Params` model;
 *  pulls no ag-grid, no react-rnd/re-resizable, no Dnd/grid/logs/chart code. */

export {ParamsEditor, useParamsEditorController} from "../internal/components/ParamsEditor/ParamsEditor.js";
export type {
    ParamsEditorController,
    ParamsEditorControllerOptions,
} from "../internal/components/ParamsEditor/ParamsEditor.js";
export {ParamLabelContent, ParamRow, ParamToggleLabel} from "../internal/components/ParamsEditor/paramRows.js";
export {ParamsArrayEdit, ParamsEdit} from "../internal/components/ParamsEditor/asyncEditors.js";
export {setAutoStepForElement} from "../internal/utils/inputAutoStep.js";
