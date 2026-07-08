import { t } from '@lingui/core/macro';
import { Stack } from '@mantine/core';

import { StylishText } from '@lib/components/StylishText';
import TenantTable from '../../../../tables/settings/TenantTable';

export default function TenantManagementPanel() {
  return (
    <Stack gap='xs'>
      <StylishText size='lg'>{t`Branches`}</StylishText>
      <TenantTable />
    </Stack>
  );
}
