/**
 * Reusable markdown processing utility extracted from MessageBubble
 * for use in legal documents and other content
 */
function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const processMarkdown = (text: string): string => {
  let processed = text || '';

  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
    const cleanMath = math.trim()
      .replace(/\\text\{([^}]+)\}/g, '$1')
      .replace(/\\,/g, ' ')
      .replace(/\\/g, '');
    return `<div class="math-display my-3 p-3 bg-white/10 dark:bg-gray-800/50 rounded-lg overflow-x-auto border border-white/20"><code class="text-sm font-mono text-gray-900 dark:text-gray-100">${cleanMath}</code></div>`;
  });

  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => {
    const cleanMath = math.trim()
      .replace(/\\text\{([^}]+)\}/g, '$1')
      .replace(/\\,/g, ' ')
      .replace(/\\/g, '');
    return `<code class="inline-math px-1.5 py-0.5 bg-white/10 dark:bg-gray-800/50 rounded font-mono text-sm text-gray-900 dark:text-gray-100">${cleanMath}</code>`;
  });

  processed = processed.replace(/\$\$([^$]+)\$\$/g, (_, math) => {
    return `<div class="math-display my-3 p-3 bg-white/10 dark:bg-gray-800/50 rounded-lg overflow-x-auto border border-white/20"><code class="text-sm font-mono text-gray-900 dark:text-gray-100">${math.trim()}</code></div>`;
  });

  processed = processed.replace(/\$([^$]+)\$/g, (_, math) => {
    return `<code class="inline-math px-1.5 py-0.5 bg-white/10 dark:bg-gray-800/50 rounded font-mono text-sm text-gray-900 dark:text-gray-100">${math}</code>`;
  });

  processed = processed.replace(/`([^`]+)`/g, (_, code) => {
    return `<code class="inline-code px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-[0.85em] text-brand-ink dark:text-white">${escapeHtml(
      code
    )}</code>`;
  });

  processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');
  processed = processed.replace(/__([^_]+)__/g, '<strong class="font-semibold">$1</strong>');

  processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  processed = processed.replace(/_([^_]+)_/g, '<em>$1</em>');

  processed = processed.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_m, alt, url) =>
      `<img src="${url}" alt="${escapeHtml(alt)}" class="rounded-md my-2 max-w-full h-auto shadow-sm" loading="lazy" decoding="async" style="content-visibility:auto; contain-intrinsic-size: 800px 400px;" />`
  );

  processed = processed.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline font-semibold hover:opacity-80">$1</a>'
  );

  processed = processed.replace(/^#### (.*$)/gm, '<h4 class="text-base font-bold mt-3 mb-2 text-gray-900 dark:text-gray-100">$1</h4>');
  processed = processed.replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">$1</h3>');
  processed = processed.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">$1</h2>');
  processed = processed.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">$1</h1>');

  processed = processed.replace(
    /(^|\n)((?:\s*[-*]\s+.+\n?)+)/gm,
    (_m: string, lead: string, block: string) => {
      const items = block
        .trimEnd()
        .split(/\n/)
        .filter(Boolean)
        .map((line: string) => line.replace(/^\s*[-*]\s+/, ''))
        .map((inner: string) => `<li class=\"ml-4\">${inner}</li>`)
        .join('');
      return `${lead}<ul class=\"my-2 space-y-1 list-disc\">${items}</ul>`;
    }
  );

  processed = processed.replace(
    /(^|\n)((?:\s*\d+\.\s+.+\n?)+)/gm,
    (_m: string, lead: string, block: string) => {
      const items = block
        .trimEnd()
        .split(/\n/)
        .filter(Boolean)
        .map((line: string) => line.replace(/^\s*\d+\.\s+/, ''))
        .map((inner: string) => `<li class=\"ml-4\">${inner}</li>`)
        .join('');
      return `${lead}<ol class=\"my-2 space-y-1 list-decimal\">${items}</ol>`;
    }
  );

  processed = processed.replace(/\n{2,}/g, '<br /><br />');

  processed = processed
    .replace(/<\/li><br \/?><br \/?>/g, '</li>')
    .replace(/<\/ul><br \/?><br \/?>/g, '</ul>')
    .replace(/<\/ol><br \/?><br \/?>/g, '</ol>');

  return processed;
};
