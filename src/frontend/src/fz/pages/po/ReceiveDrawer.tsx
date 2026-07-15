import {
  Button,
  Drawer,
  Group,
  NumberInput,
  Stack,
  Table,
  Text,
  TextInput
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { apiUrl } from '@lib/functions/Api';
import { formatDecimal } from '@lib/functions/Formatting';
import { useApi } from '../../../contexts/ApiContext';
import { extractErrorMessage } from '../../api/errors';
import { useInvalidateBranch } from '../../api/useBranchQuery';
import FzLocationSelect from '../../components/FzLocationSelect';

/**
 * Receive purchase order lines into a location of the active branch.
 * Quantities default to the remaining amount per line; a single
 * destination applies to all lines. (Serialized receipt and per-line
 * destinations stay in the classic UI escape hatch.)
 */
export default function ReceiveDrawer({
  order,
  lines,
  opened,
  onClose
}: {
  order: any;
  lines: any[];
  opened: boolean;
  onClose: () => void;
}) {
  const api = useApi();
  const invalidateBranch = useInvalidateBranch();

  const receivable = useMemo(
    () =>
      lines.filter((line) => Number(line.received) < Number(line.quantity)),
    [lines]
  );

  const [quantities, setQuantities] = useState<Record<number, number | ''>>(
    {}
  );
  const [batches, setBatches] = useState<Record<number, string>>({});
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      const initial: Record<number, number | ''> = {};
      for (const line of receivable) {
        initial[line.pk] = Number(line.quantity) - Number(line.received);
      }
      setQuantities(initial);
      setBatches({});
      setDestination(null);
    }
  }, [opened, receivable]);

  const receiveMutation = useMutation({
    mutationFn: async () =>
      api.post(apiUrl(ApiEndpoints.purchase_order_receive, order.pk), {
        items: receivable
          .filter((line) => Number(quantities[line.pk]) > 0)
          .map((line) => ({
            line_item: line.pk,
            quantity: quantities[line.pk],
            batch_code: batches[line.pk] || undefined
          })),
        location: destination
      }),
    onSuccess: () => {
      notifications.show({
        title: 'Stock received',
        message: 'Received items were added to branch stock',
        color: 'green'
      });
      invalidateBranch();
      onClose();
    },
    onError: (error) => {
      notifications.show({
        title: 'Receive failed',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

  const anyQuantity = receivable.some(
    (line) => Number(quantities[line.pk]) > 0
  );

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title='Receive stock'
      position='right'
      size='xl'
    >
      <Stack>
        <FzLocationSelect
          label='Destination location'
          description='Locations in the active branch'
          value={destination}
          onChange={setDestination}
          enabled={opened}
          required
          aria-label='receive-destination'
        />
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Part</Table.Th>
              <Table.Th w={120}>Remaining</Table.Th>
              <Table.Th w={140}>Receive</Table.Th>
              <Table.Th w={160}>Batch</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {receivable.map((line) => (
              <Table.Tr key={line.pk}>
                <Table.Td>
                  <Text size='sm'>
                    {line.part_detail?.full_name ?? line.internal_part_name}
                  </Text>
                  <Text size='xs' c='dimmed'>
                    {line.supplier_part_detail?.SKU}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size='sm'>
                    {formatDecimal(
                      Number(line.quantity) - Number(line.received)
                    )}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size='xs'
                    value={quantities[line.pk]}
                    min={0}
                    max={Number(line.quantity) - Number(line.received)}
                    onChange={(value) =>
                      setQuantities((current) => ({
                        ...current,
                        [line.pk]: typeof value === 'number' ? value : ''
                      }))
                    }
                    aria-label={`receive-quantity-${line.pk}`}
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    size='xs'
                    placeholder='Optional'
                    value={batches[line.pk] ?? ''}
                    onChange={(event) => {
                      const batch = event.currentTarget.value;
                      setBatches((current) => ({
                        ...current,
                        [line.pk]: batch
                      }));
                    }}
                    aria-label={`receive-batch-${line.pk}`}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Group justify='flex-end'>
          <Button variant='default' onClick={onClose}>
            Cancel
          </Button>
          <Button
            color='green'
            onClick={() => receiveMutation.mutate()}
            loading={receiveMutation.isPending}
            disabled={!destination || !anyQuantity}
            data-testid='fz-po-receive-submit'
          >
            Receive
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
