import {
  ActionIcon,
  Button,
  Group,
  Menu,
  Select,
  Text,
  Tooltip
} from '@mantine/core';
import {
  IconBuildingStore,
  IconExternalLink,
  IconLogout,
  IconUserCircle
} from '@tabler/icons-react';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useUserState } from '../../states/UserState';
import { useBranches } from '../api/useBranchQuery';
import { useBranchState } from '../state/BranchState';

const SECTIONS = [
  { key: 'so', label: 'Sales', path: '/b/so/' },
  { key: 'po', label: 'Purchasing', path: '/b/po/' },
  { key: 'stock', label: 'Stock', path: '/b/stock/' },
  { key: 'items', label: 'Item master', path: '/b/items/' }
] as const;

export default function FzTopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserState();

  const { data: branches } = useBranches();
  const { activeBranchId, setActiveBranch } = useBranchState();

  // Path is /b/<section>/... — highlight the active section
  const activeSection = location.pathname.split('/')[2] ?? 'so';

  const branchOptions = useMemo(
    () =>
      (branches ?? []).map((branch) => ({
        value: String(branch.pk),
        label: branch.code ? `${branch.name} (${branch.code})` : branch.name
      })),
    [branches]
  );

  return (
    <Group justify='space-between' px='md' h='100%' wrap='nowrap'>
      <Group gap='xs' wrap='nowrap'>
        <IconBuildingStore size={22} />
        <Text fw={700} size='lg'>
          Fanzart
        </Text>
        <Group gap={4} ml='md' wrap='nowrap'>
          {SECTIONS.map((section) => (
            <Button
              key={section.key}
              size='compact-sm'
              variant={activeSection === section.key ? 'light' : 'subtle'}
              onClick={() => navigate(section.path)}
            >
              {section.label}
            </Button>
          ))}
        </Group>
      </Group>
      <Group gap='xs' wrap='nowrap'>
        <Select
          aria-label='Active branch'
          data={branchOptions}
          value={activeBranchId != null ? String(activeBranchId) : null}
          onChange={(value) => {
            if (value) {
              setActiveBranch(Number.parseInt(value, 10));
            }
          }}
          placeholder='Select branch'
          allowDeselect={false}
          searchable={branchOptions.length > 6}
          w={220}
          size='sm'
        />
        <Tooltip label='Full InvenTree'>
          <ActionIcon
            variant='subtle'
            aria-label='open-full-inventree'
            onClick={() => navigate('/home')}
          >
            <IconExternalLink size={20} />
          </ActionIcon>
        </Tooltip>
        <Menu position='bottom-end'>
          <Menu.Target>
            <ActionIcon variant='subtle' aria-label='fz-user-menu'>
              <IconUserCircle size={22} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{user.username()}</Menu.Label>
            <Menu.Item
              leftSection={<IconExternalLink size={16} />}
              onClick={() => navigate('/home')}
            >
              Full InvenTree
            </Menu.Item>
            <Menu.Item
              leftSection={<IconLogout size={16} />}
              onClick={() => navigate('/logout')}
            >
              Logout
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );
}
