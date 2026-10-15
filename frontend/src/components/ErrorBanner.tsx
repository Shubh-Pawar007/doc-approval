import type { ApiError } from '../api/client';

interface Props {
  error: ApiError;
  onRetry?: () => void;
}

export function ErrorBanner({ error, onRetry }: Props) {
  return (
    <div className="banner banner--error" role="alert">
      <p>{error.message}</p>
      {error.requestId && <p className="banner__meta">Reference: {error.requestId}</p>}
      {onRetry && (
        <button type="button" className="btn btn--quiet" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
