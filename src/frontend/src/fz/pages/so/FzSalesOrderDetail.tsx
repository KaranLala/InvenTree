import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Divider,
  Group,
  Loader,
  Stack,
  Text,
  Title,
  Tooltip
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconExternalLink } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { UserRoles } from '@lib/enums/Roles';
import { apiUrl } from '@lib/functions/Api';
import { StatusRenderer } from '../../../components/render/StatusRenderer';
import { useApi } from '../../../contexts/ApiContext';
import { formatCurrency } from '../../../defaults/formatters';
import { useSalesOrderFields } from '../../../forms/SalesOrderForms';
import { useEditApiFormModal } from '../../../hooks/UseForm';
import { useUserState } from '../../../states/UserState';
import { extractErrorMessage } from '../../api/errors';
import { SO_EDITABLE_STATUSES, soActions } from '../../api/soStatus';
import { fzKey, listResults, useBranchQuery } from '../../api/useBranchQuery';
import OrderPartyCard from '../../components/OrderPartyCard';
import { useBranchState } from '../../state/BranchState';
import LineItemGrid from './LineItemGrid';
import ShipmentPanel from './ShipmentPanel';

/**
 * Single-page sales order: header strip (customer, status, tax totals,
 * status actions), inline-editable line grid with per-line allocation,
 * and the shipment panel — no tabs.
 */
export default function FzSalesOrderDetail() {
  const { id } = useParams();
  const orderId = Number(id);

  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useUserState();
  const branchId = useBranchState((s) => s.activeBranchId);

  const orderQuery = useBranchQuery({
    key: ['so', orderId, 'detail'],
    endpoint: ApiEndpoints.sales_order_list,
    pk: orderId,
    params: {
      customer_detail: true,
      contact_detail: true,
      address_detail: true
    },
    scoped: false
  });

  const order = orderQuery.data;

  const shipmentsQuery = useBranchQuery({
    key: ['so', orderId, 'shipments'],
    endpoint: ApiEndpoints.sales_order_shipment_list,
    params: { order: orderId },
    scoped: false
  });

  const shipments = listResults(shipmentsQuery.data);

  const invalidateAll = () => {
    queryClient.invalidateQueries({
      queryKey: fzKey(branchId, 'so', orderId)
    });
    queryClient.invalidateQueries({
      queryKey: fzKey(branchId, 'sales-orders')
    });
  };

  const orderFields = useSalesOrderFields({});

  // Focused editor: only the customer / contact / address of the order
  const partyFields = useMemo(
    () => ({
      customer: orderFields.customer,
      contact: orderFields.contact,
      address: orderFields.address
    }),
    [orderFields]
  );

  const editOrder = useEditApiFormModal({
    url: ApiEndpoints.sales_order_list,
    pk: orderId,
    title: 'Edit Customer',
    fields: partyFields,
    onFormSuccess: invalidateAll
  });

  const actionMutation = useMutation({
    mutationFn: async (endpoint: ApiEndpoints) =>
      api.post(apiUrl(endpoint, orderId), {}),
    onSuccess: invalidateAll,
    onError: (error) => {
      notifications.show({
        title: 'Action failed',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

  /**
   * Return a pending shipment for allocations, creating the first
   * one lazily. Allocation works without a shipment, but assigning one
   * up front keeps the one-shipment happy path a single click.
   */
  const ensureShipment = async (): Promise<number | null> => {
    const pending = shipments.find((s: any) => !s.shipment_date);

    if (pending) {
      return pending.pk;
    }

    try {
      const response = await api.post(
        apiUrl(ApiEndpoints.sales_order_shipment_list),
        {
          order: orderId,
          reference: String(shipments.length + 1)
        }
      );
      shipmentsQuery.refetch();
      return response.data?.pk ?? null;
    } catch {
      // Allocation without a shipment is still valid
      return null;
    }
  };

  if (orderQuery.isLoading) {
    return (
      <Center h='60vh'>
        <Loader />
      </Center>
    );
  }

  if (!order) {
    return (
      <Center h='60vh'>
        <Text c='dimmed'>Sales order not found</Text>
      </Center>
    );
  }

  const editable =
    SO_EDITABLE_STATUSES.includes(order.status) &&
    user.hasChangeRole(UserRoles.sales_order);

  return (
    <Stack data-testid='fz-so-detail'>
      {editOrder.modal}
      <Group justify='space-between' wrap='nowrap' align='flex-start'>
        <Group gap='sm' wrap='nowrap'>
          <ActionIcon
            variant='subtle'
            onClick={() => navigate('/b/so/')}
            aria-label='back-to-orders'
          >
            <IconArrowLeft size={20} />
          </ActionIcon>
          <div>
            <Group gap='sm'>
              <Title order={3}>{order.reference}</Title>
              <StatusRenderer
                status={order.status_custom_key ?? order.status}
                type={ModelType.salesorder}
              />
              {order.tenant_detail && (
                <Badge variant='light'>{order.tenant_detail.name}</Badge>
              )}
            </Group>
            <Group gap='xs'>
              <Text size='sm' fw={500}>
                {order.customer_detail?.name}
              </Text>
              {order.description && (
                <Text size='sm' c='dimmed'>
                  — {order.description}
                </Text>
              )}
              {order.target_date && (
                <Text size='sm' c='dimmed'>
                  · due {order.target_date}
                </Text>
              )}
            </Group>
          </div>
        </Group>
        <Group gap='xs' wrap='nowrap'>
          {soActions(order).map((action) => (
            <Button
              key={action.key}
              size='compact-sm'
              color={action.color}
              variant={action.variant ?? 'filled'}
              loading={actionMutation.isPending}
              disabled={!user.hasChangeRole(UserRoles.sales_order)}
              onClick={() => {
                if (!action.confirm || window.confirm(action.confirm)) {
                  actionMutation.mutate(action.endpoint);
                }
              }}
              data-testid={`fz-so-action-${action.key}`}
            >
              {action.label}
            </Button>
          ))}
          <Tooltip label='Open in InvenTree'>
            <ActionIcon
              variant='subtle'
              onClick={() => navigate(`/sales/sales-order/${orderId}`)}
              aria-label='open-in-inventree'
            >
              <IconExternalLink size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <OrderPartyCard
        label='Customer'
        company={order.customer_detail}
        contact={order.contact_detail}
        address={order.address_detail}
        canEdit={user.hasChangeRole(UserRoles.sales_order)}
        onEdit={editOrder.open}
        testId='fz-so-customer'
      />

      <Card withBorder p='sm'>
        <Group gap='xl'>
          <div>
            <Text size='xs' c='dimmed'>
              Subtotal
            </Text>
            <Text fw={600}>
              {formatCurrency(order.subtotal, {
                currency: order.order_currency
              })}
            </Text>
          </div>
          <div>
            <Text size='xs' c='dimmed'>
              Tax{order.tax_rate ? ` (${Number(order.tax_rate)}%)` : ''}
              {order.tax_inclusive ? ' · inclusive' : ''}
            </Text>
            <Text fw={600}>
              {formatCurrency(order.tax_amount, {
                currency: order.order_currency
              })}
            </Text>
          </div>
          <div>
            <Text size='xs' c='dimmed'>
              Total (incl. tax)
            </Text>
            <Text fw={700} data-testid='fz-so-total'>
              {formatCurrency(order.total_with_tax, {
                currency: order.order_currency
              })}
            </Text>
          </div>
          <div>
            <Text size='xs' c='dimmed'>
              Lines complete
            </Text>
            <Text fw={600}>
              {order.completed_lines} / {order.line_items}
            </Text>
          </div>
        </Group>
      </Card>

      <LineItemGrid
        order={order}
        editable={editable}
        ensureShipment={ensureShipment}
      />

      <Divider />

      <ShipmentPanel
        shipments={shipments}
        loading={shipmentsQuery.isLoading}
        editable={editable}
        onChanged={invalidateAll}
      />
    </Stack>
  );
}
