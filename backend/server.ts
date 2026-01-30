import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import cors from 'cors';
import { runVisualTest, getTestProgress } from './src/testOrchestrator';
import { generateHTMLReport, saveReport } from './src/reportGenerator';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
// Serve static files (screenshots, reports, etc.)
app.use(express.static(path.join(__dirname, '../public')));
app.use('/screenshots', express.static(path.join(__dirname, '../screenshots')));
app.use('/FigmaScreens', express.static(path.join(__dirname, '../FigmaScreens')));
app.use('/reports', express.static(path.join(__dirname, '../reports')));

// Store active tests
const activeTests = new Map<string, { url: string; status: string }>();

// API Routes

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'UI Automation Server is running' });
});

// Start a new test
app.post('/api/start-test', async (req: Request, res: Response) => {
  const { url, enableInteractive } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Validate URL format
  try {
    new URL(url);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Generate test ID
  const testId = uuidv4();

  // Store test info
  activeTests.set(testId, { url, status: 'queued' });

  // Start test in background (pass enableInteractive option)
  runTest(testId, url, enableInteractive);

  res.json({
    testId,
    message: 'Test started successfully',
    statusUrl: `/api/test-status/${testId}`,
    reportUrl: `/api/report/${testId}`,
  });
});

// Get test status
app.get('/api/test-status/:testId', (req: Request, res: Response) => {
  const { testId } = req.params;

  const progress = getTestProgress(testId);

  if (!progress) {
    return res.status(404).json({ error: 'Test not found' });
  }

  res.json(progress);
});

// Get report
app.get('/api/report/:testId', (req: Request, res: Response) => {
  const { testId } = req.params;
  const reportPath = path.join(process.env.REPORTS_DIR || 'reports', testId, 'report.html');

  if (!fs.existsSync(reportPath)) {
    return res.status(404).json({ error: 'Report not found. Test may still be running.' });
  }

  // Send the HTML report
  res.sendFile(path.resolve(reportPath));
});

// Get report as JSON
app.get('/api/report/:testId/json', (req: Request, res: Response) => {
  const { testId } = req.params;
  const reportPath = path.join(process.env.REPORTS_DIR || 'reports', testId, 'report.html');

  if (!fs.existsSync(reportPath)) {
    return res.status(404).json({ error: 'Report not found' });
  }

  const testInfo = activeTests.get(testId);
  
  res.json({
    testId,
    url: testInfo?.url || '',
    reportUrl: `/api/report/${testId}`,
    viewUrl: `http://localhost:${PORT}/api/report/${testId}`,
  });
});

// Home page
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Background test execution
async function runTest(testId: string, url: string, enableInteractive?: boolean) {
  try {
    const separator = '='.repeat(60);
    console.log(`\n${separator}`);
    console.log(`🚀 Starting test ${testId} for ${url}`);
    console.log(`🤖 Interactive testing: ${enableInteractive ? 'ENABLED' : 'DISABLED'}`);
    console.log(separator);

    const results = await runVisualTest(url, testId, enableInteractive);

    // Generate report
    const html = generateHTMLReport({
      testId,
      url,
      results,
    });

    saveReport(testId, html);

    // Update test status
    activeTests.set(testId, { url, status: 'completed' });

    console.log(`\n${separator}`);
    console.log(`✅ Test ${testId} completed successfully`);
    console.log(`📊 Report available at: http://localhost:${PORT}/api/report/${testId}`);
    console.log(`${separator}\n`);

  } catch (error: any) {
    console.error(`❌ Test ${testId} failed:`, error.message);
    activeTests.set(testId, { url, status: 'failed' });
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎯 UI Automation Testing Server                        ║
║                                                           ║
║   Server running at: http://localhost:${PORT}              ║
║                                                           ║
║   📊 Dashboard: http://localhost:${PORT}                   ║
║   🔧 API Health: http://localhost:${PORT}/api/health       ║
║                                                           ║
║   Ready to test your UI! 🚀                              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Check for Ollama API key
  if (!process.env.OLLAMA_API_KEY) {
    console.warn(`
⚠️  WARNING: OLLAMA_API_KEY not found in environment variables!
   Please set your API key in the .env file to use AI analysis.
    `);
  }

  // Check for Figma screenshots directory
  const figmaDir = process.env.FIGMA_SCREENSHOTS_DIR || 'FigmaScreens';
  if (!fs.existsSync(figmaDir) || fs.readdirSync(figmaDir).length === 0) {
    console.warn(`
⚠️  INFO: No Figma screenshots found in ${figmaDir}/
   Add your Figma design screenshots to enable comparison.
   Expected filenames: iPhone_SE_320px.png, iPad_Portrait_768px.png, etc.
    `);
  }
});
