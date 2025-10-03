(() => {
  const safeString = (value) => {
    if (typeof value !== 'string') {
      return '';
    }
    return value.slice(0, 8000);
  };

  const selection = (() => {
    try {
      if (window.getSelection) {
        return safeString(window.getSelection().toString());
      }
    } catch (_) {}
    return '';
  })();

  const description = (() => {
    try {
      const meta = document.querySelector('meta[name="description"]');
      if (meta && typeof meta.content === 'string') {
        return safeString(meta.content);
      }
    } catch (_) {}
    return '';
  })();

  const title = (() => {
    try {
      return safeString(document.title || '');
    } catch (_) {}
    return '';
  })();

  const favicons = (() => {
    try {
      return Array.from(
        document.querySelectorAll(
          'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"], link[rel="mask-icon"]'
        )
      )
        .map((link) => link.href || link.getAttribute('href') || '')
        .filter(Boolean)
        .slice(0, 6);
    } catch (_) {
      return [];
    }
  })();

  return {
    title,
    description,
    selection,
    favicons,
  };
})();
