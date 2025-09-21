import { processMarkdown } from '../../../src/renderer/utils/markdownProcessor';

describe('processMarkdown inline code styling', () => {
  it('adds brand text classes for inline code in light and dark modes', () => {
    const html = processMarkdown('`page-context.json`');
    expect(html).toContain('inline-code');
    expect(html).toContain('text-brand-ink');
    expect(html).toContain('dark:text-white');
  });
});
