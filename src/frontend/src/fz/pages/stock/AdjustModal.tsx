import {
  Button,
  Group,
  Modal,
  NumberInput,
  Stack,
  Table,
  Text,
  TextInput
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { apiUrl } from '@lib/functions/Api';
import { useApi } from '../../../contexts/ApiContext';
import { extractErrorMessage } from '../../api/errors';
import { useInvalidateBranch } from '../../api/useBranchQuery';

export type AdjustMode = 'count' | 'add' | 'remove';

const MODE_CONFIG: Record<
  AdjustMode,
  { title: string; endpoint: ApiEndpoints; verb: string }
> = {
  count: {
    title: 'Count stock',
    endpoint: ApiEndpoints.stock_count,
    verb: 'Counted'
  },
  add: { title: 'Add stock', endpoint: ApiEndpoints.stock_add, verb: 'Added' },
  remove: {
    title: 'Remove stock',
    endpoint: ApiEndpoints.stock_remove,
    verb: 'Removed'
  }
};

/**
 * Quick stock adjustment (count / add / remove) for one or more items.
 */
export default function AdjustModal({
  items,
  mode,
  opened,
  onClose
}: {
  items: any[];
  mode: AdjustMode;
  opened: boolean;
  onClose: () => void;
}) {
  const api = useApi();
  const invalidateBranch = useInvalidateBranch();
  const config = MODE_CONFIG[mode];

  const [quantities, setQuantities] = useState<Record<number, number | ''>>(
    {}
  );
  const [notes, setNotes] = useState('');

  // Re-seed per-item quantities whenever the modal opens
  useEffect(() => {
    if (opened) {
      const initial: Record<number, number | ''> = {};
      for (const item of items) {
        initial[item.pk] = mode === 'count' ? Number(item.quantity) : '';
      }
      setQuantities(initial);
      setNotes('');
    }
  }, [opened, items, mode]);

  const mutation = useMutation({
    mutationFn: async () =>
      api.post(apiUrl(config.endpoint), {
        items: items.map((item) => ({
          pk: item.pk,
          quantity: quantities[item.pk]
        })),
        notes: notes
      }),
    onSuccess: () => {
      notifications.show({
        title: config.title,
        message: `${config.verb} stock for ${items.length} item${items.length === 1 ? '' : 's'}`,
        color: 'green'
      });
      invalidateBranch();
      onClose();
    },
    onError: (error) => {
      notifications.show({
        title: 'Adjustment failed',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

  const valid = items.every((item) => {
    const quantity = quantities[item.pk];
    return quantity !== '' && quantity != null && Number(quantity) >= 0;
  });

  return (
    <Modal opened={opened} onClose={onClose} title={config.title} size='lg'>
      <Stack>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Part</Table.Th>
              <Table.Th>Location</Table.Th>
              <Table.Th w={120}>In stock</Table.Th>
              <Table.Th w={160}>
                {mode === 'count' ? 'Counted quantity' : 'Quantity'}
              </Table.Th>
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
                    {item.location_detail?.pathstring ?? '-'}
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
                    size='xs'
                    aria-label={`adjust-quantity-${item.pk}`}
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
            {config.title}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
