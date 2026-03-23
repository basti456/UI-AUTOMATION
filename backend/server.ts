import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
import { runVisualTest, getTestProgress } from './src/testOrchestrator';
import { generateHTMLReport, saveReport } from './src/reportGenerator';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const REPORTS_DIR = path.join(process.cwd(), 'reports');
const FIGMA_DIR = path.join(process.cwd(), 'FigmaScreens');

// Ensure dirs exist
[REPORTS_DIR, FIGMA_DIR].forEach((d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// Multer for figma uploads
const figmaStorage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const type = file.fieldname === 'web' ? 'desktop' : 'mobile';
    const dir = path.join(FIGMA_DIR, type);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `figma_upload${ext}`);
  },
});
const figmaUpload = multer({
  storage: figmaStorage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/screenshots', express.static(path.join(__dirname, '../screenshots')));
app.use('/FigmaScreens', express.static(path.join(__dirname, '../FigmaScreens')));
app.use('/reports', express.static(path.join(__dirname, '../reports')));

// Store active tests
const activeTests = new Map<string, { url: string; status: string; timestamp: string }>();

// ---------- API Routes ----------

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'UI Automation Server is running' });
});

// Upload Figma screenshots
app.post(
  '/api/upload-figma',
  figmaUpload.fields([
    { name: 'web', maxCount: 1 },
    { name: 'mobile', maxCount: 1 },
  ]),
  (req: Request, res: Response) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const uploaded: string[] = [];
    if (files?.web?.[0]) uploaded.push(`web → ${files.web[0].path}`);
    if (files?.mobile?.[0]) uploaded.push(`mobile → ${files.mobile[0].path}`);
    if (uploaded.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    console.log(`📁 Figma uploads: ${uploaded.join(', ')}`);
    res.json({ success: true, uploaded });
  }
);

// Start a new test
app.post('/api/start-test', async (req: Request, res: Response) => {
  const { url, enableInteractive, deviceType } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }

  const testId = uuidv4();
  activeTests.set(testId, { url, status: 'queued', timestamp: new Date().toISOString() });
  runTest(testId, url, enableInteractive, deviceType);

  res.json({ testId, message: 'Test started', statusUrl: `/api/test-status/${testId}`, reportUrl: `/api/report/${testId}` });
});

// Get test status
app.get('/api/test-status/:testId', (req: Request, res: Response) => {
  const progress = getTestProgress(req.params.testId);
  if (!progress) return res.status(404).json({ error: 'Test not found' });
  res.json(progress);
});

// Get report HTML
app.get('/api/report/:testId', (req: Request, res: Response) => {
  const reportPath = path.join(REPORTS_DIR, req.params.testId, 'report.html');
  if (!fs.existsSync(reportPath)) return res.status(404).json({ error: 'Report not found' });
  res.sendFile(path.resolve(reportPath));
});

// Get report JSON metadata
app.get('/api/report/:testId/json', (req: Request, res: Response) => {
  const { testId } = req.params;
  const reportPath = path.join(REPORTS_DIR, testId, 'report.html');
  if (!fs.existsSync(reportPath)) return res.status(404).json({ error: 'Report not found' });
  const testInfo = activeTests.get(testId);
  res.json({
    testId,
    url: testInfo?.url || '',
    reportUrl: `/api/report/${testId}`,
    viewUrl: `http://localhost:${PORT}/api/report/${testId}`,
  });
});

// List last 3 reports
app.get('/api/reports', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(REPORTS_DIR)) return res.json([]);

    const reportDirs = fs.readdirSync(REPORTS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const reportPath = path.join(REPORTS_DIR, d.name, 'report.html');
        const metaPath = path.join(REPORTS_DIR, d.name, 'meta.json');
        if (!fs.existsSync(reportPath)) return null;

        let meta: { url?: string; timestamp?: string } = {};
        if (fs.existsSync(metaPath)) {
          try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')); } catch {}
        }

        const stat = fs.statSync(reportPath);
        const testInfo = activeTests.get(d.name);
        return {
          testId: d.name,
          url: meta.url || testInfo?.url || '',
          timestamp: meta.timestamp || testInfo?.timestamp || stat.mtime.toISOString(),
          reportUrl: `http://localhost:${PORT}/api/report/${d.name}`,
        };
      })
      .filter(Boolean);

    // Sort newest first, return last 3
    reportDirs.sort((a, b) => new Date(b!.timestamp).getTime() - new Date(a!.timestamp).getTime());
    res.json(reportDirs.slice(0, 3));
  } catch (err) {
    res.status(500).json({ error: 'Failed to list reports' });
  }
});

// Serve React app for all non-API routes (in production mode)
app.get('/', (_req: Request, res: Response) => {
  // In dev mode, Vite serves the frontend; in production mode, serve from dist
  const distIndex = path.join(__dirname, '../dist', 'index.html');
  if (fs.existsSync(distIndex)) {
    res.sendFile(path.resolve(distIndex));
  } else {
    // Fall back to old HTML during dev if dist doesn't exist
    const legacyIndex = path.join(__dirname, '../public', 'index.html');
    if (fs.existsSync(legacyIndex)) res.sendFile(path.resolve(legacyIndex));
    else res.json({ status: 'API server running. Frontend served by Vite on port 5173.' });
  }
});

// Background test execution
async function runTest(testId: string, url: string, enableInteractive?: boolean, deviceType?: string) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Starting test ${testId} for ${url}`);
    console.log(`🤖 Interactive: ${enableInteractive ? 'ENABLED' : 'DISABLED'}`);
    console.log(`📱 Device Type: ${deviceType || 'ALL'}`);
    console.log('='.repeat(60));

    const results = await runVisualTest(url, testId, enableInteractive, deviceType);
    const html = generateHTMLReport({ testId, url, results });
    saveReport(testId, html, url);

    activeTests.set(testId, { url, status: 'completed', timestamp: new Date().toISOString() });
    console.log(`\n✅ Test ${testId} completed`);
    console.log(`📊 Report: http://localhost:${PORT}/api/report/${testId}\n`);

    // Cleanup old reports — keep only last 3
    cleanupOldReports();
  } catch (error: any) {
    console.error(`❌ Test ${testId} failed:`, error.message);
    activeTests.set(testId, { url, status: 'failed', timestamp: new Date().toISOString() });
  }
}

function cleanupOldReports() {
  try {
    if (!fs.existsSync(REPORTS_DIR)) return;

    const dirs = fs.readdirSync(REPORTS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(REPORTS_DIR, d.name, 'report.html')))
      .map((d) => {
        const stat = fs.statSync(path.join(REPORTS_DIR, d.name, 'report.html'));
        return { name: d.name, mtime: stat.mtime.getTime() };
      })
      .sort((a, b) => b.mtime - a.mtime); // newest first

    // Delete all beyond index 2 (keep 3)
    dirs.slice(3).forEach(({ name }) => {
      const dir = path.join(REPORTS_DIR, name);
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`🗑️ Cleaned up old report: ${name}`);
    });
  } catch (err) {
    console.warn('⚠️ Report cleanup error:', err);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎯 UI Automation Testing Server                        ║
║                                                           ║
║   API Server: http://localhost:${PORT}                    ║
║   React UI:   http://localhost:5173  (run: npm run dev)   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

  if (!process.env.OLLAMA_API_KEY) {
    console.warn('⚠️  WARNING: OLLAMA_API_KEY not found in .env');
  }
});
