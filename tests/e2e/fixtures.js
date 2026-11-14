const base = require('@playwright/test');

/**
 * Extends Playwright's `test` with a `scratchFolder` fixture: a uniquely-named
 * top-level folder under source/, created before the test and always deleted
 * afterwards (even on failure), so parallel runs never collide and nothing
 * pollutes the repo's source/ directory between runs.
 */
exports.test = base.test.extend({
    scratchFolder: async ({ page, baseURL }, use, testInfo) => {
        // Visiting dialog.php establishes $_SESSION['RF']['verify'], which every
        // ajax_calls.php/execute.php action requires before it will do anything.
        // Using page.request (not the standalone `request` fixture) so the ajax
        // calls share the browser context's session cookie.
        await page.goto('/dialog.php');

        const name = `e2e_${testInfo.testId}_${testInfo.retry}`;

        await page.request.post(`${baseURL}/execute.php?action=create_folder`, {
            form: { path: '/', name },
        });

        await use(name);

        await page.request.post(`${baseURL}/execute.php?action=delete_folder`, {
            form: { path: `/${name}/` },
        });
    },
});

exports.expect = base.expect;
