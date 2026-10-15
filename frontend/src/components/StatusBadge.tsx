import type { DocumentStatus } from '../api/types';
import { STATUS_LABEL } from '../utils/format';

interface Props {
  status: DocumentStatus;
  /** The large, stamped variant used on the document detail. */
  stamp?: boolean;
}

export function StatusBadge({ status, stamp = false }: Props) {
  return (
    <span className={`badge badge--${status}${stamp ? ' badge--stamp' : ''}`} data-status={status}>
      {STATUS_LABEL[status]}
    </span>
  );
}
