import { Loader, Select, SimpleGrid, Text, TextInput } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import type { AxiosInstance } from 'axios';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { apiUrl } from '@lib/functions/Api';
import { useApi } from '../../../contexts/ApiContext';
import { extractErrorMessage } from '../../api/errors';
import { fzGlobalKey, listResults } from '../../api/useBranchQuery';

export interface ParameterTemplate {
  pk: number;
  name: string;
  description: string;
  units: string;
  checkbox: boolean;
  choices: string;
  selectionlist: number | null;
}

export interface ExistingParameterRow {
  pk: number;
  data: string;
}

export type ParameterOp =
  | { kind: 'create'; templatePk: number; data: string }
  | { kind: 'update'; templatePk: number; rowPk: number; data: string }
  | { kind: 'delete'; templatePk: number; rowPk: number };

export interface ParameterOpFailure {
  templatePk: number;
  message: string;
}

/**
 * Diff current input values against the server rows. Empty inputs never
 * create rows; clearing a previously stored value deletes its row.
 */
export function buildParameterOps(
  templates: ParameterTemplate[],
  current: Record<number, string>,
  existingRows: Record<number, ExistingParameterRow>
): ParameterOp[] {
  const ops: ParameterOp[] = [];

  for (const template of templates) {
    const value = (current[template.pk] ?? '').trim();
    const row = existingRows[template.pk];

    if (!row && value) {
      ops.push({ kind: 'create', templatePk: template.pk, data: value });
    } else if (row && value && value !== String(row.data).trim()) {
      ops.push({
        kind: 'update',
        templatePk: template.pk,
        rowPk: row.pk,
        data: value
      });
    } else if (row && !value) {
      ops.push({ kind: 'delete', templatePk: template.pk, rowPk: row.pk });
    }
  }

  return ops;
}

/**
 * Execute parameter ops sequentially, collecting per-template failures
 * (the server validates choices/units/checkbox values). Re-running the
 * save re-diffs against refetched rows, so retries are idempotent.
 */
export async function runParameterOps(
  api: AxiosInstance,
  partId: number,
  ops: ParameterOp[]
): Promise<ParameterOpFailure[]> {
  const failures: ParameterOpFailure[] = [];

  for (const op of ops) {
    try {
      if (op.kind === 'create') {
        await api.post(apiUrl(ApiEndpoints.parameter_list), {
          model_type: 'part',
          model_id: partId,
          template: op.templatePk,
          data: op.data
        });
      } else if (op.kind === 'update') {
        await api.patch(apiUrl(ApiEndpoints.parameter_list, op.rowPk), {
          data: op.data
        });
      } else {
        await api.delete(apiUrl(ApiEndpoints.parameter_list, op.rowPk));
      }
    } catch (error: any) {
      const dataError = error?.response?.data?.data;
      failures.push({
        templatePk: op.templatePk,
        message: dataError
          ? String(Array.isArray(dataError) ? dataError[0] : dataError)
          : extractErrorMessage(error)
      });
    }
  }

  return failures;
}

/**
 * One input per admin-defined parameter template, typed by the
 * template shape (checkbox / choices / selection list / units / text).
 */
export default function ParameterInputs({
  templates,
  values,
  errors,
  onChange
}: {
  templates: ParameterTemplate[];
  values: Record<number, string>;
  errors: Record<number, string>;
  onChange: (templatePk: number, value: string) => void;
}) {
  if (templates.length === 0) {
    return (
      <Text size='sm' c='dimmed'>
        No custom parameters defined. Add parameter templates in the Admin
        Center.
      </Text>
    );
  }

  return (
    <SimpleGrid cols={2} spacing='sm' data-testid='fz-item-params'>
      {templates.map((template) => (
        <ParameterInput
          key={template.pk}
          template={template}
          value={values[template.pk] ?? ''}
          error={errors[template.pk]}
          onChange={(value) => onChange(template.pk, value)}
        />
      ))}
    </SimpleGrid>
  );
}

function ParameterInput({
  template,
  value,
  error,
  onChange
}: {
  template: ParameterTemplate;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const common = {
    label: template.name,
    description: template.description || undefined,
    error: error,
    'aria-label': `param-${template.pk}`
  };

  if (template.checkbox) {
    // Three states: unset (no row), Yes, No — a plain checkbox
    // cannot express "unset"
    return (
      <Select
        {...common}
        data={[
          { value: 'True', label: 'Yes' },
          { value: 'False', label: 'No' }
        ]}
        value={value || null}
        onChange={(selected) => onChange(selected ?? '')}
        clearable
        placeholder='—'
      />
    );
  }

  if (template.choices) {
    return (
      <Select
        {...common}
        data={template.choices
          .split(',')
          .map((choice) => choice.trim())
          .filter(Boolean)}
        value={value || null}
        onChange={(selected) => onChange(selected ?? '')}
        clearable
        searchable
        placeholder='—'
      />
    );
  }

  if (template.selectionlist) {
    return (
      <SelectionListInput
        common={common}
        selectionList={template.selectionlist}
        value={value}
        onChange={onChange}
      />
    );
  }

  return (
    <TextInput
      {...common}
      value={value}
      rightSection={
        template.units ? (
          <Text size='xs' c='dimmed'>
            {template.units}
          </Text>
        ) : undefined
      }
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}

/** Options come from the template's selection list; the value stored
 *  is the entry value. Falls back to free text if the list fails to
 *  load — the server validates either way. */
function SelectionListInput({
  common,
  selectionList,
  value,
  onChange
}: {
  common: Record<string, any>;
  selectionList: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const api = useApi();

  const { data, isLoading, isError } = useQuery({
    queryKey: fzGlobalKey('selection-list', selectionList),
    queryFn: async () =>
      api
        .get(
          apiUrl(ApiEndpoints.selectionentry_list, undefined, {
            id: selectionList
          })
        )
        .then((res) => listResults(res.data))
  });

  if (isLoading) {
    return <TextInput {...common} value={value} readOnly rightSection={<Loader size='xs' />} />;
  }

  if (isError || !data) {
    return (
      <TextInput
        {...common}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  }

  return (
    <Select
      {...common}
      data={data
        .filter((entry: any) => entry.active !== false)
        .map((entry: any) => ({
          value: String(entry.value),
          label: entry.label || String(entry.value)
        }))}
      value={value || null}
      onChange={(selected) => onChange(selected ?? '')}
      clearable
      searchable
      placeholder='—'
    />
  );
}
