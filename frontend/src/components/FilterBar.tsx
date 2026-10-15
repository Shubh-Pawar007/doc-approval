import type { DocumentStatus } from '../api/types';

export type StatusFilter = DocumentStatus | 'all';

const OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

interface Props {
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
}

export function FilterBar({ status, onStatusChange, search, onSearchChange }: Props) {
  return (
    <div className="filters">
      <div className="segmented" role="radiogroup" aria-label="Filter by status">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={status === option.value}
            className="segmented__item"
            onClick={() => onStatusChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <input
        type="search"
        className="input filters__search"
        placeholder="Search titles"
        aria-label="Search by title"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
  );
}
