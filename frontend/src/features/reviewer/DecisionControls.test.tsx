import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import { DecisionControls } from './DecisionControls';

describe('DecisionControls', () => {
  it('approves in one click', async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<DecisionControls onDecide={onDecide} />);

    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onDecide).toHaveBeenCalledWith({ decision: 'approved' });
  });

  it('keeps reject disabled until a reason is typed, then sends the trimmed reason', async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<DecisionControls onDecide={onDecide} />);

    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    const confirm = screen.getByRole('button', { name: 'Reject with reason' });
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/why are you rejecting/i), '   ');
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/why are you rejecting/i), 'Missing budget  ');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(onDecide).toHaveBeenCalledWith({ decision: 'rejected', reason: 'Missing budget' });
  });

  it('shows the server error, e.g. a 409 conflict', async () => {
    const onDecide = vi.fn().mockRejectedValue(new ApiError(409, 'CONFLICT', 'Another reviewer decided this document first.'));
    render(<DecisionControls onDecide={onDecide} />);

    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Another reviewer decided this document first.');
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
  });

  it('sends one request for a double click', async () => {
    let resolve!: () => void;
    const onDecide = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    render(<DecisionControls onDecide={onDecide} />);

    await userEvent.dblClick(screen.getByRole('button', { name: 'Approve' }));
    expect(onDecide).toHaveBeenCalledTimes(1);
    resolve();
  });
});
