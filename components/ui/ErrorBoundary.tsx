'use client'

import { Component, ReactNode, ErrorInfo } from 'react'

interface Props {
  children:   ReactNode
  fallback?:  ReactNode
  onError?:   (error: Error, info: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error:    Error | null
}

/**
 * React error boundary — catches runtime crashes and shows a clean
 * recovery screen instead of a blank page.
 * Wrap individual page sections so one crash doesn't kill the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ZK Shield] Unhandled error:', error, info)
    this.props.onError?.(error, info)
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] px-4 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-shield-dark mb-2">Something went wrong</h2>
          <p className="text-sm text-shield-mid max-w-sm mb-6 leading-relaxed">
            An unexpected error occurred. Your notes and funds are safe — this is a UI error only.
          </p>
          {this.state.error && (
            <pre className="text-xs bg-shield-light rounded-xl p-4 text-left max-w-sm w-full overflow-auto mb-6 text-shield-mid">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3">
            <button onClick={this.reset} className="btn-primary text-sm">
              Try again
            </button>
            <button onClick={() => window.location.reload()} className="btn-ghost text-sm">
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
