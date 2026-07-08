import { expect, test } from './baseFixtures.js';
import { navigate } from './helpers.js';
import { doLogin } from './login.js';

/**
 * Tests for the FZ branch-scoped stock browser (/b/stock/).
 */

test('FZ Stock - Browser renders branch-scoped stock', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/stock/');
  await page.waitForURL('**/web/b/stock/');

  // Location sidebar and search input are present
  await page.getByText('Locations', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'All locations' }).waitFor();
  await page.getByTestId('fz-stock-search').waitFor();

  // The stock table renders with at least one row
  await page.getByTestId('fz-stock-table').waitFor();
  const rows = page.locator('[data-testid="fz-stock-table"] tbody tr');
  expect(await rows.count()).toBeGreaterThan(0);
});

test('FZ Stock - Search filters and shows empty state', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/stock/');
  await page.waitForURL('**/web/b/stock/');
  await page.getByTestId('fz-stock-table').waitFor();

  // A nonsense search shows the empty state
  await page.getByTestId('fz-stock-search').fill('zzzz-no-such-stock-item');
  await page.getByText('No stock found').waitFor();

  // Clearing the search brings the rows back
  await page.getByTestId('fz-stock-search').fill('');
  await page.getByTestId('fz-stock-table').waitFor();
});

test('FZ Stock - Adjust and transfer modals open', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/stock/');
  await page.waitForURL('**/web/b/stock/');
  await page.getByTestId('fz-stock-table').waitFor();

  // Open the adjust menu on the first row and pick "Count"
  await page.locator('[aria-label^="adjust-stock-"]').first().click();
  await page.getByRole('menuitem', { name: 'Count' }).click();

  // The count modal opens with a quantity input, then cancel
  await page.getByText('Count stock').first().waitFor();
  await page.locator('[aria-label^="adjust-quantity-"]').first().waitFor();
  await page.getByRole('button', { name: 'Cancel' }).click();

  // Open the transfer modal on the first row
  await page.locator('[aria-label^="transfer-stock-"]').first().click();
  await page.getByText('Transfer stock').first().waitFor();
  await page.getByLabel('transfer-destination').waitFor();
  await page.getByRole('button', { name: 'Cancel' }).click();
});
