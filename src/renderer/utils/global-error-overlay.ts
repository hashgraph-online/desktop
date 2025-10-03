const OVERLAY_ID = 'moonscape-dev-error-overlay';

type OverlayOptions = {
  title: string;
  details?: string;
};

const renderOverlay = ({ title, details }: OverlayOptions): void => {
  if (typeof document === 'undefined') {
    return;
  }

  const existing = document.getElementById(OVERLAY_ID);
  const container = existing ?? document.createElement('div');

  container.id = OVERLAY_ID;
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.right = '0';
  container.style.padding = '16px';
  container.style.zIndex = '2147483647';
  container.style.background = 'rgba(191, 28, 28, 0.95)';
  container.style.color = '#fff';
  container.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  container.style.fontSize = '13px';
  container.style.lineHeight = '1.4';
  container.style.whiteSpace = 'pre-wrap';
  container.style.maxHeight = '40vh';
  container.style.overflow = 'auto';
  container.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)';

  container.innerHTML = `⚠️ <strong>${title}</strong>\n${details ?? ''}`;

  if (!existing) {
    document.body.appendChild(container);
  }
};

const formatReason = (reason: unknown): string => {
  if (reason instanceof Error) {
    return `${reason.message}\n${reason.stack ?? ''}`;
  }
  if (typeof reason === 'object') {
    try {
      return JSON.stringify(reason, null, 2);
    } catch {
      return String(reason);
    }
  }
  return String(reason);
};



export {};
