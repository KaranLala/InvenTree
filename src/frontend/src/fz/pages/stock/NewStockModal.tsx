import {
  Avatar,
  Button,
  Combobox,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  useCombobox
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { UserRoles } from '@lib/enums/Roles';
import { apiUrl } from '@lib/functions/Api';
import { useApi } from '../../../contexts/ApiContext';
import { useUserState } from '../../../states/UserState';
import { extractErrorMessage } from '../../api/errors';
import {
  listResults,
  useBranchQuery,
  useInvalidateBranch
} from '../../api/useBranchQuery';

/**
 * Create a new stock item: pick a part, a branch location and a quantity.
 * Minimal by design — serial/status/batch/price live behind the classic UI.
 */
export default function NewStockModal({
  opened,
  onClose,
  defaultLocation
}: {
  opened: boolean;
  onClose: () => void;
  defaultLocation?: number | null;
}) {
  const api = useApi();
  const user = useUserState();
  const invalidateBranch = useInvalidateBranch();

  const [part, setPart] = useState<any | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [notes, setNotes] = useState('');

  const { data: locationData } = useBranchQuery({
    key: ['stock-locations', 'new-stock-destinations'],
    endpoint: ApiEndpoints.stock_location_list,
    params: { structural: false },
    enabled: opened
  });

  const locationOptions = useMemo(
    () =>
      listResults(locationData).map((loc: any) => ({
        value: String(loc.pk),
        label: loc.pathstring || loc.name
      })),
    [locationData]
  );

  // Reset the form each time the modal opens, seeding the location
  useEffect(() => {
    if (opened) {
      setPart(null);
      setLocation(defaultLocation != null ? String(defaultLocation) : null);
      setQuantity(1);
      setNotes('');
    }
  }, [opened, defaultLocation]);

  const canAdd = user.hasAddRole(UserRoles.stock);

  const mutation = useMutation({
    mutationFn: async () =>
      api.post(apiUrl(ApiEndpoints.stock_item_list), {
        part: part.pk,
        quantity: quantity,
        location: location != null ? Number(location) : null,
        notes: notes
      }),
    onSuccess: () => {
      notifications.show({
        title: 'Stock added',
        message: `Added ${quantity} × ${part?.full_name}`,
        color: 'green'
      });
      invalidateBranch();
      onClose();
    },
    onError: (error) => {
      notifications.show({
        title: 'Add stock failed',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

  const valid =
    part != null &&
    location != null &&
    quantity !== '' &&
    quantity != null &&
    Number(quantity) > 0;

  return (
    <Modal opened={opened} onClose={onClose} title='Add stock' size='lg'>
      <Stack>
        <div>
          <Text size='sm' fw={500} mb={4}>
            Part <span style={{ color: 'var(--mantine-color-red-6)' }}>*</span>
          </Text>
          <PartSearchCombobox value={part} onChange={setPart} />
        </div>
        <Select
          label='Location'
          description='Locations in the active branch'
          data={locationOptions}
          value={location}
          onChange={setLocation}
          searchable
          required
          aria-label='new-stock-location'
          data-testid='fz-new-stock-location'
        />
        <NumberInput
          label='Quantity'
          value={quantity}
          onChange={(value) =>
            setQuantity(typeof value === 'number' ? value : '')
          }
          min={0}
          required
          data-testid='fz-new-stock-quantity'
        />
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
            disabled={!valid || !canAdd}
            data-testid='fz-new-stock-save'
          >
            Add stock
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Async part search (any active, non-virtual part). */
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
          placeholder='Search for a part...'
          value={value ? value.full_name : query}
          rightSection={loading ? <Loader size='xs' /> : undefined}
          onChange={(event) => {
            onChange(null);
            setQuery(event.currentTarget.value);
            combobox.openDropdown();
          }}
          onFocus={() => combobox.openDropdown()}
          aria-label='new-stock-part'
          data-testid='fz-new-stock-part'
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
