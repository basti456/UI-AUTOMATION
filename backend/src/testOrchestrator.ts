import { chromium, BrowserContext, Browser } from 'playwright';
import path from 'path';
import fs from 'fs';
import { deviceList } from '../../tests/devices';
import { analyzeVisualDifferences, validateImagePaths, analyzeWithoutFigma, clearImageCache } from './qwenVisionService';
import { annotateScreenshot } from './imageAnnotator';
import { TestResult, TestProgress, VisualIssue, InteractionState } from './types';
import { generateInteractionPlan, executeInteraction } from './interactionService';
import dotenv from 'dotenv';

dotenv.config();

const SCREENSHOT_DIR = process.env.WEBSITE_SCREENSHOTS_DIR ? path.join(__dirname, '../../', process.env.WEBSITE_SCREENSHOTS_DIR) : path.join(__dirname, '../../screenshots');
const FIGMA_DIR = process.env.FIGMA_SCREENSHOTS_DIR ? path.join(__dirname, '../../', process.env.FIGMA_SCREENSHOTS_DIR) : path.join(__dirname, '../../FigmaScreens');
const REPORTS_DIR = process.env.REPORTS_DIR ? path.join(__dirname, '../../', process.env.REPORTS_DIR) : path.join(__dirname, '../../reports');

// In-memory test progress tracking
const testProgressMap = new Map<string, TestProgress>();

export async function runVisualTest(url: string, testId: string, enableInteractive?: boolean, deviceType: string = 'both'): Promise<TestResult[]> {
  console.log(`🚀 Starting visual test for: ${url}`);
  console.log(`📝 Test ID: ${testId}`);
  console.log(`📱 Device Type: ${deviceType}`);

  // Clear the base64 image cache so this run starts fresh — prevents
  // stale Figma / screenshot data from a previous test bleeding in.
  clearImageCache();

  // Filter devices based on type
  const targetDevices = deviceList.filter(device => {
    if (deviceType === 'both') return true;

    // Strict definition of Desktop vs Mobile/Tablet
    const width = device.config.viewport?.width || 1920;
    const name = device.name.toLowerCase();

    // Desktop: Width >= 1024 AND not explicitly a mobile/tablet device
    const isDesktop = width >= 1024 && !name.includes('iphone') && !name.includes('ipad');

    if (deviceType === 'desktop') return isDesktop;
    if (deviceType === 'mobile') return !isDesktop;

    return true;
  });

  console.log(`🎯 Testing on ${targetDevices.length} devices`);

  // Initialize progress
  updateTestProgress(testId, {
    testId,
    status: 'running',
    totalDevices: targetDevices.length,
    completedDevices: 0,
    progress: 0,
    message: 'Initializing browser...',
  });

  const results: TestResult[] = [];
  let browser: Browser | null = null;

  try {
    // Ensure directories exist
    ensureDirectories(testId);

    // Launch browser
    browser = await chromium.launch({ headless: true });

    updateTestProgress(testId, {
      testId,
      status: 'running',
      totalDevices: targetDevices.length,
      completedDevices: 0,
      progress: 5,
      message: 'Browser launched, starting device tests...',
    });

    // Test each device
    for (let i = 0; i < targetDevices.length; i++) {
      const device = targetDevices[i];

      updateTestProgress(testId, {
        testId,
        status: 'running',
        currentDevice: device.name,
        totalDevices: targetDevices.length,
        completedDevices: i,
        progress: 5 + ((i / targetDevices.length) * 85), // 5-90% for device testing
        message: `Testing ${device.name}...`,
      });

      const result = await testDevice(browser, url, device, testId, enableInteractive);
      results.push(result);

      updateTestProgress(testId, {
        testId,
        status: 'running',
        currentDevice: device.name,
        totalDevices: targetDevices.length,
        completedDevices: i + 1,
        progress: 5 + (((i + 1) / targetDevices.length) * 85),
        message: `Completed ${device.name} - Found ${result.issues.length} issues`,
      });
    }

    updateTestProgress(testId, {
      testId,
      status: 'completed',
      totalDevices: targetDevices.length,
      completedDevices: targetDevices.length,
      progress: 100,
      message: 'Test completed successfully!',
    });

    console.log(`✅ Visual test completed. Total devices tested: ${results.length}`);
    return results;

  } catch (error: any) {
    console.error(`❌ Test failed: ${error.message}`);

    updateTestProgress(testId, {
      testId,
      status: 'failed',
      totalDevices: targetDevices.length,
      completedDevices: results.length,
      progress: 0,
      message: `Test failed: ${error.message}`,
    });

    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function testDevice(
  browser: Browser,
  url: string,
  device: { name: string; config: any },
  testId: string,
  enableInteractive?: boolean
): Promise<TestResult> {
  console.log(`🌍 Testing ${device.name}...`);

  const context: BrowserContext = await browser.newContext(device.config);
  const page = await context.newPage();

  try {
    // Navigate to URL
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for page to stabilize
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Disable animations for consistent screenshots
    await page.addStyleTag({
      content: `
        * {
          animation: none !important;
          transition: none !important;
          caret-color: transparent !important;
          -webkit-font-smoothing: antialiased !important;
          text-rendering: geometricPrecision !important;
        }
      `,
    });

    await page.waitForTimeout(500);

    // Capture screenshot
    const screenshotPath = path.join(SCREENSHOT_DIR, testId, `${device.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot captured: ${device.name}`);

    // Find corresponding Figma screenshot (Smart Match)
    let figmaPath = findMatchingFigmaFile(device.name, device.config.viewport?.width || 1920);
    let isStyleReferenceOnly = false;

    if (figmaPath) {
      console.log(`✅ MATCH: Using ${path.basename(figmaPath)} for ${device.name}`);
    } else {
      // Fallback: Use Desktop for Style Reference if no Mobile match
      const desktopFallback = findMatchingFigmaFile('Desktop_1920px', 1920);
      if (desktopFallback) {
        console.log(`⚠️ PARTIAL MATCH: Using Desktop design as Style Reference for ${device.name}`);
        figmaPath = desktopFallback;
        isStyleReferenceOnly = true;
      } else {
        console.log(`⚠️ NO MATCH: No Figma baseline found for ${device.name}`);
      }
    }

    let issues: VisualIssue[] = [];
    let annotatedPath: string | undefined;
    const interactionStates: InteractionState[] = [];

    if (figmaPath && fs.existsSync(figmaPath)) {
      // Analyze with AI
      const aiResponse = await analyzeVisualDifferences({
        websiteImagePath: screenshotPath,
        figmaImagePath: figmaPath,
        deviceName: device.name,
        isStyleReferenceOnly // Pass this flag to AI service
      });

      issues = aiResponse.issues;

      // Annotate screenshot if issues found
      // Annotate screenshot if issues found
      if (issues.length > 0) {
        // 1. Master annotation (All issues)
        annotatedPath = path.join(REPORTS_DIR, testId, 'annotated', `${device.name}_annotated_all.png`);
        await annotateScreenshot({
          screenshotPath,
          issues,
          outputPath: annotatedPath,
        });

        // 2. Individual annotations (One per issue)
        for (let j = 0; j < issues.length; j++) {
          const issuePath = path.join(REPORTS_DIR, testId, 'annotated', `${device.name}_issue_${j + 1}.png`);
          await annotateScreenshot({
            screenshotPath,
            issues: [issues[j]], // Pass only the single issue to isolate highlighting
            outputPath: issuePath
          });
          issues[j].annotatedScreenshot = issuePath; // Store path in the issue object
        }
      }
    } else {
      // No Figma baseline — analyze against universal design guidelines instead
      console.log(`🌐 No Figma baseline for ${device.name}. Using universal design guidelines mode.`);
      const aiResponse = await analyzeWithoutFigma(screenshotPath, device.name);
      issues = aiResponse.issues;

      // Annotate screenshot if issues found
      if (issues.length > 0) {
        annotatedPath = path.join(REPORTS_DIR, testId, 'annotated', `${device.name}_annotated_all.png`);
        await annotateScreenshot({ screenshotPath, issues, outputPath: annotatedPath });

        for (let j = 0; j < issues.length; j++) {
          const issuePath = path.join(REPORTS_DIR, testId, 'annotated', `${device.name}_issue_${j + 1}.png`);
          await annotateScreenshot({ screenshotPath, issues: [issues[j]], outputPath: issuePath });
          issues[j].annotatedScreenshot = issuePath;
        }
      }
    }

    // Interactive Testing - Run AFTER Figma comparison (if enabled)
    const isInteractiveEnabled = enableInteractive !== undefined
      ? enableInteractive
      : process.env.ENABLE_INTERACTIVE_TESTING === 'true';

    if (isInteractiveEnabled) {
      console.log(`🤖 Starting Auto-Exploration Mode...`);
      updateTestProgress(testId, {
        testId,
        status: 'running',
        totalDevices: 0,
        completedDevices: 0,
        progress: 92,
        message: `🤖 [${device.name}] Detecting interactive elements…`,
      });
      try {
        const interactionPlan = await generateInteractionPlan(page, screenshotPath);

        for (let iIdx = 0; iIdx < interactionPlan.length; iIdx++) {
          const action = interactionPlan[iIdx];
          console.log(`🤖 Auto-Exploring: ${action.name} (${iIdx + 1}/${interactionPlan.length})`);

          // Push live status so the frontend progress bar reflects each interaction step
          updateTestProgress(testId, {
            testId,
            status: 'running',
            totalDevices: 0,
            completedDevices: 0,
            progress: 92 + Math.round((iIdx / interactionPlan.length) * 6), // 92–98%
            message: `🤖 [${device.name}] Interacting: ${action.name} (${iIdx + 1}/${interactionPlan.length})`,
          });

          await executeInteraction(page, action);

          // Capture state screenshot
          const stateName = `${device.name}_${action.action}_${action.name.replace(/\s+/g, '_')}`;
          const stateScreenshotPath = path.join(SCREENSHOT_DIR, testId, `${stateName}.png`);
          await page.screenshot({ path: stateScreenshotPath, fullPage: true });

          // Track this interaction state
          interactionStates.push({
            actionName: action.name,
            screenshotPath: stateScreenshotPath,
            timestamp: new Date().toISOString()
          });

          // Extra wait time to ensure interaction completes and page updates
          await page.waitForTimeout(1500); // Increased from 500ms to 1500ms
          await page.waitForLoadState('networkidle');

          // Compare with Main Design (Consistency Check)
          const styleReferencePath = figmaPath || findMatchingFigmaFile('Desktop_1920px', 1920);

          if (styleReferencePath && fs.existsSync(styleReferencePath)) {
            // Add delay to prevent rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

            const aiResponse = await analyzeVisualDifferences({
              websiteImagePath: stateScreenshotPath,
              figmaImagePath: styleReferencePath,
              deviceName: stateName
            });

            // If issues found, create annotated screenshot for this specific interaction
            if (aiResponse.issues.length > 0) {
              const annotatedStatePath = path.join(REPORTS_DIR, testId, 'annotated', `${stateName}_annotated.png`);
              await annotateScreenshot({
                screenshotPath: stateScreenshotPath,
                issues: aiResponse.issues,
                outputPath: annotatedStatePath,
              });

              // Store annotated path in the last interaction state we just added
              const lastIndex = interactionStates.length - 1;
              interactionStates[lastIndex].annotatedPath = annotatedStatePath;
            }

            // Add state issues to main issues list
            issues.push(...aiResponse.issues.map(i => ({ ...i, category: `[Interaction: ${action.name}] ${i.category}` })));
          }
        }
      } catch (interactionError) {
        console.error(`Exploration failed: ${interactionError}`);
      }
    }

    await context.close();

    return {
      deviceName: device.name,
      screenshotPath,
      figmaPath: fs.existsSync(figmaPath) ? figmaPath : '',
      annotatedPath,
      issues,
      interactionStates: interactionStates.length > 0 ? interactionStates : undefined,
      timestamp: new Date().toISOString(),
    };

  } catch (error: any) {
    console.error(`❌ Error testing ${device.name}: ${error.message}`);
    await context.close();

    return {
      deviceName: device.name,
      screenshotPath: '',
      figmaPath: '',
      issues: [
        {
          category: 'Test Error',
          severity: 'high',
          description: `Failed to test ${device.name}: ${error.message}`,
          howToReproduce: 'Check browser console and network logs',
          deviceName: device.name,
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }
}

function ensureDirectories(testId: string) {
  const dirs = [
    path.join(SCREENSHOT_DIR, testId),
    path.join(REPORTS_DIR, testId),
    path.join(REPORTS_DIR, testId, 'annotated'),
  ];

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Ensure base directories exist
  if (!fs.existsSync(FIGMA_DIR)) {
    fs.mkdirSync(FIGMA_DIR, { recursive: true });
    console.log(`📁 Created Figma screenshots directory: ${FIGMA_DIR}`);
  }
}

export function updateTestProgress(testId: string, progress: Partial<TestProgress>) {
  const existing = testProgressMap.get(testId) || {
    testId,
    status: 'queued' as const,
    totalDevices: 0,
    completedDevices: 0,
    progress: 0,
    message: 'Initializing...',
  };

  const updated = { ...existing, ...progress };
  testProgressMap.set(testId, updated);
}

export function getTestProgress(testId: string): TestProgress | null {
  return testProgressMap.get(testId) || null;
}

function findMatchingFigmaFile(deviceName: string, width: number): string | null {
  // 1. Try EXACT match first (e.g. "iPhone_SE_320px.png")
  const exactPath = path.join(FIGMA_DIR, `${deviceName}.png`);
  if (fs.existsSync(exactPath)) return exactPath;

  // Determine device type folder
  let typeFolder = 'desktop';
  if (width < 600) {
    typeFolder = 'mobile';
  } else if (width < 1024) {
    // Optional: could add 'tablet' folder support if needed
    // For now, mapping tablets to desktop or check if specific tablet folder exists
    typeFolder = fs.existsSync(path.join(FIGMA_DIR, 'tablet')) ? 'tablet' : 'desktop';
  }

  const folderPath = path.join(FIGMA_DIR, typeFolder);

  // 2. Check in specific folder (mobile/desktop)
  if (fs.existsSync(folderPath)) {
    try {
      const files = fs.readdirSync(folderPath);
      // Return the first image found in the folder
      // In a real scenario, could implement more complex matching if multiple files exist
      const imageFile = files.find(f => /\.(png|jpg|jpeg)$/i.test(f));
      if (imageFile) {
        return path.join(folderPath, imageFile);
      }
    } catch (e) {
      console.warn(`Error reading ${typeFolder} directory: ${e}`);
    }
  }

  // 3. Fallback: Old keyword matching in root directory for backward compatibility
  try {
    if (fs.existsSync(FIGMA_DIR)) {
      const files = fs.readdirSync(FIGMA_DIR);

      // Determine keyword based on width
      let keyword = 'desktop';
      if (width < 600) keyword = 'mobile';
      else if (width < 1024) keyword = 'tablet';

      // Partial match for keyword in filename
      const partialMatch = files.find(f => f.toLowerCase().includes(keyword) && /\.(png|jpg|jpeg)$/i.test(f));
      if (partialMatch) return path.join(FIGMA_DIR, partialMatch);

      // Fallback for tablet -> desktop
      if (keyword === 'tablet') {
        const desktopMatch = files.find(f => f.toLowerCase().includes('desktop') && /\.(png|jpg|jpeg)$/i.test(f));
        if (desktopMatch) return path.join(FIGMA_DIR, desktopMatch);
      }
    }
  } catch (error) {
    console.warn(`Error searching Figma root directory: ${error}`);
  }

  return null;
}
