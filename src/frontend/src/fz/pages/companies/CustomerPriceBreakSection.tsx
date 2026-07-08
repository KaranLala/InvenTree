import { ActionIcon, Loader, Table, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { UserRoles } from '@lib/enums/Roles';
import { apiUrl } from '@lib/functions/Api';
import { useApi } from '../../../contexts/ApiContext';
import { formatCurrency } from '../../../defaults/formatters';
import { useUserState } from '../../../states/UserState';
import { extractErrorMessage } from '../../api/errors';
import {
  fzGlobalKey,
  listResults,
  useGlobalQuery
} from '../../api/useBranchQuery';

/**
 * All price breaks specific to one customer, across parts. View and
 * delete only — new breaks are added from the Item master, next to
 * the part's generic breaks.
 */
export default function CustomerPriceBreakSection({
  customerId
}: {
  customerId: number;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const user = useUserState();

  const breaksQuery = useGlobalQuery({
    key: ['company', customerId, 'price-breaks'],
    endpoint: ApiEndpoints.part_pricing_sale,
    params: { customer: customerId, limit: 200 }
  });

  // The endpoint cannot order by part name — sort client-side
  const breaks: any[] = useMemo(
    () =>
      [...listResults(breaksQuery.data)].sort(
        (a, b) =>
          (a.part_detail?.full_name ?? '').localeCompare(
            b.part_detail?.full_name ?? ''
          ) || Number(a.quantity) - Number(b.quantity)
      ),
    [breaksQuery.data]
  );

  const deleteMutation = useMutation({
    mutationFn: async (pk: number) =>
      api.delete(apiUrl(ApiEndpoints.part_pricing_sale, pk)),
    onSuccess: (_data, pk) => {
      queryClient.invalidateQueries({
        queryKey: fzGlobalKey('company', customerId, 'price-breaks')
      });
      // Keep the per-part price break tables in the Item master honest
      queryClient.invalidateQueries({ queryKey: fzGlobalKey('price-breaks') });
    },
    onError: (error) => {
      notifications.show({
        title: 'Could not delete price break',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

  // Price breaks belong to the part ruleset, not the order rulesets
  const canDelete = user.hasDeleteRole(UserRoles.part);

  if (breaksQuery.isLoading) {
    return <Loader size='xs' />;
  }

  if (breaks.length === 0) {
    return (
      <Text size='sm' c='dimmed'>
        No customer-specific price breaks. Add them from the Item master.
      </Text>
    );
  }

  return (
    <>
      <Table data-testid='fz-customer-price-breaks'>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Part</Table.Th>
            <Table.Th w={110}>Quantity</Table.Th>
            <Table.Th w={150}>Price</Table.Th>
            <Table.Th w={50} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {breaks.map((priceBreak) => (
            <Table.Tr key={priceBreak.pk}>
              <Table.Td>
                <Text size='sm' fw={500}>
                  {priceBreak.part_detail?.full_name ??
                    priceBreak.part_detail?.name ??
                    '-'}
                </Text>
              </Table.Td>
              <Table.Td>{Number(priceBreak.quantity)}</Table.Td>
              <Table.Td>
                {formatCurrency(priceBreak.price, {
                  currency: priceBreak.price_currency
                })}
              </Table.Td>
              <Table.Td>
                {canDelete && (
                  <Tooltip label='Delete price break'>
                    <ActionIcon
                      variant='subtle'
                      color='red'
                      size='sm'
                      onClick={() => deleteMutation.mutate(priceBreak.pk)}
                      aria-label={`customer-pb-delete-${priceBreak.pk}`}
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
      <Text size='xs' c='dimmed'>
        Add price breaks from the Item master
      </Text>
    </>
  );
}
