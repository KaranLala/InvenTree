import { Alert, AppShell, Center, Loader, Stack, Text } from '@mantine/core';
import { IconBuildingStore } from '@tabler/icons-react';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import { Boundary } from '@lib/components/Boundary';
import FzProtectedRoute from './FzProtectedRoute';
import { useBranches } from './api/useBranchQuery';
import FzTopBar from './components/FzTopBar';
import { useBranchState } from './state/BranchState';

/**
 * Root layout for the FZ app (/b/*): slim top bar with the branch selector,
 * no InvenTree navigation chrome. Ensures a valid active branch is selected
 * before rendering any branch-scoped page.
 */
export default function FzLayout() {
  return (
    <FzProtectedRoute>
      <FzShell />
    </FzProtectedRoute>
  );
}

function FzShell() {
  const { data: branches, isLoading, isError } = useBranches();
  const { activeBranchId, setActiveBranch } = useBranchState();

  // Bootstrap: default to the first active branch if none is selected,
  // or if the persisted selection is no longer an active branch.
  useEffect(() => {
    if (!branches || branches.length === 0) return;

    if (
      activeBranchId == null ||
      !branches.some((branch) => branch.pk === activeBranchId)
    ) {
      setActiveBranch(branches[0].pk);
    }
  }, [branches, activeBranchId, setActiveBranch]);

  const branchReady =
    activeBranchId != null &&
    (branches?.some((branch) => branch.pk === activeBranchId) ?? false);

  return (
    <AppShell header={{ height: 52 }} padding='md'>
      <AppShell.Header>
        <FzTopBar />
      </AppShell.Header>
      <AppShell.Main>
        <Boundary label='fz-layout'>
          {branchReady ? (
            <Outlet />
          ) : isLoading ? (
            <Center h='60vh'>
              <Loader />
            </Center>
          ) : isError ? (
            <Center h='60vh'>
              <Alert color='red' title='Failed to load branches'>
                Could not load the branch list from the server. Check your
                connection and reload.
              </Alert>
            </Center>
          ) : (
            <Center h='60vh'>
              <Stack align='center'>
                <IconBuildingStore size={48} />
                <Text fw={600} size='lg'>
                  No active branches
                </Text>
                <Text c='dimmed'>
                  Create a branch in the Admin Center before using this app.
                </Text>
              </Stack>
            </Center>
          )}
        </Boundary>
      </AppShell.Main>
    </AppShell>
  );
}
