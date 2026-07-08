import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Tooltip
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { apiUrl } from '@lib/functions/Api';
import { useApi } from '../../../contexts/ApiContext';
import { useUserState } from '../../../states/UserState';
import { extractErrorMessage } from '../../api/errors';
import {
  fzGlobalKey,
  listResults,
  useGlobalQuery
} from '../../api/useBranchQuery';
import type { CompanyKind } from './kinds';

interface AddressForm {
  title: string;
  line1: string;
  line2: string;
  postal_city: string;
  postal_code: string;
  province: string;
  country: string;
  primary: boolean;
  shipping_notes: string;
  internal_shipping_notes: string;
}

const EMPTY_ADDRESS: AddressForm = {
  title: '',
  line1: '',
  line2: '',
  postal_city: '',
  postal_code: '',
  province: '',
  country: '',
  primary: false,
  shipping_notes: '',
  internal_shipping_notes: ''
};

/**
 * Addresses for a company: one card per address, edited in place.
 * The server enforces the single-primary rule; the whole list is
 * invalidated after each save so demoted cards refresh.
 */
export default function AddressSection({
  companyId,
  kind
}: {
  companyId: number;
  kind: CompanyKind;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const user = useUserState();

  // pk of the card being edited; -1 = the new-address card
  const [editingPk, setEditingPk] = useState<number | null>(null);
  const [form, setForm] = useState<AddressForm>(EMPTY_ADDRESS);

  const addressesQuery = useGlobalQuery({
    key: ['company', companyId, 'addresses'],
    endpoint: ApiEndpoints.address_list,
    params: { company: companyId, limit: 100, ordering: 'title' }
  });

  const addresses: any[] = listResults(addressesQuery.data);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: fzGlobalKey('company', companyId, 'addresses')
    });
    // The detail header shows the primary address
    queryClient.invalidateQueries({
      queryKey: fzGlobalKey('company', companyId)
    });
  };

  const showError = (title: string) => (error: any) =>
    notifications.show({
      title,
      message: extractErrorMessage(error),
      color: 'red'
    });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingPk === -1) {
        return api.post(apiUrl(ApiEndpoints.address_list), {
          company: companyId,
          ...form
        });
      }
      return api.patch(apiUrl(ApiEndpoints.address_list, editingPk!), form);
    },
    onSuccess: () => {
      setEditingPk(null);
      invalidate();
    },
    onError: showError('Could not save address')
  });

  const deleteMutation = useMutation({
    mutationFn: async (pk: number) =>
      api.delete(apiUrl(ApiEndpoints.address_list, pk)),
    onSuccess: invalidate,
    onError: showError('Could not delete address')
  });

  const canAdd = user.hasAddRole(kind.role);
  const canChange = user.hasChangeRole(kind.role);
  const canDelete = user.hasDeleteRole(kind.role);

  const setField = <K extends keyof AddressForm>(
    key: K,
    value: AddressForm[K]
  ) => setForm((current) => ({ ...current, [key]: value }));

  const startEdit = (address: any) => {
    setEditingPk(address.pk);
    setForm({
      title: address.title ?? '',
      line1: address.line1 ?? '',
      line2: address.line2 ?? '',
      postal_city: address.postal_city ?? '',
      postal_code: address.postal_code ?? '',
      province: address.province ?? '',
      country: address.country ?? '',
      primary: !!address.primary,
      shipping_notes: address.shipping_notes ?? '',
      internal_shipping_notes: address.internal_shipping_notes ?? ''
    });
  };

  const editorCard = (
    <Card withBorder p='sm'>
      <Stack gap='xs'>
        <Group grow>
          <TextInput
            size='xs'
            label='Title'
            required
            value={form.title}
            onChange={(e) => setField('title', e.currentTarget.value)}
            aria-label='address-title'
          />
          <Switch
            label='Primary'
            checked={form.primary}
            onChange={(e) => setField('primary', e.currentTarget.checked)}
            mt='md'
          />
        </Group>
        <TextInput
          size='xs'
          label='Line 1'
          value={form.line1}
          onChange={(e) => setField('line1', e.currentTarget.value)}
          aria-label='address-line1'
        />
        <TextInput
          size='xs'
          label='Line 2'
          value={form.line2}
          onChange={(e) => setField('line2', e.currentTarget.value)}
          aria-label='address-line2'
        />
        <SimpleGrid cols={2} spacing='xs'>
          <TextInput
            size='xs'
            label='City'
            value={form.postal_city}
            onChange={(e) => setField('postal_city', e.currentTarget.value)}
          />
          <TextInput
            size='xs'
            label='Postal code'
            value={form.postal_code}
            onChange={(e) => setField('postal_code', e.currentTarget.value)}
          />
          <TextInput
            size='xs'
            label='Province / State'
            value={form.province}
            onChange={(e) => setField('province', e.currentTarget.value)}
          />
          <TextInput
            size='xs'
            label='Country'
            value={form.country}
            onChange={(e) => setField('country', e.currentTarget.value)}
          />
        </SimpleGrid>
        <SimpleGrid cols={2} spacing='xs'>
          <Textarea
            size='xs'
            label='Shipping notes'
            description='Printed on dispatch paperwork'
            value={form.shipping_notes}
            onChange={(e) => setField('shipping_notes', e.currentTarget.value)}
            autosize
            minRows={1}
          />
          <Textarea
            size='xs'
            label='Internal shipping notes'
            description='Internal only'
            value={form.internal_shipping_notes}
            onChange={(e) =>
              setField('internal_shipping_notes', e.currentTarget.value)
            }
            autosize
            minRows={1}
          />
        </SimpleGrid>
        <Group justify='flex-end' gap='xs'>
          <Button
            size='compact-xs'
            variant='default'
            onClick={() => setEditingPk(null)}
          >
            Cancel
          </Button>
          <Button
            size='compact-xs'
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            disabled={!form.title.trim()}
            data-testid='fz-company-address-save'
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Card>
  );

  if (addressesQuery.isLoading) {
    return <Loader size='xs' />;
  }

  return (
    <Stack gap='xs' data-testid='fz-company-addresses'>
      {addresses.length === 0 && editingPk !== -1 && (
        <Text size='sm' c='dimmed'>
          No addresses yet
        </Text>
      )}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing='xs'>
        {addresses.map((address) =>
          editingPk === address.pk ? (
            <div key={address.pk}>{editorCard}</div>
          ) : (
            <Card key={address.pk} withBorder p='sm'>
              <Group justify='space-between' wrap='nowrap' align='flex-start'>
                <div>
                  <Group gap='xs'>
                    <Text size='sm' fw={600}>
                      {address.title}
                    </Text>
                    {address.primary && (
                      <Badge size='xs' variant='light'>
                        Primary
                      </Badge>
                    )}
                  </Group>
                  {[
                    address.line1,
                    address.line2,
                    [address.postal_code, address.postal_city]
                      .filter(Boolean)
                      .join(' '),
                    address.province,
                    address.country
                  ]
                    .filter(Boolean)
                    .map((line: string, index: number) => (
                      <Text size='xs' c='dimmed' key={index}>
                        {line}
                      </Text>
                    ))}
                  {address.shipping_notes && (
                    <Text size='xs' mt={4}>
                      Shipping: {address.shipping_notes}
                    </Text>
                  )}
                  {address.internal_shipping_notes && (
                    <Text size='xs' c='dimmed'>
                      Internal: {address.internal_shipping_notes}
                    </Text>
                  )}
                </div>
                <Group gap={4} wrap='nowrap'>
                  {canChange && (
                    <Tooltip label='Edit address'>
                      <ActionIcon
                        variant='subtle'
                        size='sm'
                        onClick={() => startEdit(address)}
                        aria-label={`address-edit-${address.pk}`}
                      >
                        <IconPencil size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip label='Delete address'>
                      <ActionIcon
                        variant='subtle'
                        color='red'
                        size='sm'
                        onClick={() => deleteMutation.mutate(address.pk)}
                        aria-label={`address-delete-${address.pk}`}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              </Group>
            </Card>
          )
        )}
        {editingPk === -1 && <div>{editorCard}</div>}
      </SimpleGrid>
      {canAdd && editingPk !== -1 && (
        <Group>
          <Button
            size='compact-sm'
            variant='light'
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setForm({ ...EMPTY_ADDRESS, primary: addresses.length === 0 });
              setEditingPk(-1);
            }}
            data-testid='fz-company-address-add'
          >
            Add address
          </Button>
        </Group>
      )}
    </Stack>
  );
}
