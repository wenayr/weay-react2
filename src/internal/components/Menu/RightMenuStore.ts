import { mapRightMenu } from "../../persist/persistedMaps.js";
export type {
    MenuRightPosition,
    MenuRightSavedState,
    MenuRightVerticalPosition,
} from "../../persist/persistedMaps.js";

// observable - memoryCache marks itself dirty on its mutations (drag end re-set()s the state);
// declared in persist/persistedMaps (memoryCache registry must not import the component layer)
// and re-exported here so the public surface is unchanged
export { mapRightMenu };
