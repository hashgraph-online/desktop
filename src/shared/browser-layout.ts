export type AssistantDock = 'left' | 'right' | 'bottom';

export interface BrowserBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AssistantPanelLayout {
  isOpen: boolean;
  dock: AssistantDock;
  width: number;
  height: number;
}

export interface BrowserLayoutInfo {
  toolbarHeight: number;
  bookmarkHeight: number;
  windowBounds: { x: number; y: number; width: number; height: number };
  assistantPanel?: AssistantPanelLayout;
  devicePixelRatio?: number;
}

const safeCoordinate = (value: number): number => {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    return 0;
  }
  return Math.round(value);
};

const safeDimension = (value: number): number => {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value));
};

export const calculateBrowserBounds = (
  layoutInfo: BrowserLayoutInfo
): BrowserBounds => {
  const { toolbarHeight, bookmarkHeight, windowBounds, assistantPanel } =
    layoutInfo;

  const windowWidth = safeDimension(windowBounds.width);
  const windowHeight = safeDimension(windowBounds.height);

  const topOffset = safeDimension(toolbarHeight) + safeDimension(bookmarkHeight);

  let x = 0;
  let width = windowWidth;

  let y = topOffset;
  let height = Math.max(windowHeight - topOffset, 0);

  if (assistantPanel && assistantPanel.isOpen) {
    const dock = assistantPanel.dock;
    if (dock === 'left') {
      const dockWidth = safeDimension(assistantPanel.width);
      x += dockWidth;
      width = Math.max(width - dockWidth, 0);
    } else if (dock === 'right') {
      const dockWidth = safeDimension(assistantPanel.width);
      width = Math.max(width - dockWidth, 0);
    } else if (dock === 'bottom') {
    }
  }

  return {
    x: safeCoordinate(x),
    y: safeCoordinate(y),
    width,
    height,
  };
};
