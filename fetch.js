const { chromium } = require("playwright");

(async () => {
  const url = process.argv[2];
  if (!url) {
    console.error("Missing URL argument");
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/chromium-browser",
    args: ["--no-sandbox", "--disable-dev-shm-usage"] // Back to your original stable flags
  });

  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0"
    });
    const page = await context.newPage();

    // The Fix: Use 'domcontentloaded' so we don't wait for Lever's broken trackers
    // and a 30s timeout is plenty for the actual content.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    
    // Optional: tiny wait for JS to finish rendering the text
    await page.waitForTimeout(2000); 

    const html = await page.content();
    process.stdout.write(html);
  } catch (err) {
    console.error("Scrape failed:", err.message);
  } finally {
    await browser.close();
  }
})();
