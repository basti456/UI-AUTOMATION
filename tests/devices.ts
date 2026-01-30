import { devices, BrowserContextOptions } from "@playwright/test";

export interface deviceConfig {
  name: string;
  config: BrowserContextOptions;
}

export const deviceList: deviceConfig[] = [
  { name: 'iPhone_SE_320px', config: { ...devices['iPhone SE'], viewport: { width: 320, height: 568 } } },
  { name: 'iPhone_12_375px', config: devices['iPhone 12'] },
  { name: 'iPhone_Plus_414px', config: { ...devices['iPhone 12 Pro'], viewport: { width: 414, height: 896 } } },
  { name: 'iPad_Portrait_768px', config: { ...devices['iPad Pro'], viewport: { width: 768, height: 1024 } } },
  { name: 'iPad_Landscape_1024px', config: devices['iPad Pro'] },
  { name: 'Desktop_1440px', config: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  { name: 'Desktop_1920px', config: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 } },
  { name: 'Edge_Case_850px', config: { viewport: { width: 850, height: 900 }, deviceScaleFactor: 1 } },
  { name: 'Edge_Case_950px', config: { viewport: { width: 950, height: 900 }, deviceScaleFactor: 1 } },
].filter(d => d.config); // filter out invalid keys

