import { useUser } from '../context/UserContext';

/** Stand-in for login: pick who you are acting as. */
export function UserSwitcher() {
  const { users, currentUser, switchUser } = useUser();
  if (!users.length) return null;

  return (
    <label className="switcher">
      <span className="switcher__label">Acting as</span>
      <select value={currentUser?.id ?? ''} onChange={(e) => switchUser(e.target.value)}>
        <optgroup label="Submitters">
          {users.filter((u) => u.role === 'submitter').map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </optgroup>
        <optgroup label="Reviewers">
          {users.filter((u) => u.role === 'reviewer').map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
