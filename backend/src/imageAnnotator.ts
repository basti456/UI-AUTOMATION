import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { VisualIssue } from './types';

interface AnnotationOptions {
  screenshotPath: string;
  issues: VisualIssue[];
  outputPath: string;
}

// Color mapping for severity levels with enhanced visibility
const SEVERITY_COLORS = {
  critical: { r: 220, g: 38, b: 38, alpha: 0.3 },   // Red with lower opacity for better visibility
  high: { r: 234, g: 88, b: 12, alpha: 0.3 },       // Orange
  medium: { r: 234, g: 179, b: 8, alpha: 0.3 },     // Yellow
  low: { r: 59, g: 130, b: 246, alpha: 0.3 },       // Blue
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

    // 1. Create Solid Bounding Box (User requested 1px solid)
    annotations.push(`
      <rect
        x="${safeX}"
        y="${safeY}"
        width="${safeWidth}"
        height="${safeHeight}"
        fill="none"
        stroke="rgb(${color.r}, ${color.g}, ${color.b})"
        stroke-width="2" 
        rx="2"
      />
    `);
    
    // 2. Add Issue Number Badge
    const badgeX = safeX;
    const badgeY = safeY - 30 < 0 ? safeY + safeHeight + 5 : safeY - 30;

    annotations.push(`
      <g filter="url(#shadow)">
        <rect
          x="${badgeX}"
          y="${badgeY}"
          width="30"
          height="24"
          fill="rgb(${color.r}, ${color.g}, ${color.b})"
          stroke="white"
          stroke-width="1"
          rx="4"
        />
        <text
          x="${badgeX + 15}"
          y="${badgeY + 17}"
          font-family="Arial, sans-serif"
          font-size="12"
          font-weight="bold"
          fill="white"
          text-anchor="middle"
        >#${index + 1}</text>
      </g>
    `);
    
    // 3. Add Element Label if available (next to number)
    if (issue.element) {
        const truncatedElement = issue.element.length > 20 ? issue.element.substring(0, 18) + '...' : issue.element;
        const charWidth = 7;
        const labelWidth = truncatedElement.length * charWidth + 15;
        const labelX = badgeX + 34; // Spaced after badge
        
        annotations.push(`
          <g filter="url(#shadow)">
            <rect
              x="${labelX}"
              y="${badgeY}"
              width="${labelWidth}"
              height="24"
              fill="white"
              stroke="rgb(${color.r}, ${color.g}, ${color.b})"
              stroke-width="1"
              rx="4"
            />
            <text
              x="${labelX + 8}"
              y="${badgeY + 16}"
              font-family="Arial, sans-serif"
              font-size="11"
              font-weight="bold"
              fill="rgb(${color.r}, ${color.g}, ${color.b})"
              text-anchor="start"
            >${truncatedElement}</text>
          </g>
        `);
    }
  });

  // Create complete SVG with dropshadow definition
  const svg = `
    <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.5)"/>
        </filter>
      </defs>
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
