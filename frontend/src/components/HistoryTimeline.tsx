import type { DocumentEvent } from '../api/types';
import { formatDateTime } from '../utils/format';

const VERB: Record<DocumentEvent['type'], string> = {
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function HistoryTimeline({ events }: { events: DocumentEvent[] }) {
  if (!events.length) return null;
  return (
    <ol className="timeline" aria-label="Document history">
      {events.map((event) => (
        <li key={event.id} className={`timeline__item timeline__item--${event.type}`}>
          <p>
            <strong>{VERB[event.type]}</strong> by {event.actor.name}
          </p>
          {event.reason && <p className="timeline__reason">{event.reason}</p>}
          <time dateTime={event.at}>{formatDateTime(event.at)}</time>
        </li>
      ))}
    </ol>
  );
}
