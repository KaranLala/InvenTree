import { NavLink, Skeleton, Stack, Text } from '@mantine/core';
import { IconMapPin, IconMapPinOff, IconMapPins } from '@tabler/icons-react';
import { useMemo } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { listResults, useBranchQuery } from '../../api/useBranchQuery';

export interface StockLocationNode {
  pk: number;
  name: string;
  parent: number | null;
  pathstring: string;
  structural: boolean;
}

/**
 * Sidebar tree of the active branch's stock locations.
 * selected: location pk, 'null' for "no location", or undefined for all.
 */
export default function LocationTree({
  selected,
  onSelect
}: {
  selected: number | 'null' | undefined;
  onSelect: (value: number | 'null' | undefined) => void;
}) {
  const { data, isLoading } = useBranchQuery({
    key: ['stock-locations'],
    endpoint: ApiEndpoints.stock_location_list
  });

  const locations: StockLocationNode[] = useMemo(
    () => listResults(data),
    [data]
  );

  const childMap = useMemo(() => {
    const map = new Map<number | null, StockLocationNode[]>();

    for (const location of locations) {
      const key = location.parent ?? null;
      const existing = map.get(key) ?? [];
      existing.push(location);
      map.set(key, existing);
    }

    for (const children of map.values()) {
      children.sort((a, b) => a.name.localeCompare(b.name));
    }

    return map;
  }, [locations]);

  // Roots: locations with no parent, or whose parent is outside this branch
  const roots = useMemo(() => {
    const pks = new Set(locations.map((location) => location.pk));
    return locations
      .filter(
        (location) => location.parent == null || !pks.has(location.parent)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [locations]);

  const renderNode = (node: StockLocationNode) => {
    const children = childMap.get(node.pk) ?? [];

    return (
      <NavLink
        key={node.pk}
        label={node.name}
        leftSection={<IconMapPin size={16} />}
        active={selected === node.pk}
        defaultOpened={children.length > 0 && children.length <= 5}
        onClick={() => onSelect(selected === node.pk ? undefined : node.pk)}
      >
        {children.length > 0 ? children.map(renderNode) : null}
      </NavLink>
    );
  };

  if (isLoading) {
    return (
      <Stack gap='xs'>
        <Skeleton height={28} />
        <Skeleton height={28} />
        <Skeleton height={28} />
      </Stack>
    );
  }

  return (
    <Stack gap={0}>
      <Text size='xs' fw={700} c='dimmed' tt='uppercase' mb={4}>
        Locations
      </Text>
      <NavLink
        label='All locations'
        leftSection={<IconMapPins size={16} />}
        active={selected === undefined}
        onClick={() => onSelect(undefined)}
      />
      {roots.map(renderNode)}
      <NavLink
        label='No location'
        leftSection={<IconMapPinOff size={16} />}
        active={selected === 'null'}
        onClick={() => onSelect(selected === 'null' ? undefined : 'null')}
      />
    </Stack>
  );
}
