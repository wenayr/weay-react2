import type { QaCard } from "./standKit.js";
import { Card57 } from './cards/reorderAccessible.js';
import { Card56 } from './cards/serviceBindings.js';
import { Card55 } from "./cards/replayChunks.js";
import { Card49, Card6 } from "./cards/chart.js";
import { Card51, Card38, Card39, Card40, Card41, Card42, Card43, Card44, Card45, Card46 } from "./cards/peerMedia.js";
import { Card18, Card17, Card23, Card24, Card33, Card34, Card48, Card50 } from "./cards/replay.js";
import { Card13, Card20, Card21, Card22, Card25, Card3, Card4, Card53, Card54 } from "./cards/menuModal.js";
import { Card26, Card27, Card35, Card52, Card2 } from "./cards/dnd.js";
import { Card31, Card32, Card47, Card30, Card29, Card28 } from "./cards/columns.js";
import { Card8, Card1, Card14, Card7, Card19, Card9, Card10, Card11 } from "./cards/logsParams.js";
import { Card5, Card12, Card15, Card16 } from "./cards/grid.js";

export const qaCards: QaCard[] = [
    { id: 'reorder-accessible', n: 57, section: 'active', title: 'Accessible organizer — keyboard, handles, edge scroll, command tuples', Component: Card57 },
    { id: 'service-bindings', n: 56, section: 'active', title: 'Owned client + typed commands — session lifecycle', Component: Card56 },
    { id: 'store-replay-chunks', n: 55, section: 'active', title: 'Store Replay — typed inventory and chunked loading', Component: Card55 },
    { id: 'param-commentary-hover', n: 7, section: 'active', title: 'Parameters - sliders and stable commentary hover', tall: true, Component: Card7 },
    { id: 'sparkline', n: 49, section: 'active', title: 'Sparkline — compact canvas chart', Component: Card49 },
    { id: 'peer-packet-mesh', n: 51, section: 'active', title: 'common2 Peer packet mesh — multi-hop routing + fallback', tall: true, Component: Card51 },
    { n: 18, section: 'active', title: 'Observe hooks - local store and listen', tall: true, Component: Card18 },
    { n: 17, section: 'active', title: 'Observe hooks - store mirror over HTTP/SSE', tall: true, Component: Card17 },
    { n: 23, section: 'active', title: 'Replay hooks - video line, conflation, time travel, freshness', tall: true, Component: Card23 },
    { n: 24, section: 'active', title: 'Replay hooks - store sync (useStoreReplayMirror)', Component: Card24 },
    { n: 33, section: 'active', title: 'Replay hooks - per-key feed (useStoreReplayEach)', tall: true, Component: Card33 },
    { n: 34, section: 'active', title: 'Replay hooks - route hand-off (useReplayRouteSubscribe)', tall: true, Component: Card34 },
    { n: 13, section: 'active', title: 'ModalProvider / useModal - Escape and outside click', Component: Card13 },
    { n: 20, section: 'active', title: 'SettingsDialog - searchable settings tree + registry', Component: Card20 },
    { n: 38, section: 'active', title: 'Media video — balanced / MAX unpaced capture diagnostics', Component: Card38 },
    { n: 39, section: 'active', title: 'Media audio - mic lifecycle + sequential player', Component: Card39 },
    { n: 40, section: 'active', title: 'Peer SDK - mirrored store + explicit resync', Component: Card40 },
    { n: 41, section: 'active', title: 'Peer calls - ring, accept, hangup', Component: Card41 },
    { n: 42, section: 'active', title: 'Peer presence - snapshot plus online/offline edges', Component: Card42 },
    { n: 43, section: 'active', title: 'Media relay - actual camera stream with live ACL revoke', Component: Card43 },
    { n: 44, section: 'active', title: 'Audio relay - actual microphone stream with live ACL revoke', Component: Card44 },
    { n: 45, section: 'active', title: 'Peer call with live video and audio relay', Component: Card45 },
    { n: 46, section: 'active', title: 'Conference: 3-way star room over the media relay + policy-routed direct focus', tall: true, Component: Card46 },
    { n: 21, section: 'active', title: 'createUiSlot - configurable block placement', Component: Card21 },
    { n: 22, section: 'active', title: 'createCallbackHub - one slot, many subscribers', Component: Card22 },
    { n: 25, section: 'active', title: 'createToolbar - customizable toolbar (config / Bar / Settings)', tall: true, Component: Card25 },
    { n: 26, section: 'active', title: 'useReorder - drag blocks in a field (mini dnd)', Component: Card26 },
    { id: 'reorder-board', n: 27, section: 'active', title: 'useReorderBoard + useReorder - draggable columns and items', tall: true, Component: Card27 },
    { n: 35, section: 'active', title: 'DragBox - imperative delta drag (adapter over useDraggableApi)', Component: Card35 },
    { id: 'floating-window-stack', n: 52, section: 'active', title: 'FloatingWindow - desktop taskbar, sessions, cascade and Snap', tall: true, Component: Card52 },
    { id: 'right-menu-dropdown', n: 54, section: 'active', title: 'RightMenu dropdown - createRightMenuController + submenus', tall: true, Component: Card54 },
    { id: 'context-menu-edges', n: 53, section: 'active', title: 'Context menu - viewport edge, FloatingWindow, touch long press', tall: true, Component: Card53 },
    { n: 31, section: 'active', title: 'Toolbar over columnState - one config drives toolbar + menu + grid', tall: true, Component: Card31 },
    { n: 32, section: 'active', title: 'createColumnGrid - default grid menu + mobile dots for table/cards', tall: true, Component: Card32 },
    { id: 'grid-chrome', n: 47, section: 'active', title: 'Grid Chrome — compact table commands', Component: Card47 },
    { id: 'ai-run-client', n: 48, section: 'active', title: 'common2 AI run — React Store/Replay adapter', Component: Card48 },
    { id: 'contract-runtime', n: 50, section: 'active', title: 'common2 Contract runtime — versioned binding view', Component: Card50 },
    { n: 30, section: 'active', title: 'columnState toolbar menu - grouped sub-columns', tall: true, Component: Card30 },
    { n: 29, section: 'active', title: 'columnState mobile - ColumnDots + CardList (dots create the blocks)', tall: true, Component: Card29 },
    { n: 28, section: 'active', title: 'columnState - persisted column layout (external layer)', tall: true, Component: Card28 },
    { n: 8, section: 'active', title: 'Outside-click closing (OutsideClickArea)', Component: Card8 },
    { n: 1, section: 'archive', title: 'Reactivity updateBy / renderBy', Component: Card1 },
    { n: 14, section: 'archive', title: 'Keyboard API - useKeyboard / keyboard', Component: Card14 },
    { n: 2, section: 'archive', title: 'Drag + Resize (FloatingWindow / FloatingWindow)', tall: true, Component: Card2 },
    { n: 3, section: 'archive', title: 'Nested menu (Menu) + hover', Component: Card3 },
    { n: 5, section: 'archive', title: 'Grid + transactions (applyGridRows)', tall: true, Component: Card5 },
    { n: 6, section: 'archive', title: 'Chart (MyChartEngine) - LOD min+max', tall: true, Component: Card6 },
    { n: 19, section: 'archive', title: 'Parameters - resize observer shrink repro', tall: true, Component: Card19 },
    { n: 12, section: 'archive', title: 'agGrid4 - controller, removal, external buffer', tall: true, Component: Card12 },
    { n: 15, section: 'archive', title: 'agGrid4 - overlay rowData', tall: true, Component: Card15 },
    { n: 16, section: 'archive', title: 'agGrid4 - dynamic column buffer', tall: true, Component: Card16 },
    { n: 4, section: 'archive', title: 'Right-click context menu (contextMenu)', tall: true, Component: Card4 },
    { n: 9, section: 'archive', title: 'Logs - time format + MiniLogs layers', tall: true, Component: Card9 },
    { n: 10, section: 'archive', title: 'ParamsArrayEdit vs ParamsEdit - what is sent to onSave', tall: true, Component: Card10 },
    { n: 11, section: 'archive', title: 'Parameters - debounce onChange', tall: true, Component: Card11 },
];
