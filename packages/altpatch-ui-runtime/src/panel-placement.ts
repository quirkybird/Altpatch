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

const PANEL_GAP = 20;
const VIEWPORT_MARGIN = 8;
const POINTER_Y_OFFSET = 24;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function computePanelPlacementFromPointer(
  pointer: { x: number; y: number },
  panelSize: SizeLike,
  viewport: PlacementViewport
): PanelPlacement {
  const safeWidth = Math.max(0, panelSize.width);
  const safeHeight = Math.max(0, panelSize.height);
  const maxX = Math.max(VIEWPORT_MARGIN, viewport.width - VIEWPORT_MARGIN - safeWidth);
  const maxY = Math.max(VIEWPORT_MARGIN, viewport.height - VIEWPORT_MARGIN - safeHeight);

  const rightStartX = pointer.x + PANEL_GAP;
  const leftStartX = pointer.x - PANEL_GAP - safeWidth;
  const rightFits = rightStartX + safeWidth <= viewport.width - VIEWPORT_MARGIN;
  const leftFits = leftStartX >= VIEWPORT_MARGIN;

  let side: 'right' | 'left';
  let x: number;

  if (rightFits) {
    side = 'right';
    x = rightStartX;
  } else if (leftFits) {
    side = 'left';
    x = leftStartX;
  } else {
    const rightSpace = viewport.width - VIEWPORT_MARGIN - pointer.x;
    const leftSpace = pointer.x - VIEWPORT_MARGIN;
    side = rightSpace >= leftSpace ? 'right' : 'left';
    x = side === 'right' ? viewport.width - VIEWPORT_MARGIN - safeWidth : VIEWPORT_MARGIN;
  }

  const y = clamp(pointer.y - POINTER_Y_OFFSET, VIEWPORT_MARGIN, maxY);

  return {
    x: clamp(x, VIEWPORT_MARGIN, maxX),
    y,
    side
  };
}
