import { Select, type SelectProps } from '@mantine/core';
import { useMemo } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { listResults, useBranchQuery } from '../api/useBranchQuery';

/**
 * Searchable select listing the non-structural stock locations of the
 * active branch. Shared by stock transfer, PO receive and SO line editing.
 */
export default function FzLocationSelect({
  enabled = true,
  ...selectProps
}: { enabled?: boolean } & Omit<SelectProps, 'data'>) {
  const { data: locationData } = useBranchQuery({
    key: ['stock-locations', 'options'],
    endpoint: ApiEndpoints.stock_location_list,
    params: { structural: false },
    enabled
  });

  const locationOptions = useMemo(
    () =>
      listResults(locationData).map((location: any) => ({
        value: String(location.pk),
        label: location.pathstring || location.name
      })),
    [locationData]
  );

  return <Select data={locationOptions} searchable {...selectProps} />;
}
