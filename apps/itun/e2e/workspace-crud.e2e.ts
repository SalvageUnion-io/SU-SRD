import { expect, test } from '@playwright/test'
import { waitForReady } from './_helpers'

/**
 * Workspace CRUD via the dashboard's WorkspaceSwitcher + WorkspaceList modal.
 * Covers the "Manage workspaces…" entry point, creation, and the rename /
 * delete affordances from the modal.
 */
test('create and delete a workspace from the manage modal', async ({ page }) => {
  await page.goto('/')
  await waitForReady(page)

  // Open the manage modal via the workspace switcher select (aria-label="Select workspace").
  // The "Manage workspaces…" entry has value="__manage__"; selecting it opens WorkspaceList.
  await page.getByLabel('Select workspace').selectOption({ label: 'Manage workspaces…' })

  // Confirm the dialog is open and shows the correct heading.
  const dialog = page.getByRole('dialog', { name: 'Manage Workspaces' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await expect(dialog.getByRole('heading', { name: 'Manage Workspaces' })).toBeVisible()

  // Create a workspace.
  await dialog.getByLabel('New workspace name').fill('Wasteland Patrol')
  await dialog.getByRole('button', { name: 'Create workspace' }).click()

  // Verify the new workspace shows up in the list.
  await expect(dialog.getByText('Wasteland Patrol')).toBeVisible()

  // Delete the workspace we just made (aria-label="Delete workspace <name>").
  await dialog.getByRole('button', { name: 'Delete workspace Wasteland Patrol' }).click()

  // Confirmation may use a confirm() prompt — accept it if it appears.
  page.once('dialog', (d) => void d.accept())

  await expect(dialog.getByText('Wasteland Patrol')).not.toBeVisible({ timeout: 10_000 })
})
