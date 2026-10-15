import { createHttpClient } from './client';
import type { Decision, DocumentDetail, DocumentEvent, DocumentPage, DocumentStatus, User } from './types';

export interface ListParams {
  status?: DocumentStatus;
  q?: string;
  limit?: number;
  cursor?: string;
}

export interface CreateDocumentInput {
  title: string;
  content?: string;
  file?: File | null;
}

export interface DecisionInput {
  decision: Decision;
  reason?: string;
}

function toQuery(params: ListParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function createDocumentsApi(userId: string) {
  const http = createHttpClient(userId);
  const path = (id: string) => `/api/documents/${encodeURIComponent(id)}`;

  return {
    list: (params: ListParams, signal?: AbortSignal) =>
      http.json<DocumentPage>(`/api/documents${toQuery(params)}`, { signal }),

    get: (id: string, signal?: AbortSignal) => http.json<DocumentDetail>(path(id), { signal }),

    history: async (id: string, signal?: AbortSignal) =>
      (await http.json<{ items: DocumentEvent[] }>(`${path(id)}/history`, { signal })).items,

    create: (input: CreateDocumentInput) => {
      const form = new FormData();
      form.append('title', input.title);
      if (input.content) form.append('content', input.content);
      if (input.file) form.append('file', input.file);
      return http.json<DocumentDetail>('/api/documents', { method: 'POST', body: form });
    },

    decide: (id: string, input: DecisionInput) =>
      http.json<DocumentDetail>(`${path(id)}/decision`, { method: 'POST', body: input }),

    /** Fetches with auth headers, then hands the blob to the browser as a download. */
    downloadFile: async (id: string, filename: string) => {
      const blob = await http.blob(`${path(id)}/file`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
}

export type DocumentsApi = ReturnType<typeof createDocumentsApi>;

export async function listUsers(): Promise<User[]> {
  return (await createHttpClient(null).json<{ items: User[] }>('/api/users')).items;
}
