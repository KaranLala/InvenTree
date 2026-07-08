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
import AddressSection from './AddressSection';
import CompanyEditorDrawer from './CompanyEditorDrawer';
import CompanyOrdersSection from './CompanyOrdersSection';
import ContactSection from './ContactSection';
import CustomerPriceBreakSection from './CustomerPriceBreakSection';
import { COMPANY_KINDS } from './kinds';

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
 * Single-page customer/supplier view: info strip, contacts, addresses,
 * branch-scoped order history and (customers only) price breaks.
 * Company fields are edited via the drawer; everything rare lives
 * behind the "Open in InvenTree" escape hatch.
 */
export default function FzCompanyDetail({
  kind: kindKey
}: {
  kind: 'customer' | 'supplier';
}) {
  const kind = COMPANY_KINDS[kindKey];
  const { id } = useParams();
  const companyId = Number(id);

  const navigate = useNavigate();
  const user = useUserState();

  const [drawerOpen, setDrawerOpen] = useState(false);

  const companyQuery = useGlobalQuery({
    key: ['company', companyId],
    endpoint: ApiEndpoints.company_list,
    pk: companyId,
    // Include the primary address in the response
    params: { address_detail: true }
  });

  const company = companyQuery.data;

  if (companyQuery.isLoading) {
    return (
      <Center h='60vh'>
        <Loader />
      </Center>
    );
  }

  if (!company) {
    return (
      <Center h='60vh'>
        <Text c='dimmed'>{`${kind.label.slice(0, -1)} not found`}</Text>
      </Center>
    );
  }

  const primaryAddress = company.primary_address
    ? [
        company.primary_address.line1,
        company.primary_address.postal_city,
        company.primary_address.country
      ]
        .filter(Boolean)
        .join(', ')
    : null;

  return (
    <Stack data-testid='fz-company-detail'>
      <Group justify='space-between' wrap='nowrap' align='flex-start'>
        <Group gap='sm' wrap='nowrap'>
          <ActionIcon
            variant='subtle'
            onClick={() => navigate(kind.listPath)}
            aria-label='back-to-list'
          >
            <IconArrowLeft size={20} />
          </ActionIcon>
          <div>
            <Group gap='sm'>
              <Title order={3}>{company.name}</Title>
              {!company.active && (
                <Badge variant='light' color='gray'>
                  Inactive
                </Badge>
              )}
            </Group>
            {company.description && (
              <Text size='sm' c='dimmed'>
                {company.description}
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
            disabled={!user.hasChangeRole(kind.role)}
            data-testid='fz-company-edit'
          >
            Edit
          </Button>
          <Tooltip label='Open in InvenTree'>
            <ActionIcon
              variant='subtle'
              onClick={() => navigate(kind.classicPath(companyId))}
              aria-label='open-in-inventree'
            >
              <IconExternalLink size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Group gap='xl'>
        <InfoItem label='Phone' value={company.phone} />
        <InfoItem label='Email' value={company.email} />
        <InfoItem label='Currency' value={company.currency} />
        <InfoItem label='Tax ID' value={company.tax_id} />
        <InfoItem label='Website' value={company.website} />
        <InfoItem label='Primary address' value={primaryAddress} />
      </Group>

      <Divider label='Contacts' labelPosition='left' />
      <ContactSection companyId={companyId} kind={kind} />

      <Divider label='Addresses' labelPosition='left' />
      <AddressSection companyId={companyId} kind={kind} />

      <Divider label='Orders' labelPosition='left' />
      <Text size='xs' c='dimmed'>
        Orders in the current branch
      </Text>
      <CompanyOrdersSection companyId={companyId} kind={kind} />

      {kindKey === 'customer' && (
        <>
          <Divider label='Price breaks' labelPosition='left' />
          <CustomerPriceBreakSection customerId={companyId} />
        </>
      )}

      <CompanyEditorDrawer
        opened={drawerOpen}
        kind={kind}
        companyId={companyId}
        onClose={() => setDrawerOpen(false)}
      />
    </Stack>
  );
}
