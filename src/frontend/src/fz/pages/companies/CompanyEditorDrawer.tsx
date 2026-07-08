import {
  Button,
  Drawer,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  TextInput,
  Textarea
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { apiUrl } from '@lib/functions/Api';
import { useApi } from '../../../contexts/ApiContext';
import { useGlobalSettingsState } from '../../../states/SettingsStates';
import { useUserState } from '../../../states/UserState';
import { extractErrorMessage } from '../../api/errors';
import { fzGlobalKey, useGlobalQuery } from '../../api/useBranchQuery';
import type { CompanyKind } from './kinds';

interface CompanyForm {
  name: string;
  description: string;
  phone: string;
  email: string;
  currency: string | null;
  tax_id: string;
  website: string;
  active: boolean;
}

const EMPTY_FORM: CompanyForm = {
  name: '',
  description: '',
  phone: '',
  email: '',
  currency: null,
  tax_id: '',
  website: '',
  active: true
};

/**
 * Create / edit a customer or supplier: only the daily-work company
 * fields. Rare fields (image, notes, extra flags) stay behind the
 * "Open in InvenTree" escape hatch on the detail page.
 */
export default function CompanyEditorDrawer({
  opened,
  kind,
  companyId,
  onClose,
  onSaved
}: {
  opened: boolean;
  kind: CompanyKind;
  companyId: number | null;
  onClose: () => void;
  onSaved?: (pk: number) => void;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const user = useUserState();
  const globalSettings = useGlobalSettingsState();

  const [form, setForm] = useState<CompanyForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reset whenever the drawer opens
  useEffect(() => {
    if (opened) {
      setForm(EMPTY_FORM);
      setFieldErrors({});
    }
  }, [opened, companyId]);

  // Same key AND params as the detail page so both share one cache entry
  const companyQuery = useGlobalQuery({
    key: ['company', companyId],
    endpoint: ApiEndpoints.company_list,
    pk: companyId ?? undefined,
    params: { address_detail: true },
    enabled: opened && companyId != null
  });

  // Seed the form from the fetched company
  useEffect(() => {
    const company = companyQuery.data;
    if (company && opened) {
      setForm({
        name: company.name ?? '',
        description: company.description ?? '',
        phone: company.phone ?? '',
        email: company.email ?? '',
        currency: company.currency || null,
        tax_id: company.tax_id ?? '',
        website: company.website ?? '',
        active: !!company.active
      });
    }
  }, [companyQuery.data, opened]);

  const currencyOptions = useMemo(() => {
    const fallback = globalSettings.lookup.INVENTREE_DEFAULT_CURRENCY || 'USD';
    const codes = (globalSettings.lookup.CURRENCY_CODES || fallback)
      .split(',')
      .map((code: string) => code.trim())
      .filter(Boolean);
    return codes.length > 0 ? codes : [fallback];
  }, [globalSettings.lookup]);

  const canWrite =
    companyId == null
      ? user.hasAddRole(kind.role)
      : user.hasChangeRole(kind.role);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        currency: form.currency ?? undefined,
        tax_id: form.tax_id.trim(),
        website: form.website.trim(),
        active: form.active
      };

      if (companyId == null) {
        const response = await api.post(apiUrl(ApiEndpoints.company_list), {
          ...payload,
          [kind.flagParam]: true
        });
        return { pk: response.data.pk as number, created: true };
      }

      await api.patch(apiUrl(ApiEndpoints.company_list, companyId), payload);
      return { pk: companyId, created: false };
    },
    onSuccess: ({ pk, created }) => {
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: fzGlobalKey('customers') });
      queryClient.invalidateQueries({ queryKey: fzGlobalKey('suppliers') });
      queryClient.invalidateQueries({ queryKey: fzGlobalKey('company', pk) });
      notifications.show({
        title: created
          ? `${kind.label.slice(0, -1)} created`
          : `${kind.label.slice(0, -1)} saved`,
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

  const setField = <K extends keyof CompanyForm>(
    key: K,
    value: CompanyForm[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        companyId == null ? `New ${kind.singular}` : `Edit ${kind.singular}`
      }
      position='right'
      size='xl'
      data-testid='fz-company-drawer'
    >
      <Stack gap='sm'>
        <TextInput
          label='Name'
          required
          value={form.name}
          error={fieldErrors.name}
          onChange={(event) => setField('name', event.currentTarget.value)}
          data-testid='fz-company-name'
        />
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
        <SimpleGrid cols={2} spacing='sm'>
          <TextInput
            label='Phone'
            value={form.phone}
            error={fieldErrors.phone}
            onChange={(event) => setField('phone', event.currentTarget.value)}
          />
          <TextInput
            label='Email'
            value={form.email}
            error={fieldErrors.email}
            onChange={(event) => setField('email', event.currentTarget.value)}
          />
        </SimpleGrid>
        <SimpleGrid cols={2} spacing='sm'>
          <Select
            label='Currency'
            data={currencyOptions}
            value={form.currency}
            error={fieldErrors.currency}
            onChange={(value) => setField('currency', value)}
            clearable
            searchable
          />
          <TextInput
            label='Tax ID'
            value={form.tax_id}
            error={fieldErrors.tax_id}
            onChange={(event) => setField('tax_id', event.currentTarget.value)}
          />
        </SimpleGrid>
        <TextInput
          label='Website'
          value={form.website}
          error={fieldErrors.website}
          onChange={(event) => setField('website', event.currentTarget.value)}
        />
        <Switch
          label='Active'
          checked={form.active}
          onChange={(event) => setField('active', event.currentTarget.checked)}
        />
        <Group justify='flex-end' mt='sm'>
          <Button variant='default' onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            disabled={!canWrite || !form.name.trim()}
            data-testid='fz-company-save'
          >
            {companyId == null ? `Create ${kind.singular}` : 'Save'}
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
