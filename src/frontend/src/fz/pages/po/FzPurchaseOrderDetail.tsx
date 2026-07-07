import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Card,
  Center,
  Combobox,
  Group,
  Loader,
  NumberInput,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
  useCombobox
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconExternalLink,
  IconPackageImport,
  IconTrash
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { UserRoles } from '@lib/enums/Roles';
import { apiUrl } from '@lib/functions/Api';
import { formatDecimal } from '@lib/functions/Formatting';
import { ProgressBar } from '@lib/components/ProgressBar';
import { StatusRenderer } from '../../../components/render/StatusRenderer';
import { useApi } from '../../../contexts/ApiContext';
import { formatCurrency } from '../../../defaults/formatters';
import { useUserState } from '../../../states/UserState';
import { extractErrorMessage } from '../../api/errors';
import { PO_EDITABLE_STATUSES, PO_STATUS, poActions } from '../../api/poStatus';
import { effectiveOrderCurrency } from '../../api/soStatus';
import { fzKey, useBranchQuery } from '../../api/useBranchQuery';
import { useBranchState } from '../../state/BranchState';
import { EditableNumberCell } from '../so/LineItemGrid';
import ReceiveDrawer from './ReceiveDrawer';

/**
 * Single-page purchase order: header strip with status actions,
 * inline-editable line grid with received progress, and a receive
 * drawer that lands stock in a branch location.
 */
export default function FzPurchaseOrderDetail() {
  const { id } = useParams();
  const orderId = Number(id);

  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useUserState();
  const branchId = useBranchState((s) => s.activeBranchId);

  const orderQuery = useBranchQuery({
    key: ['po', orderId, 'detail'],
    endpoint: ApiEndpoints.purchase_order_list,
    pk: orderId,
    params: { supplier_detail: true },
    scoped: false
  });

  const order = orderQuery.data;

  const linesQuery = useBranchQuery({
    key: ['po', orderId, 'lines'],
    endpoint: ApiEndpoints.purchase_order_line_list,
    params: { order: orderId, part_detail: true },
    scoped: false
  });

  const lines: any[] = useMemo(() => {
    const data = linesQuery.data;
    return Array.isArray(data) ? data : (data?.results ?? []);
  }, [linesQuery.data]);

  const [receiveOpen, setReceiveOpen] = useState(false);

  const invalidateOrder = () => {
    queryClient.invalidateQueries({
      queryKey: fzKey(branchId, 'po', orderId)
    });
    queryClient.invalidateQueries({
      queryKey: fzKey(branchId, 'purchase-orders')
    });
  };

  const actionMutation = useMutation({
    mutationFn: async (endpoint: ApiEndpoints) =>
      api.post(apiUrl(endpoint, orderId), {}),
    onSuccess: invalidateOrder,
    onError: (error) => {
      notifications.show({
        title: 'Action failed',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

  const editMutation = useMutation({
    mutationFn: async ({
      pk,
      values
    }: {
      pk: number;
      values: Record<string, any>;
    }) => api.patch(apiUrl(ApiEndpoints.purchase_order_line_list, pk), values),
    onSettled: invalidateOrder,
    onError: (error) => {
      notifications.show({
        title: 'Update failed',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (pk: number) =>
      api.delete(apiUrl(ApiEndpoints.purchase_order_line_list, pk)),
    onSuccess: invalidateOrder,
    onError: (error) => {
      notifications.show({
        title: 'Delete failed',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

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
        <Text c='dimmed'>Purchase order not found</Text>
      </Center>
    );
  }

  const editable =
    PO_EDITABLE_STATUSES.includes(order.status) &&
    user.hasChangeRole(UserRoles.purchase_order);

  const receivable =
    order.status === PO_STATUS.PLACED &&
    user.hasChangeRole(UserRoles.purchase_order) &&
    lines.some((line) => Number(line.received) < Number(line.quantity));

  return (
    <Stack data-testid='fz-po-detail'>
      <Group justify='space-between' wrap='nowrap' align='flex-start'>
        <Group gap='sm' wrap='nowrap'>
          <ActionIcon
            variant='subtle'
            onClick={() => navigate('/b/po/')}
            aria-label='back-to-orders'
          >
            <IconArrowLeft size={20} />
          </ActionIcon>
          <div>
            <Group gap='sm'>
              <Title order={3}>{order.reference}</Title>
              <StatusRenderer
                status={order.status_custom_key ?? order.status}
                type={ModelType.purchaseorder}
              />
              {order.tenant_detail && (
                <Badge variant='light'>{order.tenant_detail.name}</Badge>
              )}
            </Group>
            <Group gap='xs'>
              <Text size='sm' fw={500}>
                {order.supplier_detail?.name}
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
          {receivable && (
            <Button
              size='compact-sm'
              color='teal'
              leftSection={<IconPackageImport size={16} />}
              onClick={() => setReceiveOpen(true)}
              data-testid='fz-po-receive'
            >
              Receive stock
            </Button>
          )}
          {poActions(order).map((action) => (
            <Button
              key={action.key}
              size='compact-sm'
              color={action.color}
              variant={action.variant ?? 'filled'}
              loading={actionMutation.isPending}
              disabled={!user.hasChangeRole(UserRoles.purchase_order)}
              onClick={() => {
                if (!action.confirm || window.confirm(action.confirm)) {
                  actionMutation.mutate(action.endpoint);
                }
              }}
              data-testid={`fz-po-action-${action.key}`}
            >
              {action.label}
            </Button>
          ))}
          <Tooltip label='Open in InvenTree'>
            <ActionIcon
              variant='subtle'
              onClick={() => navigate(`/purchasing/purchase-order/${orderId}`)}
              aria-label='open-in-inventree'
            >
              <IconExternalLink size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Card withBorder p='sm'>
        <Group gap='xl'>
          <div>
            <Text size='xs' c='dimmed'>
              Total
            </Text>
            <Text fw={700} data-testid='fz-po-total'>
              {formatCurrency(order.total_price, {
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

      <Text fw={600}>Line items</Text>
      <Table data-testid='fz-po-lines'>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Part</Table.Th>
            <Table.Th w={130}>Quantity</Table.Th>
            <Table.Th w={160}>Unit price</Table.Th>
            <Table.Th w={180}>Received</Table.Th>
            <Table.Th w={50} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {linesQuery.isLoading && (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Loader size='sm' />
              </Table.Td>
            </Table.Tr>
          )}
          {lines.map((line) => (
            <Table.Tr key={line.pk} data-testid={`fz-po-line-${line.pk}`}>
              <Table.Td>
                <Group gap='xs' wrap='nowrap'>
                  <Avatar
                    src={line.part_detail?.thumbnail}
                    size='sm'
                    radius='sm'
                  />
                  <div>
                    <Text size='sm' fw={500}>
                      {line.part_detail?.full_name ?? line.internal_part_name}
                    </Text>
                    <Text size='xs' c='dimmed'>
                      {line.supplier_part_detail?.SKU}
                    </Text>
                  </div>
                </Group>
              </Table.Td>
              <Table.Td>
                <EditableNumberCell
                  value={Number(line.quantity)}
                  editable={editable}
                  min={1}
                  onCommit={(value) =>
                    editMutation.mutate({
                      pk: line.pk,
                      values: { quantity: value }
                    })
                  }
                  ariaLabel={`edit-quantity-${line.pk}`}
                />
              </Table.Td>
              <Table.Td>
                <EditableNumberCell
                  value={Number(line.purchase_price)}
                  editable={editable}
                  min={0}
                  decimals={2}
                  prefix={line.purchase_price_currency}
                  onCommit={(value) =>
                    editMutation.mutate({
                      pk: line.pk,
                      values: { purchase_price: value }
                    })
                  }
                  ariaLabel={`edit-price-${line.pk}`}
                />
              </Table.Td>
              <Table.Td>
                <ProgressBar
                  value={Number(line.received)}
                  maximum={Number(line.quantity)}
                  progressLabel
                />
              </Table.Td>
              <Table.Td>
                {editable && Number(line.received) === 0 && (
                  <Tooltip label='Remove line'>
                    <ActionIcon
                      variant='subtle'
                      color='red'
                      onClick={() => deleteMutation.mutate(line.pk)}
                      aria-label={`delete-line-${line.pk}`}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
          {editable && (
            <PoGhostRow order={order} onCreated={invalidateOrder} />
          )}
        </Table.Tbody>
      </Table>

      <ReceiveDrawer
        order={order}
        lines={lines}
        opened={receiveOpen}
        onClose={() => {
          setReceiveOpen(false);
          invalidateOrder();
        }}
      />
    </Stack>
  );
}

/** Ghost row: supplier part search + quantity + unit price → POST. */
function PoGhostRow({
  order,
  onCreated
}: {
  order: any;
  onCreated: () => void;
}) {
  const api = useApi();

  const [supplierPart, setSupplierPart] = useState<any>(null);
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [price, setPrice] = useState<number | ''>('');

  const currency = effectiveOrderCurrency(order);

  const createMutation = useMutation({
    mutationFn: async () =>
      api.post(apiUrl(ApiEndpoints.purchase_order_line_list), {
        order: order.pk,
        part: supplierPart.pk,
        quantity: quantity,
        purchase_price: price === '' ? undefined : price,
        purchase_price_currency: currency
      }),
    onSuccess: () => {
      setSupplierPart(null);
      setQuantity(1);
      setPrice('');
      onCreated();
    },
    onError: (error) => {
      notifications.show({
        title: 'Could not add line',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

  const submit = () => {
    if (supplierPart && quantity !== '' && Number(quantity) > 0) {
      createMutation.mutate();
    }
  };

  return (
    <Table.Tr data-testid='fz-po-ghost-row'>
      <Table.Td>
        <SupplierPartCombobox
          supplierId={order.supplier}
          value={supplierPart}
          onChange={setSupplierPart}
        />
      </Table.Td>
      <Table.Td>
        <NumberInput
          size='xs'
          value={quantity}
          min={1}
          onChange={(val) => setQuantity(typeof val === 'number' ? val : '')}
          onKeyDown={(event) => event.key === 'Enter' && submit()}
          aria-label='new-line-quantity'
        />
      </Table.Td>
      <Table.Td>
        <NumberInput
          size='xs'
          value={price}
          min={0}
          decimalScale={2}
          placeholder='Unit price'
          onChange={(val) => setPrice(typeof val === 'number' ? val : '')}
          onKeyDown={(event) => event.key === 'Enter' && submit()}
          aria-label='new-line-price'
        />
      </Table.Td>
      <Table.Td />
      <Table.Td>
        <Button
          size='compact-xs'
          onClick={submit}
          loading={createMutation.isPending}
          disabled={!supplierPart || quantity === ''}
          data-testid='fz-po-add-line'
        >
          Add
        </Button>
      </Table.Td>
    </Table.Tr>
  );
}

/** Async supplier part search, limited to the order's supplier. */
function SupplierPartCombobox({
  supplierId,
  value,
  onChange
}: {
  supplierId: number;
  value: any;
  onChange: (part: any | null) => void;
}) {
  const api = useApi();
  const combobox = useCombobox();

  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 250);
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (debouncedQuery.length < 1) {
      setOptions([]);
      return;
    }

    let stale = false;
    setLoading(true);

    api
      .get(apiUrl(ApiEndpoints.supplier_part_list), {
        params: {
          search: debouncedQuery,
          supplier: supplierId,
          active: true,
          part_detail: true,
          limit: 20
        }
      })
      .then((response) => {
        if (!stale) {
          const data = response.data;
          setOptions(Array.isArray(data) ? data : (data?.results ?? []));
        }
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });

    return () => {
      stale = true;
    };
  }, [debouncedQuery, supplierId, api]);

  const label = (option: any) =>
    `${option.part_detail?.full_name ?? option.SKU} (${option.SKU})`;

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(pk) => {
        const selected = options.find((option) => String(option.pk) === pk);
        onChange(selected ?? null);
        setQuery('');
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <TextInput
          size='xs'
          placeholder='Add supplier part...'
          value={value ? label(value) : query}
          rightSection={loading ? <Loader size='xs' /> : undefined}
          onChange={(event) => {
            onChange(null);
            setQuery(event.currentTarget.value);
            combobox.openDropdown();
          }}
          onFocus={() => combobox.openDropdown()}
          aria-label='new-line-part'
        />
      </Combobox.Target>
      <Combobox.Dropdown hidden={options.length === 0}>
        <Combobox.Options>
          {options.map((option) => (
            <Combobox.Option value={String(option.pk)} key={option.pk}>
              <Group gap='xs' wrap='nowrap'>
                <Avatar
                  src={option.part_detail?.thumbnail}
                  size='xs'
                  radius='sm'
                />
                <Text size='sm'>{label(option)}</Text>
              </Group>
            </Combobox.Option>
          ))}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
