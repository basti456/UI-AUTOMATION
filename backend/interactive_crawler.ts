import { chromium, Browser, Page, ElementHandle } from 'playwright';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = 'screenshots';
const MAX_CONCURRENCY = 1; // Keep to 1 for clear interactivity, increase for speed if no interaction expected
const MAX_DEPTH = 2;
const MAX_PAGES_TOTAL = 10;

// Setup readline for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query: string): Promise<string> => {
    return new Promise(resolve => rl.question(query, resolve));
};

interface CrawlTask {
    url: string;
    depth: number;
}

const visitedUrls = new Set<string>();
const queue: CrawlTask[] = [];
let pagesVisited = 0;

// Helper to ensure directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Helper to normalize URL (strip hash and trailing slash)
function normalizeUrl(urlStr: string): string {
    try {
        const u = new URL(urlStr);
        u.hash = '';
        if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
            u.pathname = u.pathname.slice(0, -1);
        }
        return u.toString();
    } catch {
        return urlStr;
    }
}

async function handleInteractivity(page: Page) {
    // Detect inputs
    const inputs = await page.locator('input:not([type="hidden"]):not([type="submit"]):not([type="button"])').all();

    if (inputs.length > 0) {
        console.log(`\n--- Interactive Mode: ${page.url()} ---`);
        console.log(`Found ${inputs.length} input fields.`);

        // Ask if user wants to interact with this page at all
        const skipPage = await askQuestion(`Found inputs. Interact with this page? (y/n/skip-all): `);
        if (skipPage.toLowerCase().startsWith('n') || skipPage.toLowerCase() === 'skip-all') {
            console.log('Skipping interaction for this page.');
            return;
        }

        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];
            const isVisible = await input.isVisible();
            if (!isVisible) continue;

            const name = await input.getAttribute('name') || await input.getAttribute('id') || `Input #${i}`;
            const type = await input.getAttribute('type') || 'text';

            // Highlight the element so user sees what we're talking about (in headful mode)
            // await input.evaluate(el => el.style.border = '2px solid red');

            const answer = await askQuestion(`Enter value for [${name}] (type '${type}', or 'skip'): `);

            if (answer.toLowerCase() === 'skip') {
                continue;
            }

            if (answer.trim() !== '') {
                await input.fill(answer);
                console.log(`Filled [${name}] with "${answer}"`);
            } else {
                console.log(`Skipped [${name}]`);
            }
        }

        // After filling inputs, look for a submit button
        const submitButton = page.locator('button[type="submit"], input[type="submit"]').first();
        if (await submitButton.isVisible()) {
            const doClick = await askQuestion('Submit button found. Click it? (y/n): ');
            if (doClick.toLowerCase() === 'y') {
                console.log('Clicking submit...');
                // Wait for navigation or just click
                try {
                    await Promise.all([
                        page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => { }),
                        submitButton.click({ timeout: 5000 })
                    ]);
                    console.log('Clicked submit.');
                } catch (e) {
                    console.log('Error clicking submit:', e);
                }
            }
        }
        console.log('--- End Interaction ---\n');
    }
}

async function processUrl(browser: Browser, task: CrawlTask) {
    const normUrl = normalizeUrl(task.url);

    if (pagesVisited >= MAX_PAGES_TOTAL) return;
    if (visitedUrls.has(normUrl)) return;

    visitedUrls.add(normUrl);
    pagesVisited++;

    const page = await browser.newPage();
    try {
        console.log(`visited: ${task.url}`);
        await page.goto(task.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Handle User Input if any forms are present
        await handleInteractivity(page);

        // Screenshot
        const safeName = normUrl.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const scPath = path.join(SCREENSHOT_DIR, `interactive-${timestamp}-${safeName}.png`);
        await page.screenshot({ path: scPath, fullPage: true });
        console.log(`Screenshot: ${scPath}`);

        // Extract Links for queue
        if (task.depth < MAX_DEPTH) {
            const links = await page.locator('a[href]').all();
            for (const link of links) {
                const href = await link.getAttribute('href');
                if (href) {
                    try {
                        const absoluteUrl = new URL(href, task.url).toString();
                        if (absoluteUrl.startsWith('http')) {
                            const nextNorm = normalizeUrl(absoluteUrl);
                            if (!visitedUrls.has(nextNorm)) {
                                queue.push({ url: absoluteUrl, depth: task.depth + 1 });
                            }
                        }
                    } catch (e) {
                        // ignore invalid urls
                    }
                }
            }
        }

    } catch (error) {
        console.error(`Error processing ${task.url}:`, error);
    } finally {
        await page.close();
    }
}

async function main() {
    const startUrl = process.argv[2] || 'https://the-internet.herokuapp.com/login'; // Default to a test login page
    console.log(`Starting crawler at: ${startUrl}`);
    console.log(`Max concurrency: ${MAX_CONCURRENCY}`);

    queue.push({ url: startUrl, depth: 0 });

    const browser = await chromium.launch({ headless: false }); // Headless false to see what's happening

    try {
        while (queue.length > 0 && pagesVisited < MAX_PAGES_TOTAL) {
            // Process queue in batches (concurrency)
            const batch = queue.splice(0, MAX_CONCURRENCY);
            await Promise.all(batch.map(task => processUrl(browser, task)));
        }
    } finally {
        await browser.close();
        rl.close();
        console.log('Done.');
    }
}

main().catch(console.error);
