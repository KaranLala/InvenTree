import {
  ActionIcon,
  Button,
  Grid,
  Group,
  Loader,
  NumberInput,
  Stack,
  Table,
  Text,
  Tooltip
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { apiUrl } from '@lib/functions/Api';
import { formatDecimal } from '@lib/functions/Formatting';
import { useApi } from '../../../contexts/ApiContext';
import { extractErrorMessage } from '../../api/errors';
import { listResults, useBranchQuery } from '../../api/useBranchQuery';

/**
 * Expanded allocation panel for a single sales order line.
 *
 * Left: existing allocations (with remove). Right: available stock in
 * the active branch, with a quantity input to allocate. The server
 * additionally enforces stock branch == order branch.
 */
export default function AllocationRow({
  order,
  line,
  editable,
  ensureShipment,
  onChanged
}: {
  order: any;
  line: any;
  editable: boolean;
  ensureShipment: () => Promise<number | null>;
  onChanged: () => void;
}) {
  const api = useApi();

  const remaining = Math.max(
    Number(line.quantity) - Number(line.allocated),
    0
  );

  const allocationsQuery = useBranchQuery({
    key: ['so', order.pk, 'line-allocations', line.pk],
    endpoint: ApiEndpoints.sales_order_allocation_list,
    params: {
      line: line.pk,
      item_detail: true,
      location_detail: true
    },
    scoped: false
  });

  const allocations = listResults(allocationsQuery.data);

  // Available stock for this part, in the active branch only
  const stockQuery = useBranchQuery({
    key: ['so', order.pk, 'part-stock', line.part],
    endpoint: ApiEndpoints.stock_item_list,
    params: {
      part: line.part,
      in_stock: true,
      available: true,
      location_detail: true,
      limit: 50
    }
  });

  const stockItems: any[] = stockQuery.data?.results ?? [];

  const refresh = () => {
    allocationsQuery.refetch();
    stockQuery.refetch();
    onChanged();
  };

  const removeMutation = useMutation({
    mutationFn: async (pk: number) =>
      api.delete(apiUrl(ApiEndpoints.sales_order_allocation_list, pk)),
    onSuccess: refresh,
    onError: (error) => {
      notifications.show({
        title: 'Could not remove allocation',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

  return (
    <Grid>
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Stack gap='xs'>
          <Text size='sm' fw={600}>
            Allocated ({formatDecimal(Number(line.allocated))} /{' '}
            {formatDecimal(Number(line.quantity))})
          </Text>
          {allocationsQuery.isLoading ? (
            <Loader size='xs' />
          ) : allocations.length === 0 ? (
            <Text size='sm' c='dimmed'>
              Nothing allocated yet
            </Text>
          ) : (
            <Table>
              <Table.Tbody>
                {allocations.map((allocation: any) => (
                  <Table.Tr key={allocation.pk}>
                    <Table.Td>
                      <Text size='sm'>
                        {allocation.location_detail?.pathstring ?? '-'}
                      </Text>
                      {allocation.serial && (
                        <Text size='xs' c='dimmed'>
                          # {allocation.serial}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td w={80}>
                      <Text size='sm'>
                        {formatDecimal(Number(allocation.quantity))}
                      </Text>
                    </Table.Td>
                    <Table.Td w={40}>
                      {editable && (
                        <Tooltip label='Remove allocation'>
                          <ActionIcon
                            variant='subtle'
                            color='red'
                            size='sm'
                            onClick={() => removeMutation.mutate(allocation.pk)}
                            aria-label={`remove-allocation-${allocation.pk}`}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 7 }}>
        <Stack gap='xs'>
          <Text size='sm' fw={600}>
            Available stock in branch
          </Text>
          {stockQuery.isLoading ? (
            <Loader size='xs' />
          ) : stockItems.length === 0 ? (
            <Text size='sm' c='dimmed'>
              No available stock for this part in the branch
            </Text>
          ) : (
            <Table>
              <Table.Tbody>
                {stockItems.map((item) => (
                  <StockAllocateRow
                    key={item.pk}
                    order={order}
                    line={line}
                    item={item}
                    remaining={remaining}
                    editable={editable}
                    ensureShipment={ensureShipment}
                    onAllocated={refresh}
                  />
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Grid.Col>
    </Grid>
  );
}

function StockAllocateRow({
  order,
  line,
  item,
  remaining,
  editable,
  ensureShipment,
  onAllocated
}: {
  order: any;
  line: any;
  item: any;
  remaining: number;
  editable: boolean;
  ensureShipment: () => Promise<number | null>;
  onAllocated: () => void;
}) {
  const api = useApi();

  const availableQuantity =
    Number(item.quantity) - Number(item.allocated ?? 0);

  const [quantity, setQuantity] = useState<number | ''>(
    Math.min(remaining || 1, availableQuantity)
  );

  const allocateMutation = useMutation({
    mutationFn: async () => {
      const shipment = await ensureShipment();

      return api.post(
        apiUrl(ApiEndpoints.sales_order_allocate, order.pk),
        {
          items: [
            {
              line_item: line.pk,
              stock_item: item.pk,
              quantity: quantity
            }
          ],
          shipment: shipment
        }
      );
    },
    onSuccess: onAllocated,
    onError: (error) => {
      notifications.show({
        title: 'Allocation failed',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

  return (
    <Table.Tr>
      <Table.Td>
        <Text size='sm'>{item.location_detail?.pathstring ?? '-'}</Text>
        {item.serial ? (
          <Text size='xs' c='dimmed'>
            # {item.serial}
          </Text>
        ) : (
          item.batch && (
            <Text size='xs' c='dimmed'>
              {item.batch}
            </Text>
          )
        )}
      </Table.Td>
      <Table.Td w={110}>
        <Text size='sm'>{formatDecimal(availableQuantity)} avail</Text>
      </Table.Td>
      <Table.Td w={120}>
        {editable && (
          <NumberInput
            size='xs'
            value={quantity}
            min={0}
            max={Math.min(availableQuantity, remaining || availableQuantity)}
            onChange={(val) =>
              setQuantity(typeof val === 'number' ? val : '')
            }
            aria-label={`allocate-quantity-${item.pk}`}
          />
        )}
      </Table.Td>
      <Table.Td w={100}>
        {editable && (
          <Group justify='flex-end'>
            <Button
              size='compact-xs'
              variant='light'
              onClick={() => allocateMutation.mutate()}
              loading={allocateMutation.isPending}
              disabled={quantity === '' || Number(quantity) <= 0}
              data-testid={`allocate-stock-${item.pk}`}
            >
              Allocate
            </Button>
          </Group>
        )}
      </Table.Td>
    </Table.Tr>
  );
}
