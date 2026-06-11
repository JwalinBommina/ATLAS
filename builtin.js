const { chromium } = require("playwright");

(async () => {
    let browser;
    let jobUrl = "";

    try {
        if (process.argv.length < 3) {
            throw new Error("No data received. Pass JSON as argument.");
        }

        const data = JSON.parse(process.argv[2]);

        jobUrl = data.jobUrl || "";

        const firstName = data.firstName || "";
        const lastName = data.lastName || "";
        const email = data.email || "";

        browser = await chromium.launch({
            executablePath: "/usr/bin/chromium",
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--window-size=1280,1024",
                "--force-device-scale-factor=0.8"
            ]
        });

        const context = await browser.newContext({
            viewport: { width: 1280, height: 1024 },
            deviceScaleFactor: 0.8
        });

        let page = await context.newPage();

        await page.goto(jobUrl, { waitUntil: "networkidle", timeout: 60000 });


        const applyBtn = page.locator("a.job-post-sticky-bar-btn").filter({
            hasText: /Apply|Easy Apply/i,
            hasNot: page.locator("i.fa-heart, [data-id='heart-button']")
        }).last();

        await applyBtn.scrollIntoViewIfNeeded({ timeout: 10000 });
        await applyBtn.click({ force: true });

        await page.waitForTimeout(2500);

        const firstNameField = page.locator('input[name*="first" i], #firstname').first();
        await firstNameField.scrollIntoViewIfNeeded({ timeout: 10000 });
        await firstNameField.focus();
        await firstNameField.fill("");
        await firstNameField.pressSequentially(firstName, { delay: 30 });

        const lastNameField = page.locator('input[name*="last" i], #lastname').first();
        await lastNameField.scrollIntoViewIfNeeded({ timeout: 10000 });
        await lastNameField.focus();
        await lastNameField.fill("");
        await lastNameField.pressSequentially(lastName, { delay: 30 });

        const emailInput = page.locator('input[type="email"], input[name*="email" i]').first();
        await emailInput.scrollIntoViewIfNeeded({ timeout: 10000 });
        await emailInput.focus();
        await emailInput.fill("");
        await emailInput.pressSequentially(email, { delay: 30 });

        const newPagePromise = context
            .waitForEvent("page", { timeout: 15000 })
            .catch(() => null);

        const continueBtn = page
            .locator('button:has-text("Continue"), a:has-text("Continue"), .btn-info:has-text("Continue")')
            .first();

        await continueBtn.scrollIntoViewIfNeeded({ timeout: 10000 });
        await continueBtn.click({ force: true });

        const opened = await newPagePromise;

        let finalUrl = jobUrl;

        if (opened) {
            page = opened;
            await page.bringToFront();

            await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(4000);

            finalUrl = page.url();
        } else {
            await page.waitForTimeout(3000);
            finalUrl = page.url() || jobUrl;
        }

        console.log(JSON.stringify({
            newTabUrl: finalUrl
        }));

        await browser.close().catch(() => {});
        process.exit(0);

    } catch (error) {
        if (browser) {
            await browser.close().catch(() => {});
        }

        console.log(JSON.stringify({
            newTabUrl: jobUrl,
            message: error.message
        }));

        process.exit(0);
    }
})();