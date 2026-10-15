import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import { SubmitDocumentForm } from './SubmitDocumentForm';

describe('SubmitDocumentForm', () => {
  it('validates before calling the API', async () => {
    const onSubmit = vi.fn();
    render(<SubmitDocumentForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
    expect(screen.getByText('Give the document a title')).toBeInTheDocument();
    expect(screen.getByText('Add some content or attach a file')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed values and resets the form', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SubmitDocumentForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Title'), '  Travel policy ');
    await userEvent.type(screen.getByLabelText('Content'), ' Economy class only ');
    await userEvent.click(screen.getByRole('button', { name: 'Submit for review' }));

    expect(onSubmit).toHaveBeenCalledWith({ title: 'Travel policy', content: 'Economy class only', file: null });
    expect(screen.getByLabelText('Title')).toHaveValue('');
  });

  it('accepts a file instead of content and rejects oversized files', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SubmitDocumentForm onSubmit={onSubmit} maxFileBytes={10} />);

    await userEvent.type(screen.getByLabelText('Title'), 'Scan');
    const big = new File(['01234567890'], 'scan.txt', { type: 'text/plain' });
    await userEvent.upload(screen.getByLabelText(/attachment/i), big);
    await userEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
    expect(screen.getByText(/files can be up to/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    const small = new File(['ok'], 'note.txt', { type: 'text/plain' });
    await userEvent.upload(screen.getByLabelText(/attachment/i), small);
    await userEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
    expect(onSubmit).toHaveBeenCalledWith({ title: 'Scan', content: undefined, file: small });
  });

  it('shows field errors returned by the server', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(
        new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', [
          { field: 'title', message: 'Title must be at most 200 characters' },
        ]),
      );
    render(<SubmitDocumentForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Title'), 'X');
    await userEvent.type(screen.getByLabelText('Content'), 'Y');
    await userEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
    expect(await screen.findByText('Title must be at most 200 characters')).toBeInTheDocument();
  });
});
