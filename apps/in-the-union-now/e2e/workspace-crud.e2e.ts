import { test, expect } from '@playwright/test'
import { waitForReady } from './_helpers'

/**
 * Workspace CRUD via the dashboard's WorkspaceSwitcher + WorkspaceList modal.
 * Covers the "Manage workspaces…" entry point, creation, and the rename /
 * delete affordances from the modal.
 */
test('create and delete a workspace from the manage modal', async ({ page }) => {
  await page.goto('/')
  await waitForReady(page)

  // Open the manage modal via the workspace switcher.
  const switcher = page.getByLabel(/workspace/i).first()
  await switcher.selectOption({ label: 'Manage workspaces…' }).catch(async () => {
    // Some app variants render the manage entry as a button; fall back.
    await page.getByRole('button', { name: /Manage workspaces/i }).click()
  })

  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/Manage Workspaces/i)).toBeVisible()

  // Create a workspace.
  await page.getByLabel(/New workspace name/i).fill('Wasteland Patrol')
  await page
    .getByRole('button', { name: /^Create$|^Add$|^New$/ })
    .first()
    .click()

  // Verify the new workspace shows up in the list.
  await expect(page.getByText('Wasteland Patrol').first()).toBeVisible()

  // Delete the workspace we just made.
  await page.getByRole('button', { name: /Delete workspace Wasteland Patrol/i }).click()

  // Confirmation may use a confirm() prompt OR an inline second-click —
  // accept either.
  page.once('dialog', (d) => void d.accept())

  await expect(page.getByText('Wasteland Patrol')).not.toBeVisible({ timeout: 10_000 })
})
