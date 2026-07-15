import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Tooltip
} from '@mantine/core';
import {
  IconExternalLink,
  IconMapPin,
  IconPencil,
  IconPlus
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { UserRoles } from '@lib/enums/Roles';
import { useUserState } from '../../../states/UserState';
import { listResults, useGlobalQuery } from '../../api/useBranchQuery';
import LocationModal from './LocationModal';

export interface BranchLocationNode {
  pk: number;
  name: string;
  description: string;
  parent: number | null;
  pathstring: string;
  structural: boolean;
  external: boolean;
  items: number;
}

/** One row of the flattened tree: a location plus its indentation depth. */
interface TreeRow {
  node: BranchLocationNode;
  depth: number;
}

/**
 * The locations of one branch as an indented tree table, with per-row
 * add-sub-location / edit actions. Delete, reparenting and location types
 * stay behind the classic-UI escape hatch.
 */
export default function LocationSection({
  branchId,
  branchName
}: {
  branchId: number;
  branchName: string;
}) {
  const navigate = useNavigate();
  const user = useUserState();

  const [modalState, setModalState] = useState<{
    opened: boolean;
    parent: BranchLocationNode | null;
    location: BranchLocationNode | null;
  }>({ opened: false, parent: null, location: null });

  const { data, isLoading } = useGlobalQuery({
    key: ['branches', branchId, 'locations'],
    endpoint: ApiEndpoints.stock_location_list,
    params: { tenant: branchId, limit: 500 }
  });

  const locations: BranchLocationNode[] = useMemo(
    () => listResults(data),
    [data]
  );

  // Flatten into depth-first rows (children indented under parents)
  const rows: TreeRow[] = useMemo(() => {
    const childMap = new Map<number, BranchLocationNode[]>();
    const pks = new Set(locations.map((location) => location.pk));

    // Roots: no parent, or parent outside this branch's set
    const roots: BranchLocationNode[] = [];
    for (const location of locations) {
      if (location.parent == null || !pks.has(location.parent)) {
        roots.push(location);
      } else {
        const siblings = childMap.get(location.parent) ?? [];
        siblings.push(location);
        childMap.set(location.parent, siblings);
      }
    }

    const byName = (a: BranchLocationNode, b: BranchLocationNode) =>
      a.name.localeCompare(b.name);

    const result: TreeRow[] = [];
    const visit = (node: BranchLocationNode, depth: number) => {
      result.push({ node, depth });
      for (const child of (childMap.get(node.pk) ?? []).sort(byName)) {
        visit(child, depth + 1);
      }
    };
    for (const root of roots.sort(byName)) {
      visit(root, 0);
    }
    return result;
  }, [locations]);

  const canAdd = user.hasAddRole(UserRoles.stock_location);
  const canChange = user.hasChangeRole(UserRoles.stock_location);

  const addButton = (
    <Button
      size='compact-sm'
      variant='light'
      leftSection={<IconPlus size={14} />}
      onClick={() =>
        setModalState({ opened: true, parent: null, location: null })
      }
      disabled={!canAdd}
      data-testid='fz-location-add'
    >
      Add location
    </Button>
  );

  return (
    <Stack gap='sm'>
      {isLoading ? (
        <Center h='20vh'>
          <Loader />
        </Center>
      ) : rows.length === 0 ? (
        <Center h='20vh'>
          <Stack align='center' gap='xs'>
            <Text fw={600}>No locations in {branchName} yet</Text>
            {addButton}
          </Stack>
        </Center>
      ) : (
        <>
          <Group justify='flex-end'>{addButton}</Group>
          <Table highlightOnHover data-testid='fz-branch-locations'>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Stock items</Table.Th>
                <Table.Th style={{ width: 120 }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map(({ node, depth }) => (
                <Table.Tr key={node.pk}>
                  <Table.Td>
                    <Group
                      gap='xs'
                      wrap='nowrap'
                      style={{ paddingLeft: depth * 24 }}
                    >
                      <IconMapPin size={16} style={{ flexShrink: 0 }} />
                      <Text size='sm' fw={500}>
                        {node.name}
                      </Text>
                      {node.structural && (
                        <Badge variant='light' color='gray' size='xs'>
                          Structural
                        </Badge>
                      )}
                      {node.external && (
                        <Badge variant='light' color='gray' size='xs'>
                          External
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm' c='dimmed' lineClamp={1}>
                      {node.description}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size='sm'>{node.items}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify='flex-end' wrap='nowrap'>
                      <Tooltip label='Add sub-location'>
                        <ActionIcon
                          variant='subtle'
                          disabled={!canAdd}
                          onClick={() =>
                            setModalState({
                              opened: true,
                              parent: node,
                              location: null
                            })
                          }
                          aria-label={`add-sublocation-${node.pk}`}
                        >
                          <IconPlus size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label='Edit'>
                        <ActionIcon
                          variant='subtle'
                          disabled={!canChange}
                          onClick={() =>
                            setModalState({
                              opened: true,
                              parent: null,
                              location: node
                            })
                          }
                          aria-label={`edit-location-${node.pk}`}
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label='Open in InvenTree'>
                        <ActionIcon
                          variant='subtle'
                          onClick={() => navigate(`/stock/location/${node.pk}`)}
                          aria-label={`open-location-${node.pk}`}
                        >
                          <IconExternalLink size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
      <LocationModal
        opened={modalState.opened}
        onClose={() =>
          setModalState((current) => ({ ...current, opened: false }))
        }
        branchId={branchId}
        parent={modalState.parent}
        location={modalState.location}
      />
    </Stack>
  );
}
