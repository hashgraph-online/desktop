import React from 'react';
import { render, screen } from '@testing-library/react';
import { MoonscapeComposer } from '../../../../src/renderer/components/shell/BrowserAssistantPanel';

describe('MoonscapeComposer', () => {
  const baseProps = {
    connected: true,
    submitting: false,
    fileError: null,
    files: [] as File[],
    onChange: () => undefined,
    onSubmit: () => undefined,
    onFileAdd: () => undefined,
    onFileRemove: () => undefined,
  };

  it('aligns send button with composer input height', () => {
    render(
      <MoonscapeComposer
        {...baseProps}
        value=''
      />
    );

    const textarea = screen.getByPlaceholderText(/ask me about this page/i);
    const layout = textarea.closest('div')?.parentElement;
    expect(layout?.className).toContain('items-stretch');

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton.className).toContain('min-h-[44px]');
    expect(sendButton.className).toContain('self-stretch');
  });
});
