import { Logger } from '@hashgraphonline/standards-sdk';
import {
  calculateBrowserBounds as calculateBrowserBoundsShared,
  type AssistantDock,
  type AssistantPanelLayout,
  type BrowserBounds,
  type BrowserLayoutInfo,
} from '../shared/browser-layout';

const layoutLogger = new Logger({ module: 'BrowserLayout' });

export type {
  AssistantDock,
  AssistantPanelLayout,
  BrowserBounds,
  BrowserLayoutInfo,
} from '../shared/browser-layout';

export const calculateBrowserBounds = (
  layoutInfo: BrowserLayoutInfo
): BrowserBounds => {
  const result = calculateBrowserBoundsShared(layoutInfo);
  layoutLogger.info('Calculated browser bounds', {
    input: layoutInfo,
    result,
  });
  return result;
};
