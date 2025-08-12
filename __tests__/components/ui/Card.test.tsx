import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../../../src/renderer/components/ui/Card';

describe('Card', () => {
  it('renders with children', () => {
    render(
      <Card>
        <CardContent>Card content</CardContent>
      </Card>
    );
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies default styles', () => {
    render(<Card data-testid='card'>Content</Card>);
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('rounded-2xl', 'border', 'shadow-lg');
  });

  it('supports custom className', () => {
    render(
      <Card className='custom-class' data-testid='card'>
        Content
      </Card>
    );
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('custom-class');
    expect(card).toHaveClass('rounded-2xl');
  });

  it('renders with complete structure', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card description</CardDescription>
        </CardHeader>
        <CardContent>Card content</CardContent>
        <CardFooter>Card footer</CardFooter>
      </Card>
    );

    expect(screen.getByText('Card Title')).toBeInTheDocument();
    expect(screen.getByText('Card description')).toBeInTheDocument();
    expect(screen.getByText('Card content')).toBeInTheDocument();
    expect(screen.getByText('Card footer')).toBeInTheDocument();
  });
});

describe('CardHeader', () => {
  it('renders with children', () => {
    render(
      <CardHeader>
        <CardTitle>Title</CardTitle>
      </CardHeader>
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('applies default styles', () => {
    render(<CardHeader data-testid='header'>Header</CardHeader>);
    const header = screen.getByTestId('header');
    expect(header).toHaveClass('grid', 'items-start', 'gap-1.5', 'px-6');
  });
});

describe('CardTitle', () => {
  it('renders as div element', () => {
    render(<CardTitle>Title</CardTitle>);
    const title = screen.getByText('Title');
    expect(title.tagName).toBe('DIV');
  });

  it('applies default styles', () => {
    render(<CardTitle>Title</CardTitle>);
    const title = screen.getByText('Title');
    expect(title).toHaveClass('leading-none', 'font-semibold');
  });

  it('supports custom className', () => {
    render(<CardTitle className='custom-class'>Title</CardTitle>);
    const title = screen.getByText('Title');
    expect(title).toHaveClass('custom-class');
  });
});

describe('CardDescription', () => {
  it('renders as div element', () => {
    render(<CardDescription>Description</CardDescription>);
    const description = screen.getByText('Description');
    expect(description.tagName).toBe('DIV');
  });

  it('applies default styles', () => {
    render(<CardDescription>Description</CardDescription>);
    const description = screen.getByText('Description');
    expect(description).toHaveClass('text-sm', 'text-muted-foreground');
  });
});

describe('CardContent', () => {
  it('renders with children', () => {
    render(<CardContent>Content</CardContent>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('applies default styles', () => {
    render(<CardContent data-testid='content'>Content</CardContent>);
    const content = screen.getByTestId('content');
    expect(content).toHaveClass('px-6');
  });
});

describe('CardFooter', () => {
  it('renders with children', () => {
    render(<CardFooter>Footer</CardFooter>);
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('applies default styles', () => {
    render(<CardFooter data-testid='footer'>Footer</CardFooter>);
    const footer = screen.getByTestId('footer');
    expect(footer).toHaveClass('flex', 'items-center', 'px-6');
  });

  it('supports custom className', () => {
    render(
      <CardFooter className='justify-end' data-testid='footer'>
        Footer
      </CardFooter>
    );
    const footer = screen.getByTestId('footer');
    expect(footer).toHaveClass('justify-end');
  });
});
