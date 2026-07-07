import type { JSX } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useUserState } from '../states/UserState';

/**
 * Auth guard for the FZ app. Mirrors ProtectedRoute in components/nav/Layout.tsx,
 * but lives here so the FZ chunk does not pull in the full InvenTree layout.
 */
export default function FzProtectedRoute({
  children
}: {
  children: JSX.Element;
}) {
  const location = useLocation();
  const { isLoggedIn } = useUserState();

  if (!isLoggedIn()) {
    return (
      <Navigate
        to='/logged-in'
        state={{
          redirectUrl: location.pathname,
          queryParams: location.search,
          anchor: location.hash
        }}
      />
    );
  }

  return children;
}
