import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-black text-white p-8">
          <h2 className="text-2xl font-bold mb-4 text-red-500">Something went wrong</h2>
          <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-lg w-full max-w-2xl overflow-auto">
            <pre className="text-sm font-mono whitespace-pre-wrap">{this.state.error?.toString()}</pre>
            <pre className="text-xs font-mono mt-4 text-gray-400 whitespace-pre-wrap">{this.state.error?.stack}</pre>
          </div>
          <button
            className="mt-6 px-4 py-2 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
