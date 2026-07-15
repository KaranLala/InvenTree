import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Stack,
  Text,
  Title,
  Tooltip
} from '@mantine/core';
import {
  IconArrowLeft,
  IconExternalLink,
  IconPencil
} from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { useUserState } from '../../../states/UserState';
import { useGlobalQuery } from '../../api/useBranchQuery';
import BranchEditorDrawer from './BranchEditorDrawer';
import LocationSection from './LocationSection';

/** One dimmed label / value pair in the header info strip. */
function InfoItem({ label, value }: { label: string; value?: string | null }) {
  if (!value) {
    return null;
  }
  return (
    <div>
      <Text size='xs' c='dimmed'>
        {label}
      </Text>
      <Text size='sm' fw={500}>
        {value}
      </Text>
    </div>
  );
}

/**
 * Manage one branch: info strip, edit drawer, and the branch's stock
 * location tree. Rare admin tasks live behind the "Open in InvenTree"
 * escape hatch (classic Admin Center branch panel).
 */
export default function FzBranchDetail() {
  const { id } = useParams();
  const branchId = Number(id);

  const navigate = useNavigate();
  const user = useUserState();

  const [drawerOpen, setDrawerOpen] = useState(false);

  const branchQuery = useGlobalQuery({
    key: ['branches', branchId],
    endpoint: ApiEndpoints.tenant_detail,
    pk: branchId
  });

  const branch = branchQuery.data;

  if (branchQuery.isLoading) {
    return (
      <Center h='60vh'>
        <Loader />
      </Center>
    );
  }

  if (!branch) {
    return (
      <Center h='60vh'>
        <Text c='dimmed'>Branch not found</Text>
      </Center>
    );
  }

  return (
    <Stack data-testid='fz-branch-detail'>
      <Group justify='space-between' wrap='nowrap' align='flex-start'>
        <Group gap='sm' wrap='nowrap'>
          <ActionIcon
            variant='subtle'
            onClick={() => navigate('/b/branches/')}
            aria-label='back-to-list'
          >
            <IconArrowLeft size={20} />
          </ActionIcon>
          <div>
            <Group gap='sm'>
              <Title order={3}>{branch.name}</Title>
              {branch.code && (
                <Badge variant='light' color='blue'>
                  {branch.code}
                </Badge>
              )}
              {!branch.is_active && (
                <Badge variant='light' color='gray'>
                  Inactive
                </Badge>
              )}
            </Group>
            {branch.description && (
              <Text size='sm' c='dimmed'>
                {branch.description}
              </Text>
            )}
          </div>
        </Group>
        <Group gap='xs' wrap='nowrap'>
          <Button
            size='compact-sm'
            variant='light'
            leftSection={<IconPencil size={14} />}
            onClick={() => setDrawerOpen(true)}
            disabled={!user.isStaff()}
            data-testid='fz-branch-edit'
          >
            Edit
          </Button>
          <Tooltip label='Open in InvenTree'>
            <ActionIcon
              variant='subtle'
              onClick={() => navigate('/settings/admin/tenant')}
              aria-label='open-in-inventree'
            >
              <IconExternalLink size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Group gap='xl'>
        <InfoItem label='Contact' value={branch.contact_name} />
        <InfoItem label='Email' value={branch.contact_email} />
        <InfoItem label='Phone' value={branch.contact_phone} />
      </Group>

      <Divider label='Locations' labelPosition='left' />
      <LocationSection branchId={branchId} branchName={branch.name} />

      <BranchEditorDrawer
        opened={drawerOpen}
        branchId={branchId}
        onClose={() => setDrawerOpen(false)}
      />
    </Stack>
  );
}
