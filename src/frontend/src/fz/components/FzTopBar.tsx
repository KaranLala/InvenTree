import {
  ActionIcon,
  Box,
  Button,
  Group,
  Menu,
  Select,
  Text,
  Tooltip
} from '@mantine/core';
import {
  IconBuildingStore,
  IconChevronDown,
  IconClipboardList,
  IconExternalLink,
  IconLogout,
  IconTruck,
  IconUserCircle,
  IconUsers
} from '@tabler/icons-react';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useUserState } from '../../states/UserState';
import { useBranches } from '../api/useBranchQuery';
import { useBranchState } from '../state/BranchState';

/** Branch-scoped (tenant-filtered) operations — the primary daily-work views. */
const PRIMARY_SECTIONS = [
  { key: 'so', label: 'Sales', path: '/b/so/' },
  { key: 'po', label: 'Purchasing', path: '/b/po/' },
  { key: 'stock', label: 'Stock', path: '/b/stock/' }
] as const;

/** Global master data — shared across all branches, touched less often. */
const GLOBAL_SECTIONS = [
  {
    key: 'items',
    label: 'Item master',
    path: '/b/items/',
    icon: IconClipboardList
  },
  {
    key: 'customers',
    label: 'Customers',
    path: '/b/customers/',
    icon: IconUsers
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    path: '/b/suppliers/',
    icon: IconTruck
  }
] as const;

const GLOBAL_KEYS: readonly string[] = GLOBAL_SECTIONS.map((s) => s.key);

export default function FzTopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserState();

  const { data: branches } = useBranches();
  const { activeBranchId, setActiveBranch } = useBranchState();

  // Path is /b/<section>/... — highlight the active section
  const activeSection = location.pathname.split('/')[2] ?? 'so';
  const isGlobalSection = GLOBAL_KEYS.includes(activeSection);

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
          {PRIMARY_SECTIONS.map((section) => (
            <Button
              key={section.key}
              size='compact-sm'
              variant={activeSection === section.key ? 'light' : 'subtle'}
              onClick={() => navigate(section.path)}
            >
              {section.label}
            </Button>
          ))}
          <Menu position='bottom-start' width={200}>
            <Menu.Target>
              <Button
                size='compact-sm'
                variant={isGlobalSection ? 'light' : 'subtle'}
                rightSection={<IconChevronDown size={14} />}
                data-testid='fz-master-data-menu'
              >
                Master data
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Global · all branches</Menu.Label>
              {GLOBAL_SECTIONS.map((section) => (
                <Menu.Item
                  key={section.key}
                  leftSection={<section.icon size={16} />}
                  onClick={() => navigate(section.path)}
                >
                  {section.label}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
      <Group gap='xs' wrap='nowrap'>
        <Tooltip
          label="Master data is shown for all branches — the branch filter doesn't apply here"
          disabled={!isGlobalSection}
          multiline
          w={240}
        >
          <Box style={{ opacity: isGlobalSection ? 0.5 : 1 }}>
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
          </Box>
        </Tooltip>
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
