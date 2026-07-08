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

import { ObservableMap } from "../../utils/observableMap";

// observable - memoryCache marks itself dirty on its mutations (drag end re-set()s the state)
export const mapRightMenu = new ObservableMap<string, MenuRightSavedState>();
