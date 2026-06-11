const { chromium } = require('playwright');
const OpenAI = require('openai');

// Initialize OpenAI using the environment variable set in your Docker run command
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * AI Function: Generates human-like answers for custom application questions
 */
async function askAIForAnswer(questionLabel, profile, resumeText, options = null) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { 
                    role: "user", 
                    content: `You are ${profile.firstName}. No preable, just answer the question. \nResume: ${resumeText}\nQuestion: ${questionLabel}` 
                }
            ],
            temperature: 0.1,
        });

        return response.choices[0].message.content.trim().replace(/^"|"$/g, '');
    } catch (error) {
        return options ? options[0] : "";
    }
}

/**
 * Platform Detection Logic
 */
function detectApplyPlatform(jobUrl, profile) {
    const urlStr = (jobUrl || '').toLowerCase();
    const profileStr = (profile?.jobBoard || '').toLowerCase();
    const checkStr = urlStr + " " + profileStr;

    if (checkStr.includes('workday') || checkStr.includes('myworkdayjobs')) return 'workday';
    if (checkStr.includes('ycombinator.com') || checkStr.includes('workatastartup.com')) return 'yc';
    if (
        checkStr.includes('greenhouse.io') || checkStr.includes('lever.co') ||
        checkStr.includes('ashbyhq.com') || checkStr.includes('smartrecruiters.com') ||
        checkStr.includes('applytojob.com') || checkStr.includes('breezy.hr')
    ) return 'spa';
    return 'others';
}

async function safeGoto(page, url) {
    try {
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        await safeWaitAfterAction(page);
        return true;

    } catch (error) {
        console.log(`⚠️ Initial navigation issue: ${error.message}`);

        // If the page partially loaded, continue instead of failing the whole job
        const currentUrl = page.url();
        const hasBody = await page.locator('body').count().catch(() => 0);

        if (currentUrl && currentUrl !== 'about:blank' && hasBody > 0) {
            console.log("✅ Page appears partially loaded. Continuing.");
            return true;
        }

        throw error;
    }
}

async function safeWaitAfterAction(page) {
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
}

async function injectCheatSheetWidget(targetContext, resumeText, coverLetterText) {
    try {
        await targetContext.evaluate(({ rText, cText }) => {
            // Don't inject twice
            if (document.getElementById('copilot-widget-container')) return; 

            const container = document.createElement('div');
            container.id = 'copilot-widget-container';
            // Align to the right, stack items, push z-index to maximum
            container.style.cssText = 'position:fixed; top:20px; right:20px; z-index:2147483647; display:flex; flex-direction:column; align-items:flex-end; gap:10px;';
            
            // --- BUTTON GROUP ---
            const btnGroup = document.createElement('div');
            btnGroup.id = 'copilot-btn-group';
            btnGroup.style.cssText = 'display:flex; gap:10px;';
            
            // Only render the Cover Letter button if text actually exists
            const coverLetterBtnHtml = cText ? `<button id="copilot-show-cover-btn" style="background:#17a2b8; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:bold; box-shadow:0 4px 6px rgba(0,0,0,0.2);">📝 Cover Letter</button>` : '';
            
            btnGroup.innerHTML = `
                ${coverLetterBtnHtml}
                <button id="copilot-show-resume-btn" style="background:#0056b3; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:bold; box-shadow:0 4px 6px rgba(0,0,0,0.2);">📄 Resume</button>
            `;

            // --- DATA SHEET ---
            const sheet = document.createElement('div');
            sheet.id = 'copilot-sheet';
            sheet.style.cssText = 'display:none; width:450px; background:#f8f9fa; border:2px solid #0056b3; border-radius:8px; padding:15px; box-shadow:0 8px 24px rgba(0,0,0,0.4);';
            sheet.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <b id="copilot-sheet-title" style="color:#333; font-size:14px;">Data</b>
                    <button id="copilot-hide-btn" style="background:#dc3545; color:white; border:none; border-radius:4px; padding:4px 10px; cursor:pointer; font-weight:bold;">Hide</button>
                </div>
                <div id="copilot-sheet-content" style="font-family:monospace; font-size:12px; color:#333; max-height:60vh; overflow-y:auto; background:white; padding:10px; border:1px solid #ddd; white-space:pre-wrap;"></div>
            `;

            container.appendChild(btnGroup);
            container.appendChild(sheet);
            document.body.appendChild(container);

            // --- LOGIC / CLICK HANDLERS ---
            const hideBtn = document.getElementById('copilot-hide-btn');
            const resumeBtn = document.getElementById('copilot-show-resume-btn');
            const coverBtn = document.getElementById('copilot-show-cover-btn'); // Might be null
            const title = document.getElementById('copilot-sheet-title');
            const content = document.getElementById('copilot-sheet-content');

            hideBtn.onclick = () => { 
                sheet.style.display = 'none'; 
                btnGroup.style.display = 'flex'; 
            };
            
            resumeBtn.onclick = () => { 
                btnGroup.style.display = 'none'; 
                title.innerText = '📄 Resume Content';
                content.innerText = rText;
                sheet.style.display = 'block'; 
            };

            if (coverBtn) {
                coverBtn.onclick = () => { 
                    btnGroup.style.display = 'none'; 
                    title.innerText = '📝 Cover Letter Content';
                    content.innerText = cText;
                    sheet.style.display = 'block'; 
                };
            }
        }, { rText: resumeText || "No resume data available.", cText: coverLetterText || "" });
    } catch (e) {
        // Silently fail if frame is inaccessible
    }
}
/**
 * Keeps the resume / cover letter widget alive across:
 * - DOM refreshes
 * - Workday MPA page transitions
 * - new tabs/pages opened after Apply
 */
function startWidgetKeeper(context, getActivePage, setActivePage, resumeText, coverLetterText) {
    const watchedPages = new WeakSet();

    async function safeDelay(page, ms) {
        try {
            if (!page || page.isClosed()) return false;
            await page.waitForTimeout(ms);
            return true;
        } catch (e) {
            return false;
        }
    }

    async function keepInjectedOnPage(page) {
        if (!page || watchedPages.has(page)) return;

        watchedPages.add(page);

        while (page && !page.isClosed()) {
            try {
                await injectCheatSheetWidget(page, resumeText, coverLetterText);
            } catch (e) {
                // Ignore navigation / DOM refresh / closed-page errors
            }

            const stillOpen = await safeDelay(page, 1500);
            if (!stillOpen) break;
        }
    }

    context.on('page', async (newPage) => {
        try {
            setActivePage(newPage);

            await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
            await newPage.bringToFront().catch(() => {});

            keepInjectedOnPage(newPage).catch(() => {});
        } catch (e) {
            // Ignore failed new-page injection
        }
    });

    return keepInjectedOnPage;
}

(async () => {
    try {
        if (process.argv.length < 3) throw new Error("No data received from n8n");
        const data = JSON.parse(process.argv[2]);
        const { jobUrl, resume_text, coverletter_text, ResumePath, CoverLetterPath, profile } = data;

        // --- BROWSER SETTINGS ---
        const browser = await chromium.launch({
            executablePath: '/usr/bin/chromium', 
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,1024', '--force-device-scale-factor=0.8']
        });

        const context = await browser.newContext({ 
            viewport: { width: 1280, height: 1024 }, 
            deviceScaleFactor: 0.8 
        });
        
        let page = await context.newPage();
        
        const keepInjectedOnPage = startWidgetKeeper(
            context,
            () => page,
            (newPage) => { page = newPage; },
            resume_text,
            coverletter_text
        );
        
        await safeGoto(page, jobUrl);
        
        // Start watching the first page after it loads
        keepInjectedOnPage(page).catch(() => {});

        const applyPlatform = detectApplyPlatform(jobUrl, profile);
        console.log(`Platform: ${applyPlatform}`);
        
        let isAppReady = false;
        const quickCheckFileInput = await page.locator('input[type="file"]').count();    
        if (quickCheckFileInput > 0 ) {
            console.log("⏩  Form detected immediately on landing. Skipping Part 3 (Auth/Entry).");
            isAppReady = true;
        }
        // ====================================================================
        // PART 3: AUTH / ENTRY
        // ====================================================================
        if (!isAppReady) {
        let authLoopCount = 0;
        const availablePasswords = Array.isArray(profile.passwords) ? profile.passwords.filter(Boolean) : [];
        let forgotPasswordAttempted = false;

        switch (applyPlatform) {
            case 'yc':
                console.log("[YC] Clicking Apply and waiting for Pop-up modal...");
                await page.locator('a, button').filter({ hasText: /^Apply to role/i }).first().click({ timeout: 5000 }).catch(() => {});
                // Wait for the specific YC modal container
                await page.waitForSelector('.modal-container, .popover-content, [role="dialog"]', { state: 'visible', timeout: 3000 }).catch(() => {});
                isAppReady = true;
                break;

            case 'spa':
                await page.locator('a, button').filter({ hasText: /^Apply/i }).first().click({ force: true }).catch(() => {});
                console.log("⏳ SPA Render Buffer (4s)...");
                await page.waitForTimeout(4000);
                isAppReady = true;
                break;

            case 'workday':
                // Step 3a: Initial Apply Button
                const oldPage = page;

                const newPagePromise = context.waitForEvent('page', { timeout: 3000 }).catch(() => null);

                await page.locator('a, button')
                    .filter({ hasText: /^Apply/i })
                    .first()
                    .click()
                    .catch(() => {});

                const openedPage = await newPagePromise;

                if (openedPage) {
                    console.log("🔳 Workday opened in new tab. Switching active page...");
                    page = openedPage;
                    await page.bringToFront().catch(() => {});
                    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
                    keepInjectedOnPage(page).catch(() => {});
                } else {
                    console.log("➡️ Workday continued in same tab.");
                    page = oldPage;
                    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
                    keepInjectedOnPage(page).catch(() => {});
                }

                // Step 3b: Prefer Autofill, Fallback to Manual
                const clickedAutofill = await page.locator('a, button').filter({ hasText: /Autofill with Resume/i }).first()
                    .click({ timeout: 5000 }).then(() => true).catch(() => false);
                
                if (!clickedAutofill) {
                    await page.locator('a, button').filter({ hasText: /Apply Manually/i }).first()
                        .click({ timeout: 5000 }).catch(() => false);
                }

                console.log("Entering Smart Login/Auth Loop...");
                
                while (!isAppReady && authLoopCount++ < 30) {
                    await page.waitForTimeout(500); 

                    // --- BREAK CONDITION: Form is Ready ---
                    const fileInputCount = await page.locator('input[type="file"]').count();
                    const firstNameCount = await page.locator('label').filter({ hasText: /First Name/i }).count();

                    if (fileInputCount > 0 || firstNameCount > 0) {
                        console.log("✅Form detected! Exiting auth loop.");
                        isAppReady = true;
                        break; 
                    }

                    // --- STEP 1: CREATE ACCOUNT ---
                    const isCreateAccount = await page.locator('[data-automation-id="createAccountSubmitButton"]').count() > 0;

                    if (isCreateAccount) {
                        console.log("🔍'Create Account' screen detected.");
                        try {
                            const passToUse = availablePasswords[0];
                            if (!passToUse) {
                                console.log("⌨️No passwords. Waiting for manual entry.");
                                await page.waitForTimeout(3000);
                                continue;
                            }

                            // Type slowly as a user
                            await page.locator('[data-automation-id="email"]').last().pressSequentially(profile.email, { delay: 30 });
                            await page.locator('[data-automation-id="password"]').last().pressSequentially(passToUse, { delay: 30 }); 
                            await page.locator('[data-automation-id="verifyPassword"]').last().pressSequentially(passToUse, { delay: 30 });
                            
                            const termsBox = page.locator('[data-automation-id="createAccountCheckbox"]').last();
                            if (await termsBox.isVisible()) await termsBox.click({ force: true }); 
                            
                            const createBtn = page.locator('[data-automation-id="createAccountSubmitButton"]').last();
                            await createBtn.scrollIntoViewIfNeeded();
                            await createBtn.click({ force: true });
                            await createBtn.evaluate(el => el.click()).catch(() => {});
                            console.log("🖱️ Clicked Create Account button.");
                            await page.waitForTimeout(3000);
                            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
                            continue; 
                        } catch(e) { console.log("❌ Create Account error."); }
                    }

                    // --- STEP 2: SIGN IN (Check all passwords) ---
                    const signInBtn = page.locator('[data-automation-id="signInSubmitButton"]').last();
                    
                    if (!isCreateAccount && await signInBtn.isVisible({ timeout: 2000 })) {
                        let loginSuccess = false;

                        for (let i = 0; i < availablePasswords.length; i++) {
                            const passToUse = availablePasswords[i];
                            console.log(`Trying password ${i + 1}/${availablePasswords.length}...`);

                            try {
                                const emailField = page.locator('[data-automation-id="email"]').last();
                                await emailField.scrollIntoViewIfNeeded();
                                await emailField.focus();
                                await emailField.fill('');
                                await emailField.pressSequentially(profile.email, { delay: 30 });
                                const passField = page.locator('[data-automation-id="password"]').last();
                                await passField.focus();
                                await passField.fill('');
                                await passField.pressSequentially(passToUse, { delay: 30 });
                                await signInBtn.click({ force: true });
                                await page.waitForTimeout(3000); 
                                const stillOnLogin = await signInBtn.isVisible().catch(() => false);

                                if (!stillOnLogin) {
                                    console.log("🎉 Login successful! Page navigated.");
                                    loginSuccess = true;
                                    break; 
                                }
                                console.log(`🔄 Password attempt ${i + 1} failed.`);
                            } catch (err) {
                                 console.log(`🩹 Login successful! (Navigation detected via error)`);
                                 loginSuccess = true;
                                 break;
                            }
                        }

                        if (loginSuccess) continue; 

                        // --- STEP 3: FORGOT PASSWORD (If all passwords fail) ---
                        if (!forgotPasswordAttempted) {
                            console.log("🔄 All passwords failed. Starting Forgot Password flow...");
                            forgotPasswordAttempted = true; 
                            
                            try {
                                const forgotPassBtn = page.locator('[data-automation-id*="forgotPassword"], a:has-text("Forgot Password")').first();
                                if (await forgotPassBtn.isVisible()) {
                                    await forgotPassBtn.click({ force: true });
                                    await page.waitForSelector('[data-automation-id="email"]', { state: 'visible', timeout: 10000 }).catch(()=>{});
                                    
                                    await page.locator('[data-automation-id="email"]').last().pressSequentially(profile.email, { delay: 30 });
                                    await page.locator('button:has-text("Submit")').click();
                                    
                                    console.log(`📩Reset requested for: ${profile.email}`);
                                }
                            } catch (err) { console.log(`⛔ Forgot Password flow failed.`); }
                        }

                        console.log("🖥️  Pausing for manual intervention in noVNC.");
                        await page.waitForTimeout(5000); 
                    }
                }
                break;

                
                case 'others': {
                    console.log("[Others] Searching for entry button and handling potential new tabs...");
            
                    const initialBtn = page.locator('a, button').filter({ hasText: /Apply Now|Apply to position|Start Application|Apply$/i }).first();
                    if (await initialBtn.isVisible({ timeout: 3000 })) {
                        const newPagePromise = context.waitForEvent('page', { timeout: 5000 }).catch(() => null);
                        await initialBtn.click({ force: true }).catch(() => {});
                        const opened = await newPagePromise;
                        if (opened) {
                            console.log("🔳 New tab detected. Shifting focus...");
                            page = opened;
                            await page.bringToFront();
                            await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
                        } else {
                            await page.waitForTimeout(2000); 
                        }
                    }
                    const e = page.locator('input[type="email"], input[name*="email" i], input[name*="user" i], input[id*="email" i], input[id*="user" i], [data-automation-id="email"]').first();
                    if (await e.isVisible()) {
                        console.log("👤 Filling Email/Username field...");
                        await e.focus();
                        await e.fill('');
                        await e.pressSequentially(profile.email, { delay: 30 });
                    }
                    const p = page.locator('input[type="password"], input[name*="password" i], [data-automation-id="password"]').first();
                    if (await p.isVisible() && availablePasswords.length > 0) {
                        console.log("🔑 Filling Password field...");
                        await p.focus();
                        await p.fill('');
                        await p.pressSequentially(availablePasswords[0], { delay: 30 });
                    }
                    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login"), button:has-text("Next"), [data-automation-id="signInSubmitButton"]').first();
                    if (await submitBtn.isVisible()) {
                        await submitBtn.click({ force: true }).catch(() => {});
                    }
                    isAppReady = true;
                    break;
                }
        }
    }
        // INJECT WIDGET HERE: The DOM is stable and we have the correct frame.
        let formContext = page;
        
        if (applyPlatform !== 'workday') {
            // ====================================================================
            // PARTS 4, 5, 6: FILLING ENGINE
            // ====================================================================
            let formContext = page;
            for (const frame of page.frames()) {
                if (frame.url().includes('greenhouse.io') || frame.url().includes('lever.co')) { formContext = frame; break; }
            }

            // ====================================================================
            // PART 4: FILE UPLOADS (RESUME FIRST, THEN COVER LETTER)
            // ====================================================================
            console.log("\n=====================================================");
            console.log(" STARTING PART 4: FILE UPLOADS");
            console.log("=====================================================");

            async function getFreshFormContext() {
                let freshContext = page;

                for (const frame of page.frames()) {
                    if (
                        frame.url().includes('greenhouse.io') ||
                        frame.url().includes('lever.co') ||
                        frame.url().includes('ashbyhq.com')
                    ) {
                        freshContext = frame;
                        break;
                    }
                }

                return freshContext;
            }

            async function getInputContext(input) {
                const html = await input.evaluate(el => el.outerHTML.toLowerCase()).catch(() => "");

                const parentText = await input.evaluate(el => {
                    let node = el;
                    let text = "";

                    for (let i = 0; i < 4 && node; i++) {
                        text += " " + (node.innerText || "");
                        node = node.parentElement;
                    }

                    return text.toLowerCase();
                }).catch(() => "");

                return `${html} ${parentText}`;
            }

            function isAutofillOrParserField(contextText) {
                return (
                    contextText.includes('autofill') ||
                    contextText.includes('parse') ||
                    contextText.includes('extract') ||
                    contextText.includes('smart apply') ||
                    contextText.includes('apply with')
                );
            }

            async function revealInputIfNeeded(ctx, input) {
                const isVisible = await input.isVisible().catch(() => false);

                if (!isVisible) {
                    const trigger = ctx
                        .locator('button, a, label')
                        .filter({ hasText: /Attach|Upload|Choose|Add file|Select file/i })
                        .first();

                    if (await trigger.count() > 0) {
                        await trigger.click({ force: true }).catch(() => {});
                        await page.waitForTimeout(500);
                    }
                }
            }

            async function uploadFileByType(fileType, filePath) {
                if (!filePath) {
                    console.log(`⏭️ No ${fileType} path provided. Skipping.`);
                    return false;
                }

                let ctx = await getFreshFormContext();

                await page.waitForTimeout(750);

                const fileInputs = await ctx.locator('input[type="file"]').all();
                console.log(`🔎 Searching ${fileInputs.length} upload fields for ${fileType}.`);

                for (const input of fileInputs) {
                    try {
                        const combinedContext = await getInputContext(input);

                        if (isAutofillOrParserField(combinedContext)) {
                            console.log("🛡️ Skipped an Autofill/Parse upload field.");
                            continue;
                        }

                        const isResumeField =
                            combinedContext.includes('resume') ||
                            combinedContext.includes('cv');

                        const isCoverLetterField =
                            combinedContext.includes('cover') ||
                            combinedContext.includes('letter');

                        const matchesTarget =
                            fileType === 'resume'
                                ? isResumeField
                                : isCoverLetterField;

                        if (!matchesTarget) continue;

                        await revealInputIfNeeded(ctx, input);

                        console.log(`📤 Found ${fileType} upload field. Uploading...`);
                        await input.setInputFiles(filePath);

                        console.log(`✅ ${fileType} uploaded successfully.`);

                        // Important: resume upload may refresh/re-render the DOM.
                        await page.waitForTimeout(1500);
                        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

                        return true;
                    } catch (e) {
                        console.log(`🔧 Error while trying a ${fileType} upload field. Trying next field.`);
                    }
                }

                console.log(`⏭️ No matching ${fileType} upload field found.`);
                return false;
            }

            // 1. Search for resume field first and upload resume if found.
            await uploadFileByType('resume', ResumePath);

            // 2. DOM may refresh after resume upload, so search fresh for cover letter.
            await uploadFileByType('cover letter', CoverLetterPath);

            // PART 5: STANDARD FIELDS (Slow Type)
            const standardFields = [
                { pattern: /First Name|Given Name|Name/i, val: profile.firstName },
                { pattern: /Last Name|Family Name/i, val: profile.lastName },
                { pattern: /Email Address|Email/i, val: profile.email },
                { pattern: /Phone|Mobile/i, val: profile.phone },
                { pattern: /LinkedIn/i, val: profile.linkedin },
                { pattern: /GitHub|Website|Portfolio/i, val: profile.github }
            ];
            for (const f of standardFields) {
                const box = formContext.getByRole('textbox', { name: f.pattern }).first();
                if (await box.isVisible({ timeout: 1500 })) {
                    await box.focus(); await box.fill('');
                    await box.pressSequentially(f.val, { delay: 30 });
                }
            }

            // Country Code dropdown
            if (profile.countrycode) {
                const countryText = profile.countrycode.trim();

                const countryCodeDropdown = formContext
                    .getByRole('combobox', { name: /Country Code|Phone Country|Country/i })
                    .first();

                if (await countryCodeDropdown.isVisible({ timeout: 1500 }).catch(() => false)) {
                    await countryCodeDropdown.click();
                    await page.waitForTimeout(300);

                    await countryCodeDropdown.fill(countryText);
                    await page.waitForTimeout(700);

                    // Select first filtered dropdown result
                    await countryCodeDropdown.press('ArrowDown').catch(() => {});
                    await countryCodeDropdown.press('Enter').catch(() => {});

                    console.log(`✅ Tried selecting country code: ${countryText}`);
                }
            }

            // PART 6: AI BUTTON INJECTION
            await page.exposeFunction('generateAIResponse', async (q) => await askAIForAnswer(q, profile, resume_text));
            await formContext.evaluate(() => {
                const fields = document.querySelectorAll('textarea, input[type="text"]:not([role="combobox"])');
                fields.forEach(f => {
                    if (f.value) return;
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.innerHTML = '✨ Auto-Fill with AI';
                    btn.style.cssText = 'margin:5px 0; background:#6f42c1; color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-weight:bold;';
                    f.parentNode.insertBefore(btn, f.nextSibling);
                    btn.onclick = async (e) => {
                        e.preventDefault(); btn.innerHTML = '🪄 Thinking...';
                    const label = (() => {
                            const container = f.closest('div, section, fieldset, label') || f.parentElement;
                        
                            const text = container?.innerText
                                ?.split('\n')
                                .map(x => x.trim())
                                .filter(x =>
                                    x &&
                                    x !== f.placeholder &&
                                    !x.includes('Auto-Fill with AI') &&
                                    !x.includes('Thinking') &&
                                    !x.includes('Done') &&
                                    !x.includes('Retry')
                                )
                                .join(' ');
                        
                            return f.getAttribute('aria-label') || text || f.placeholder;
                        })();
                console.log("Question Label:", label);
                const generateFunc = window.generateAIResponse || window.parent.generateAIResponse;
                const extraDetails = btn.nextSibling?.classList?.contains('ai-extra-details')? btn.nextSibling.value.trim(): '';

                const finalPrompt = extraDetails? `${label}\n\nUser extra details for retry: ${extraDetails}`: label;

                const aiAnswer = await generateFunc(finalPrompt);

                const nativeValueSetter = Object.getOwnPropertyDescriptor(
                    f.tagName === 'TEXTAREA'
                        ? window.HTMLTextAreaElement.prototype
                        : window.HTMLInputElement.prototype,
                    'value'
                ).set;

                nativeValueSetter.call(f, aiAnswer);

                f.dispatchEvent(new InputEvent('input', {
                    bubbles: true,
                    inputType: 'insertText',
                    data: aiAnswer
                }));

                f.dispatchEvent(new Event('change', { bubbles: true }));

                f.focus();
                f.blur();

                console.log("finalPrompt:", finalPrompt);
                btn.innerHTML = '🟢 Done. 🔄 Retry with details?';

                let detailsBox = btn.nextSibling;
                if (!detailsBox || detailsBox.tagName !== 'TEXTAREA' || !detailsBox.classList.contains('ai-extra-details')) {
                    detailsBox = document.createElement('textarea');
                    detailsBox.className = 'ai-extra-details';
                    detailsBox.placeholder = 'Add details for retry, e.g. make it shorter, mention my React project, sound more natural...';
                    detailsBox.style.cssText = 'display:block; width:100%; margin:6px 0; padding:8px; border:1px solid #ccc; border-radius:6px; min-height:60px;';
                    btn.parentNode.insertBefore(detailsBox, btn.nextSibling);
                }
                    };
                });
            });
        }

       // ====================================================================
        // FINAL HANDOFF: Graceful exit on tab/browser close
        // ====================================================================
        let applicationStatus = "Applied";
        console.log("🚀 Handoff to manual control. Script will exit cleanly if tab is closed.");

        try {
            await Promise.race([
                new Promise(resolve => page.on('close', resolve)),
                new Promise(resolve => browser.on('disconnected', resolve))
            ]);
        } catch (e) {
            applicationStatus = "Skipped";
            console.log("🔌 Tab or browser closed by user.");
        }finally {
            await browser.close().catch(() => {});
        }
        console.log(JSON.stringify({ 
            status: "success", 
            application_result: applicationStatus,
            jobUrl: jobUrl 
        }));
        process.exit(0);
    } catch (error) {
        console.log(JSON.stringify({ 
            status: "error", 
            application_result: "Skipped", 
            message: error.message 
        }));
        process.exit(0);
    }
})();