/** `wenay-calls` - the React call UI and hooks over the wenay-common2 peer/media stack. Until
 *  wenay-react2 5.0.0 this was its `./communication` entry. It imports only react and
 *  wenay-common2 and never depends on wenay-react2 (whose module-level state must stay single). */

export {useMediaSource} from "./useMedia.js";
export type {UseMediaSourceController} from "./useMedia.js";
export {usePeer} from "./usePeer.js";
export {usePeerCalls, usePeerPresence} from "./usePeerCall.js";
export type {PeerPresence} from "./usePeerCall.js";
export {useRouteState} from "./useRoute.js";
export type {RouteLogEntry} from "./useRoute.js";
export {VideoCall, useVideoCallController, videoCallLabelsEn, videoCallLabelsRu} from "./VideoCall.js";
export type {
    UseVideoCallControllerOptions,
    VideoCallAssistant,
    VideoCallController,
    VideoCallFocusMode,
    VideoCallLabels,
    VideoCallLayout,
    VideoCallMediaState,
    VideoCallMeeting,
    VideoCallMessage,
    VideoCallPanel,
    VideoCallParticipant,
    VideoCallPhase,
    VideoCallPoll,
    VideoCallProps,
    VideoCallRecording,
    VideoCallRecordingState,
    VideoCallRoom,
    VideoCallScreenState,
    VideoCallTone,
} from "./VideoCall.js";
