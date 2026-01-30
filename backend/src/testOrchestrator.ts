import { chromium, BrowserContext, Browser } from 'playwright';
import path from 'path';
import fs from 'fs';
import { deviceList } from '../../tests/devices';
import { analyzeVisualDifferences, validateImagePaths } from './qwenVisionService';
import { annotateScreenshot } from './imageAnnotator';
import { TestResult, TestProgress, VisualIssue } from './types';
import { generateInteractionPlan, executeInteraction } from './interactionService';
import dotenv from 'dotenv';

dotenv.config();

const SCREENSHOT_DIR = process.env.WEBSITE_SCREENSHOTS_DIR ? path.join(__dirname, '../../', process.env.WEBSITE_SCREENSHOTS_DIR) : path.join(__dirname, '../../screenshots');
const FIGMA_DIR = process.env.FIGMA_SCREENSHOTS_DIR ? path.join(__dirname, '../../', process.env.FIGMA_SCREENSHOTS_DIR) : path.join(__dirname, '../../FigmaScreens');
const REPORTS_DIR = process.env.REPORTS_DIR ? path.join(__dirname, '../../', process.env.REPORTS_DIR) : path.join(__dirname, '../../reports');

// In-memory test progress tracking
const testProgressMap = new Map<string, TestProgress>();

export async function runVisualTest(url: string, testId: string, enableInteractive?: boolean): Promise<TestResult[]> {
  console.log(`🚀 Starting visual test for: ${url}`);
  console.log(`📝 Test ID: ${testId}`);

  // Initialize progress
  updateTestProgress(testId, {
    testId,
    status: 'running',
    totalDevices: deviceList.length,
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
      totalDevices: deviceList.length,
      completedDevices: 0,
      progress: 5,
      message: 'Browser launched, starting device tests...',
    });

    // Test each device
    for (let i = 0; i < deviceList.length; i++) {
      const device = deviceList[i];
      
      updateTestProgress(testId, {
        testId,
        status: 'running',
        currentDevice: device.name,
        totalDevices: deviceList.length,
        completedDevices: i,
        progress: 5 + ((i / deviceList.length) * 85), // 5-90% for device testing
        message: `Testing ${device.name}...`,
      });

      const result = await testDevice(browser, url, device, testId, enableInteractive);
      results.push(result);

      updateTestProgress(testId, {
        testId,
        status: 'running',
        currentDevice: device.name,
        totalDevices: deviceList.length,
        completedDevices: i + 1,
        progress: 5 + (((i + 1) / deviceList.length) * 85),
        message: `Completed ${device.name} - Found ${result.issues.length} issues`,
      });
    }

    updateTestProgress(testId, {
      testId,
      status: 'completed',
      totalDevices: deviceList.length,
      completedDevices: deviceList.length,
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
      totalDevices: deviceList.length,
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
      if (issues.length > 0) {
        annotatedPath = path.join(REPORTS_DIR, testId, 'annotated', `${device.name}_annotated.png`);
        await annotateScreenshot({
          screenshotPath,
          issues,
          outputPath: annotatedPath,
        });
      }
    } else {
      console.warn(`⚠️ No Figma baseline for ${device.name}.`);
      
      // Check if interactive testing is enabled (parameter takes priority over env variable)
      const isInteractiveEnabled = enableInteractive !== undefined 
        ? enableInteractive 
        : process.env.ENABLE_INTERACTIVE_TESTING === 'true';
      
      if (isInteractiveEnabled) {
        console.log(`🤖 Starting Auto-Exploration Mode...`);
        // Auto-Exploration Mode
        try {
          const interactionPlan = await generateInteractionPlan(page, screenshotPath);
          
          for (const action of interactionPlan) {
            console.log(`🤖 Auto-Exploring: ${action.name}`);
            
            await executeInteraction(page, action);
            
            // Capture state screenshot
            const stateName = `${device.name}_${action.action}_${action.name.replace(/\s+/g, '_')}`;
            const stateScreenshotPath = path.join(SCREENSHOT_DIR, testId, `${stateName}.png`);
            await page.screenshot({ path: stateScreenshotPath, fullPage: true });

            // Compare with Main Design (Consistency Check) -> Using Desktop as style reference
            // Note: In a real scenario, we'd check if specific state Figma file exists
            const styleReferencePath = findMatchingFigmaFile('Desktop_1920px', 1920); // Fallback to desktop for style
            
            if (styleReferencePath && fs.existsSync(styleReferencePath)) {
               const aiResponse = await analyzeVisualDifferences({
                  websiteImagePath: stateScreenshotPath,
                  figmaImagePath: styleReferencePath,
                  deviceName: stateName
               });
               
               // Add state issues to main issues list
               issues.push(...aiResponse.issues.map(i => ({...i, category: `[Interaction: ${action.name}] ${i.category}`})));
            }
          }
        } catch (interactionError) {
          console.error(`Exploration failed: ${interactionError}`);
        }

        issues.push({
          category: 'Info',
          severity: 'low',
          description: `No specific Figma baseline. Performed Auto-Exploration and Style Consistency checks.`,
          howToReproduce: `Review auto-generated state screenshots`,
          deviceName: device.name,
        });
      } else {
        console.log(`ℹ️ Interactive testing disabled. Skipping auto-exploration.`);
        issues.push({
          category: 'Missing Baseline',
          severity: 'low',
          description: `No Figma design screenshot found for ${device.name}. Add a baseline to enable comparison.`,
          howToReproduce: `Add ${device.name}.png or a generic mobile/desktop.png to ${FIGMA_DIR} folder`,
          deviceName: device.name,
        });
      }
    }

    await context.close();

    return {
      deviceName: device.name,
      screenshotPath,
      figmaPath: fs.existsSync(figmaPath) ? figmaPath : '',
      annotatedPath,
      issues,
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
