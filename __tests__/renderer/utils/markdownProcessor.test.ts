import { processMarkdown } from '../../../src/renderer/utils/markdownProcessor';

describe('processMarkdown', () => {
  describe('Math Expressions', () => {
    test('should process display math expressions with escaped brackets', () => {
      const input = 'Here is a formula: \\[E = mc^2\\]';
      const expected = 'Here is a formula: <div class="math-display my-3 p-3 bg-white/10 dark:bg-gray-800/50 rounded-lg overflow-x-auto border border-white/20"><code class="text-sm font-mono text-gray-900 dark:text-gray-100">E = mc^2</code></div>';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should process inline math expressions with escaped parentheses', () => {
      const input = 'The equation \\(a^2 + b^2 = c^2\\) is Pythagorean';
      const expected = 'The equation <code class="inline-math px-1.5 py-0.5 bg-white/10 dark:bg-gray-800/50 rounded font-mono text-sm text-gray-900 dark:text-gray-100">a^2 + b^2 = c^2</code> is Pythagorean';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should process double dollar display math', () => {
      const input = 'Formula: $$\\int_0^\\infty e^{-x^2} dx$$';
      const expected = 'Formula: <div class="math-display my-3 p-3 bg-white/10 dark:bg-gray-800/50 rounded-lg overflow-x-auto border border-white/20"><code class="text-sm font-mono text-gray-900 dark:text-gray-100">\\int_0^\\infty e^{-x^2} dx</code></div>';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should process single dollar inline math', () => {
      const input = 'Use $x = 5$ in the equation';
      const expected = 'Use <code class="inline-math px-1.5 py-0.5 bg-white/10 dark:bg-gray-800/50 rounded font-mono text-sm text-gray-900 dark:text-gray-100">x = 5</code> in the equation';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should handle complex math expressions with text commands', () => {
      const input = '\\[\\text{Force} = m \\cdot a\\]';
      const expected = '<div class="math-display my-3 p-3 bg-white/10 dark:bg-gray-800/50 rounded-lg overflow-x-auto border border-white/20"><code class="text-sm font-mono text-gray-900 dark:text-gray-100">Force = m cdot a</code></div>';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should handle math with backslashes and commas', () => {
      const input = '\\(f(x) = \\frac{1}{x}\\)';
      const expected = '<code class="inline-math px-1.5 py-0.5 bg-white/10 dark:bg-gray-800/50 rounded font-mono text-sm text-gray-900 dark:text-gray-100">f(x) = frac{1}{x}</code>';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });
  });

  describe('Code Blocks', () => {
    test('should process inline code', () => {
      const input = 'Use the `console.log()` function';
      const expected = 'Use the <code class="inline-code px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-[0.85em]">console.log()</code> function';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should handle code with special characters', () => {
      const input = 'Type `npm install <package>` in terminal';
      const expected = 'Type <code class="inline-code px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-[0.85em]">npm install &lt;package&gt;</code> in terminal';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should handle multiple inline code blocks', () => {
      const input = 'Use `function()` and `variable` together';
      const expected = 'Use <code class="inline-code px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-[0.85em]">function()</code> and <code class="inline-code px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-[0.85em]">variable</code> together';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });
  });

  describe('Text Formatting', () => {
    test('should process bold text with double asterisks', () => {
      const input = 'This is **bold** text';
      const expected = 'This is <strong class="font-semibold">bold</strong> text';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should process bold text with double underscores', () => {
      const input = 'This is __bold__ text';
      const expected = 'This is <strong class="font-semibold">bold</strong> text';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should process italic text with single asterisk', () => {
      const input = 'This is *italic* text';
      const expected = 'This is <em>italic</em> text';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should process italic text with single underscore', () => {
      const input = 'This is _italic_ text';
      const expected = 'This is <em>italic</em> text';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should handle nested formatting', () => {
      const input = 'This is ***bold italic*** text';
      const expected = 'This is <em><strong class="font-semibold">bold italic</strong></em> text';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });
  });

  describe('Links', () => {
    test('should process links', () => {
      const input = 'Visit [Google](https://google.com) for search';
      const expected = 'Visit <a href="https://google.com" target="_blank" rel="noopener noreferrer" class="underline font-semibold hover:opacity-80">Google</a> for search';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should handle links with underscores in URL', () => {
      const input = 'Check [documentation](https://example.com/docs_page)';
      const expected = 'Check <a href="https://example.com/docs_page" target="_blank" rel="noopener noreferrer" class="underline font-semibold hover:opacity-80">documentation</a>';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should handle multiple links', () => {
      const input = '[Link1](url1) and [Link2](url2)';
      const expected = '<a href="url1" target="_blank" rel="noopener noreferrer" class="underline font-semibold hover:opacity-80">Link1</a> and <a href="url2" target="_blank" rel="noopener noreferrer" class="underline font-semibold hover:opacity-80">Link2</a>';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });
  });

  describe('Headings', () => {
    test('should process H1 headings', () => {
      const input = '# Main Title';
      const expected = '<h1 class="text-2xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">Main Title</h1>';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should process H2 headings', () => {
      const input = '## Section Title';
      const expected = '<h2 class="text-xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">Section Title</h2>';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should process H3 headings', () => {
      const input = '### Subsection Title';
      const expected = '<h3 class="text-lg font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">Subsection Title</h3>';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should process H4 headings', () => {
      const input = '#### Detail Title';
      const expected = '<h4 class="text-base font-bold mt-3 mb-2 text-gray-900 dark:text-gray-100">Detail Title</h4>';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should process multiple headings', () => {
      const input = '# Title\n## Subtitle\n### Section';
      const expected = '<h1 class="text-2xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">Title</h1>\n<h2 class="text-xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">Subtitle</h2>\n<h3 class="text-lg font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">Section</h3>';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });
  });

  describe('Lists', () => {
    test('should process unordered list with dashes', () => {
      const input = '- Item 1\n- Item 2\n- Item 3';
      const expected = '<ul class="my-2 space-y-1 list-disc"><li class="ml-4">Item 1</li><li class="ml-4">Item 2</li><li class="ml-4">Item 3</li></ul>';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should process unordered list with asterisks', () => {
      const input = '* Item 1\n* Item 2';
      const expected = '<em> Item 1\n</em> Item 2';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should handle single list item', () => {
      const input = '- Single item';
      const expected = '<ul class="my-2 space-y-1 list-disc"><li class="ml-4">Single item</li></ul>';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });
  });

  describe('Line Breaks', () => {
    test('should convert newlines to br tags', () => {
      const input = 'Line 1\nLine 2\nLine 3';
      const expected = 'Line 1\nLine 2\nLine 3';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should handle mixed content with line breaks', () => {
      const input = '# Title\n\nSome text\n\n- Item 1\n- Item 2';
      const expected = '<h1 class="text-2xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">Title</h1><br /><br />Some text\n<ul class="my-2 space-y-1 list-disc"><li class="ml-4">Item 1</li><li class="ml-4">Item 2</li></ul>';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });
  });

  describe('Complex Content', () => {
    test('should process complex markdown document', () => {
      const input = `# Document Title

This is a **bold** and *italic* text with \`code\` and [link](url).

## Math Section

Here is inline math $E = mc^2$ and display math:

$$\\int_0^1 x^2 dx$$

## List of Items

- First item
- Second item with **bold** text
- Third item

## Code Examples

Use \`npm install\` to install packages.`;

      const result = processMarkdown(input);
      expect(result).toContain('<h1 class="text-2xl font-bold');
      expect(result).toContain('<strong class="font-semibold">bold</strong>');
      expect(result).toContain('<em>italic</em>');
      expect(result).toContain('<code class="inline-code');
      expect(result).toContain('<a href="url"');
      expect(result).toContain('<code class="inline-math');
      expect(result).toContain('<code class="text-sm font-mono');
      expect(result).toContain('<ul class="my-2 space-y-1 list-disc">');
      expect(result).toContain('First item');
      expect(result).toContain('Second item');
    });

    test('should handle edge cases', () => {
      expect(processMarkdown('')).toBe('');

      expect(processMarkdown('   \n  \n  ')).toBe('   \n  \n  ');

      expect(processMarkdown('Plain text without markdown')).toBe('Plain text without markdown');
    });

    test('should handle nested elements correctly', () => {
      const input = '**Bold with `code`** and *italic with [link](url)*';
      const expected = '<strong class="font-semibold">Bold with <code class="inline-code px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-[0.85em]">code</code></strong> and <em>italic with <a href="url" target="_blank" rel="noopener noreferrer" class="underline font-semibold hover:opacity-80">link</a></em>';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });
  });

  describe('Order of Processing', () => {
    test('should process elements in correct order', () => {
      const input = '$`code`$';
      const result = processMarkdown(input);

      expect(result).toContain('<code class="inline-math');
      expect(result).toContain('<code class="inline-code');
    });

    test('should handle overlapping patterns correctly', () => {
      const input = '**Bold** and *italic*';
      const result = processMarkdown(input);

      expect(result).toContain('<strong class="font-semibold">Bold</strong>');
      expect(result).toContain('<em>italic</em>');
    });
  });

  describe('HTML Escaping', () => {
    test('should handle HTML-like content in code blocks', () => {
      const input = 'Use `<div>` in HTML';
      const expected = 'Use <code class="inline-code px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-[0.85em]">&lt;div&gt;</code> in HTML';

      const result = processMarkdown(input);
      expect(result).toBe(expected);
    });

    test('should preserve special characters in regular text', () => {
      const input = 'Price: $5 < $10 > $1';
      const result = processMarkdown(input);

      expect(result).toBe('Price: <code class="inline-math px-1.5 py-0.5 bg-white/10 dark:bg-gray-800/50 rounded font-mono text-sm text-gray-900 dark:text-gray-100">5 < </code>10 > $1');
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle large content efficiently', () => {
      const largeContent = 'Line\n\n'.repeat(500) + '**bold**';
      const result = processMarkdown(largeContent);

      expect(result).toContain('<strong class="font-semibold">bold</strong>');
      expect(result.split('<br />').length).toBe(1001); // 500 double newlines create 500 <br /><br /> tags, splitting gives 1001 parts
    });

    test('should handle empty or malformed patterns', () => {
      const inputs = [
        '$$',           // Empty math
        '``',           // Empty code
        '**',           // Empty bold
        '*',            // Single asterisk
        '[](url)',      // Empty link text
        '[text]()',     // Empty link URL
        '#',            // Empty heading
        '-',            // Empty list item
      ];

      inputs.forEach(input => {
        expect(() => processMarkdown(input)).not.toThrow();
      });
    });

    test('should be idempotent', () => {
      const input = '**bold** and `code`';
      const firstPass = processMarkdown(input);
      const secondPass = processMarkdown(firstPass);

      expect(secondPass).toBe(firstPass);
    });
  });
});
