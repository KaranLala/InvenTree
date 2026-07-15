import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Center,
  Checkbox,
  Grid,
  Group,
  Loader,
  Menu,
  Pagination,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconAdjustments,
  IconExternalLink,
  IconPlus,
  IconSearch,
  IconTransfer
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { formatDecimal } from '@lib/functions/Formatting';
import { StatusRenderer } from '../../../components/render/StatusRenderer';
import { useBranchQuery } from '../../api/useBranchQuery';
import { useBranchState } from '../../state/BranchState';
import AdjustModal, { type AdjustMode } from './AdjustModal';
import LocationTree from './LocationTree';
import NewStockModal from './NewStockModal';
import TransferModal from './TransferModal';

const PAGE_SIZE = 50;

/**
 * Branch-scoped stock browser: search-first, with a location tree
 * sidebar, quick adjust (count/add/remove) and in-branch transfer.
 */
export default function FzStock() {
  const navigate = useNavigate();
  const activeBranchId = useBranchState((s) => s.activeBranchId);

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [location, setLocation] = useState<number | 'null' | undefined>(
    undefined
  );
  const [page, setPage] = useState(1);
  // Selection is keyed by group (part + location + serial), not stock item pk
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const [modalItems, setModalItems] = useState<any[]>([]);
  const [adjustMode, setAdjustMode] = useState<AdjustMode | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [newStockOpen, setNewStockOpen] = useState(false);

  // The "no location" view is branch-independent: those items have no
  // branch, and the tenant filter would exclude them
  const noLocation = location === 'null';

  const queryParams: Record<string, any> = {
    search: debouncedSearch || undefined,
    in_stock: true,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE
  };

  if (noLocation) {
    queryParams.location = 'null';
    queryParams.cascade = false;
  } else if (location !== undefined) {
    queryParams.location = location;
    queryParams.cascade = true;
  }

  // Rows are grouped by part + location (serialized items stay separate); the
  // backend sums available across the underlying stock items of each group.
  const { data, isLoading, isFetching } = useBranchQuery({
    key: ['stock-aggregate', debouncedSearch, location, page],
    endpoint: ApiEndpoints.stock_item_aggregate,
    params: queryParams,
    scoped: !noLocation
  });

  const items: any[] = data?.results ?? [];
  const totalCount: number = data?.count ?? 0;
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);

  // Count of unhomed items, surfaced as a pill (branch-independent)
  const { data: noLocationData } = useBranchQuery({
    key: ['stock-items', 'no-location-count'],
    endpoint: ApiEndpoints.stock_item_list,
    params: { location: 'null', cascade: false, in_stock: true, limit: 1 },
    scoped: false
  });
  const noLocationCount: number = noLocationData?.count ?? 0;

  // Stable key for a grouped row (part + location + serial)
  const groupKey = (row: any) =>
    `${row.part}-${row.location ?? 'null'}-${row.serial ?? ''}`;

  // Expand a grouped row into the underlying stock items, enriched with the
  // display fields the adjust/transfer modals expect (they render one row per
  // item, keyed by pk + quantity).
  const membersOf = (row: any): any[] =>
    (row.members ?? []).map((member: any) => ({
      ...member,
      part_detail: { full_name: row.part_name },
      location_detail: { pathstring: row.location_name }
    }));

  const selectedRows = useMemo(
    () => items.filter((row) => selection.has(groupKey(row))),
    [items, selection]
  );

  const toggleSelection = (key: string) => {
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const openAdjust = (rows: any[], mode: AdjustMode) => {
    setModalItems(rows.flatMap(membersOf));
    setAdjustMode(mode);
  };

  const openTransfer = (rows: any[]) => {
    setModalItems(rows.flatMap(membersOf));
    setTransferOpen(true);
  };

  const closeModals = () => {
    setAdjustMode(null);
    setTransferOpen(false);
    setSelection(new Set());
  };

  return (
    <Stack>
      <Group justify='space-between'>
        <Title order={3}>Stock</Title>
        <Group>
          {noLocationCount > 0 && (
            <Tooltip label='Stock items without a location (no branch)'>
              <Badge
                variant={noLocation ? 'filled' : 'light'}
                color='orange'
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setLocation(noLocation ? undefined : 'null');
                  setPage(1);
                }}
              >
                {noLocationCount} without location
              </Badge>
            </Tooltip>
          )}
          {selection.size > 0 && (
            <>
              <Button
                size='compact-sm'
                variant='light'
                leftSection={<IconAdjustments size={16} />}
                onClick={() => openAdjust(selectedRows, 'count')}
              >
                Count ({selection.size})
              </Button>
              <Button
                size='compact-sm'
                variant='light'
                leftSection={<IconTransfer size={16} />}
                onClick={() => openTransfer(selectedRows)}
              >
                Transfer ({selection.size})
              </Button>
            </>
          )}
          <Button
            size='compact-sm'
            leftSection={<IconPlus size={16} />}
            onClick={() => setNewStockOpen(true)}
            data-testid='fz-add-stock'
          >
            Add stock
          </Button>
        </Group>
      </Group>
      <Grid>
        <Grid.Col span={{ base: 12, sm: 3, lg: 2.5 }}>
          <LocationTree
            selected={location}
            onSelect={(value) => {
              setLocation(value);
              setPage(1);
              setSelection(new Set());
            }}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 9, lg: 9.5 }}>
          <Stack gap='xs'>
            <TextInput
              placeholder='Search stock by part name, IPN, batch, serial...'
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(event) => {
                setSearch(event.currentTarget.value);
                setPage(1);
              }}
              rightSection={isFetching ? <Loader size='xs' /> : undefined}
              data-testid='fz-stock-search'
            />
            {isLoading ? (
              <Center h='40vh'>
                <Loader />
              </Center>
            ) : items.length === 0 ? (
              <Center h='30vh'>
                <Stack align='center' gap='xs'>
                  <Text fw={600}>No stock found</Text>
                  <Text c='dimmed' size='sm'>
                    {debouncedSearch
                      ? 'Try a different search term'
                      : 'No stock items in this branch'}
                  </Text>
                </Stack>
              </Center>
            ) : (
              <>
                <Table highlightOnHover data-testid='fz-stock-table'>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={36} />
                      <Table.Th>Part</Table.Th>
                      <Table.Th>Location</Table.Th>
                      <Table.Th>Available</Table.Th>
                      <Table.Th>Batch / Serial</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th w={140} />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {items.map((row) => {
                      const key = groupKey(row);
                      const members: any[] = row.members ?? [];
                      const batches = Array.from(
                        new Set(
                          members
                            .map((member) => member.batch)
                            .filter((batch) => batch)
                        )
                      );
                      const statuses = Array.from(
                        new Set(
                          members.map(
                            (member) =>
                              member.status_custom_key ?? member.status
                          )
                        )
                      );
                      const batchLabel = row.serial
                        ? `# ${row.serial}`
                        : batches.length === 0
                          ? '-'
                          : batches.length === 1
                            ? batches[0]
                            : `${batches.length} batches`;
                      const openTarget =
                        row.item_count === 1 && members[0]
                          ? `/stock/item/${members[0].pk}`
                          : row.location != null
                            ? `/stock/location/${row.location}`
                            : `/part/${row.part}/`;
                      return (
                        <Table.Tr key={key}>
                          <Table.Td>
                            <Checkbox
                              size='xs'
                              checked={selection.has(key)}
                              onChange={() => toggleSelection(key)}
                              aria-label={`select-stock-${key}`}
                            />
                          </Table.Td>
                          <Table.Td>
                            <Group gap='xs' wrap='nowrap'>
                              <Avatar size='sm' radius='sm' />
                              <div>
                                <Group gap={6} wrap='nowrap'>
                                  <Text size='sm' fw={500}>
                                    {row.part_name}
                                  </Text>
                                  {row.item_count > 1 && (
                                    <Badge
                                      size='xs'
                                      variant='light'
                                      color='gray'
                                    >
                                      ×{row.item_count}
                                    </Badge>
                                  )}
                                </Group>
                                {row.part_IPN && (
                                  <Text size='xs' c='dimmed'>
                                    {row.part_IPN}
                                  </Text>
                                )}
                              </div>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text size='sm'>{row.location_name ?? '-'}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4} wrap='nowrap'>
                              <Text size='sm' fw={500}>
                                {formatDecimal(Number(row.available))}
                              </Text>
                              {Number(row.total_allocated ?? 0) > 0 && (
                                <Text size='xs' c='dimmed'>
                                  / {formatDecimal(Number(row.total_quantity))}
                                </Text>
                              )}
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text size='sm'>{batchLabel}</Text>
                          </Table.Td>
                          <Table.Td>
                            {statuses.length === 1 ? (
                              <StatusRenderer
                                status={statuses[0]}
                                type={ModelType.stockitem}
                              />
                            ) : (
                              <Text size='sm' c='dimmed'>
                                —
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4} wrap='nowrap' justify='flex-end'>
                              <Menu position='bottom-end'>
                                <Menu.Target>
                                  <ActionIcon
                                    variant='subtle'
                                    aria-label={`adjust-stock-${key}`}
                                  >
                                    <IconAdjustments size={16} />
                                  </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                  <Menu.Item
                                    onClick={() => openAdjust([row], 'count')}
                                  >
                                    Count
                                  </Menu.Item>
                                  <Menu.Item
                                    onClick={() => openAdjust([row], 'add')}
                                  >
                                    Add
                                  </Menu.Item>
                                  <Menu.Item
                                    onClick={() => openAdjust([row], 'remove')}
                                  >
                                    Remove
                                  </Menu.Item>
                                </Menu.Dropdown>
                              </Menu>
                              <Tooltip label='Transfer'>
                                <ActionIcon
                                  variant='subtle'
                                  onClick={() => openTransfer([row])}
                                  aria-label={`transfer-stock-${key}`}
                                >
                                  <IconTransfer size={16} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label='Open in InvenTree'>
                                <ActionIcon
                                  variant='subtle'
                                  onClick={() => navigate(openTarget)}
                                  aria-label={`open-stock-${key}`}
                                >
                                  <IconExternalLink size={16} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
                <Group justify='space-between'>
                  <Text size='sm' c='dimmed'>
                    {totalCount} stock line{totalCount === 1 ? '' : 's'}
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
          </Stack>
        </Grid.Col>
      </Grid>
      <AdjustModal
        items={modalItems}
        mode={adjustMode ?? 'count'}
        opened={adjustMode != null}
        onClose={closeModals}
      />
      <TransferModal
        items={modalItems}
        opened={transferOpen}
        onClose={closeModals}
      />
      <NewStockModal
        opened={newStockOpen}
        onClose={() => setNewStockOpen(false)}
        defaultLocation={typeof location === 'number' ? location : null}
      />
      {activeBranchId == null && (
        <Text c='dimmed' size='sm'>
          Select a branch to view stock.
        </Text>
      )}
    </Stack>
  );
}
