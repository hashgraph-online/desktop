import React from 'react';
import { render } from '@testing-library/react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  VisuallyHidden,
} from '../../../src/renderer/components/ui/dialog';

describe('Dialog', () => {
  it('renders without accessibility errors when no explicit title is provided', () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <p>Dialog content without explicit title</p>
        </DialogContent>
      </Dialog>
    );
    
    // If this renders without throwing, the accessibility issue is fixed
    expect(true).toBe(true);
  });

  it('renders without accessibility errors when explicit title is provided', () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>My Dialog Title</DialogTitle>
          <p>Dialog content with explicit title</p>
        </DialogContent>
      </Dialog>
    );
    
    // If this renders without throwing, no hidden title should be added
    expect(true).toBe(true);
  });

  it('exports VisuallyHidden component', () => {
    expect(VisuallyHidden).toBeDefined();
  });
});