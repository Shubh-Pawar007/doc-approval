import { useRef, useState, type FormEvent } from 'react';
import { normalizeError } from '../../api/client';
import type { CreateDocumentInput } from '../../api/documents';
import { formatBytes } from '../../utils/format';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_FILE_TYPES = '.pdf,.docx,.txt,.md,.png,.jpg,.jpeg';

type FieldName = 'title' | 'content' | 'file' | 'form';
type Errors = Partial<Record<FieldName, string>>;

interface Props {
  onSubmit: (input: CreateDocumentInput) => Promise<void>;
  maxFileBytes?: number;
}

/**
 * Client-side checks mirror the server's rules for fast feedback;
 * the server remains the source of truth and its field errors are shown too.
 */
export function SubmitDocumentForm({ onSubmit, maxFileBytes = MAX_FILE_BYTES }: Props) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function validate(): Errors {
    const next: Errors = {};
    if (!title.trim()) next.title = 'Give the document a title';
    else if (title.trim().length > 200) next.title = 'Keep the title under 200 characters';
    if (!content.trim() && !file) next.content = 'Add some content or attach a file';
    if (file && file.size > maxFileBytes) next.file = `Files can be up to ${formatBytes(maxFileBytes)}`;
    return next;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await onSubmit({ title: title.trim(), content: content.trim() || undefined, file });
      setTitle('');
      setContent('');
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
    } catch (err) {
      const apiError = normalizeError(err);
      const fieldErrors: Errors = {};
      for (const field of ['title', 'content', 'file'] as const) {
        const message = apiError.fieldError(field);
        if (message) fieldErrors[field] = message;
      }
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { form: apiError.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="doc-title">Title</label>
        <input
          id="doc-title"
          className="input"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'doc-title-error' : undefined}
        />
        {errors.title && <p id="doc-title-error" className="field-error">{errors.title}</p>}
      </div>

      <div className="field">
        <label htmlFor="doc-content">Content</label>
        <textarea
          id="doc-content"
          className="input"
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          aria-invalid={Boolean(errors.content)}
          aria-describedby={errors.content ? 'doc-content-error' : undefined}
        />
        {errors.content && <p id="doc-content-error" className="field-error">{errors.content}</p>}
      </div>

      <div className="field">
        <label htmlFor="doc-file">Attachment (optional)</label>
        <input
          id="doc-file"
          ref={fileInput}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          aria-invalid={Boolean(errors.file)}
          aria-describedby="doc-file-hint"
        />
        <p id="doc-file-hint" className="hint">PDF, DOCX, TXT, Markdown, PNG or JPEG, up to {formatBytes(maxFileBytes)}.</p>
        {errors.file && <p className="field-error">{errors.file}</p>}
      </div>

      {errors.form && <p className="field-error" role="alert">{errors.form}</p>}

      <button type="submit" className="btn btn--primary" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit for review'}
      </button>
    </form>
  );
}
