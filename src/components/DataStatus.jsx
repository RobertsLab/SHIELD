/**
 * Loading and error placeholders for asynchronously fetched data bundles.
 * Renders nothing when `status` is `ready`.
 */
export default function DataStatus({ status, error, retry, label = 'data', className = '' }) {
  if (status === 'ready') return null;

  if (status === 'error') {
    return (
      <div className={`data-status data-status-error ${className}`.trim()} role="alert">
        <p>
          Could not load {label}.{' '}
          {error?.message ? <span className="data-status-detail">{error.message}</span> : null}
        </p>
        {retry ? (
          <button type="button" className="secondary-action" onClick={retry}>
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`data-status ${className}`.trim()} role="status" aria-live="polite">
      <p>Loading {label}…</p>
    </div>
  );
}
