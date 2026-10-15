export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="loading__dot" aria-hidden="true" />
      {label}…
    </div>
  );
}
