import {
  Button,
  Divider,
  Drawer,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { UserRoles } from '@lib/enums/Roles';
import { apiUrl } from '@lib/functions/Api';
import { useApi } from '../../../contexts/ApiContext';
import { useUserState } from '../../../states/UserState';
import { extractErrorMessage } from '../../api/errors';
import {
  fzGlobalKey,
  listResults,
  useGlobalQuery
} from '../../api/useBranchQuery';
import ItemImage from './ItemImage';
import ParameterInputs, {
  type ExistingParameterRow,
  type ParameterTemplate,
  buildParameterOps,
  runParameterOps
} from './ParameterInputs';
import PriceBreakSection from './PriceBreakSection';

interface ItemForm {
  name: string;
  category: string | null;
  IPN: string;
  description: string;
  units: string;
  minimum_stock: number | '';
  active: boolean;
  salable: boolean;
  purchaseable: boolean;
}

const EMPTY_FORM: ItemForm = {
  name: '',
  category: null,
  IPN: '',
  description: '',
  units: 'pcs',
  minimum_stock: 0,
  active: true,
  salable: true,
  purchaseable: true
};

/**
 * Item editor: core part fields, every admin-defined parameter, plus
 * (once the item exists) image upload and sale price breaks.
 *
 * Create is two-phase: saving a new item promotes the drawer to edit
 * mode with the new pk, unlocking the image and price break sections.
 */
export default function ItemEditorDrawer({
  opened,
  partId,
  onClose
}: {
  opened: boolean;
  partId: number | null;
  onClose: () => void;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const user = useUserState();

  // Seeded from props; promoted from null after a successful create
  const [currentPartId, setCurrentPartId] = useState<number | null>(partId);

  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [paramValues, setParamValues] = useState<Record<number, string>>({});
  const [paramErrors, setParamErrors] = useState<Record<number, string>>({});

  // Reset everything whenever the drawer opens
  useEffect(() => {
    if (opened) {
      setCurrentPartId(partId);
      setForm(EMPTY_FORM);
      setFieldErrors({});
      setParamValues({});
      setParamErrors({});
    }
  }, [opened, partId]);

  const partQuery = useGlobalQuery({
    key: ['part', currentPartId],
    endpoint: ApiEndpoints.part_list,
    pk: currentPartId ?? undefined,
    enabled: opened && currentPartId != null
  });

  // Seed the form from the fetched part
  useEffect(() => {
    const part = partQuery.data;
    if (part && opened) {
      setForm({
        name: part.name ?? '',
        category: part.category != null ? String(part.category) : null,
        IPN: part.IPN ?? '',
        description: part.description ?? '',
        units: part.units ?? '',
        minimum_stock: Number(part.minimum_stock ?? 0),
        active: !!part.active,
        salable: !!part.salable,
        purchaseable: !!part.purchaseable
      });
    }
  }, [partQuery.data, opened]);

  const categoriesQuery = useGlobalQuery({
    key: ['categories'],
    endpoint: ApiEndpoints.category_list,
    params: { structural: false, limit: 200, ordering: 'pathstring' },
    enabled: opened
  });

  const categoryOptions = useMemo(
    () =>
      listResults(categoriesQuery.data).map((category: any) => ({
        value: String(category.pk),
        label: category.pathstring || category.name
      })),
    [categoriesQuery.data]
  );

  const templatesQuery = useGlobalQuery({
    key: ['parameter-templates'],
    endpoint: ApiEndpoints.parameter_template_list,
    params: { model_type: 'part', enabled: true, limit: 200, ordering: 'name' },
    enabled: opened
  });

  const templates: ParameterTemplate[] = useMemo(
    () => listResults(templatesQuery.data),
    [templatesQuery.data]
  );

  const valuesQuery = useGlobalQuery({
    key: ['parameters', currentPartId],
    endpoint: ApiEndpoints.parameter_list,
    params: { model_type: 'part', model_id: currentPartId, limit: 200 },
    enabled: opened && currentPartId != null
  });

  const existingRows: Record<number, ExistingParameterRow> = useMemo(() => {
    const rows: Record<number, ExistingParameterRow> = {};
    for (const row of listResults(valuesQuery.data)) {
      rows[row.template] = { pk: row.pk, data: String(row.data ?? '') };
    }
    return rows;
  }, [valuesQuery.data]);

  // Seed parameter inputs from existing rows
  useEffect(() => {
    if (opened) {
      const seeded: Record<number, string> = {};
      for (const [templatePk, row] of Object.entries(existingRows)) {
        seeded[Number(templatePk)] = row.data;
      }
      setParamValues(seeded);
    }
  }, [existingRows, opened]);

  const canWrite =
    currentPartId == null
      ? user.hasAddRole(UserRoles.part)
      : user.hasChangeRole(UserRoles.part);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        category: form.category ? Number(form.category) : null,
        IPN: form.IPN.trim(),
        description: form.description.trim(),
        units: form.units.trim(),
        minimum_stock: form.minimum_stock === '' ? 0 : form.minimum_stock,
        active: form.active,
        salable: form.salable,
        purchaseable: form.purchaseable
      };

      let pk = currentPartId;

      if (pk == null) {
        // The editor manages parameters explicitly — server-side
        // category copying would collide with our POSTs
        const response = await api.post(apiUrl(ApiEndpoints.part_list), {
          ...payload,
          copy_category_parameters: false
        });
        pk = response.data.pk as number;
      } else {
        await api.patch(apiUrl(ApiEndpoints.part_list, pk), payload);
      }

      const ops = buildParameterOps(templates, paramValues, existingRows);
      const failures = await runParameterOps(api, pk, ops);

      return { pk, failures, created: currentPartId == null };
    },
    onSuccess: ({ pk, failures, created }) => {
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: fzGlobalKey('parts') });
      queryClient.invalidateQueries({ queryKey: fzGlobalKey('part', pk) });
      queryClient.invalidateQueries({
        queryKey: fzGlobalKey('parameters', pk)
      });

      if (failures.length > 0) {
        const errors: Record<number, string> = {};
        for (const failure of failures) {
          errors[failure.templatePk] = failure.message;
        }
        setParamErrors(errors);
        setCurrentPartId(pk);
        notifications.show({
          title: 'Item saved',
          message: `${failures.length} parameter${failures.length === 1 ? '' : 's'} failed to save`,
          color: 'orange'
        });
        return;
      }

      setParamErrors({});

      if (created) {
        // Stay open in edit mode: image + price breaks are now available
        setCurrentPartId(pk);
        notifications.show({
          title: 'Item created',
          message: 'You can now add an image and price breaks',
          color: 'green'
        });
      } else {
        notifications.show({
          title: 'Item saved',
          message: form.name,
          color: 'green'
        });
        onClose();
      }
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

  const setField = <K extends keyof ItemForm>(key: K, value: ItemForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={currentPartId == null ? 'New item' : 'Edit item'}
      position='right'
      size='xl'
      data-testid='fz-item-drawer'
    >
      <Stack gap='sm'>
        {currentPartId != null && (
          <ItemImage
            partId={currentPartId}
            image={partQuery.data?.image}
            editable={canWrite}
          />
        )}

        <TextInput
          label='Name'
          required
          value={form.name}
          error={fieldErrors.name}
          onChange={(event) => setField('name', event.currentTarget.value)}
          data-testid='fz-item-name'
        />
        <SimpleGrid cols={2} spacing='sm'>
          <Select
            label='Category'
            data={categoryOptions}
            value={form.category}
            error={fieldErrors.category}
            onChange={(value) => setField('category', value)}
            clearable
            searchable
          />
          <TextInput
            label='IPN'
            description='Internal part number'
            value={form.IPN}
            error={fieldErrors.IPN}
            onChange={(event) => setField('IPN', event.currentTarget.value)}
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
        <SimpleGrid cols={2} spacing='sm'>
          <TextInput
            label='Units'
            value={form.units}
            error={fieldErrors.units}
            onChange={(event) => setField('units', event.currentTarget.value)}
          />
          <NumberInput
            label='Minimum stock'
            description='Low-stock warning level'
            value={form.minimum_stock}
            min={0}
            error={fieldErrors.minimum_stock}
            onChange={(value) =>
              setField('minimum_stock', typeof value === 'number' ? value : '')
            }
          />
        </SimpleGrid>
        <Group gap='xl'>
          <Switch
            label='Active'
            checked={form.active}
            onChange={(event) =>
              setField('active', event.currentTarget.checked)
            }
          />
          <Switch
            label='Salable'
            checked={form.salable}
            onChange={(event) =>
              setField('salable', event.currentTarget.checked)
            }
          />
          <Switch
            label='Purchaseable'
            checked={form.purchaseable}
            onChange={(event) =>
              setField('purchaseable', event.currentTarget.checked)
            }
          />
        </Group>

        <Divider label='Parameters' labelPosition='left' />
        <ParameterInputs
          templates={templates}
          values={paramValues}
          errors={paramErrors}
          onChange={(templatePk, value) => {
            setParamValues((current) => ({ ...current, [templatePk]: value }));
          }}
        />

        <Divider label='Price breaks' labelPosition='left' />
        {currentPartId != null ? (
          <PriceBreakSection partId={currentPartId} />
        ) : (
          <Text size='sm' c='dimmed'>
            Save the item first to add price breaks and an image.
          </Text>
        )}

        <Group justify='flex-end' mt='sm'>
          <Button variant='default' onClick={onClose}>
            {currentPartId != null && partId == null ? 'Done' : 'Cancel'}
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            disabled={!canWrite || !form.name.trim()}
            data-testid='fz-item-save'
          >
            {currentPartId == null ? 'Create item' : 'Save'}
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
