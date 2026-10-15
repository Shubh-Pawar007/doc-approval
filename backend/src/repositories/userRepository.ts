import type { User } from '../domain/types';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  list(): Promise<User[]>;
}

/** Mocked identities. Auth is out of scope for this iteration; see README. */
export const DEMO_USERS: readonly User[] = [
  { id: 'u-alice', name: 'Alice Fernandes', role: 'submitter' },
  { id: 'u-bob', name: 'Bob Mehta', role: 'submitter' },
  { id: 'u-rita', name: 'Rita Kulkarni', role: 'reviewer' },
  { id: 'u-raj', name: 'Raj Iyer', role: 'reviewer' },
];

export class InMemoryUserRepository implements UserRepository {
  private readonly users: Map<string, User>;

  constructor(users: readonly User[] = DEMO_USERS) {
    this.users = new Map(users.map((u) => [u.id, { ...u }]));
  }

  async findById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async list(): Promise<User[]> {
    return [...this.users.values()].map((u) => ({ ...u }));
  }
}
