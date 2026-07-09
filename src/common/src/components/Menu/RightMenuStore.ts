export type MenuRightPosition = 'left' | 'right';
export type MenuRightVerticalPosition = 'top' | 'bottom';

export type MenuRightSavedState = {
    position: MenuRightPosition;
    verticalPosition: MenuRightVerticalPosition;
    offset: {
        x: number;
        y: number;
    };
};

import { mapRightMenu } from "../../utils/persistedMaps";

// observable - memoryCache marks itself dirty on its mutations (drag end re-set()s the state);
// declared in utils/persistedMaps (memoryCache registry must not import the component layer)
// and re-exported here so the public surface is unchanged
export { mapRightMenu };
