import { Button, Card, Group, Stack, Text } from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';

/**
 * Order party card: shows the customer/supplier for an order together with
 * the point-of-contact and delivery address snapshot, plus an edit button
 * that opens the order's contact/address editor. Shared by the FZ sales and
 * purchase order detail pages.
 */
export default function OrderPartyCard({
  label,
  company,
  contact,
  address,
  canEdit,
  onEdit,
  testId
}: {
  label: string;
  company?: { name?: string } | null;
  contact?: { name?: string; phone?: string; email?: string; role?: string } | null;
  address?: {
    line1?: string;
    line2?: string;
    postal_code?: string;
    postal_city?: string;
    province?: string;
    country?: string;
  } | null;
  canEdit: boolean;
  onEdit: () => void;
  testId?: string;
}) {
  return (
    <Card withBorder p='sm' data-testid={testId}>
      <Group justify='space-between' align='flex-start' wrap='nowrap'>
        <Group gap='xl' align='flex-start' wrap='wrap'>
          <div>
            <Text size='xs' c='dimmed'>
              {label}
            </Text>
            <Text fw={600}>{company?.name ?? '—'}</Text>
          </div>
          <div>
            <Text size='xs' c='dimmed'>
              Contact
            </Text>
            {contact ? (
              <Stack gap={0}>
                <Text size='sm'>{contact.name}</Text>
                {(contact.phone || contact.email) && (
                  <Text size='xs' c='dimmed'>
                    {[contact.phone, contact.email].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </Stack>
            ) : (
              <Text size='sm' c='dimmed'>
                —
              </Text>
            )}
          </div>
          <div>
            <Text size='xs' c='dimmed'>
              Address
            </Text>
            {formatAddress(address) ? (
              <Text size='sm' style={{ whiteSpace: 'pre-line' }}>
                {formatAddress(address)}
              </Text>
            ) : (
              <Text size='sm' c='dimmed'>
                —
              </Text>
            )}
          </div>
        </Group>
        {canEdit && (
          <Button
            size='compact-sm'
            variant='light'
            leftSection={<IconEdit size={16} />}
            onClick={onEdit}
            data-testid={testId ? `${testId}-edit` : undefined}
          >
            Edit
          </Button>
        )}
      </Group>
    </Card>
  );
}

/** Render an address snapshot into a multi-line block. */
function formatAddress(
  address?: {
    line1?: string;
    line2?: string;
    postal_code?: string;
    postal_city?: string;
    province?: string;
    country?: string;
  } | null
): string {
  if (!address) {
    return '';
  }

  const cityLine = [
    [address.postal_city, address.province].filter(Boolean).join(', '),
    address.postal_code
  ]
    .filter(Boolean)
    .join(' ');

  return [address.line1, address.line2, cityLine, address.country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join('\n');
}
