export type SizeLike = {
    width: number;
    height: number;
};
export type PlacementViewport = {
    width: number;
    height: number;
};
export type PanelPlacement = {
    x: number;
    y: number;
    side: 'right' | 'left';
};
export declare function computePanelPlacementFromPointer(pointer: {
    x: number;
    y: number;
}, panelSize: SizeLike, viewport: PlacementViewport): PanelPlacement;
//# sourceMappingURL=panel-placement.d.ts.map