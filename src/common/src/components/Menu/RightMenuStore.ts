import { mapRightMenu } from "../../utils/persistedMaps.js";
export type {
    MenuRightPosition,
    MenuRightSavedState,
    MenuRightVerticalPosition,
} from "../../utils/persistedMaps.js";

// observable - memoryCache marks itself dirty on its mutations (drag end re-set()s the state);
// declared in utils/persistedMaps (memoryCache registry must not import the component layer)
// and re-exported here so the public surface is unchanged
export { mapRightMenu };
