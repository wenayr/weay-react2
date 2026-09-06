/** `wenay-react2/chart` (3.0.0) - the canvas chart block: the Sparkline component and the
 *  chart engine factories (data model / data set / panel manager / renderer / interaction, tied
 *  together by createChartEngine). Depends only on React and the shared canvas surface helpers;
 *  pulls no ag-grid, no react-rnd/re-resizable, no wenay-common2 and no components/ code. */

export {Sparkline} from "../internal/myChart/Sparkline.js";
export type {SparklineProps, SparklineSeries, SparklineTheme} from "../internal/myChart/Sparkline.js";
export {createDataModel, createDataSet} from "../internal/myChart/chartEngine/dataSet.js";
export type {
    ChartType,
    CreateDataSetParams,
    DataModel,
    DataPoint,
    DataSet,
    DataSetStyle,
    MinMaxChunk,
} from "../internal/myChart/chartEngine/dataSet.js";
export {createPanelManager} from "../internal/myChart/chartEngine/panels.js";
export type {Panel, PanelConfig, PanelManager} from "../internal/myChart/chartEngine/panels.js";
export {createRenderer} from "../internal/myChart/chartEngine/renderer.js";
export type {Renderer, Transform} from "../internal/myChart/chartEngine/renderer.js";
export {createInteraction} from "../internal/myChart/chartEngine/interaction.js";
export type {Interaction} from "../internal/myChart/chartEngine/interaction.js";
export {createChartEngine} from "../internal/myChart/chartEngine/engine.js";
export type {ChartEngine} from "../internal/myChart/chartEngine/engine.js";
