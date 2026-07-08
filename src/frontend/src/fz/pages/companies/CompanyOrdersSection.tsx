import {
  Badge,
  Center,
  Group,
  Loader,
  Pagination,
  Stack,
  Table,
  Text
} from '@mantine/core';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { StatusRenderer } from '../../../components/render/StatusRenderer';
import { formatCurrency } from '../../../defaults/formatters';
import { useBranchQuery } from '../../api/useBranchQuery';
import type { CompanyKind } from './kinds';

const PAGE_SIZE = 50;

/**
 * Order history for a customer/supplier. This is the one branch-scoped
 * piece of the company page: the query merges tenant=<active branch>
 * and refetches automatically when the branch changes.
 */
export default function CompanyOrdersSection({
  companyId,
  kind
}: {
  companyId: number;
  kind: CompanyKind;
}) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useBranchQuery({
    key: ['company', companyId, 'orders', page],
    endpoint: kind.ordersEndpoint,
    params: {
      [kind.orderFilterParam]: companyId,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      ordering: '-creation_date'
    }
  });

  const orders: any[] = data?.results ?? [];
  const totalCount: number = data?.count ?? 0;
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);

  if (isLoading) {
    return (
      <Center h={80}>
        <Loader size='sm' />
      </Center>
    );
  }

  if (orders.length === 0) {
    return (
      <Text size='sm' c='dimmed'>
        No orders for this {kind.singular} in this branch
      </Text>
    );
  }

  return (
    <Stack gap='xs'>
      <Table highlightOnHover data-testid='fz-company-orders'>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Reference</Table.Th>
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
              onClick={() => navigate(`${kind.orderRoute}${order.pk}`)}
            >
              <Table.Td>
                <Text size='sm' fw={600}>
                  {order.reference}
                </Text>
              </Table.Td>
              <Table.Td>
                <StatusRenderer
                  status={order.status_custom_key ?? order.status}
                  type={kind.orderModelType}
                />
              </Table.Td>
              <Table.Td>
                <Badge variant='light' color='gray'>
                  {order.completed_lines} / {order.line_items}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size='sm'>
                  {formatCurrency(order[kind.orderTotalField], {
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
    </Stack>
  );
}
