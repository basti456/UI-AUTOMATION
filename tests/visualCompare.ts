import fs from "fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { ssim } from "ssim.js";

interface VisualCompareResult {
  diffPixels: number;
  ssimScore: number;
  passed: boolean;
}

export async function visualCompare(
  actualPath: string,
  expectedPath: string,
  diffPath: string,
  threshold = 0.95
): Promise<VisualCompareResult> {
  if (!fs.existsSync(actualPath) || !fs.existsSync(expectedPath)) {
    throw new Error("Actual or expected image missing.");
  }

  const actualImg = PNG.sync.read(fs.readFileSync(actualPath));
  const expectedImg = PNG.sync.read(fs.readFileSync(expectedPath));

  // Pixelmatch diff
  const diff = new PNG({ width: actualImg.width, height: actualImg.height });
  const diffPixels = pixelmatch(
    actualImg.data,
    expectedImg.data,
    diff.data,
    actualImg.width,
    actualImg.height,
    { threshold: 0.1 }
  );

  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  // SSIM perceptual similarity
  const ssimResult = ssim(actualImg, expectedImg);
  const ssimScore = ssimResult.mssim;

  const passed = ssimScore >= threshold;

  console.log(
    `👁️ Visual Compare | SSIM: ${ssimScore.toFixed(4)} | Diff pixels: ${diffPixels} | Passed: ${passed}`
  );

  return { diffPixels, ssimScore, passed };
}
