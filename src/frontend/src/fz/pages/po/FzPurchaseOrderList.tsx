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
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { UserRoles } from '@lib/enums/Roles';
import { StatusRenderer } from '../../../components/render/StatusRenderer';
import { formatCurrency } from '../../../defaults/formatters';
import { usePurchaseOrderFields } from '../../../forms/PurchaseOrderForms';
import { useCreateApiFormModal } from '../../../hooks/UseForm';
import { useUserState } from '../../../states/UserState';
import { useBranchQuery } from '../../api/useBranchQuery';
import { useBranchState } from '../../state/BranchState';

const PAGE_SIZE = 50;

/**
 * Branch-scoped purchase order list — same shape as the FZ SO list,
 * with the supplier instead of the customer.
 */
export default function FzPurchaseOrderList() {
  const navigate = useNavigate();
  const user = useUserState();
  const activeBranchId = useBranchState((s) => s.activeBranchId);

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [outstanding, setOutstanding] = useState(true);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useBranchQuery({
    key: ['purchase-orders', debouncedSearch, outstanding, page],
    endpoint: ApiEndpoints.purchase_order_list,
    params: {
      search: debouncedSearch || undefined,
      outstanding: outstanding || undefined,
      supplier_detail: true,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      ordering: '-creation_date'
    }
  });

  const orders: any[] = data?.results ?? [];
  const totalCount: number = data?.count ?? 0;
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);

  const orderFields = usePurchaseOrderFields({});

  // The branch comes from the top-bar selector — no need to ask again
  const createFields = useMemo(() => {
    const fields = { ...orderFields };
    fields.tenant = {
      value: activeBranchId ?? undefined,
      hidden: true
    };
    return fields;
  }, [orderFields, activeBranchId]);

  const newOrder = useCreateApiFormModal({
    url: ApiEndpoints.purchase_order_list,
    title: 'New Purchase Order',
    fields: createFields,
    onFormSuccess: (order: any) => {
      if (order?.pk) {
        navigate(`/b/po/${order.pk}`);
      }
    }
  });

  return (
    <Stack>
      {newOrder.modal}
      <Group justify='space-between'>
        <Title order={3}>Purchase Orders</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => newOrder.open()}
          disabled={!user.hasAddRole(UserRoles.purchase_order)}
          data-testid='fz-po-create'
        >
          New order
        </Button>
      </Group>
      <Group>
        <TextInput
          placeholder='Search by reference, supplier, description...'
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            setPage(1);
          }}
          style={{ flexGrow: 1, maxWidth: 420 }}
          data-testid='fz-po-search'
        />
        <Chip
          checked={outstanding}
          onChange={(checked) => {
            setOutstanding(checked);
            setPage(1);
          }}
          variant='light'
        >
          Outstanding only
        </Chip>
      </Group>
      {isLoading ? (
        <Center h='40vh'>
          <Loader />
        </Center>
      ) : orders.length === 0 ? (
        <Center h='30vh'>
          <Stack align='center' gap='xs'>
            <Text fw={600}>No purchase orders</Text>
            <Text c='dimmed' size='sm'>
              {debouncedSearch
                ? 'Try a different search term'
                : outstanding
                  ? 'No outstanding orders in this branch'
                  : 'No orders in this branch yet'}
            </Text>
          </Stack>
        </Center>
      ) : (
        <>
          <Table highlightOnHover data-testid='fz-po-table'>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Reference</Table.Th>
                <Table.Th>Supplier</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Lines</Table.Th>
                <Table.Th>Total</Table.Th>
                <Table.Th>Target date</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {orders.map((order) => (
                <Table.Tr
                  key={order.pk}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/b/po/${order.pk}`)}
                >
                  <Table.Td>
                    <Text size='sm' fw={600}>
                      {order.reference}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm'>{order.supplier_detail?.name ?? '-'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <StatusRenderer
                      status={order.status_custom_key ?? order.status}
                      type={ModelType.purchaseorder}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Badge variant='light' color='gray'>
                      {order.completed_lines} / {order.line_items}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm'>
                      {formatCurrency(order.total_price, {
                        currency: order.order_currency
                      })}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm' c='dimmed'>
                      {order.target_date ?? '-'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Group justify='space-between'>
            <Text size='sm' c='dimmed'>
              {totalCount} order{totalCount === 1 ? '' : 's'}
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
  );
}
