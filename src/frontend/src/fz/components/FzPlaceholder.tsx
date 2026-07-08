import { Badge, Card, Group, Loader, Stack, Text, Title } from '@mantine/core';

import type { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { useBranchQuery } from '../api/useBranchQuery';
import { useBranchState } from '../state/BranchState';

/**
 * Temporary stand-in page for a not-yet-built workflow. Shows a live
 * branch-scoped record count to prove the scoping pipeline end-to-end.
 * Replaced section by section as the real pages land.
 */
export default function FzPlaceholder({
  title,
  endpoint,
  countLabel
}: {
  title: string;
  endpoint: ApiEndpoints;
  countLabel: string;
}) {
  const activeBranchId = useBranchState((s) => s.activeBranchId);

  const { data, isLoading } = useBranchQuery({
    key: ['placeholder', endpoint],
    endpoint: endpoint,
    params: { limit: 1 }
  });

  return (
    <Stack>
      <Group justify='space-between'>
        <Title order={3}>{title}</Title>
        <Badge variant='light' data-testid='fz-active-branch'>
          Branch #{activeBranchId}
        </Badge>
      </Group>
      <Card withBorder>
        {isLoading ? (
          <Loader size='sm' />
        ) : (
          <Text data-testid='fz-placeholder-count'>
            {data?.count ?? 0} {countLabel} in this branch
          </Text>
        )}
        <Text c='dimmed' size='sm' mt='xs'>
          This workflow is being rebuilt as a single-page experience.
        </Text>
      </Card>
    </Stack>
  );
}
