/* Generic error boundary. React Native has none built in, so without this any
   render throw (most likely in the math-heavy visualizations) white-screens the
   whole app. `fallback` may be a node or a (error, reset) => node render fn. */
import React from 'react';

export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (this.props.onError) this.props.onError(error, info);
    // eslint-disable-next-line no-console
    else console.error('ErrorBoundary caught:', error, info && info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') return fallback(this.state.error, this.reset);
      return fallback != null ? fallback : null;
    }
    return this.props.children;
  }
}
