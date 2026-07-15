import {
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Title
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { useUserState } from '../../../states/UserState';
import { listResults, useGlobalQuery } from '../../api/useBranchQuery';
import BranchEditorDrawer from './BranchEditorDrawer';

/**
 * Branch list: all branches (active and inactive), row click opens the
 * branch management page. No search/pagination — a handful of branches.
 */
export default function FzBranchList() {
  const navigate = useNavigate();
  const user = useUserState();

  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isLoading } = useGlobalQuery({
    key: ['branches', 'all'],
    endpoint: ApiEndpoints.tenant_list,
    params: { ordering: 'name' }
  });

  const branches: any[] = listResults(data);

  return (
    <Stack>
      <Group justify='space-between'>
        <Title order={3}>Branches</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setDrawerOpen(true)}
          disabled={!user.isStaff()}
          data-testid='fz-branch-create'
        >
          New branch
        </Button>
      </Group>
      {isLoading ? (
        <Center h='40vh'>
          <Loader />
        </Center>
      ) : branches.length === 0 ? (
        <Center h='30vh'>
          <Stack align='center' gap='xs'>
            <Text fw={600}>No branches yet</Text>
            <Text c='dimmed' size='sm'>
              Create your first branch to get started
            </Text>
          </Stack>
        </Center>
      ) : (
        <Table highlightOnHover data-testid='fz-branches-table'>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Code</Table.Th>
              <Table.Th>Contact</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {branches.map((branch) => (
              <Table.Tr
                key={branch.pk}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/b/branches/${branch.pk}`)}
              >
                <Table.Td>
                  <Text size='sm' fw={600}>
                    {branch.name}
                  </Text>
                  {branch.description && (
                    <Text size='xs' c='dimmed' lineClamp={1}>
                      {branch.description}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size='sm'>{branch.code || '-'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size='sm'>
                    {[branch.contact_name, branch.contact_phone]
                      .filter(Boolean)
                      .join(' · ') || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {branch.is_active ? (
                    <Badge variant='light' color='green'>
                      Active
                    </Badge>
                  ) : (
                    <Badge variant='light' color='gray'>
                      Inactive
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <BranchEditorDrawer
        opened={drawerOpen}
        branchId={null}
        onClose={() => setDrawerOpen(false)}
        onSaved={(pk) => navigate(`/b/branches/${pk}`)}
      />
    </Stack>
  );
}
