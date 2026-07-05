export type MenuRightPosition = 'left' | 'right';
export type MenuRightPosition2 = 'top' | 'bottom';

export type MenuRightSavedState = {
    position: MenuRightPosition;
    position2: MenuRightPosition2;
    offset: {
        x: number;
        y: number;
    };
};

import { ObservableMap } from "../../utils/observableMap";

// observable - Cash marks itself dirty on its mutations (drag end re-set()s the state)
export const mapRightMenu = new ObservableMap<string, MenuRightSavedState>();
