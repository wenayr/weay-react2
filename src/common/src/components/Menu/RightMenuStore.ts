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

export const mapRightMenu = new Map<string, MenuRightSavedState>();
