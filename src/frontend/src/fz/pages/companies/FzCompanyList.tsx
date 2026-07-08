import {
  Badge,
  Button,
  Center,
  Chip,
  Group,
  Loader,
  Pagination,
  Stack,
  Table,
  Text,
  TextInput,
  Title
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { useUserState } from '../../../states/UserState';
import { useGlobalQuery } from '../../api/useBranchQuery';
import CompanyEditorDrawer from './CompanyEditorDrawer';
import { COMPANY_KINDS } from './kinds';

const PAGE_SIZE = 50;

/**
 * Customer / supplier list: global (not branch-scoped), searchable,
 * row click opens the detail page, "New" opens the editor drawer.
 */
export default function FzCompanyList({
  kind: kindKey
}: {
  kind: 'customer' | 'supplier';
}) {
  const kind = COMPANY_KINDS[kindKey];
  const navigate = useNavigate();
  const user = useUserState();

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [activeOnly, setActiveOnly] = useState(true);
  const [page, setPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isLoading } = useGlobalQuery({
    key: [kind.key, debouncedSearch, activeOnly, page],
    endpoint: ApiEndpoints.company_list,
    params: {
      [kind.flagParam]: true,
      search: debouncedSearch || undefined,
      active: activeOnly || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      ordering: 'name'
    }
  });

  const companies: any[] = data?.results ?? [];
  const totalCount: number = data?.count ?? 0;
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <Stack>
      <Group justify='space-between'>
        <Title order={3}>{kind.label}</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setDrawerOpen(true)}
          disabled={!user.hasAddRole(kind.role)}
          data-testid={`fz-${kind.key}-create`}
        >
          New {kind.singular}
        </Button>
      </Group>
      <Group>
        <TextInput
          placeholder='Search by name, description, website...'
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            setPage(1);
          }}
          style={{ flexGrow: 1, maxWidth: 420 }}
          data-testid={`fz-${kind.key}-search`}
        />
        <Chip
          checked={activeOnly}
          onChange={(checked) => {
            setActiveOnly(checked);
            setPage(1);
          }}
          variant='light'
        >
          Active only
        </Chip>
      </Group>
      {isLoading ? (
        <Center h='40vh'>
          <Loader />
        </Center>
      ) : companies.length === 0 ? (
        <Center h='30vh'>
          <Stack align='center' gap='xs'>
            <Text fw={600}>No {kind.key} found</Text>
            <Text c='dimmed' size='sm'>
              {debouncedSearch
                ? 'Try a different search term'
                : `Create your first ${kind.singular} to get started`}
            </Text>
          </Stack>
        </Center>
      ) : (
        <>
          <Table highlightOnHover data-testid={`fz-${kind.key}-table`}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Phone</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Currency</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {companies.map((company) => (
                <Table.Tr
                  key={company.pk}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`${kind.listPath}${company.pk}`)}
                >
                  <Table.Td>
                    <Text size='sm' fw={600}>
                      {company.name}
                    </Text>
                    {company.description && (
                      <Text size='xs' c='dimmed' lineClamp={1}>
                        {company.description}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm'>{company.phone || '-'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm'>{company.email || '-'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm' c='dimmed'>
                      {company.currency || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {company.active ? (
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
          <Group justify='space-between'>
            <Text size='sm' c='dimmed'>
              {totalCount} {totalCount === 1 ? kind.singular : kind.key}
            </Text>
            {pageCount > 1 && (
              <Pagination
                total={pageCount}
                value={page}
                onChange={setPage}
                size='sm'
              />
            )}
          </Group>
        </>
      )}
      <CompanyEditorDrawer
        opened={drawerOpen}
        kind={kind}
        companyId={null}
        onClose={() => setDrawerOpen(false)}
        onSaved={(pk) => navigate(`${kind.listPath}${pk}`)}
      />
    </Stack>
  );
}
