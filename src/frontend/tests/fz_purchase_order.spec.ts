import { expect, test } from './baseFixtures.js';
import { navigate } from './helpers.js';
import { doLogin } from './login.js';

/**
 * Tests for the FZ single-page purchase order workflow (/b/po/).
 */

test('FZ PO - List renders with branch-scoped orders', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/po/');
  await page.waitForURL('**/web/b/po/');

  await page.getByTestId('fz-po-search').waitFor();
  await page.getByText('Outstanding only').waitFor();
  await page.getByTestId('fz-po-create').waitFor();
});

test('FZ PO - Create modal opens without a branch field', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/po/');
  await page.waitForURL('**/web/b/po/');

  await page.getByTestId('fz-po-create').click();

  await page.getByText('Reference', { exact: false }).first().waitFor();
  await page.getByText('Supplier', { exact: false }).first().waitFor();
  await expect(page.getByText('Branch this order belongs to')).toHaveCount(0);

  await page.getByRole('button', { name: 'Cancel' }).click();
});

test('FZ PO - Ghost row searches all parts', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/po/');
  await page.waitForURL('**/web/b/po/');

  // Show all orders, then open an editable one (pending/placed/on hold)
  await page.getByText('Outstanding only').click();
  await page.getByTestId('fz-po-table').waitFor();

  await page
    .locator('[data-testid="fz-po-table"] tbody tr')
    .filter({ hasText: /Pending|Placed|On Hold/ })
    .first()
    .click();
  await page.waitForURL(/\/web\/b\/po\/\d+/);

  // Ghost row offers a global part search (not supplier-part scoped)
  await page.getByTestId('fz-po-ghost-row').waitFor();
  const search = page.getByTestId('fz-po-part-search');
  await expect(search).toHaveAttribute('placeholder', 'Add part...');

  // Any purchaseable part matches, regardless of supplier links
  await search.fill('c');
  await page.getByRole('option').first().waitFor();
});

test('FZ PO - Detail shows single-page zones', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/po/');
  await page.waitForURL('**/web/b/po/');

  // Show all orders (not only outstanding) to guarantee rows
  await page.getByText('Outstanding only').click();
  await page.getByTestId('fz-po-table').waitFor();

  await page.locator('[data-testid="fz-po-table"] tbody tr').first().click();
  await page.waitForURL(/\/web\/b\/po\/\d+/);

  await page.getByTestId('fz-po-detail').waitFor();
  await page.getByTestId('fz-po-total').waitFor();
  await page.getByTestId('fz-po-lines').waitFor();
  await page.getByLabel('open-in-inventree').waitFor();
});
