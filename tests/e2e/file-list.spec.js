const { test, expect } = require('./fixtures');

test('loads the file manager and renders the file list', async ({ page }) => {
    await page.goto('/dialog.php');

    await expect(page.locator('#main-item-container')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('forbidden');
});
