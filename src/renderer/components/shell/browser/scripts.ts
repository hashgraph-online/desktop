export const PAGE_CONTEXT_SCRIPT = String.raw`
(() => {
  const obtainSelection = () => {
    try {
      const raw = window.getSelection ? window.getSelection().toString() : '';
      return raw || '';
    } catch (error) {
      return '';
    }
  };

  const meta = document.querySelector('meta[name="description"]');
  const description = meta && typeof meta.content === 'string' ? meta.content : '';

  let computedTitle = '';
  try {
    computedTitle = document.title || '';
  } catch (error) {
    computedTitle = '';
  }

  const iconLinks = Array.from(
    document.querySelectorAll(
      'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"], link[rel="mask-icon"]'
    )
  )
    .map((link) => link.href || link.getAttribute('href') || '')
    .filter(Boolean);

  return {
    title: computedTitle,
    description,
    selection: obtainSelection(),
    favicons: iconLinks,
  };
})();
`;

export const FAVICON_SCRIPT = String.raw`
(() =>
  Array.from(
    document.querySelectorAll(
      'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"], link[rel="mask-icon"]'
    )
  )
    .map((link) => link.href || link.getAttribute('href') || '')
    .filter(Boolean)
)();
`;

export interface PageContext {
  title?: string | null;
  description: string | null;
  selection: string | null;
  favicons?: string[] | null;
}
