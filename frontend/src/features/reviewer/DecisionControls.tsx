import { useRef, useState } from 'react';
import { normalizeError } from '../../api/client';
import type { DecisionInput } from '../../api/documents';
import type { Decision } from '../../api/types';

interface Props {
  onDecide: (input: DecisionInput) => Promise<void>;
}

/**
 * Approve in one click; reject needs a reason (the server enforces this too).
 * A ref guards against double submits, because state updates land a render late.
 */
export function DecisionControls({ onDecide }: Props) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function decide(decision: Decision) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(decision);
    setError(null);
    try {
      await onDecide(decision === 'rejected' ? { decision, reason: reason.trim() } : { decision });
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <section className="decision" aria-label="Review decision">
      {!rejecting ? (
        <div className="decision__actions">
          <button type="button" className="btn btn--approve" disabled={busy} onClick={() => decide('approved')}>
            {pending === 'approved' ? 'Approving…' : 'Approve'}
          </button>
          <button type="button" className="btn btn--outline-reject" disabled={busy} onClick={() => setRejecting(true)}>
            Reject
          </button>
        </div>
      ) : (
        <div className="decision__reject">
          <label htmlFor="reject-reason">Why are you rejecting this?</label>
          <textarea
            id="reject-reason"
            className="input"
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="The submitter will see this note"
            autoFocus
          />
          <div className="decision__actions">
            <button
              type="button"
              className="btn btn--quiet"
              disabled={busy}
              onClick={() => {
                setRejecting(false);
                setReason('');
                setError(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--reject"
              disabled={busy || !reason.trim()}
              onClick={() => decide('rejected')}
            >
              {pending === 'rejected' ? 'Rejecting…' : 'Reject with reason'}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
