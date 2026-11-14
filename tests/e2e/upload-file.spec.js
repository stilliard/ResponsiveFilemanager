const path = require('path');
const { test, expect } = require('./fixtures');

test('uploads a file via the UI and lists it', async ({ page, scratchFolder }) => {
    await page.goto(`/dialog.php?fldr=${scratchFolder}`);

    await page.locator('.upload-btn').click();
    await expect(page.locator('.uploader')).toBeVisible();

    await page
        .locator('#fileupload input[type=file]')
        .setInputFiles(path.join(__dirname, 'fixtures', 'test-upload.png'));

    await page.locator('.fileupload-buttonbar button.start').click();

    // Upload appends "_<timestamp>.<ext>" to the stored filename.
    await expect(page.locator('#filesTable')).toContainText('test-upload', { timeout: 15_000 });

    await page.locator('.close-uploader').click();

    await expect(page.locator('#main-item-container')).toContainText('test-upload');
});
