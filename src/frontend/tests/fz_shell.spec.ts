import { expect, test } from './baseFixtures.js';
import { loginUrl } from './defaults.js';
import { navigate } from './helpers.js';
import { doLogin } from './login.js';

/**
 * Smoke tests for the FZ branch app shell (/b/):
 * - login lands on the FZ app by default
 * - a branch is auto-selected and shown in the top bar
 * - switching branch persists across a reload
 * - the classic InvenTree UI remains reachable
 */

test('FZ Shell - Default landing and branch bootstrap', async ({ page }) => {
  await navigate(page, loginUrl);
  await page.waitForURL('**/web/login');

  await page.getByLabel('login-username').fill('allaccess');
  await page.getByLabel('login-password').fill('nolimits');
  await page.getByRole('button', { name: 'Log in' }).click();

  // Login lands on the FZ app sales order section
  await page.waitForURL('**/web/b/so/');

  // The FZ top bar is visible with its section navigation
  await page.getByText('Fanzart').first().waitFor();
  await page.getByRole('button', { name: 'Sales' }).waitFor();
  await page.getByRole('button', { name: 'Purchasing' }).waitFor();
  await page.getByRole('button', { name: 'Stock' }).waitFor();

  // A branch has been auto-selected (selector is non-empty)
  const branchSelect = page.getByLabel('Active branch');
  await expect(branchSelect).not.toHaveValue('');
});

test('FZ Shell - Branch switch persists across reload', async ({ page }) => {
  await doLogin(page);
  await navigate(page, 'b/so/');
  await page.waitForURL('**/web/b/so/');

  const branchSelect = page.getByLabel('Active branch');
  await expect(branchSelect).not.toHaveValue('');

  // Open the selector and pick the last option
  await branchSelect.click();
  const options = page.getByRole('option');
  const count = await options.count();
  expect(count).toBeGreaterThan(0);

  const lastOption = options.nth(count - 1);
  const lastLabel = await lastOption.textContent();
  await lastOption.click();

  await expect(branchSelect).toHaveValue(lastLabel ?? '');

  // Selection survives a reload
  await page.reload();
  await page.waitForURL('**/web/b/so/');
  await expect(branchSelect).toHaveValue(lastLabel ?? '');
});

test('FZ Shell - Section navigation and classic UI escape hatch', async ({
  page
}) => {
  await doLogin(page);
  await navigate(page, 'b/');
  await page.waitForURL('**/web/b/so/');

  // Navigate between FZ sections
  await page.getByRole('button', { name: 'Stock' }).click();
  await page.waitForURL('**/web/b/stock/');
  await page.getByRole('heading', { name: 'Stock' }).waitFor();

  await page.getByRole('button', { name: 'Purchasing' }).click();
  await page.waitForURL('**/web/b/po/');
  await page.getByRole('heading', { name: 'Purchase Orders' }).waitFor();

  // Escape hatch to the classic UI
  await page.getByLabel('open-full-inventree').click();
  await page.waitForURL('**/web/home');
  await page.getByRole('link', { name: 'Dashboard' }).waitFor();

  // And back to the FZ app from the classic header
  await page.getByLabel('open-branch-app').click();
  await page.waitForURL('**/web/b/so/');
});
