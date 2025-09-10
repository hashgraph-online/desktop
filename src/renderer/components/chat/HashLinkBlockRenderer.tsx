import React, { useEffect, useState, useRef, useMemo } from 'react';
import { BlockLoader, Logger } from '@hashgraphonline/standards-sdk';
import { cn } from '../../lib/utils';
import {
  FiX,
  FiLink,
  FiCopy,
  FiExternalLink,
  FiRefreshCw,
} from 'react-icons/fi';
import Typography from '../ui/Typography';
import { motion } from 'framer-motion';
import { useConfigStore } from '../../stores/configStore';

const logger = new Logger({ module: 'HashLinkBlockRenderer' });

const FALLBACK_TEMPLATE = `<div class="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 shadow-sm w-full">
  <div class="flex items-center gap-3 mb-4">
    <div class="w-6 h-6 bg-blue-500 rounded flex-shrink-0"></div>
    <div class="min-w-0 flex-1">
      <h3 class="font-semibold text-slate-900 dark:text-slate-100 text-base mb-1">{{name}}</h3>
      <p class="text-sm text-slate-600 dark:text-slate-400">by {{creator}}</p>
    </div>
  </div>
  <div class="pt-2 border-t border-slate-200 dark:border-slate-700">
    <p class="text-xs text-slate-600 dark:text-slate-400">Topic: {{topicId}} | Network: {{network}}</p>
  </div>
</div>`;

interface HashLinkBlock {
  blockId: string;
  hashLink: string;
  template: string;
  attributes: Record<string, unknown>;
}

interface HashLinkBlockRendererProps {
  hashLinkBlock: HashLinkBlock;
  className?: string;
  // Rendering strategy for template execution
  // - 'host': inject into DOM (not recommended for templates with scripts)
  // - 'sandbox': render inside sandboxed iframe
  renderMode?: 'host' | 'sandbox';
  // When sandboxed, copy host styles (Tailwind, global CSS) into the iframe head
  inheritStyles?: boolean;
}

/**
 * Generic renderer for HCS-12 HashLink blocks
 * Fetches templates from the blockchain and renders them with simple variable substitution
 * Templates are expected to be self-contained with their own JavaScript and CSS
 */
const HashLinkBlockRenderer: React.FC<HashLinkBlockRendererProps> = ({
  hashLinkBlock,
  className,
  renderMode = 'sandbox',
  inheritStyles = true,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderedContent, setRenderedContent] = useState<string | null>(null);
  const [loadTime, setLoadTime] = useState<number | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const { config } = useConfigStore();
  const contentRef = useRef<HTMLDivElement>(null);
  const hasRenderedRef = useRef(false);
  const loadStartTime = useRef<number | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(420);

  const blockId = hashLinkBlock.blockId;
  const template = hashLinkBlock.template;
  const network = config?.hedera?.network === 'mainnet' ? 'mainnet' : 'testnet';
  const baseHref = typeof document !== 'undefined' ? document.baseURI : '/';

  const attributesKey = useMemo(() => {
    return JSON.stringify(hashLinkBlock.attributes);
  }, [hashLinkBlock.attributes]);

  const copyHRL = async () => {
    try {
      await navigator.clipboard.writeText(hashLinkBlock.hashLink);

      logger.info('HRL copied to clipboard', { hrl: hashLinkBlock.hashLink });
    } catch (error) {
      logger.error('Failed to copy HRL to clipboard', error);
    }
  };

  const openInExplorer = () => {
    try {
      const isMainnet = network === 'mainnet';
      const baseUrl = isMainnet
        ? 'https://hashscan.io'
        : 'https://hashscan.io/testnet';
      const explorerUrl = `${baseUrl}/topic/${hashLinkBlock.blockId}`;
      window.open(explorerUrl, '_blank', 'noopener,noreferrer');
      logger.info('Opened HashLink in explorer', { url: explorerUrl });
    } catch (error) {
      logger.error('Failed to open explorer', error);
    }
  };

  const refreshBlock = () => {
    hasRenderedRef.current = false;
    setRenderedContent(null);
    setRenderError(null);
    setIsLoading(true);
    setLoadTime(null);
    setIsFromCache(false);
    setImagesLoaded(0);
    setTotalImages(0);
    loadStartTime.current = null;
  };

  const handleKeyDown = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

const shouldSandbox = useMemo(() => {
    // Always sandbox unless explicitly requested to use host
    return renderMode !== 'host';
  }, [renderMode]);

  useEffect(() => {
    if (hasRenderedRef.current && renderedContent) {
      logger.info('Skipping re-render, content already loaded');
      return;
    }

    const renderHashLinkBlock = async () => {
      try {
        loadStartTime.current = performance.now();
        setIsLoading(true);
        setRenderError(null);
        setIsFromCache(false);

        const logger = new Logger({
          module: 'HashLinkRenderer',
          level: 'info',
        });

        const blockLoader = new BlockLoader(network, logger);

        let templateContent = template;

        const isBlockIdTemplate = templateContent?.match(/^0\.0\.\d+$/);

        if (isBlockIdTemplate) {
          try {
            logger.info(
              `Fetching template from blockchain: ${templateContent}`
            );
            const blockData = await blockLoader.loadBlock(templateContent);
            if (blockData.template) {
              templateContent = blockData.template;
              logger.info('Template fetched successfully from blockchain');
            } else {
              throw new Error('No template found in block data');
            }
          } catch (loadError) {
            logger.error('Failed to load template from blockchain:', loadError);
            setRenderError(
              `Failed to load template: ${loadError instanceof Error ? loadError.message : 'Unknown error'}`
            );
            return;
          }
        } else if (!templateContent || templateContent.trim() === '') {
          templateContent = FALLBACK_TEMPLATE;
          logger.info('Using fallback template');
        }

        let finalHtml = templateContent;
        if (finalHtml && finalHtml.includes('{{')) {
          Object.entries(hashLinkBlock.attributes).forEach(([key, value]) => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            finalHtml = finalHtml?.replace(regex, String(value || ''));
          });
        }

        logger.info('Template rendered successfully', {
          templateLength: finalHtml?.length,
          attributeCount: Object.keys(hashLinkBlock.attributes).length,
        });

        setRenderedContent(finalHtml);
        hasRenderedRef.current = true;

        if (loadStartTime.current) {
          const endTime = performance.now();
          const timeElapsed = Math.round(endTime - loadStartTime.current);
          setLoadTime(timeElapsed);
        }

        if (loadStartTime.current) {
          const endTime = performance.now();
          const timeElapsed = endTime - loadStartTime.current;
          setIsFromCache(timeElapsed < 100);
        }
      } catch (error) {
        logger.error('Template rendering failed:', error);
        setRenderError(
          error instanceof Error ? error.message : 'Unknown rendering error'
        );
      } finally {
        setIsLoading(false);
      }
    };

    renderHashLinkBlock();
  }, [blockId, template, network, attributesKey]);


  useEffect(() => {
    // Skip host-DOM image observation if sandboxing
    if (shouldSandbox) return;
    if (renderedContent && contentRef.current) {
      const images = contentRef.current.querySelectorAll('img');
      setTotalImages(images.length);
      setImagesLoaded(0);

      if ('IntersectionObserver' in window) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const img = entry.target as HTMLImageElement;
                if (img.dataset.src) {
                  img.src = img.dataset.src;
                  img.classList.remove('opacity-0');
                  img.classList.add('opacity-100');
                  observerRef.current?.unobserve(img);
                }
              }
            });
          },
          { rootMargin: '50px' }
        );

        images.forEach((img) => {
          if (!img.src || img.src === '') {
            img.dataset.src = img.src;
            img.src =
              'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2YzZjRmNiIvPgo8L3JlY3Q+Cjwvc3ZnPg==';
            img.classList.add(
              'opacity-0',
              'transition-opacity',
              'duration-300'
            );
            observerRef.current?.observe(img);
          }

          img.addEventListener('load', () => {
            setImagesLoaded((prev) => prev + 1);
          });

          img.addEventListener('error', () => {
            setImagesLoaded((prev) => prev + 1);
          });
        });
      }
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [renderedContent, shouldSandbox]);



// Resize handling for sandboxed iframe without injecting scripts
  useEffect(() => {
    if (!shouldSandbox) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    let roDoc: ResizeObserver | null = null;
    let roRoot: ResizeObserver | null = null;

    const measure = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const root = doc.getElementById('hlb-root');
        if (root) {
          // Prefer the content wrapper height
          const rootScroll = root.scrollHeight;
          const rootRect = root.getBoundingClientRect().height;
          const h = Math.max(rootScroll, Math.ceil(rootRect));
          setIframeHeight(Math.max(100, h));
        } else {
          // Fallback to document measurements
          const body = doc.body;
          const html = doc.documentElement;
          const h = Math.max(body.scrollHeight, html.scrollHeight);
          setIframeHeight(Math.max(100, h));
        }
      } catch {}
    };

    const onLoad = () => {
      try {
        measure();
        const doc = iframe.contentDocument;
        if (!doc) return;
        const root = doc.getElementById('hlb-root') as HTMLElement | null;
        if (typeof ResizeObserver !== 'undefined') {
          roDoc = new ResizeObserver(() => measure());
          roDoc.observe(doc.body);
          if (root) {
            roRoot = new ResizeObserver(() => measure());
            roRoot.observe(root);
          }
        } else {
          // Fallback: periodic measurement if ResizeObserver unavailable
          const intervalId = window.setInterval(measure, 500);
          (iframe as any).__hlbInterval = intervalId;
        }
      } catch {}
    };

    iframe.addEventListener('load', onLoad);

    // If already loaded, trigger measure
    if ((iframe as any).contentDocument?.readyState === 'complete') {
      onLoad();
    }

    return () => {
      iframe.removeEventListener('load', onLoad);
      try {
        roDoc?.disconnect();
      } catch {}
      try {
        roRoot?.disconnect();
      } catch {}
      const intervalId = (iframe as any).__hlbInterval as number | undefined;
      if (intervalId) {
        window.clearInterval(intervalId);
        (iframe as any).__hlbInterval = undefined;
      }
    };
  }, [shouldSandbox, renderedContent]);

  // When sandboxed, optionally copy host stylesheets and style tags into the iframe
  useEffect(() => {
    if (!shouldSandbox || !inheritStyles) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const injectStyles = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const head = doc.head;
        if (!head) return;

        // Avoid double-injection
        if (head.querySelector('[data-hol-injected="1"]')) return;

        // Clone link[rel="stylesheet"] from host
        const hostLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
        hostLinks.forEach((lnk) => {
          try {
            const newLink = doc.createElement('link');
            newLink.setAttribute('rel', 'stylesheet');
            // copy attributes conservatively
            if (lnk.href) newLink.href = lnk.href;
            if (lnk.media) newLink.media = lnk.media;
            if (lnk.crossOrigin) newLink.crossOrigin = lnk.crossOrigin;
            newLink.setAttribute('data-hol-injected', '1');
            head.appendChild(newLink);
          } catch {}
        });

        // Clone inline <style> tags (Tailwind often emits these in dev/bundled environments)
        const hostStyles = Array.from(document.querySelectorAll('style')) as HTMLStyleElement[];
        hostStyles.forEach((st) => {
          try {
            const cssText = st.textContent || '';
            if (!cssText.trim()) return;
            const newStyle = doc.createElement('style');
            newStyle.textContent = cssText;
            newStyle.setAttribute('data-hol-injected', '1');
            head.appendChild(newStyle);
          } catch {}
        });

        // Marker to prevent re-injection
        const marker = doc.createElement('meta');
        marker.setAttribute('data-hol-injected', '1');
        head.appendChild(marker);
      } catch {}
    };

    // Inject on load
    iframe.addEventListener('load', injectStyles);

    // If already loaded, inject immediately
    if ((iframe as any).contentDocument?.readyState === 'complete') {
      injectStyles();
    }

    return () => {
      iframe.removeEventListener('load', injectStyles);
    };
  }, [shouldSandbox, inheritStyles, renderedContent]);

  if (isLoading) {
    return (
      <div
        className={cn(
          'relative mt-3 border rounded-xl overflow-hidden bg-gradient-to-br from-blue-50/60 via-blue-50/40 to-blue-50/30 dark:from-blue-950/60 dark:via-blue-950/40 dark:to-blue-950/30 border-blue-200/50 dark:border-blue-700/50 shadow-lg',
          className
        )}
        role='status'
        aria-live='polite'
        aria-label='Loading HashLink block content'
      >
        {/* Header skeleton */}
        <div className='flex items-center justify-between p-4 bg-gradient-to-r from-blue-100/80 via-blue-50/60 to-cyan-50/60 dark:from-blue-900/80 dark:via-blue-950/60 dark:to-cyan-950/60'>
          <div className='flex items-center gap-3'>
            <div className='w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20'>
              <FiLink className='w-3.5 h-3.5 text-white' />
            </div>
            <div className='h-4 bg-blue-200 dark:bg-blue-800 rounded w-32 animate-pulse'></div>
            <div className='px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 rounded-full'>
              <div className='h-3 bg-blue-300 dark:bg-blue-700 rounded w-16 animate-pulse'></div>
            </div>
          </div>
          <div className='flex items-center gap-1'>
            <div className='w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-md animate-pulse'></div>
            <div className='w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-md animate-pulse'></div>
            <div className='w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-md animate-pulse'></div>
          </div>
        </div>

        {/* Content skeleton */}
        <div className='p-6 space-y-4'>
          <div className='flex items-start gap-4'>
            <div className='w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse flex-shrink-0'></div>
            <div className='flex-1 space-y-2'>
              <div className='h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 animate-pulse'></div>
              <div className='h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 animate-pulse'></div>
              <div className='h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3 animate-pulse'></div>
            </div>
          </div>

          <div className='border-t border-slate-200 dark:border-slate-700 pt-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <div className='h-3 bg-slate-200 dark:bg-slate-700 rounded w-16 animate-pulse'></div>
                <div className='h-4 bg-slate-200 dark:bg-slate-700 rounded w-full animate-pulse'></div>
              </div>
              <div className='space-y-2'>
                <div className='h-3 bg-slate-200 dark:bg-slate-700 rounded w-16 animate-pulse'></div>
                <div className='h-4 bg-slate-200 dark:bg-slate-700 rounded w-full animate-pulse'></div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading overlay */}
        <div className='absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm'>
          <div className='flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg px-4 py-3 shadow-lg'>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className='w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full'
            />
            <Typography
              variant='caption'
              className='text-purple-700 dark:text-purple-300 font-medium'
            >
              Loading HashLink block...
            </Typography>
          </div>
        </div>
      </div>
    );
  }

  if (renderError) {
    return (
      <div
        className={cn(
          'relative mt-3 border rounded-xl overflow-hidden bg-gradient-to-br from-blue-50/60 via-blue-50/40 to-blue-50/30 dark:from-blue-950/60 dark:via-blue-950/40 dark:to-blue-950/30 border-blue-200/50 dark:border-blue-700/50 shadow-lg',
          className
        )}
        role='alert'
        aria-live='assertive'
      >
        <div className='p-4'>
          <div className='flex items-start gap-3 mb-4'>
            <div className='w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0'>
              <FiX className='w-3 h-3 text-white' />
            </div>
            <div className='flex-1 min-w-0'>
              <Typography
                variant='caption'
                className='font-semibold text-red-700 dark:text-red-300 block mb-1'
              >
                HashLink Block Error
              </Typography>
              <Typography
                variant='caption'
                className='text-red-600 dark:text-red-400 block text-xs leading-relaxed'
              >
                {renderError}
              </Typography>
            </div>
          </div>

          <div className='flex items-center gap-2 pt-3 border-t border-red-200/30 dark:border-red-700/30'>
            <button
              onClick={refreshBlock}
              onKeyDown={(e) => handleKeyDown(e, refreshBlock)}
              className='flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 focus:bg-red-200 dark:focus:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 text-red-700 dark:text-red-300 rounded-md transition-colors text-xs font-medium'
              aria-label='Retry loading HashLink block'
              tabIndex={0}
            >
              <FiRefreshCw className='w-3 h-3' />
              Retry
            </button>

            <button
              onClick={openInExplorer}
              onKeyDown={(e) => handleKeyDown(e, openInExplorer)}
              className='flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 focus:bg-gray-200 dark:focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 text-gray-700 dark:text-gray-300 rounded-md transition-colors text-xs font-medium'
              aria-label='Open topic in HashScan explorer'
              tabIndex={0}
            >
              <FiExternalLink className='w-3 h-3' />
              View in Explorer
            </button>
          </div>

          <div className='mt-3 p-2 bg-red-50 dark:bg-red-950/20 rounded border border-red-200/50 dark:border-red-700/30'>
            <Typography
              variant='caption'
              className='text-red-600 dark:text-red-400 text-xs'
            >
              <strong>Troubleshooting tips:</strong>
              <br />• Check your network connection
              <br />• Verify the HashLink reference is valid
              <br />• Try refreshing if the issue persists
            </Typography>
          </div>
        </div>
      </div>
    );
  }

  if (!renderedContent) {
    return (
      <div
        className={cn(
          'relative mt-3 border rounded-xl overflow-hidden bg-gradient-to-br from-blue-50/60 via-blue-50/40 to-blue-50/30 dark:from-blue-950/60 dark:via-blue-950/40 dark:to-blue-950/30 border-blue-200/50 dark:border-blue-700/50 shadow-lg p-4',
          className
        )}
      >
        <Typography
          variant='caption'
          className='text-gray-600 dark:text-gray-400'
        >
          No content available for HashLink block
        </Typography>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative mt-3 border rounded-xl overflow-hidden bg-gradient-to-br from-blue-50/60 via-blue-50/40 to-blue-50/30 dark:from-blue-950/60 dark:via-blue-950/40 dark:to-blue-950/30 border-blue-200/50 dark:border-blue-700/50 shadow-lg',
        className
      )}
    >
      <div className='flex items-center justify-between p-4 bg-gradient-to-r from-blue-100/80 via-blue-50/60 to-cyan-50/60 dark:from-blue-900/80 dark:via-blue-950/60 dark:to-cyan-950/60'>
        <div className='flex items-center gap-3'>
          <div className='w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20'>
            <FiLink className='w-3.5 h-3.5 text-white' />
          </div>
          <Typography
            variant='caption'
            className='font-semibold text-blue-700 dark:text-blue-300 text-sm'
          >
            HCS-12 HashLink Block
          </Typography>
          <div className='flex items-center gap-2'>
            <div className='px-2.5 py-1 bg-blue-100/80 dark:bg-blue-900/60 rounded-full border border-blue-200/50 dark:border-blue-700/50'>
              <Typography
                variant='caption'
                className='text-xs font-mono text-blue-700 dark:text-blue-300'
              >
                {hashLinkBlock.blockId}
              </Typography>
            </div>

            {/* Cache and performance indicators */}
            {(loadTime || totalImages > 0) && (
              <div className='flex items-center gap-1'>
                {isFromCache && (
                  <div
                    className='flex items-center gap-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 rounded text-xs'
                    title='Loaded from cache'
                  >
                    <div className='w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse'></div>
                    <span className='text-green-700 dark:text-green-300 font-medium'>
                      Cache
                    </span>
                  </div>
                )}

                {loadTime && (
                  <div
                    className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      loadTime < 500
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : loadTime < 2000
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    }`}
                    title={`Load time: ${loadTime}ms`}
                  >
                    {loadTime}ms
                  </div>
                )}

                {totalImages > 0 && imagesLoaded < totalImages && (
                  <div
                    className='flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded text-xs'
                    title={`Loading images: ${imagesLoaded}/${totalImages}`}
                  >
                    <div className='w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse'></div>
                    <span className='text-blue-700 dark:text-blue-300 font-medium'>
                      {imagesLoaded}/{totalImages}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          className='flex items-center gap-1'
          role='toolbar'
          aria-label='HashLink block actions'
        >
          <button
            onClick={copyHRL}
            onKeyDown={(e) => handleKeyDown(e, copyHRL)}
            className='p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 focus:bg-blue-100 dark:focus:bg-blue-900/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors group'
            title='Copy HRL to clipboard (Enter or Space to activate)'
            aria-label='Copy HashLink reference to clipboard'
            tabIndex={0}
          >
            <FiCopy className='w-3.5 h-3.5 text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 group-focus:text-blue-700 dark:group-focus:text-blue-300' />
          </button>

          <button
            onClick={openInExplorer}
            onKeyDown={(e) => handleKeyDown(e, openInExplorer)}
            className='p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 focus:bg-blue-100 dark:focus:bg-blue-900/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors group'
            title='Open in HashScan (Enter or Space to activate)'
            aria-label='Open HashLink in HashScan explorer'
            tabIndex={0}
          >
            <FiExternalLink className='w-3.5 h-3.5 text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 group-focus:text-blue-700 dark:group-focus:text-blue-300' />
          </button>

          <button
            onClick={refreshBlock}
            onKeyDown={(e) => handleKeyDown(e, refreshBlock)}
            className='p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 focus:bg-blue-100 dark:focus:bg-blue-900/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors group'
            title='Refresh block (Enter or Space to activate)'
            aria-label='Refresh HashLink block content'
            tabIndex={0}
          >
            <FiRefreshCw className='w-3.5 h-3.5 text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 group-focus:text-blue-700 dark:group-focus:text-blue-300' />
          </button>
        </div>
      </div>

{shouldSandbox ? (
        <iframe
          ref={iframeRef}
          className='hashlink-content w-full border-0'
          sandbox='allow-scripts allow-same-origin allow-popups allow-forms allow-downloads'
srcDoc={`<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><base href=\"${baseHref}\" target=\"_blank\" /><style>html,body{margin:0;padding:0;background:transparent;}</style></head><body><div id=\"hlb-root\" class=\"hlb-root\" style=\"display:block; width:100%;\">${renderedContent}</div></body></html>`}
          style={{ width: '100%', height: iframeHeight }}
          title={`hashlink-block-${blockId}`}
        />
      ) : (
        <div
          ref={contentRef}
          className='hashlink-content p-4 bg-gradient-to-b from-transparent via-blue-50/20 to-blue-50/30 dark:via-blue-950/20 dark:to-blue-950/30'
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
      )}
    </div>
  );
};

export default React.memo(HashLinkBlockRenderer, (prevProps, nextProps) => {
  return (
    prevProps.hashLinkBlock.blockId === nextProps.hashLinkBlock.blockId &&
    prevProps.hashLinkBlock.template === nextProps.hashLinkBlock.template &&
    JSON.stringify(prevProps.hashLinkBlock.attributes) ===
      JSON.stringify(nextProps.hashLinkBlock.attributes) &&
    prevProps.className === nextProps.className
  );
});
