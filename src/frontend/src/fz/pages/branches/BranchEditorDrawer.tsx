import {
  Button,
  Drawer,
  Group,
  SimpleGrid,
  Stack,
  Switch,
  TextInput,
  Textarea
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { apiUrl } from '@lib/functions/Api';
import { useApi } from '../../../contexts/ApiContext';
import { useUserState } from '../../../states/UserState';
import { extractErrorMessage } from '../../api/errors';
import { fzGlobalKey, useGlobalQuery } from '../../api/useBranchQuery';

interface BranchForm {
  name: string;
  code: string;
  description: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  is_active: boolean;
}

const EMPTY_FORM: BranchForm = {
  name: '',
  code: '',
  description: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  is_active: true
};

/**
 * Create / edit a branch. Branches cannot be deleted (the backend has no
 * delete endpoint by design) — deactivate via the Active switch instead.
 * Branch writes are staff-only on the server.
 */
export default function BranchEditorDrawer({
  opened,
  branchId,
  onClose,
  onSaved
}: {
  opened: boolean;
  branchId: number | null;
  onClose: () => void;
  onSaved?: (pk: number) => void;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const user = useUserState();

  const [form, setForm] = useState<BranchForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reset whenever the drawer opens
  useEffect(() => {
    if (opened) {
      setForm(EMPTY_FORM);
      setFieldErrors({});
    }
  }, [opened, branchId]);

  // Same key as the detail page so both share one cache entry
  const branchQuery = useGlobalQuery({
    key: ['branches', branchId],
    endpoint: ApiEndpoints.tenant_detail,
    pk: branchId ?? undefined,
    enabled: opened && branchId != null
  });

  // Seed the form from the fetched branch
  useEffect(() => {
    const branch = branchQuery.data;
    if (branch && opened) {
      setForm({
        name: branch.name ?? '',
        code: branch.code ?? '',
        description: branch.description ?? '',
        contact_name: branch.contact_name ?? '',
        contact_email: branch.contact_email ?? '',
        contact_phone: branch.contact_phone ?? '',
        is_active: !!branch.is_active
      });
    }
  }, [branchQuery.data, opened]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        // Empty code/email must be null — both have server-side validation
        code: form.code.trim() || null,
        description: form.description.trim(),
        contact_name: form.contact_name.trim(),
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim(),
        is_active: form.is_active
      };

      if (branchId == null) {
        const response = await api.post(
          apiUrl(ApiEndpoints.tenant_list),
          payload
        );
        return { pk: response.data.pk as number, created: true };
      }

      await api.patch(apiUrl(ApiEndpoints.tenant_detail, branchId), payload);
      return { pk: branchId, created: false };
    },
    onSuccess: ({ pk, created }) => {
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: fzGlobalKey('branches') });
      // Refresh the top-bar branch selector too
      queryClient.invalidateQueries({ queryKey: ['fz', 'branches'] });
      notifications.show({
        title: created ? 'Branch created' : 'Branch saved',
        message: form.name,
        color: 'green'
      });
      if (created) {
        onSaved?.(pk);
      }
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

  const setField = <K extends keyof BranchForm>(
    key: K,
    value: BranchForm[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={branchId == null ? 'New branch' : 'Edit branch'}
      position='right'
      size='lg'
      data-testid='fz-branch-drawer'
    >
      <Stack gap='sm'>
        <SimpleGrid cols={2} spacing='sm'>
          <TextInput
            label='Name'
            required
            value={form.name}
            error={fieldErrors.name}
            onChange={(event) => setField('name', event.currentTarget.value)}
            data-testid='fz-branch-name'
          />
          <TextInput
            label='Code'
            description='Short unique code, e.g. BLR'
            value={form.code}
            error={fieldErrors.code}
            onChange={(event) => setField('code', event.currentTarget.value)}
            data-testid='fz-branch-code'
          />
        </SimpleGrid>
        <Textarea
          label='Description'
          value={form.description}
          error={fieldErrors.description}
          onChange={(event) =>
            setField('description', event.currentTarget.value)
          }
          autosize
          minRows={1}
        />
        <TextInput
          label='Contact name'
          value={form.contact_name}
          error={fieldErrors.contact_name}
          onChange={(event) =>
            setField('contact_name', event.currentTarget.value)
          }
        />
        <SimpleGrid cols={2} spacing='sm'>
          <TextInput
            label='Contact email'
            value={form.contact_email}
            error={fieldErrors.contact_email}
            onChange={(event) =>
              setField('contact_email', event.currentTarget.value)
            }
          />
          <TextInput
            label='Contact phone'
            value={form.contact_phone}
            error={fieldErrors.contact_phone}
            onChange={(event) =>
              setField('contact_phone', event.currentTarget.value)
            }
          />
        </SimpleGrid>
        <Switch
          label='Active'
          description='Inactive branches are hidden from the branch selector'
          checked={form.is_active}
          error={fieldErrors.is_active}
          onChange={(event) =>
            setField('is_active', event.currentTarget.checked)
          }
        />
        <Group justify='flex-end' mt='sm'>
          <Button variant='default' onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            disabled={!user.isStaff() || !form.name.trim()}
            data-testid='fz-branch-save'
          >
            {branchId == null ? 'Create branch' : 'Save'}
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
