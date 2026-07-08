import { expect, test } from './baseFixtures.js';
import { navigate } from './helpers.js';
import { doLogin } from './login.js';

/**
 * Tests for the FZ Customers and Suppliers sections
 * (global company management, /b/customers/ and /b/suppliers/).
 */

test('FZ Customers - List renders with customers', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/customers/');
  await page.waitForURL('**/web/b/customers/');

  await page.getByTestId('fz-customers-search').waitFor();
  await page.getByText('Active only').waitFor();
  await page.getByTestId('fz-customers-table').waitFor();

  const rows = page.locator('[data-testid="fz-customers-table"] tbody tr');
  expect(await rows.count()).toBeGreaterThan(0);
});

test('FZ Customers - Search shows empty state', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/customers/');
  await page.waitForURL('**/web/b/customers/');
  await page.getByTestId('fz-customers-table').waitFor();

  await page.getByTestId('fz-customers-search').fill('zzzz-no-such-customer');
  await page.getByText('No customers found').waitFor();

  await page.getByTestId('fz-customers-search').fill('');
  await page.getByTestId('fz-customers-table').waitFor();
});

test('FZ Customers - Create drawer opens empty', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/customers/');
  await page.waitForURL('**/web/b/customers/');
  await page.getByTestId('fz-customers-table').waitFor();

  await page.getByTestId('fz-customers-create').click();
  await page.getByText('New customer').first().waitFor();
  await expect(page.getByTestId('fz-company-name')).toHaveValue('');
  await expect(page.getByTestId('fz-company-save')).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel' }).click();
});

test('FZ Customers - Detail page shows all sections', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/customers/');
  await page.waitForURL('**/web/b/customers/');
  await page.getByTestId('fz-customers-table').waitFor();

  await page
    .locator('[data-testid="fz-customers-table"] tbody tr')
    .first()
    .click();
  await page.waitForURL('**/web/b/customers/*');

  await page.getByTestId('fz-company-detail').waitFor();
  await page.getByTestId('fz-company-edit').waitFor();
  await page.getByText('Contacts').first().waitFor();
  await page.getByText('Addresses').first().waitFor();
  await page.getByText('Orders in the current branch').waitFor();
  await page.getByText('Price breaks').first().waitFor();
});

test('FZ Suppliers - List and detail render', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/suppliers/');
  await page.waitForURL('**/web/b/suppliers/');

  await page.getByTestId('fz-suppliers-search').waitFor();
  await page.getByTestId('fz-suppliers-table').waitFor();

  const rows = page.locator('[data-testid="fz-suppliers-table"] tbody tr');
  expect(await rows.count()).toBeGreaterThan(0);

  await rows.first().click();
  await page.waitForURL('**/web/b/suppliers/*');

  await page.getByTestId('fz-company-detail').waitFor();
  await page.getByText('Contacts').first().waitFor();
  await page.getByText('Addresses').first().waitFor();
  await page.getByText('Orders in the current branch').waitFor();

  // Suppliers have no price break section
  await expect(
    page.getByTestId('fz-customer-price-breaks')
  ).not.toBeVisible();
});
