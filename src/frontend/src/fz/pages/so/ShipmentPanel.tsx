import {
  Badge,
  Button,
  Collapse,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  TextInput
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { apiUrl } from '@lib/functions/Api';
import { useApi } from '../../../contexts/ApiContext';
import { extractErrorMessage } from '../../api/errors';

/**
 * Shipments for a sales order. Collapsed by default when there is at
 * most one shipment (the one-shipment-per-order happy path); completing
 * a shipment asks only for an optional tracking number.
 */
export default function ShipmentPanel({
  shipments,
  loading,
  editable,
  onChanged
}: {
  shipments: any[];
  loading: boolean;
  editable: boolean;
  onChanged: () => void;
}) {
  const api = useApi();

  const [open, setOpen] = useState(shipments.length > 1);
  const [completing, setCompleting] = useState<any>(null);
  const [trackingNumber, setTrackingNumber] = useState('');

  const pendingShipments = shipments.filter((s) => !s.shipment_date);

  const completeMutation = useMutation({
    mutationFn: async () =>
      api.post(
        apiUrl(ApiEndpoints.sales_order_shipment_complete, completing.pk),
        {
          shipment_date: new Date().toISOString().split('T')[0],
          tracking_number: trackingNumber || undefined
        }
      ),
    onSuccess: () => {
      notifications.show({
        title: 'Shipment completed',
        message: `Shipment ${completing.reference} marked as shipped`,
        color: 'green'
      });
      setCompleting(null);
      setTrackingNumber('');
      onChanged();
    },
    onError: (error) => {
      notifications.show({
        title: 'Could not complete shipment',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

  if (loading || shipments.length === 0) {
    return null;
  }

  return (
    <Stack gap='xs'>
      <Group
        gap='xs'
        style={{ cursor: 'pointer' }}
        onClick={() => setOpen(!open)}
      >
        {open ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
        <Text fw={600}>Shipments</Text>
        <Badge variant='light' color='gray'>
          {shipments.length - pendingShipments.length} / {shipments.length}{' '}
          shipped
        </Badge>
      </Group>
      <Collapse expanded={open}>
        <Table data-testid='fz-so-shipments'>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Reference</Table.Th>
              <Table.Th>Items</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Tracking</Table.Th>
              <Table.Th w={140} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {shipments.map((shipment) => (
              <Table.Tr key={shipment.pk}>
                <Table.Td>
                  <Text size='sm' fw={500}>
                    {shipment.reference}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size='sm'>{shipment.allocated_items}</Text>
                </Table.Td>
                <Table.Td>
                  {shipment.shipment_date ? (
                    <Badge variant='light' color='green'>
                      Shipped {shipment.shipment_date}
                    </Badge>
                  ) : (
                    <Badge variant='light' color='orange'>
                      Pending
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size='sm' c='dimmed'>
                    {shipment.tracking_number || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {editable &&
                    !shipment.shipment_date &&
                    shipment.allocated_items > 0 && (
                      <Button
                        size='compact-xs'
                        variant='light'
                        color='green'
                        onClick={() => setCompleting(shipment)}
                        data-testid={`complete-shipment-${shipment.pk}`}
                      >
                        Complete shipment
                      </Button>
                    )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Collapse>
      <Modal
        opened={completing != null}
        onClose={() => setCompleting(null)}
        title={`Complete shipment ${completing?.reference ?? ''}`}
      >
        <Stack>
          <Text size='sm' c='dimmed'>
            Ships {completing?.allocated_items} allocated item
            {completing?.allocated_items === 1 ? '' : 's'} today.
          </Text>
          <TextInput
            label='Tracking number'
            placeholder='Optional'
            value={trackingNumber}
            onChange={(event) => setTrackingNumber(event.currentTarget.value)}
          />
          <Group justify='flex-end'>
            <Button variant='default' onClick={() => setCompleting(null)}>
              Cancel
            </Button>
            <Button
              color='green'
              onClick={() => completeMutation.mutate()}
              loading={completeMutation.isPending}
            >
              Ship
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
