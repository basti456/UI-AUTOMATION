import { chromium, BrowserContext } from "playwright";
import { visualCompare } from "../tests/visualCompare";
import { deviceList } from "../tests/devices";
import path from "path";    
import fs from "fs";
import { detectLayoutIssues } from "../tests/layoutChecks";

const url = process.argv[2];
if (!url) {
    console.log("❌ Please provide website URL");
    console.log("Usage: npx ts-node runAutomation.ts https://example.com");
    process.exit(1);
}

(async () => {
    const browser = await chromium.launch();

    // Ensure directories exist
    ["screenshots/actual", "screenshots/expected", "screenshots/diff"].forEach(
        dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
    );

    for (const device of deviceList) {
        console.log(`🌍 Testing on device: ${device.name}`);

        const context: BrowserContext = await browser.newContext({
            ...device.config
        });

        const page = await context.newPage();
        await page.goto(url, { waitUntil: "networkidle" });

        // Screenshot paths
        const actualPath = path.join(
            "screenshots",
            "actual",
            `${device.name.replace(" ", "_")}.png`
        );
        const expectedPath = path.join(
            "screenshots",
            "expected",
            `${device.name.replace(" ", "_")}.png`
        );
        const diffPath = path.join(
            "screenshots",
            "diff",
            `${device.name.replace(" ", "_")}-diff.png`
        );

        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1500);

        await page.addStyleTag({
            content: `
    * {
      animation: none !important;
      transition: none !important;
      caret-color: transparent !important;
      -webkit-font-smoothing: antialiased !important;
      text-rendering: geometricPrecision !important;
    }
  `
        });

        // Capture actual screenshot
        await page.screenshot({ path: actualPath, fullPage: true });
        // 🔍 Layout intelligence checks
        // const layoutIssues = await detectLayoutIssues(page);

        // if (layoutIssues.length > 0) {
        //     console.log(`🚨 Layout issues on ${device.name}:`);
        //     layoutIssues.slice(0, 10).forEach(issue => console.log("   -", issue));
        // } else {
        //     console.log(`✅ No layout breakage on ${device.name}`);
        // }

        // Auto-baseline: if expected doesn't exist, copy actual as baseline
        if (!fs.existsSync(expectedPath)) {
            fs.copyFileSync(actualPath, expectedPath);
            console.log(`✅ Baseline created for ${device.name} at ${expectedPath}`);
        } else {
            // Compare with baseline
            try {
                const result = await visualCompare(actualPath, expectedPath, diffPath);
                if (!result.passed) {
                    console.warn(`❌ UI deviation detected on ${device.name}`);
                } else {
                    console.log(`✅ UI matches on ${device.name}`);
                    // Optional: remove diff if it exists
                    if (fs.existsSync(diffPath)) fs.unlinkSync(diffPath);
                }
            } catch (err: any) {
                console.warn(`⚠️ Visual compare failed: ${err.message}`);
            }
        }

        await context.close();
    }

    await browser.close();
})();