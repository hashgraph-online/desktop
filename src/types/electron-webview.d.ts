import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import type { WebviewTag } from 'electron';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: DetailedHTMLProps<HTMLAttributes<WebviewTag>, WebviewTag> & {
        allowpopups?: boolean | 'true';
        partition?: string;
        preload?: string;
        src?: string;
        useragent?: string;
      };
    }
  }
}

export {};
