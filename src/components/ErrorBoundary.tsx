export default function ErrorBoundary({ error, reset }: { error?: Error; reset?: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="max-w-md mx-auto p-6 bg-gray-800 rounded-lg shadow-lg">
        <div className="flex items-center mb-4">
          <div className="text-red-500 text-2xl mr-3">⚠️</div>
          <h1 className="text-xl font-semibold">Something went wrong</h1>
        </div>
        <p className="text-gray-300 mb-4">An error occurred while loading the dashboard.</p>
        {error && (
          <details className="mb-4">
            <summary className="cursor-pointer text-gray-400 hover:text-gray-200 text-sm">
              Error details
            </summary>
            <pre className="mt-2 p-2 bg-gray-700 rounded text-xs overflow-auto text-red-400">
              {error.stack}
            </pre>
          </details>
        )}
        {reset && (
          <button
            onClick={reset}
            className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

export function NotFoundError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="max-w-md mx-auto p-6 bg-gray-800 rounded-lg shadow-lg text-center">
        <div className="text-gray-400 text-6xl mb-4">404</div>
        <h1 className="text-xl font-semibold mb-2">Page Not Found</h1>
        <p className="text-gray-300">The requested page could not be found.</p>
      </div>
    </div>
  );
}
