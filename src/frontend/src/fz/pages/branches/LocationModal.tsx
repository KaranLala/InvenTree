import {
  Button,
  Group,
  Modal,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { apiUrl } from '@lib/functions/Api';
import { useApi } from '../../../contexts/ApiContext';
import { extractErrorMessage } from '../../api/errors';
import { fzGlobalKey } from '../../api/useBranchQuery';
import type { BranchLocationNode } from './LocationSection';

/**
 * Create / edit a stock location within one branch. The branch (tenant) is
 * always preset, and the parent is fixed by the row the modal was opened
 * from — no reparenting here, so the "location tenant must match parent
 * tenant" invariant can't be violated. Reparenting, location types and
 * icons live behind the classic-UI escape hatch.
 */
export default function LocationModal({
  opened,
  onClose,
  branchId,
  parent,
  location
}: {
  opened: boolean;
  onClose: () => void;
  branchId: number;
  parent: BranchLocationNode | null;
  location: BranchLocationNode | null;
}) {
  const api = useApi();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [structural, setStructural] = useState(false);
  const [external, setExternal] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reset each time the modal opens, seeding from the location when editing
  useEffect(() => {
    if (opened) {
      setName(location?.name ?? '');
      setDescription(location?.description ?? '');
      setStructural(!!location?.structural);
      setExternal(!!location?.external);
      setFieldErrors({});
    }
  }, [opened, location]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (location == null) {
        return api.post(apiUrl(ApiEndpoints.stock_location_list), {
          name: name.trim(),
          description: description.trim(),
          parent: parent?.pk ?? null,
          structural: structural,
          external: external,
          tenant: branchId
        });
      }

      // Never send parent/tenant on edit — no reparenting from this UI
      return api.patch(apiUrl(ApiEndpoints.stock_location_list, location.pk), {
        name: name.trim(),
        description: description.trim(),
        structural: structural,
        external: external
      });
    },
    onSuccess: () => {
      setFieldErrors({});
      queryClient.invalidateQueries({
        queryKey: fzGlobalKey('branches', branchId, 'locations')
      });
      // Branch-scoped caches (stock browser tree, location selects)
      queryClient.invalidateQueries({ queryKey: ['fz', branchId] });
      notifications.show({
        title: location == null ? 'Location created' : 'Location saved',
        message: name,
        color: 'green'
      });
      onClose();
    },
    onError: (error: any) => {
      const data = error?.response?.data;

      if (data && typeof data === 'object' && !data.detail) {
        const errors: Record<string, string> = {};
        for (const [key, value] of Object.entries(data)) {
          errors[key] = String(Array.isArray(value) ? value[0] : value);
        }
        setFieldErrors(errors);
      }

      notifications.show({
        title: 'Save failed',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

  const title =
    location != null
      ? 'Edit location'
      : parent != null
        ? 'New sub-location'
        : 'New location';

  return (
    <Modal opened={opened} onClose={onClose} title={title} size='lg'>
      <Stack gap='sm'>
        {location == null && parent != null && (
          <div>
            <Text size='xs' c='dimmed'>
              Inside
            </Text>
            <Text size='sm' fw={500}>
              {parent.pathstring || parent.name}
            </Text>
          </div>
        )}
        <TextInput
          label='Name'
          required
          value={name}
          error={fieldErrors.name}
          onChange={(event) => setName(event.currentTarget.value)}
          data-testid='fz-location-name'
        />
        <Textarea
          label='Description'
          value={description}
          error={fieldErrors.description}
          onChange={(event) => setDescription(event.currentTarget.value)}
          autosize
          minRows={1}
        />
        <Switch
          label='Structural'
          description="Structural locations can't hold stock directly, only sub-locations"
          checked={structural}
          error={fieldErrors.structural}
          onChange={(event) => setStructural(event.currentTarget.checked)}
        />
        <Switch
          label='External'
          description='Stock in external locations is not counted as available'
          checked={external}
          error={fieldErrors.external}
          onChange={(event) => setExternal(event.currentTarget.checked)}
        />
        <Group justify='flex-end' mt='sm'>
          <Button variant='default' onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            disabled={!name.trim()}
            data-testid='fz-location-save'
          >
            {location == null ? 'Create location' : 'Save'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
