import {
  Avatar,
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

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { UserRoles } from '@lib/enums/Roles';
import { formatDecimal } from '@lib/functions/Formatting';
import { useUserState } from '../../../states/UserState';
import { useGlobalQuery } from '../../api/useBranchQuery';
import ItemEditorDrawer from './ItemEditorDrawer';

const PAGE_SIZE = 50;

/**
 * Item master: global part management (not branch-scoped).
 * Searchable list; row click edits an item in a side drawer,
 * "New item" creates one.
 */
export default function FzItemMaster() {
  const user = useUserState();

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [activeOnly, setActiveOnly] = useState(true);
  const [page, setPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editPartId, setEditPartId] = useState<number | null>(null);

  const { data, isLoading } = useGlobalQuery({
    key: ['parts', debouncedSearch, activeOnly, page],
    endpoint: ApiEndpoints.part_list,
    params: {
      search: debouncedSearch || undefined,
      active: activeOnly || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      ordering: 'name'
    }
  });

  const parts: any[] = data?.results ?? [];
  const totalCount: number = data?.count ?? 0;
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);

  const openEditor = (partId: number | null) => {
    setEditPartId(partId);
    setDrawerOpen(true);
  };

  return (
    <Stack>
      <Group justify='space-between'>
        <Title order={3}>Item master</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => openEditor(null)}
          disabled={!user.hasAddRole(UserRoles.part)}
          data-testid='fz-items-create'
        >
          New item
        </Button>
      </Group>
      <Group>
        <TextInput
          placeholder='Search by name, IPN, category...'
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            setPage(1);
          }}
          style={{ flexGrow: 1, maxWidth: 420 }}
          data-testid='fz-items-search'
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
      ) : parts.length === 0 ? (
        <Center h='30vh'>
          <Stack align='center' gap='xs'>
            <Text fw={600}>No items found</Text>
            <Text c='dimmed' size='sm'>
              {debouncedSearch
                ? 'Try a different search term'
                : 'Create your first item to get started'}
            </Text>
          </Stack>
        </Center>
      ) : (
        <>
          <Table highlightOnHover data-testid='fz-items-table'>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={48} />
                <Table.Th>Name</Table.Th>
                <Table.Th>IPN</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>Units</Table.Th>
                <Table.Th>In stock (all)</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {parts.map((part) => (
                <Table.Tr
                  key={part.pk}
                  style={{ cursor: 'pointer' }}
                  onClick={() => openEditor(part.pk)}
                >
                  <Table.Td>
                    <Avatar src={part.thumbnail} size='sm' radius='sm' />
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm' fw={600}>
                      {part.full_name ?? part.name}
                    </Text>
                    {part.description && (
                      <Text size='xs' c='dimmed' lineClamp={1}>
                        {part.description}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm'>{part.IPN || '-'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm'>{part.category_name ?? '-'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm' c='dimmed'>
                      {part.units || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm'>
                      {formatDecimal(Number(part.total_in_stock ?? 0))}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Group justify='space-between'>
            <Text size='sm' c='dimmed'>
              {totalCount} item{totalCount === 1 ? '' : 's'}
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
      <ItemEditorDrawer
        opened={drawerOpen}
        partId={editPartId}
        onClose={() => setDrawerOpen(false)}
      />
    </Stack>
  );
}
