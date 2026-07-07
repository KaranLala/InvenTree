import {
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
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
import { useApi } from '../../../contexts/ApiContext';
import { extractErrorMessage } from '../../api/errors';
import {
  listResults,
  useBranchQuery,
  useInvalidateBranch
} from '../../api/useBranchQuery';

/**
 * Transfer one or more stock items to another location within the
 * active branch. Destinations are limited to non-structural locations
 * of the branch; the backend additionally blocks cross-branch moves.
 */
export default function TransferModal({
  items,
  opened,
  onClose
}: {
  items: any[];
  opened: boolean;
  onClose: () => void;
}) {
  const api = useApi();
  const invalidateBranch = useInvalidateBranch();

  const [destination, setDestination] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number | ''>>(
    {}
  );
  const [notes, setNotes] = useState('');

  const { data: locationData } = useBranchQuery({
    key: ['stock-locations', 'transfer-destinations'],
    endpoint: ApiEndpoints.stock_location_list,
    params: { structural: false },
    enabled: opened
  });

  const locationOptions = useMemo(
    () =>
      listResults(locationData).map((location: any) => ({
        value: String(location.pk),
        label: location.pathstring || location.name
      })),
    [locationData]
  );

  useEffect(() => {
    if (opened) {
      const initial: Record<number, number | ''> = {};
      for (const item of items) {
        initial[item.pk] = Number(item.quantity);
      }
      setQuantities(initial);
      setDestination(null);
      setNotes('');
    }
  }, [opened, items]);

  const mutation = useMutation({
    mutationFn: async () =>
      api.post(apiUrl(ApiEndpoints.stock_transfer), {
        items: items.map((item) => ({
          pk: item.pk,
          quantity: quantities[item.pk]
        })),
        location: destination,
        notes: notes
      }),
    onSuccess: () => {
      notifications.show({
        title: 'Stock transferred',
        message: `Transferred ${items.length} item${items.length === 1 ? '' : 's'}`,
        color: 'green'
      });
      invalidateBranch();
      onClose();
    },
    onError: (error) => {
      notifications.show({
        title: 'Transfer failed',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

  const valid =
    destination != null &&
    items.every((item) => {
      const quantity = quantities[item.pk];
      return quantity !== '' && quantity != null && Number(quantity) > 0;
    });

  return (
    <Modal opened={opened} onClose={onClose} title='Transfer stock' size='lg'>
      <Stack>
        <Select
          label='Destination'
          description='Locations in the active branch'
          data={locationOptions}
          value={destination}
          onChange={setDestination}
          searchable
          required
          aria-label='transfer-destination'
        />
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Part</Table.Th>
              <Table.Th>From</Table.Th>
              <Table.Th w={120}>In stock</Table.Th>
              <Table.Th w={160}>Quantity</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item) => (
              <Table.Tr key={item.pk}>
                <Table.Td>
                  <Text size='sm'>{item.part_detail?.full_name}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size='sm' c='dimmed'>
                    {item.location_detail?.pathstring ?? 'No location'}
                  </Text>
                </Table.Td>
                <Table.Td>{Number(item.quantity)}</Table.Td>
                <Table.Td>
                  <NumberInput
                    value={quantities[item.pk]}
                    onChange={(value) =>
                      setQuantities((current) => ({
                        ...current,
                        [item.pk]: typeof value === 'number' ? value : ''
                      }))
                    }
                    min={0}
                    max={Number(item.quantity)}
                    size='xs'
                    aria-label={`transfer-quantity-${item.pk}`}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <TextInput
          label='Notes'
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
          placeholder='Optional notes'
        />
        <Group justify='flex-end'>
          <Button variant='default' onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!valid}
          >
            Transfer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
