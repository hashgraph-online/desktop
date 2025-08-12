/**
 * Reusable markdown processing utility extracted from MessageBubble
 * for use in legal documents and other content
 */
export const processMarkdown = (text: string): string => {
  let processed = text;

  // Process math equations first (before other markdown)
  // LaTeX display math blocks \[...\]
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
    const cleanMath = math.trim()
      .replace(/\\text\{([^}]+)\}/g, '$1')  // Convert \text{} to plain text
      .replace(/\\,/g, ' ')  // Replace \, with space
      .replace(/\\/g, '');   // Remove remaining backslashes
    return `<div class="math-display my-3 p-3 bg-white/10 dark:bg-gray-800/50 rounded-lg overflow-x-auto border border-white/20"><code class="text-sm font-mono text-gray-900 dark:text-gray-100">${cleanMath}</code></div>`;
  });

  // LaTeX inline math \(...\)
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => {
    const cleanMath = math.trim()
      .replace(/\\text\{([^}]+)\}/g, '$1')
      .replace(/\\,/g, ' ')
      .replace(/\\/g, '');
    return `<code class="inline-math px-1.5 py-0.5 bg-white/10 dark:bg-gray-800/50 rounded font-mono text-sm text-gray-900 dark:text-gray-100">${cleanMath}</code>`;
  });

  // Display math ($$...$$)
  processed = processed.replace(/\$\$([^$]+)\$\$/g, (_, math) => {
    return `<div class="math-display my-3 p-3 bg-white/10 dark:bg-gray-800/50 rounded-lg overflow-x-auto border border-white/20"><code class="text-sm font-mono text-gray-900 dark:text-gray-100">${math.trim()}</code></div>`;
  });

  // Inline math ($...$)
  processed = processed.replace(/\$([^$]+)\$/g, (_, math) => {
    return `<code class="inline-math px-1.5 py-0.5 bg-white/10 dark:bg-gray-800/50 rounded font-mono text-sm text-gray-900 dark:text-gray-100">${math}</code>`;
  });

  // Code blocks
  processed = processed.replace(/`([^`]+)`/g, (_, code) => {
    return `<code class="inline-code px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-sm text-gray-900 dark:text-gray-100">${code}</code>`;
  });

  // Bold text
  processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');
  processed = processed.replace(/__([^_]+)__/g, '<strong class="font-semibold">$1</strong>');

  // Italic text
  processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  processed = processed.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Links
  processed = processed.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold">$1</a>'
  );

  // Headers
  processed = processed.replace(/^#### (.*$)/gm, '<h4 class="text-base font-bold mt-3 mb-2 text-gray-900 dark:text-gray-100">$1</h4>');
  processed = processed.replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">$1</h3>');
  processed = processed.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">$1</h2>');
  processed = processed.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">$1</h1>');

  // Lists
  processed = processed.replace(/^\s*[-*] (.+)$/gm, '<li class="ml-4 text-gray-700 dark:text-gray-300">• $1</li>');
  processed = processed.replace(/(<li.*<\/li>)/s, '<ul class="my-2 space-y-1">$1</ul>');
  
  // Line breaks
  processed = processed.replace(/\n/g, '<br />');

  return processed;
};