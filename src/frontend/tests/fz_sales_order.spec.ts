import { expect, test } from './baseFixtures.js';
import { navigate } from './helpers.js';
import { doLogin } from './login.js';

/**
 * Tests for the FZ single-page sales order workflow (/b/so/).
 */

test('FZ SO - List renders with branch-scoped orders', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/so/');
  await page.waitForURL('**/web/b/so/');

  await page.getByTestId('fz-so-search').waitFor();
  await page.getByText('Outstanding only').waitFor();
  await page.getByTestId('fz-so-create').waitFor();
});

test('FZ SO - Create modal opens without a branch field', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/so/');
  await page.waitForURL('**/web/b/so/');

  await page.getByTestId('fz-so-create').click();

  // The ApiForm modal opens with customer + reference fields;
  // the branch is preset from the top-bar selector and hidden
  await page.getByText('Reference', { exact: false }).first().waitFor();
  await page.getByText('Customer', { exact: false }).first().waitFor();
  await expect(page.getByText('Branch this order belongs to')).toHaveCount(0);

  await page.getByRole('button', { name: 'Cancel' }).click();
});

test('FZ SO - Detail shows single-page zones', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/so/');
  await page.waitForURL('**/web/b/so/');

  // Show all orders (not only outstanding) to guarantee rows
  await page.getByText('Outstanding only').click();
  await page.getByTestId('fz-so-table').waitFor();

  // Open the first order
  await page
    .locator('[data-testid="fz-so-table"] tbody tr')
    .first()
    .click();
  await page.waitForURL(/\/web\/b\/so\/\d+/);

  // Single page: header strip, totals card, and the line grid all visible
  await page.getByTestId('fz-so-detail').waitFor();
  await page.getByTestId('fz-so-total').waitFor();
  await page.getByTestId('fz-so-lines').waitFor();
  await page.getByLabel('open-in-inventree').waitFor();
});
