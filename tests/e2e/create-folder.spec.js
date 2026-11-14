const { test, expect } = require('./fixtures');

test('creates a folder via the UI and lists it', async ({ page, scratchFolder }) => {
    await page.goto(`/dialog.php?fldr=${scratchFolder}`);

    const subfolderName = 'sub_e2e_folder';

    await page.locator('.new-folder').click();

    const modal = page.locator('.bootbox.modal');
    await expect(modal).toBeVisible();
    await modal.locator('input.input-block-level').fill(subfolderName);
    await modal.locator('.btn-primary').click();

    await expect(page.locator('#main-item-container')).toContainText(subfolderName);

    // Navigating into the new folder confirms it exists server-side, not just in the DOM.
    await page.goto(`/dialog.php?fldr=${scratchFolder}/${subfolderName}`);
    await expect(page.locator('body')).not.toContainText('wrong path');
    await expect(page.locator('#main-item-container')).toBeVisible();
});
