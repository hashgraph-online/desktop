import React, { Component, ReactNode } from 'react';
import { HiExclamationTriangle } from 'react-icons/hi2';
import { Card, CardContent } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import Typography from '../../../ui/Typography';
import { useBlockTesterStore } from '../../../../stores/blockTesterStore';
import { Logger } from '@hashgraphonline/standards-sdk';

const logger = new Logger({ module: 'ErrorBoundary' });

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class BlockTesterErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Block Tester Error Boundary caught an error', { error: error.message, errorInfo });
    
    if (typeof window !== 'undefined' && (window as any).desktopAPI?.logError) {
      (window as any).desktopAPI.logError('BlockTester', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
    }

    try {
      useBlockTesterStore.getState().addError({
        type: 'runtime',
        source: 'preview',
        message: `Component error: ${error.message}`
      });
    } catch (storeError) {
      logger.error('Failed to add error to store', { error: storeError.message });
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return <DefaultErrorFallback error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({ error, resetError }) => (
  <Card className="m-4">
    <CardContent className="p-8 text-center">
      <div className="mb-4">
        <HiExclamationTriangle className="w-12 h-12 mx-auto text-red-500" />
      </div>
      <Typography variant="h3" className="text-xl font-bold mb-2" noMargin>
        Something went wrong
      </Typography>
      <Typography variant="body1" className="text-muted-foreground mb-4" noMargin>
        The Block Tester encountered an error: {error.message}
      </Typography>
      <div className="flex gap-2 justify-center">
        <Button onClick={resetError} variant="outline">
          Try Again
        </Button>
        <Button onClick={() => window.location.reload()} variant="outline">
          Reload Page
        </Button>
      </div>
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4 text-left">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Error Details (Development)
          </summary>
          <pre className="mt-2 p-4 bg-muted rounded text-xs overflow-auto">
            {error.stack}
          </pre>
        </details>
      )}
    </CardContent>
  </Card>
);

export default BlockTesterErrorBoundary;
