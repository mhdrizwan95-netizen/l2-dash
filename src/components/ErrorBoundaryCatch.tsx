import React from 'react';
import ErrorBoundary from './ErrorBoundary';

interface ErrorBoundaryCatchProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; reset?: () => void }>;
}

interface ErrorBoundaryCatchState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundaryCatch extends React.Component<
  ErrorBoundaryCatchProps,
  ErrorBoundaryCatchState
> {
  constructor(props: ErrorBoundaryCatchProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryCatchState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || ErrorBoundary;
      return (
        <FallbackComponent
          error={this.state.error || undefined}
          reset={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}
