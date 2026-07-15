import { expect, test } from './baseFixtures.js';
import { navigate } from './helpers.js';
import { doLogin } from './login.js';

/**
 * Tests for the FZ Branches section (/b/branches/):
 * branch list, branch detail with location tree, editor drawer.
 */

test('FZ Branches - List renders with branches', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/branches/');
  await page.waitForURL('**/web/b/branches/');

  await page.getByTestId('fz-branch-create').waitFor();
  await page.getByTestId('fz-branches-table').waitFor();

  const rows = page.locator('[data-testid="fz-branches-table"] tbody tr');
  expect(await rows.count()).toBeGreaterThan(0);
});

test('FZ Branches - Create drawer opens empty', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/branches/');
  await page.waitForURL('**/web/b/branches/');
  await page.getByTestId('fz-branches-table').waitFor();

  await page.getByTestId('fz-branch-create').click();
  await page.getByText('New branch').first().waitFor();
  await expect(page.getByTestId('fz-branch-name')).toHaveValue('');
  await expect(page.getByTestId('fz-branch-save')).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel' }).click();
});

test('FZ Branches - Detail page shows locations', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/branches/');
  await page.waitForURL('**/web/b/branches/');
  await page.getByTestId('fz-branches-table').waitFor();

  await page
    .locator('[data-testid="fz-branches-table"] tbody tr')
    .first()
    .click();
  await page.waitForURL('**/web/b/branches/*');

  await page.getByTestId('fz-branch-detail').waitFor();
  await page.getByTestId('fz-branch-edit').waitFor();
  await page.getByText('Locations').first().waitFor();
  await page.getByTestId('fz-location-add').waitFor();
});

test('FZ Branches - Location modal opens', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/branches/');
  await page.waitForURL('**/web/b/branches/');
  await page.getByTestId('fz-branches-table').waitFor();

  await page
    .locator('[data-testid="fz-branches-table"] tbody tr')
    .first()
    .click();
  await page.getByTestId('fz-branch-detail').waitFor();

  await page.getByTestId('fz-location-add').click();
  await page.getByText('New location').first().waitFor();
  await expect(page.getByTestId('fz-location-name')).toHaveValue('');
  await expect(page.getByTestId('fz-location-save')).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel' }).click();
});
