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
  const [selection, setSelection] = useState<Set<number>>(new Set());

  const [modalItems, setModalItems] = useState<any[]>([]);
  const [adjustMode, setAdjustMode] = useState<AdjustMode | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  // The "no location" view is branch-independent: those items have no
  // branch, and the tenant filter would exclude them
  const noLocation = location === 'null';

  const queryParams: Record<string, any> = {
    search: debouncedSearch || undefined,
    part_detail: true,
    location_detail: true,
    in_stock: true,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    ordering: 'part'
  };

  if (noLocation) {
    queryParams.location = 'null';
    queryParams.cascade = false;
  } else if (location !== undefined) {
    queryParams.location = location;
    queryParams.cascade = true;
  }

  const { data, isLoading, isFetching } = useBranchQuery({
    key: ['stock-items', debouncedSearch, location, page],
    endpoint: ApiEndpoints.stock_item_list,
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

  const selectedItems = useMemo(
    () => items.filter((item) => selection.has(item.pk)),
    [items, selection]
  );

  const toggleSelection = (pk: number) => {
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(pk)) {
        next.delete(pk);
      } else {
        next.add(pk);
      }
      return next;
    });
  };

  const openAdjust = (rows: any[], mode: AdjustMode) => {
    setModalItems(rows);
    setAdjustMode(mode);
  };

  const openTransfer = (rows: any[]) => {
    setModalItems(rows);
    setTransferOpen(true);
  };

  const closeModals = () => {
    setAdjustMode(null);
    setTransferOpen(false);
    setSelection(new Set());
  };

  const available = (item: any) =>
    Number(item.quantity) - Number(item.allocated ?? 0);

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
                onClick={() => openAdjust(selectedItems, 'count')}
              >
                Count ({selection.size})
              </Button>
              <Button
                size='compact-sm'
                variant='light'
                leftSection={<IconTransfer size={16} />}
                onClick={() => openTransfer(selectedItems)}
              >
                Transfer ({selection.size})
              </Button>
            </>
          )}
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
                    {items.map((item) => (
                      <Table.Tr key={item.pk}>
                        <Table.Td>
                          <Checkbox
                            size='xs'
                            checked={selection.has(item.pk)}
                            onChange={() => toggleSelection(item.pk)}
                            aria-label={`select-stock-${item.pk}`}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Group gap='xs' wrap='nowrap'>
                            <Avatar
                              src={item.part_detail?.thumbnail}
                              size='sm'
                              radius='sm'
                            />
                            <div>
                              <Text size='sm' fw={500}>
                                {item.part_detail?.full_name}
                              </Text>
                              {item.part_detail?.IPN && (
                                <Text size='xs' c='dimmed'>
                                  {item.part_detail.IPN}
                                </Text>
                              )}
                            </div>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size='sm'>
                            {item.location_detail?.pathstring ?? '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} wrap='nowrap'>
                            <Text size='sm' fw={500}>
                              {formatDecimal(available(item))}
                            </Text>
                            {Number(item.allocated ?? 0) > 0 && (
                              <Text size='xs' c='dimmed'>
                                / {formatDecimal(Number(item.quantity))}
                              </Text>
                            )}
                            {item.part_detail?.units && (
                              <Text size='xs' c='dimmed'>
                                [{item.part_detail.units}]
                              </Text>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size='sm'>
                            {item.serial
                              ? `# ${item.serial}`
                              : (item.batch ?? '-')}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <StatusRenderer
                            status={item.status_custom_key ?? item.status}
                            type={ModelType.stockitem}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} wrap='nowrap' justify='flex-end'>
                            <Menu position='bottom-end'>
                              <Menu.Target>
                                <ActionIcon
                                  variant='subtle'
                                  aria-label={`adjust-stock-${item.pk}`}
                                >
                                  <IconAdjustments size={16} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Item
                                  onClick={() => openAdjust([item], 'count')}
                                >
                                  Count
                                </Menu.Item>
                                <Menu.Item
                                  onClick={() => openAdjust([item], 'add')}
                                >
                                  Add
                                </Menu.Item>
                                <Menu.Item
                                  onClick={() => openAdjust([item], 'remove')}
                                >
                                  Remove
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                            <Tooltip label='Transfer'>
                              <ActionIcon
                                variant='subtle'
                                onClick={() => openTransfer([item])}
                                aria-label={`transfer-stock-${item.pk}`}
                              >
                                <IconTransfer size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label='Open in InvenTree'>
                              <ActionIcon
                                variant='subtle'
                                onClick={() =>
                                  navigate(`/stock/item/${item.pk}`)
                                }
                                aria-label={`open-stock-${item.pk}`}
                              >
                                <IconExternalLink size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
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
      {activeBranchId == null && (
        <Text c='dimmed' size='sm'>
          Select a branch to view stock.
        </Text>
      )}
    </Stack>
  );
}
