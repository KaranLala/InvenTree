import {
  ActionIcon,
  Button,
  Group,
  Loader,
  Table,
  Text,
  TextInput,
  Tooltip
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconPencil, IconTrash, IconX } from '@tabler/icons-react';
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

interface ContactForm {
  name: string;
  phone: string;
  email: string;
  role: string;
}

const EMPTY_CONTACT: ContactForm = { name: '', phone: '', email: '', role: '' };

/**
 * Contact persons for a company: inline-editable table rows plus a
 * persistent add-row. Plain mutate -> invalidate, no optimistic updates.
 */
export default function ContactSection({
  companyId,
  kind
}: {
  companyId: number;
  kind: CompanyKind;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const user = useUserState();

  // pk of the row being edited; 'new' rows use the add-row form state
  const [editingPk, setEditingPk] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ContactForm>(EMPTY_CONTACT);
  const [addForm, setAddForm] = useState<ContactForm>(EMPTY_CONTACT);

  const contactsQuery = useGlobalQuery({
    key: ['company', companyId, 'contacts'],
    endpoint: ApiEndpoints.contact_list,
    params: { company: companyId, limit: 100, ordering: 'name' }
  });

  const contacts: any[] = listResults(contactsQuery.data);

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: fzGlobalKey('company', companyId, 'contacts')
    });

  const showError = (title: string) => (error: any) =>
    notifications.show({
      title,
      message: extractErrorMessage(error),
      color: 'red'
    });

  const addMutation = useMutation({
    mutationFn: async () =>
      api.post(apiUrl(ApiEndpoints.contact_list), {
        company: companyId,
        ...addForm
      }),
    onSuccess: () => {
      setAddForm(EMPTY_CONTACT);
      invalidate();
    },
    onError: showError('Could not add contact')
  });

  const editMutation = useMutation({
    mutationFn: async (pk: number) =>
      api.patch(apiUrl(ApiEndpoints.contact_list, pk), editForm),
    onSuccess: () => {
      setEditingPk(null);
      invalidate();
    },
    onError: showError('Could not save contact')
  });

  const deleteMutation = useMutation({
    mutationFn: async (pk: number) =>
      api.delete(apiUrl(ApiEndpoints.contact_list, pk)),
    onSuccess: invalidate,
    onError: showError('Could not delete contact')
  });

  const canAdd = user.hasAddRole(kind.role);
  const canChange = user.hasChangeRole(kind.role);
  const canDelete = user.hasDeleteRole(kind.role);

  const setEditField = (key: keyof ContactForm, value: string) =>
    setEditForm((current) => ({ ...current, [key]: value }));
  const setAddField = (key: keyof ContactForm, value: string) =>
    setAddForm((current) => ({ ...current, [key]: value }));

  if (contactsQuery.isLoading) {
    return <Loader size='xs' />;
  }

  return (
    <Table data-testid='fz-company-contacts'>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Name</Table.Th>
          <Table.Th>Phone</Table.Th>
          <Table.Th>Email</Table.Th>
          <Table.Th>Role</Table.Th>
          <Table.Th w={80} />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {contacts.length === 0 && (
          <Table.Tr>
            <Table.Td colSpan={5}>
              <Text size='sm' c='dimmed'>
                No contacts yet
              </Text>
            </Table.Td>
          </Table.Tr>
        )}
        {contacts.map((contact) =>
          editingPk === contact.pk ? (
            <Table.Tr key={contact.pk}>
              <Table.Td>
                <TextInput
                  size='xs'
                  value={editForm.name}
                  onChange={(e) => setEditField('name', e.currentTarget.value)}
                  aria-label='contact-edit-name'
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  size='xs'
                  value={editForm.phone}
                  onChange={(e) => setEditField('phone', e.currentTarget.value)}
                  aria-label='contact-edit-phone'
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  size='xs'
                  value={editForm.email}
                  onChange={(e) => setEditField('email', e.currentTarget.value)}
                  aria-label='contact-edit-email'
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  size='xs'
                  value={editForm.role}
                  onChange={(e) => setEditField('role', e.currentTarget.value)}
                  aria-label='contact-edit-role'
                />
              </Table.Td>
              <Table.Td>
                <Group gap={4} wrap='nowrap'>
                  <ActionIcon
                    variant='subtle'
                    color='green'
                    size='sm'
                    loading={editMutation.isPending}
                    disabled={!editForm.name.trim()}
                    onClick={() => editMutation.mutate(contact.pk)}
                    aria-label='contact-save'
                  >
                    <IconCheck size={14} />
                  </ActionIcon>
                  <ActionIcon
                    variant='subtle'
                    size='sm'
                    onClick={() => setEditingPk(null)}
                    aria-label='contact-cancel'
                  >
                    <IconX size={14} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ) : (
            <Table.Tr key={contact.pk}>
              <Table.Td>
                <Text size='sm' fw={500}>
                  {contact.name}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size='sm'>{contact.phone || '-'}</Text>
              </Table.Td>
              <Table.Td>
                <Text size='sm'>{contact.email || '-'}</Text>
              </Table.Td>
              <Table.Td>
                <Text size='sm' c='dimmed'>
                  {contact.role || '-'}
                </Text>
              </Table.Td>
              <Table.Td>
                <Group gap={4} wrap='nowrap'>
                  {canChange && (
                    <Tooltip label='Edit contact'>
                      <ActionIcon
                        variant='subtle'
                        size='sm'
                        onClick={() => {
                          setEditingPk(contact.pk);
                          setEditForm({
                            name: contact.name ?? '',
                            phone: contact.phone ?? '',
                            email: contact.email ?? '',
                            role: contact.role ?? ''
                          });
                        }}
                        aria-label={`contact-edit-${contact.pk}`}
                      >
                        <IconPencil size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip label='Delete contact'>
                      <ActionIcon
                        variant='subtle'
                        color='red'
                        size='sm'
                        onClick={() => deleteMutation.mutate(contact.pk)}
                        aria-label={`contact-delete-${contact.pk}`}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          )
        )}
        {canAdd && (
          <Table.Tr>
            <Table.Td>
              <TextInput
                size='xs'
                placeholder='Name'
                value={addForm.name}
                onChange={(e) => setAddField('name', e.currentTarget.value)}
                aria-label='contact-add-name'
              />
            </Table.Td>
            <Table.Td>
              <TextInput
                size='xs'
                placeholder='Phone'
                value={addForm.phone}
                onChange={(e) => setAddField('phone', e.currentTarget.value)}
                aria-label='contact-add-phone'
              />
            </Table.Td>
            <Table.Td>
              <TextInput
                size='xs'
                placeholder='Email'
                value={addForm.email}
                onChange={(e) => setAddField('email', e.currentTarget.value)}
                aria-label='contact-add-email'
              />
            </Table.Td>
            <Table.Td>
              <TextInput
                size='xs'
                placeholder='Role'
                value={addForm.role}
                onChange={(e) => setAddField('role', e.currentTarget.value)}
                aria-label='contact-add-role'
              />
            </Table.Td>
            <Table.Td>
              <Button
                size='compact-xs'
                onClick={() => addMutation.mutate()}
                loading={addMutation.isPending}
                disabled={!addForm.name.trim()}
                data-testid='fz-company-contact-add'
              >
                Add
              </Button>
            </Table.Td>
          </Table.Tr>
        )}
      </Table.Tbody>
    </Table>
  );
}
