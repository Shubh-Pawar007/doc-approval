import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { normalizeError, type ApiError } from '../api/client';
import { createDocumentsApi, listUsers, type DocumentsApi } from '../api/documents';
import type { User } from '../api/types';

const STORAGE_KEY = 'doc-approval:user-id';

interface UserContextValue {
  users: User[];
  currentUser: User | null;
  switchUser: (id: string) => void;
  loading: boolean;
  error: ApiError | null;
  retry: () => void;
  api: DocumentsApi | null;
}

const UserContext = createContext<UserContextValue | null>(null);

function readStoredId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeId(id: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage unavailable (private mode etc.) — selection just won't persist.
  }
}

/**
 * Mock identity provider. Picks a demo user and exposes an API client bound to them.
 * Real auth would replace this provider and nothing below it.
 */
export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(readStoredId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listUsers()
      .then((list) => {
        if (cancelled) return;
        setUsers(list);
        setCurrentId((prev) => (prev && list.some((u) => u.id === prev) ? prev : (list[0]?.id ?? null)));
      })
      .catch((err) => !cancelled && setError(normalizeError(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const switchUser = useCallback((id: string) => {
    setCurrentId(id);
    storeId(id);
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const currentUser = users.find((u) => u.id === currentId) ?? null;
  const currentUserId = currentUser?.id;
  const api = useMemo(() => (currentUserId ? createDocumentsApi(currentUserId) : null), [currentUserId]);

  const value = useMemo(
    () => ({ users, currentUser, switchUser, loading, error, retry, api }),
    [users, currentUser, switchUser, loading, error, retry, api],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used inside <UserProvider>');
  return ctx;
}

/** For views that only render once a user is selected. */
export function useDocumentsApi(): DocumentsApi {
  const { api } = useUser();
  if (!api) throw new Error('useDocumentsApi requires a selected user');
  return api;
}
