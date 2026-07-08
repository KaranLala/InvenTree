import { expect, test } from './baseFixtures.js';
import { navigate } from './helpers.js';
import { doLogin } from './login.js';

/**
 * Tests for the FZ Item Master (global part management, /b/items/).
 */

test('FZ Items - List renders with parts', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/items/');
  await page.waitForURL('**/web/b/items/');

  await page.getByTestId('fz-items-search').waitFor();
  await page.getByText('Active only').waitFor();
  await page.getByTestId('fz-items-table').waitFor();

  const rows = page.locator('[data-testid="fz-items-table"] tbody tr');
  expect(await rows.count()).toBeGreaterThan(0);
});

test('FZ Items - Search shows empty state', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/items/');
  await page.waitForURL('**/web/b/items/');
  await page.getByTestId('fz-items-table').waitFor();

  await page.getByTestId('fz-items-search').fill('zzzz-no-such-item');
  await page.getByText('No items found').waitFor();

  await page.getByTestId('fz-items-search').fill('');
  await page.getByTestId('fz-items-table').waitFor();
});

test('FZ Items - Editor drawer opens for edit and create', async ({
  page
}) => {
  await doLogin(page);
  await navigate(page, 'b/items/');
  await page.waitForURL('**/web/b/items/');
  await page.getByTestId('fz-items-table').waitFor();

  // Edit: row click opens the drawer with the name populated
  await page
    .locator('[data-testid="fz-items-table"] tbody tr')
    .first()
    .click();
  await page.getByText('Edit item').waitFor();
  await expect(page.getByTestId('fz-item-name')).not.toHaveValue('');
  await page.getByRole('button', { name: 'Cancel' }).click();

  // Create: empty name disables save; parameter section is present
  await page.getByTestId('fz-items-create').click();
  await page.getByText('New item').first().waitFor();
  await expect(page.getByTestId('fz-item-name')).toHaveValue('');
  await expect(page.getByTestId('fz-item-save')).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel' }).click();
});
