import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { VisualIssue } from './types';

interface AnnotationOptions {
  screenshotPath: string;
  issues: VisualIssue[];
  outputPath: string;
}

// Color mapping for severity levels
const SEVERITY_COLORS = {
  critical: { r: 220, g: 38, b: 38, alpha: 0.5 },   // Red
  high: { r: 234, g: 88, b: 12, alpha: 0.5 },       // Orange
  medium: { r: 234, g: 179, b: 8, alpha: 0.5 },     // Yellow
  low: { r: 59, g: 130, b: 246, alpha: 0.5 },       // Blue
};

export async function annotateScreenshot(options: AnnotationOptions): Promise<string> {
  const { screenshotPath, issues, outputPath } = options;

  try {
    console.log(`🎨 Annotating screenshot: ${path.basename(screenshotPath)}`);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Load the original screenshot
    const image = sharp(screenshotPath);
    const metadata = await image.metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    if (!width || !height) {
      throw new Error('Invalid image dimensions');
    }

    // Create SVG overlay for annotations
    const svgOverlay = createSVGOverlay(issues, width, height);

    // Composite the annotations onto the image
    await image
      .composite([
        {
          input: Buffer.from(svgOverlay),
          top: 0,
          left: 0,
        },
      ])
      .toFile(outputPath);

    console.log(`✅ Annotated screenshot saved: ${path.basename(outputPath)}`);
    return outputPath;
  } catch (error: any) {
    console.error(`❌ Error annotating screenshot: ${error.message}`);
    
    // If annotation fails, just copy the original
    fs.copyFileSync(screenshotPath, outputPath);
    return outputPath;
  }
}

function createSVGOverlay(issues: VisualIssue[], imageWidth: number, imageHeight: number): string {
  const annotations: string[] = [];

  issues.forEach((issue, index) => {
    if (!issue.boundingBox) {
      // If no bounding box, skip visual annotation
      return;
    }

    const { x, y, width, height } = issue.boundingBox;
    const color = SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.medium;
    
    // Ensure coordinates are within image bounds
    const safeX = Math.max(0, Math.min(x, imageWidth - 10));
    const safeY = Math.max(0, Math.min(y, imageHeight - 10));
    const safeWidth = Math.min(width, imageWidth - safeX);
    const safeHeight = Math.min(height, imageHeight - safeY);

    // Create bounding box rectangle
    annotations.push(`
      <rect
        x="${safeX}"
        y="${safeY}"
        width="${safeWidth}"
        height="${safeHeight}"
        fill="rgba(${color.r}, ${color.g}, ${color.b}, ${color.alpha})"
        stroke="rgb(${color.r}, ${color.g}, ${color.b})"
        stroke-width="3"
        rx="4"
      />
    `);

    // Add issue number badge
    const badgeX = safeX;
    const badgeY = safeY - 30 < 0 ? safeY + safeHeight + 5 : safeY - 30;

    annotations.push(`
      <g>
        <rect
          x="${badgeX}"
          y="${badgeY}"
          width="40"
          height="25"
          fill="rgb(${color.r}, ${color.g}, ${color.b})"
          rx="4"
        />
        <text
          x="${badgeX + 20}"
          y="${badgeY + 17}"
          font-family="Arial, sans-serif"
          font-size="14"
          font-weight="bold"
          fill="white"
          text-anchor="middle"
        >#${index + 1}</text>
      </g>
    `);

    // Add severity badge
    const severityBadgeX = badgeX + 45;
    annotations.push(`
      <g>
        <rect
          x="${severityBadgeX}"
          y="${badgeY}"
          width="${issue.severity.length * 8 + 10}"
          height="25"
          fill="rgb(${color.r}, ${color.g}, ${color.b})"
          rx="4"
        />
        <text
          x="${severityBadgeX + 5}"
          y="${badgeY + 17}"
          font-family="Arial, sans-serif"
          font-size="12"
          font-weight="bold"
          fill="white"
        >${issue.severity.toUpperCase()}</text>
      </g>
    `);
  });

  // Create complete SVG
  const svg = `
    <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
      ${annotations.join('\n')}
    </svg>
  `;

  return svg;
}

export async function annotateMultipleScreenshots(
  screenshots: { path: string; issues: VisualIssue[]; outputPath: string }[]
): Promise<string[]> {
  const results: string[] = [];

  for (const screenshot of screenshots) {
    const annotatedPath = await annotateScreenshot({
      screenshotPath: screenshot.path,
      issues: screenshot.issues,
      outputPath: screenshot.outputPath,
    });
    results.push(annotatedPath);
  }

  return results;
}
