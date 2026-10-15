import { ErrorBanner } from './components/ErrorBanner';
import { Loading } from './components/Loading';
import { UserSwitcher } from './components/UserSwitcher';
import { UserProvider, useUser } from './context/UserContext';
import { ReviewerView } from './features/reviewer/ReviewerView';
import { SubmitterView } from './features/submitter/SubmitterView';

function Shell() {
  const { currentUser, loading, error, retry } = useUser();

  let body;
  if (loading) body = <Loading label="Connecting" />;
  else if (error) body = <ErrorBanner error={error} onRetry={retry} />;
  else if (!currentUser) body = <p className="empty">No users are configured on the server.</p>;
  // key: switching user remounts the view, so no state leaks between identities.
  else if (currentUser.role === 'reviewer') body = <ReviewerView key={currentUser.id} />;
  else body = <SubmitterView key={currentUser.id} />;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">
          <h1>Approvals desk</h1>
          {currentUser && (
            <p className="topbar__role">
              {currentUser.role === 'reviewer' ? 'Reviewing submissions' : 'Submitting documents'}
            </p>
          )}
        </div>
        <UserSwitcher />
      </header>
      <main className="main">{body}</main>
    </div>
  );
}

export default function App() {
  return (
    <UserProvider>
      <Shell />
    </UserProvider>
  );
}
