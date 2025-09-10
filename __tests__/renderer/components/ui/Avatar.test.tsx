jest.mock('../../../src/renderer/lib/utils', () => ({
  cn: (...classes: string[]) => classes.join(' '),
}));

jest.mock('@radix-ui/react-avatar', () => ({
  Root: ({ children, className, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'avatar-root', className, ...props },
      children
    ),
  Image: ({ className, ...props }: any) =>
    React.createElement('img', {
      'data-testid': 'avatar-image',
      className,
      ...props,
    }),
  Fallback: ({ children, className, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'avatar-fallback', className, ...props },
      children
    ),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from '../../../src/renderer/components/ui/avatar';

describe('Avatar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Avatar Root', () => {
    test('renders with default props', () => {
      render(<Avatar />);

      const avatar = screen.getByTestId('avatar-root');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('data-slot', 'avatar');
      expect(avatar).toHaveClass('relative');
      expect(avatar).toHaveClass('flex');
      expect(avatar).toHaveClass('size-8');
      expect(avatar).toHaveClass('shrink-0');
      expect(avatar).toHaveClass('overflow-hidden');
      expect(avatar).toHaveClass('rounded-full');
    });

    test('applies custom className', () => {
      render(<Avatar className='custom-class' />);

      const avatar = screen.getByTestId('avatar-root');
      expect(avatar).toHaveClass('custom-class');
    });

    test('forwards additional props', () => {
      render(<Avatar data-testid='custom-avatar' />);

      expect(screen.getByTestId('custom-avatar')).toBeInTheDocument();
    });

    test('has correct accessibility attributes', () => {
      render(<Avatar role='img' aria-label='User avatar' />);

      const avatar = screen.getByTestId('avatar-root');
      expect(avatar).toHaveAttribute('role', 'img');
      expect(avatar).toHaveAttribute('aria-label', 'User avatar');
    });
  });

  describe('AvatarImage', () => {
    test('renders with src and alt', () => {
      render(
        <Avatar>
          <AvatarImage src='https://example.com/avatar.jpg' alt='User Avatar' />
        </Avatar>
      );

      const image = screen.getByTestId('avatar-image');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', 'https://example.com/avatar.jpg');
      expect(image).toHaveAttribute('alt', 'User Avatar');
      expect(image).toHaveClass('aspect-square');
      expect(image).toHaveClass('size-full');
    });

    test('applies custom className', () => {
      render(
        <Avatar>
          <AvatarImage className='custom-image' src='test.jpg' />
        </Avatar>
      );

      const image = screen.getByTestId('avatar-image');
      expect(image).toHaveClass('custom-image');
    });

    test('forwards additional props', () => {
      render(
        <Avatar>
          <AvatarImage src='test.jpg' loading='lazy' />
        </Avatar>
      );

      const image = screen.getByTestId('avatar-image');
      expect(image).toHaveAttribute('loading', 'lazy');
    });

    test('handles missing src gracefully', () => {
      render(
        <Avatar>
          <AvatarImage alt='Fallback' />
        </Avatar>
      );

      const image = screen.getByTestId('avatar-image');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('alt', 'Fallback');
    });
  });

  describe('AvatarFallback', () => {
    test('renders with children', () => {
      render(
        <Avatar>
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
      );

      const fallback = screen.getByTestId('avatar-fallback');
      expect(fallback).toBeInTheDocument();
      expect(fallback).toHaveTextContent('JD');
      expect(fallback).toHaveClass('bg-muted');
      expect(fallback).toHaveClass('flex');
      expect(fallback).toHaveClass('size-full');
      expect(fallback).toHaveClass('items-center');
      expect(fallback).toHaveClass('justify-center');
      expect(fallback).toHaveClass('rounded-full');
    });

    test('applies custom className', () => {
      render(
        <Avatar>
          <AvatarFallback className='custom-fallback'>AB</AvatarFallback>
        </Avatar>
      );

      const fallback = screen.getByTestId('avatar-fallback');
      expect(fallback).toHaveClass('custom-fallback');
    });

    test('handles complex children', () => {
      render(
        <Avatar>
          <AvatarFallback>
            <span>User</span>
            <span>Name</span>
          </AvatarFallback>
        </Avatar>
      );

      const fallback = screen.getByTestId('avatar-fallback');
      expect(fallback).toHaveTextContent('User');
      expect(fallback).toHaveTextContent('Name');
    });

    test('renders with emoji', () => {
      render(
        <Avatar>
          <AvatarFallback>👤</AvatarFallback>
        </Avatar>
      );

      const fallback = screen.getByTestId('avatar-fallback');
      expect(fallback).toHaveTextContent('👤');
    });

    test('forwards additional props', () => {
      render(
        <Avatar>
          <AvatarFallback data-testid='custom-fallback'>Test</AvatarFallback>
        </Avatar>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    });
  });

  describe('Complete Avatar Usage', () => {
    test('renders with image and fallback', () => {
      render(
        <Avatar>
          <AvatarImage src='user.jpg' alt='User' />
          <AvatarFallback>UN</AvatarFallback>
        </Avatar>
      );

      expect(screen.getByTestId('avatar-root')).toBeInTheDocument();
      expect(screen.getByTestId('avatar-image')).toBeInTheDocument();
      expect(screen.getByTestId('avatar-fallback')).toBeInTheDocument();
    });

    test('renders fallback when image fails', () => {
      render(
        <Avatar>
          <AvatarImage src='broken.jpg' alt='Broken' />
          <AvatarFallback>BF</AvatarFallback>
        </Avatar>
      );

      expect(screen.getByTestId('avatar-image')).toBeInTheDocument();
      expect(screen.getByTestId('avatar-fallback')).toBeInTheDocument();
      expect(screen.getByText('BF')).toBeInTheDocument();
    });

    test('renders only fallback when no image', () => {
      render(
        <Avatar>
          <AvatarFallback>OF</AvatarFallback>
        </Avatar>
      );

      expect(screen.queryByTestId('avatar-image')).not.toBeInTheDocument();
      expect(screen.getByTestId('avatar-fallback')).toBeInTheDocument();
      expect(screen.getByText('OF')).toBeInTheDocument();
    });

    test('renders only image when no fallback', () => {
      render(
        <Avatar>
          <AvatarImage src='solo.jpg' alt='Solo' />
        </Avatar>
      );

      expect(screen.getByTestId('avatar-image')).toBeInTheDocument();
      expect(screen.queryByTestId('avatar-fallback')).not.toBeInTheDocument();
    });
  });

  describe('Data Attributes', () => {
    test('Avatar has correct data-slot', () => {
      render(<Avatar />);

      const avatar = screen.getByTestId('avatar-root');
      expect(avatar).toHaveAttribute('data-slot', 'avatar');
    });

    test('AvatarImage has correct data-slot', () => {
      render(
        <Avatar>
          <AvatarImage src='test.jpg' />
        </Avatar>
      );

      const image = screen.getByTestId('avatar-image');
      expect(image).toHaveAttribute('data-slot', 'avatar-image');
    });

    test('AvatarFallback has correct data-slot', () => {
      render(
        <Avatar>
          <AvatarFallback>Test</AvatarFallback>
        </Avatar>
      );

      const fallback = screen.getByTestId('avatar-fallback');
      expect(fallback).toHaveAttribute('data-slot', 'avatar-fallback');
    });
  });

  describe('Styling and Classes', () => {
    test('Avatar applies base classes correctly', () => {
      render(<Avatar />);

      const avatar = screen.getByTestId('avatar-root');
      expect(avatar).toHaveClass(
        'relative',
        'flex',
        'size-8',
        'shrink-0',
        'overflow-hidden',
        'rounded-full'
      );
    });

    test('AvatarImage applies base classes correctly', () => {
      render(
        <Avatar>
          <AvatarImage src='test.jpg' />
        </Avatar>
      );

      const image = screen.getByTestId('avatar-image');
      expect(image).toHaveClass('aspect-square', 'size-full');
    });

    test('AvatarFallback applies base classes correctly', () => {
      render(
        <Avatar>
          <AvatarFallback>Test</AvatarFallback>
        </Avatar>
      );

      const fallback = screen.getByTestId('avatar-fallback');
      expect(fallback).toHaveClass(
        'bg-muted',
        'flex',
        'size-full',
        'items-center',
        'justify-center',
        'rounded-full'
      );
    });

    test('custom classes are merged correctly', () => {
      render(
        <Avatar className='w-12 h-12'>
          <AvatarImage className='object-cover' src='test.jpg' />
          <AvatarFallback className='text-lg'>T</AvatarFallback>
        </Avatar>
      );

      const avatar = screen.getByTestId('avatar-root');
      const image = screen.getByTestId('avatar-image');
      const fallback = screen.getByTestId('avatar-fallback');

      expect(avatar).toHaveClass('w-12', 'h-12');
      expect(image).toHaveClass('object-cover');
      expect(fallback).toHaveClass('text-lg');
    });
  });

  describe('Edge Cases', () => {
    test('handles empty children', () => {
      render(<Avatar></Avatar>);

      const avatar = screen.getByTestId('avatar-root');
      expect(avatar).toBeInTheDocument();
      expect(avatar.children).toHaveLength(0);
    });

    test('handles multiple images (should not happen but test robustness)', () => {
      render(
        <Avatar>
          <AvatarImage src='img1.jpg' />
          <AvatarImage src='img2.jpg' />
        </Avatar>
      );

      const images = screen.getAllByTestId('avatar-image');
      expect(images).toHaveLength(2);
    });

    test('handles multiple fallbacks (should not happen but test robustness)', () => {
      render(
        <Avatar>
          <AvatarFallback>F1</AvatarFallback>
          <AvatarFallback>F2</AvatarFallback>
        </Avatar>
      );

      const fallbacks = screen.getAllByTestId('avatar-fallback');
      expect(fallbacks).toHaveLength(2);
      expect(screen.getByText('F1')).toBeInTheDocument();
      expect(screen.getByText('F2')).toBeInTheDocument();
    });

    test('handles undefined props gracefully', () => {
      render(
        <Avatar className={undefined}>
          <AvatarImage src={undefined} alt={undefined} />
          <AvatarFallback className={undefined}>Test</AvatarFallback>
        </Avatar>
      );

      expect(screen.getByTestId('avatar-root')).toBeInTheDocument();
      expect(screen.getByTestId('avatar-image')).toBeInTheDocument();
      expect(screen.getByTestId('avatar-fallback')).toBeInTheDocument();
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });

  describe('Integration with User Data', () => {
    test('can be used with user profile data', () => {
      const userData = {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg',
        initials: 'JD',
      };

      render(
        <Avatar>
          <AvatarImage src={userData.avatar} alt={userData.name} />
          <AvatarFallback>{userData.initials}</AvatarFallback>
        </Avatar>
      );

      const image = screen.getByTestId('avatar-image');
      const fallback = screen.getByTestId('avatar-fallback');

      expect(image).toHaveAttribute('src', userData.avatar);
      expect(image).toHaveAttribute('alt', userData.name);
      expect(fallback).toHaveTextContent(userData.initials);
    });

    test('handles user data with missing avatar', () => {
      const userData = {
        name: 'Jane Smith',
        initials: 'JS',
      };

      render(
        <Avatar>
          <AvatarFallback>{userData.initials}</AvatarFallback>
        </Avatar>
      );

      expect(screen.queryByTestId('avatar-image')).not.toBeInTheDocument();
      expect(screen.getByTestId('avatar-fallback')).toBeInTheDocument();
      expect(screen.getByText(userData.initials)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('supports screen reader with proper labeling', () => {
      render(
        <Avatar aria-label='User profile picture'>
          <AvatarImage src='user.jpg' alt='Profile picture' />
          <AvatarFallback>UP</AvatarFallback>
        </Avatar>
      );

      const avatar = screen.getByTestId('avatar-root');
      expect(avatar).toHaveAttribute('aria-label', 'User profile picture');

      const image = screen.getByTestId('avatar-image');
      expect(image).toHaveAttribute('alt', 'Profile picture');
    });

    test('supports role attributes', () => {
      render(
        <Avatar role='button' tabIndex={0}>
          <AvatarFallback>Click me</AvatarFallback>
        </Avatar>
      );

      const avatar = screen.getByTestId('avatar-root');
      expect(avatar).toHaveAttribute('role', 'button');
      expect(avatar).toHaveAttribute('tabIndex', '0');
    });
  });
});


