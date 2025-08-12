import React, { Component, ReactNode } from 'react';
import Typography from './ui/Typography';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary component to catch and handle React errors gracefully.
 * Prevents the entire app from crashing when a component throws an error.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className='flex flex-col items-center justify-center min-h-screen p-8'>
          <div className='max-w-md text-center space-y-4'>
            <Typography variant='h1' gradient>
              Oops! Something went wrong
            </Typography>
            <Typography variant='body1' color='muted'>
              We encountered an unexpected error. Please try refreshing the
              page.
            </Typography>
            {this.state.error && (
              <div className='mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-left'>
                <Typography
                  variant='caption'
                  color='muted'
                  className='font-mono break-all'
                >
                  {this.state.error.message}
                </Typography>
              </div>
            )}
            <Button
              onClick={() => window.location.reload()}
              variant='gradient'
              className='mt-6'
            >
              Refresh Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
