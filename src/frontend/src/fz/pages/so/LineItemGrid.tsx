import {
  ActionIcon,
  Avatar,
  Button,
  Combobox,
  Group,
  Loader,
  NumberInput,
  Table,
  Text,
  TextInput,
  Tooltip,
  useCombobox
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconChevronDown,
  IconChevronRight,
  IconTrash,
  IconWand
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { apiUrl } from '@lib/functions/Api';
import { formatDecimal } from '@lib/functions/Formatting';
import { ProgressBar } from '@lib/components/ProgressBar';
import { useApi } from '../../../contexts/ApiContext';
import { formatCurrency } from '../../../defaults/formatters';
import { extractErrorMessage } from '../../api/errors';
import { pickPriceBreak, priceBreakHint } from '../../api/priceBreaks';
import { effectiveOrderCurrency } from '../../api/soStatus';
import { fzKey, useBranchQuery } from '../../api/useBranchQuery';
import { useBranchState } from '../../state/BranchState';
import AllocationRow from './AllocationPopover';

/**
 * Inline-editable line item grid for a sales order.
 *
 * - Quantity and unit price edit in place (Enter commits, Esc reverts)
 *   with optimistic updates; the order query is refetched on settle
 *   because the server recomputes tax totals.
 * - A permanent ghost row at the bottom adds new lines: pick a part,
 *   the sale price auto-fills from the customer-aware price break.
 * - Each row expands to an allocation panel (branch-scoped stock).
 */
export default function LineItemGrid({
  order,
  editable,
  ensureShipment
}: {
  order: any;
  editable: boolean;
  ensureShipment: () => Promise<number | null>;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const branchId = useBranchState((s) => s.activeBranchId);

  const linesKey = fzKey(branchId, 'so', order.pk, 'lines');

  const { data, isLoading } = useBranchQuery({
    key: ['so', order.pk, 'lines'],
    endpoint: ApiEndpoints.sales_order_line_list,
    params: { order: order.pk, part_detail: true },
    scoped: false
  });

  const lines: any[] = useMemo(
    () => (Array.isArray(data) ? data : (data?.results ?? [])),
    [data]
  );

  const [expanded, setExpanded] = useState<number | null>(null);

  // Invalidate everything belonging to this order (lines, detail,
  // shipments, allocations) — the server recomputes totals on edit
  const invalidateOrder = () => {
    queryClient.invalidateQueries({
      queryKey: fzKey(branchId, 'so', order.pk)
    });
  };

  // Optimistic inline edit of a line field (quantity / sale_price)
  const editMutation = useMutation({
    mutationFn: async ({
      pk,
      values
    }: {
      pk: number;
      values: Record<string, any>;
    }) => api.patch(apiUrl(ApiEndpoints.sales_order_line_list, pk), values),
    onMutate: async ({ pk, values }) => {
      await queryClient.cancelQueries({ queryKey: linesKey });
      const previous = queryClient.getQueryData(linesKey);

      queryClient.setQueryData(linesKey, (current: any) => {
        const patch = (rows: any[]) =>
          rows.map((row) => (row.pk === pk ? { ...row, ...values } : row));
        if (Array.isArray(current)) return patch(current);
        if (current?.results) {
          return { ...current, results: patch(current.results) };
        }
        return current;
      });

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(linesKey, context.previous);
      }
      notifications.show({
        title: 'Update failed',
        message: extractErrorMessage(error),
        color: 'red'
      });
    },
    onSettled: invalidateOrder
  });

  const deleteMutation = useMutation({
    mutationFn: async (pk: number) =>
      api.delete(apiUrl(ApiEndpoints.sales_order_line_list, pk)),
    onSuccess: invalidateOrder,
    onError: (error) => {
      notifications.show({
        title: 'Delete failed',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

  const autoAllocate = useMutation({
    mutationFn: async () =>
      api.post(apiUrl(ApiEndpoints.sales_order_auto_allocate, order.pk), {}),
    onSuccess: () => {
      notifications.show({
        title: 'Auto-allocation started',
        message: 'Stock is being allocated in the background',
        color: 'blue'
      });
      // Background task: refetch after a short delay
      setTimeout(invalidateOrder, 2500);
    },
    onError: (error) => {
      notifications.show({
        title: 'Auto-allocation failed',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

  return (
    <>
      <Group justify='space-between'>
        <Text fw={600}>Line items</Text>
        {editable && lines.length > 0 && (
          <Button
            size='compact-sm'
            variant='light'
            leftSection={<IconWand size={16} />}
            onClick={() => autoAllocate.mutate()}
            loading={autoAllocate.isPending}
          >
            Auto-allocate
          </Button>
        )}
      </Group>
      <Table data-testid='fz-so-lines'>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={28} />
            <Table.Th>Part</Table.Th>
            <Table.Th w={130}>Quantity</Table.Th>
            <Table.Th w={160}>Unit price</Table.Th>
            <Table.Th w={140}>Incl. tax</Table.Th>
            <Table.Th w={180}>Allocated</Table.Th>
            <Table.Th w={90}>Shipped</Table.Th>
            <Table.Th w={50} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading && (
            <Table.Tr>
              <Table.Td colSpan={8}>
                <Loader size='sm' />
              </Table.Td>
            </Table.Tr>
          )}
          {lines.map((line) => (
            <LineRow
              key={line.pk}
              order={order}
              line={line}
              editable={editable}
              expanded={expanded === line.pk}
              onToggleExpand={() =>
                setExpanded(expanded === line.pk ? null : line.pk)
              }
              onEdit={(values) =>
                editMutation.mutate({ pk: line.pk, values: values })
              }
              onDelete={() => deleteMutation.mutate(line.pk)}
              ensureShipment={ensureShipment}
              onChanged={invalidateOrder}
            />
          ))}
          {editable && (
            <GhostRow order={order} onCreated={invalidateOrder} />
          )}
        </Table.Tbody>
      </Table>
    </>
  );
}

function LineRow({
  order,
  line,
  editable,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  ensureShipment,
  onChanged
}: {
  order: any;
  line: any;
  editable: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: (values: Record<string, any>) => void;
  onDelete: () => void;
  ensureShipment: () => Promise<number | null>;
  onChanged: () => void;
}) {
  return (
    <>
      <Table.Tr data-testid={`fz-so-line-${line.pk}`}>
        <Table.Td>
          <ActionIcon
            variant='subtle'
            size='sm'
            onClick={onToggleExpand}
            aria-label={`expand-line-${line.pk}`}
          >
            {expanded ? (
              <IconChevronDown size={16} />
            ) : (
              <IconChevronRight size={16} />
            )}
          </ActionIcon>
        </Table.Td>
        <Table.Td>
          <Group gap='xs' wrap='nowrap'>
            <Avatar src={line.part_detail?.thumbnail} size='sm' radius='sm' />
            <div>
              <Text size='sm' fw={500}>
                {line.part_detail?.full_name}
              </Text>
              {line.part_detail?.IPN && (
                <Text size='xs' c='dimmed'>
                  {line.part_detail.IPN}
                </Text>
              )}
            </div>
          </Group>
        </Table.Td>
        <Table.Td>
          <EditableNumberCell
            value={Number(line.quantity)}
            editable={editable}
            min={1}
            onCommit={(value) => onEdit({ quantity: value })}
            ariaLabel={`edit-quantity-${line.pk}`}
          />
        </Table.Td>
        <Table.Td>
          <EditableNumberCell
            value={Number(line.sale_price)}
            editable={editable}
            min={0}
            decimals={2}
            prefix={line.sale_price_currency}
            onCommit={(value) => onEdit({ sale_price: value })}
            ariaLabel={`edit-price-${line.pk}`}
          />
        </Table.Td>
        <Table.Td>
          <Text size='sm' c='dimmed'>
            {formatCurrency(line.price_with_tax, {
              currency: line.sale_price_currency
            })}
          </Text>
        </Table.Td>
        <Table.Td>
          <ProgressBar
            value={Number(line.allocated)}
            maximum={Number(line.quantity)}
            progressLabel
          />
        </Table.Td>
        <Table.Td>
          <Text size='sm'>
            {formatDecimal(Number(line.shipped))} /{' '}
            {formatDecimal(Number(line.quantity))}
          </Text>
        </Table.Td>
        <Table.Td>
          {editable && (
            <Tooltip label='Remove line'>
              <ActionIcon
                variant='subtle'
                color='red'
                onClick={onDelete}
                aria-label={`delete-line-${line.pk}`}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Table.Td>
      </Table.Tr>
      {expanded && (
        <Table.Tr>
          <Table.Td colSpan={8} p='sm' bg='var(--mantine-color-default-hover)'>
            <AllocationRow
              order={order}
              line={line}
              editable={editable}
              ensureShipment={ensureShipment}
              onChanged={onChanged}
            />
          </Table.Td>
        </Table.Tr>
      )}
    </>
  );
}

/** Click-to-edit numeric cell: Enter/blur commits, Esc reverts. */
export function EditableNumberCell({
  value,
  editable,
  min,
  decimals,
  prefix,
  onCommit,
  ariaLabel
}: {
  value: number;
  editable: boolean;
  min: number;
  decimals?: number;
  prefix?: string;
  onCommit: (value: number) => void;
  ariaLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number | ''>(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    setEditing(false);
    if (draft !== '' && Number(draft) !== value) {
      onCommit(Number(draft));
    } else {
      setDraft(value);
    }
  };

  if (!editable) {
    return (
      <Text size='sm'>
        {prefix ? `${prefix} ` : ''}
        {formatDecimal(value, { digits: decimals ?? 6 })}
      </Text>
    );
  }

  if (!editing) {
    return (
      <TextInput
        size='xs'
        variant='unstyled'
        readOnly
        value={`${prefix ? `${prefix} ` : ''}${formatDecimal(value, { digits: decimals ?? 6 })}`}
        onFocus={() => setEditing(true)}
        onClick={() => setEditing(true)}
        aria-label={ariaLabel}
        styles={{ input: { cursor: 'pointer', fontWeight: 500 } }}
      />
    );
  }

  return (
    <NumberInput
      size='xs'
      value={draft}
      min={min}
      autoFocus
      onChange={(val) => setDraft(typeof val === 'number' ? val : '')}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit();
        } else if (event.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
      aria-label={`${ariaLabel}-input`}
    />
  );
}

/** Ghost row: part search + quantity + auto-priced unit price → POST. */
function GhostRow({
  order,
  onCreated
}: {
  order: any;
  onCreated: () => void;
}) {
  const api = useApi();

  const [part, setPart] = useState<any>(null);
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [price, setPrice] = useState<number | ''>('');
  const [priceHint, setPriceHint] = useState<string | null>(null);
  const [priceTouched, setPriceTouched] = useState(false);

  const currency = effectiveOrderCurrency(order);

  // Auto-apply the customer-aware price break when part or qty changes
  useEffect(() => {
    if (!part || quantity === '' || priceTouched) {
      return;
    }

    const match = pickPriceBreak(part.price_breaks, {
      customerId: order.customer ?? null,
      currency: currency,
      quantity: Number(quantity)
    });

    if (match) {
      setPrice(Number(match.price));
      setPriceHint(priceBreakHint(match));
    } else {
      setPriceHint(null);
    }
  }, [part, quantity, priceTouched, order.customer, currency]);

  const createMutation = useMutation({
    mutationFn: async () =>
      api.post(apiUrl(ApiEndpoints.sales_order_line_list), {
        order: order.pk,
        part: part.pk,
        quantity: quantity,
        sale_price: price === '' ? undefined : price,
        sale_price_currency: currency
      }),
    onSuccess: () => {
      setPart(null);
      setQuantity(1);
      setPrice('');
      setPriceHint(null);
      setPriceTouched(false);
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
    if (part && quantity !== '' && Number(quantity) > 0) {
      createMutation.mutate();
    }
  };

  return (
    <Table.Tr data-testid='fz-so-ghost-row'>
      <Table.Td />
      <Table.Td>
        <PartSearchCombobox value={part} onChange={setPart} />
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
          description={priceHint ? `price from break (${priceHint})` : ''}
          onChange={(val) => {
            setPrice(typeof val === 'number' ? val : '');
            setPriceTouched(true);
          }}
          onKeyDown={(event) => event.key === 'Enter' && submit()}
          aria-label='new-line-price'
        />
      </Table.Td>
      <Table.Td colSpan={3} />
      <Table.Td>
        <Button
          size='compact-xs'
          onClick={submit}
          loading={createMutation.isPending}
          disabled={!part || quantity === ''}
          data-testid='fz-so-add-line'
        >
          Add
        </Button>
      </Table.Td>
    </Table.Tr>
  );
}

/** Async part search (salable parts, with price breaks in the payload). */
function PartSearchCombobox({
  value,
  onChange
}: {
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
      .get(apiUrl(ApiEndpoints.part_list), {
        params: {
          search: debouncedQuery,
          active: true,
          salable: true,
          price_breaks: true,
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
  }, [debouncedQuery, api]);

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
          placeholder='Add part...'
          value={value ? value.full_name : query}
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
                <Avatar src={option.thumbnail} size='xs' radius='sm' />
                <Text size='sm'>{option.full_name}</Text>
                {option.IPN && (
                  <Text size='xs' c='dimmed'>
                    {option.IPN}
                  </Text>
                )}
              </Group>
            </Combobox.Option>
          ))}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
