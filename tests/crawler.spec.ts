import { test, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { deviceList } from './devices';

test.describe('AI UI Crawler', () => {
  test.setTimeout(600000);

  const MAX_PAGES = 50;
  const VISITED_URLS = new Set<string>();
  const SCREENSHOT_DIR = 'screenshots';

  test.beforeAll(async () => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });

  async function autoScroll(page: Page) {
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve(null);
          }
        }, 200);
      });
    });
  }

  async function crawl(page: Page, url: string, startDomain: string, browserName: string) {
    if (VISITED_URLS.has(url) || VISITED_URLS.size >= MAX_PAGES) return;

    try {
      const host = new URL(url).hostname;
      if (!host.includes(startDomain)) return;
    } catch { return; }

    VISITED_URLS.add(url);
    console.log(`🌍 Crawling: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
    } catch {
      return;
    }

    const safeUrl = url.replace(/[^a-z0-9]/gi, '_').substring(0, 40);
    const timestamp = Date.now();

    for (const device of deviceList) {
      if (!device.config.viewport) continue;

      await page.setViewportSize(device.config.viewport);
      await page.waitForTimeout(300);

      const deviceName = device.name.replace(/\s+/g, '_');
      const baseName = `${browserName}-${deviceName}-${safeUrl}-${timestamp}`;
      const basePath = path.join(SCREENSHOT_DIR, baseName);

      // 🟢 REAL USER VIEW (for Figma compare)
      await page.screenshot({
        path: `${basePath}-viewport.png`,
        fullPage: false
      });

      // 🔵 Controlled Full Page
      await autoScroll(page);
      await page.waitForTimeout(500);

      await page.screenshot({
        path: `${basePath}-full.png`,
        fullPage: true
      });

      console.log(`📸 ${browserName} | ${device.name}`);
    }

    const urlsToVisit: string[] = [];

    // Standard links
    const links = await page.locator('a[href]').all();
    for (const link of links) {
      const href = await link.getAttribute('href');
      if (!href) continue;
      const absolute = new URL(href, page.url()).toString();
      if (!VISITED_URLS.has(absolute) && absolute.includes(startDomain)) {
        urlsToVisit.push(absolute);
      }
    }

    // 🔥 ADVANCED INTERACTION DETECTION
    const INTERACTIVE_SELECTORS = [
      'button:not([disabled])',
      '[role="button"]',
      '[onclick]',
      '[class*="btn"]',
      '[class*="button"]',
      '[class*="cta"]',
      '[class*="action"]',
      '[class*="hamburger"]',
      '[class*="menu-toggle"]',
      '[class*="nav-toggle"]',
      '[class*="drawer-toggle"]',
      'svg[role="button"]',
      '[aria-label]:not(input)'
    ].join(',');

    const elements = await page.locator(INTERACTIVE_SELECTORS).all();
    const processed = new Set<string>();

    for (const el of elements.slice(0, 12)) {
      try {
        if (!(await el.isVisible())) continue;

        let text = (await el.textContent())?.trim() ||
          (await el.getAttribute('aria-label')) ||
          (await el.getAttribute('title')) || '';

        // Allow icon-only buttons
        if (!text) {
          const box = await el.boundingBox();
          if (!box || box.width < 24 || box.height < 24) continue;
          text = 'icon_button';
        }

        if (processed.has(text)) continue;
        processed.add(text);

        const tempPage = await page.context().newPage();
        await tempPage.setViewportSize(page.viewportSize()!);
        await tempPage.goto(url, { waitUntil: 'domcontentloaded' });

        const locator = tempPage.locator(`text="${text}"`)
          .or(tempPage.locator(`[aria-label="${text}"]`))
          .or(tempPage.locator(`[title="${text}"]`))
          .first();

        if (await locator.isVisible()) {
          await locator.click({ timeout: 2000 }).catch(() => { });
          await tempPage.waitForTimeout(1000);

          const newUrl = tempPage.url();
          if (newUrl !== url && newUrl.includes(startDomain)) {
            urlsToVisit.push(newUrl);
          } else {
            await tempPage.screenshot({
              path: path.join(SCREENSHOT_DIR, `interaction-${browserName}-${text}-${timestamp}.png`),
              fullPage: false
            });
          }
        }

        await tempPage.close();
      } catch { }
    }

    for (const nextUrl of urlsToVisit) {
      await crawl(page, nextUrl, startDomain, browserName);
    }
  }

  test('AI website crawl', async ({ page }, testInfo) => {
    const browserName = testInfo.project.name;

    const START_URL = process.env.START_URL || 'https://example.com';
    const startDomain = new URL(START_URL).hostname.replace('www.', '');

    await crawl(page, START_URL, startDomain, browserName);
  });
});
