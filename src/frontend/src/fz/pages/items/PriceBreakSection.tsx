import {
  ActionIcon,
  Button,
  Group,
  Loader,
  NumberInput,
  Select,
  Table,
  Text,
  Tooltip
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { UserRoles } from '@lib/enums/Roles';
import { apiUrl } from '@lib/functions/Api';
import { useApi } from '../../../contexts/ApiContext';
import { formatCurrency } from '../../../defaults/formatters';
import { useGlobalSettingsState } from '../../../states/SettingsStates';
import { useUserState } from '../../../states/UserState';
import { extractErrorMessage } from '../../api/errors';
import type { PriceBreak } from '../../api/priceBreaks';
import {
  fzGlobalKey,
  listResults,
  useGlobalQuery
} from '../../api/useBranchQuery';

/**
 * Sale price breaks for an item: live add/delete (no inline edit —
 * delete and re-add). An optional customer makes a break
 * customer-specific; these drive the FZ sales order auto-pricing.
 */
export default function PriceBreakSection({ partId }: { partId: number }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const user = useUserState();
  const globalSettings = useGlobalSettingsState();

  const defaultCurrency =
    globalSettings.lookup.INVENTREE_DEFAULT_CURRENCY || 'USD';

  const currencyOptions = useMemo(() => {
    const codes = (globalSettings.lookup.CURRENCY_CODES || defaultCurrency)
      .split(',')
      .map((code: string) => code.trim())
      .filter(Boolean);
    return codes.length > 0 ? codes : [defaultCurrency];
  }, [globalSettings.lookup, defaultCurrency]);

  const [quantity, setQuantity] = useState<number | ''>(1);
  const [price, setPrice] = useState<number | ''>('');
  const [currency, setCurrency] = useState<string>(defaultCurrency);
  const [customer, setCustomer] = useState<string | null>(null);

  const breaksQuery = useGlobalQuery({
    key: ['price-breaks', partId],
    endpoint: ApiEndpoints.part_pricing_sale,
    params: { part: partId, limit: 100 }
  });

  const breaks: PriceBreak[] = listResults(breaksQuery.data);

  const customersQuery = useGlobalQuery({
    key: ['customers'],
    endpoint: ApiEndpoints.company_list,
    params: { is_customer: true, active: true, limit: 100 }
  });

  const customerOptions = useMemo(
    () =>
      listResults(customersQuery.data).map((company: any) => ({
        value: String(company.pk),
        label: company.name
      })),
    [customersQuery.data]
  );

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: fzGlobalKey('price-breaks', partId)
    });

  const addMutation = useMutation({
    mutationFn: async () =>
      api.post(apiUrl(ApiEndpoints.part_pricing_sale), {
        part: partId,
        quantity: quantity,
        price: price,
        price_currency: currency,
        customer: customer ? Number(customer) : undefined
      }),
    onSuccess: () => {
      setQuantity(1);
      setPrice('');
      setCustomer(null);
      invalidate();
    },
    onError: (error) => {
      notifications.show({
        title: 'Could not add price break',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (pk: number) =>
      api.delete(apiUrl(ApiEndpoints.part_pricing_sale, pk)),
    onSuccess: invalidate,
    onError: (error) => {
      notifications.show({
        title: 'Could not delete price break',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

  const canDelete = user.hasDeleteRole(UserRoles.part);
  const canAdd = user.hasAddRole(UserRoles.part);

  return (
    <Table data-testid='fz-item-price-breaks'>
      <Table.Thead>
        <Table.Tr>
          <Table.Th w={110}>Quantity</Table.Th>
          <Table.Th w={150}>Price</Table.Th>
          <Table.Th w={110}>Currency</Table.Th>
          <Table.Th>Customer</Table.Th>
          <Table.Th w={50} />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {breaksQuery.isLoading && (
          <Table.Tr>
            <Table.Td colSpan={5}>
              <Loader size='xs' />
            </Table.Td>
          </Table.Tr>
        )}
        {breaks.map((priceBreak) => (
          <Table.Tr key={priceBreak.pk}>
            <Table.Td>{Number(priceBreak.quantity)}</Table.Td>
            <Table.Td>
              {formatCurrency(priceBreak.price, {
                currency: priceBreak.price_currency
              })}
            </Table.Td>
            <Table.Td>
              <Text size='sm' c='dimmed'>
                {priceBreak.price_currency}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size='sm'>
                {priceBreak.customer_detail?.name ?? 'All customers'}
              </Text>
            </Table.Td>
            <Table.Td>
              {canDelete && (
                <Tooltip label='Delete price break'>
                  <ActionIcon
                    variant='subtle'
                    color='red'
                    size='sm'
                    onClick={() => deleteMutation.mutate(priceBreak.pk)}
                    aria-label={`delete-price-break-${priceBreak.pk}`}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Table.Td>
          </Table.Tr>
        ))}
        {canAdd && (
          <Table.Tr>
            <Table.Td>
              <NumberInput
                size='xs'
                value={quantity}
                min={1}
                onChange={(value) =>
                  setQuantity(typeof value === 'number' ? value : '')
                }
                aria-label='price-break-quantity'
              />
            </Table.Td>
            <Table.Td>
              <NumberInput
                size='xs'
                value={price}
                min={0}
                decimalScale={2}
                placeholder='Unit price'
                onChange={(value) =>
                  setPrice(typeof value === 'number' ? value : '')
                }
                aria-label='price-break-price'
              />
            </Table.Td>
            <Table.Td>
              <Select
                size='xs'
                data={currencyOptions}
                value={currency}
                onChange={(value) => value && setCurrency(value)}
                allowDeselect={false}
                aria-label='price-break-currency'
              />
            </Table.Td>
            <Table.Td>
              <Select
                size='xs'
                data={customerOptions}
                value={customer}
                onChange={setCustomer}
                clearable
                searchable
                placeholder='All customers'
                aria-label='price-break-customer'
              />
            </Table.Td>
            <Table.Td>
              <Button
                size='compact-xs'
                onClick={() => addMutation.mutate()}
                loading={addMutation.isPending}
                disabled={quantity === '' || price === ''}
                data-testid='fz-item-pb-add'
              >
                Add
              </Button>
            </Table.Td>
          </Table.Tr>
        )}
      </Table.Tbody>
    </Table>
  );
}
