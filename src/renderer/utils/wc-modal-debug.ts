import { Logger } from '@hashgraphonline/standards-sdk';

const logger = new Logger({ module: 'WcModalDebug' });

function isWcIframe(node: Node): boolean {
  if (!(node instanceof HTMLElement)) {
    return false;
  }
  if (node.tagName === 'IFRAME') {
    const src = (node as HTMLIFrameElement).src || '';
    if (
      src.includes('walletconnect') ||
      src.includes('verify.walletconnect.org')
    ) {
      return true;
    }
  }
  const tag = node.tagName.toUpperCase();
  if (
    tag === 'WCM-MODAL' ||
    tag === 'WCM-MODAL-V2' ||
    tag === 'WCM-MODAL-ROOT'
  ) {
    return true;
  }
  return false;
}

function logMutation(mutation: MutationRecord): void {
  try {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((n) => {
        if (isWcIframe(n)) {
          logger.info('WC modal node added');
        }
      });
      mutation.removedNodes.forEach((n) => {
        if (isWcIframe(n)) {
          logger.warn('WC modal node removed');
        }
      });
    }
    if (mutation.type === 'attributes') {
      const target = mutation.target as HTMLElement;
      if (isWcIframe(target)) {
        const display = target.style?.display || '';
        const visibility = target.style?.visibility || '';
        logger.info('WC modal attributes changed', {
          display,
          visibility,
          attr: mutation.attributeName,
        });
      }
    }
  } catch (e) {
    logger.error('Observer error', String(e));
  }
}

function attachObserver(): void {
  try {
    const root = document.body || document.documentElement;
    if (!root) {
      return;
    }
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        logMutation(m);
      }
    });
    obs.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'hidden', 'class'],
    });

    const originalAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (
      init: ShadowRootInit
    ): ShadowRoot {
      const shadow = originalAttachShadow.call(this, init);
      try {
        if (init && init.mode === 'open') {
          const shadowObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
              logMutation(m);
            }
          });
          shadowObserver.observe(shadow, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'hidden', 'class'],
          });
          logger.info('Attached observer to open shadow root');
        }
      } catch (e) {
        logger.warn('Failed to observe shadow root', String(e));
      }
      return shadow;
    };

    const originalAppendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function <T extends Node>(node: T): T {
      try {
        if (isWcIframe(node)) {
          logger.info('appendChild -> WC node added');
        }
      } catch (e) {
        logger.warn('appendChild hook error', String(e));
      }
      return originalAppendChild.call(this, node);
    };

    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function <T extends Node>(node: T): T {
      try {
        if (isWcIframe(node)) {
          logger.warn('removeChild -> WC node removed');
        }
      } catch (e) {
        logger.warn('removeChild hook error', String(e));
      }
      return originalRemoveChild.call(this, node);
    };

    try {
      const desc = Object.getOwnPropertyDescriptor(
        HTMLIFrameElement.prototype,
        'src'
      );
      if (desc && desc.set) {
        Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
          configurable: true,
          enumerable: desc.enumerable,
          get: desc.get?.bind(HTMLIFrameElement.prototype),
          set: function (this: HTMLIFrameElement, value: string) {
            try {
              if (
                typeof value === 'string' &&
                (value.includes('walletconnect') ||
                  value.includes('verify.walletconnect.org'))
              ) {
                logger.info('iframe src set', { value });
              }
            } catch (e) {
              logger.warn('iframe src hook error', String(e));
            }
            return desc.set!.call(this, value);
          },
        });
      }
    } catch (e) {
      logger.warn('Failed to patch iframe src', String(e));
    }
  } catch (e) {
    logger.error('Failed to attach WC modal observer', String(e));
  }
}

try {
  window.addEventListener('message', (event: MessageEvent) => {
    try {
      const origin = event.origin;
      const data = event.data;
      const parsed = typeof data === 'string' ? (() => { try { return JSON.parse(data); } catch { return null; } })() : data;
      if (parsed && typeof parsed === 'object' && 'type' in parsed) {
        logger.info('Window message', { origin, type: (parsed as { type: string }).type });
      } else {
        logger.info('Window message (unparsed)', { origin });
      }
    } catch (e) {
      logger.warn('Message listener error', String(e));
    }
  }, true);
} catch (e) {
  logger.warn('Failed to attach window message logger', String(e));
}

try {
  const originalAddEventListener = window.addEventListener;
  window.addEventListener = function (...args: Parameters<typeof originalAddEventListener>) {
    try {
      const [type] = args;
      if (type === 'message') {
        logger.info('addEventListener(message) called');
      }
    } catch (e) {
      logger.warn('addEventListener patch warn', String(e));
    }
    return originalAddEventListener.apply(this, args as unknown as Parameters<typeof originalAddEventListener>);
  } as typeof window.addEventListener;
} catch (e) {
  logger.warn('Failed to patch addEventListener', String(e));
}

try {
  const originalDefine = customElements.define.bind(customElements);
  customElements.define = function (name: string, constructor: CustomElementConstructor, options?: ElementDefinitionOptions) {
    try {
      if (name && name.startsWith('wcm-')) {
        logger.info('Custom element defined', { name });
      }
    } catch (e) {
      logger.warn('customElements.define patch warn', String(e));
    }
    return originalDefine(name, constructor, options as ElementDefinitionOptions);
  } as typeof customElements.define;
} catch (e) {
  logger.warn('Failed to patch customElements.define', String(e));
}

try {
  setTimeout(() => {
    const modal = document.getElementById('wcm-modal');
    if (modal) {
      const container = modal.querySelector('.wcm-container') as HTMLElement | null;
      if (container) {
        logger.info('WC container snapshot', { empty: !container.innerHTML || container.innerHTML.trim().length === 0 });
        try {
          const cs = getComputedStyle(modal as HTMLElement);
          logger.info('WC modal styles', {
            display: cs.display,
            visibility: cs.visibility,
            opacity: cs.opacity,
            zIndex: cs.zIndex,
          });
        } catch (e) {
          logger.warn('style snapshot warn', String(e));
        }
      }
    }
  }, 1500);
} catch (e) {
  logger.warn('Snapshot error', String(e));
}

try {
  const hasModal = typeof customElements.get === 'function' && !!customElements.get('wcm-modal');
  logger.info('Custom element presence', { wcmModalDefined: hasModal });
} catch (e) {
  logger.warn('custom elements presence warn', String(e));
}

attachObserver();
