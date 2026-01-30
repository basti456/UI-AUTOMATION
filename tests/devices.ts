import { devices, BrowserContextOptions } from "@playwright/test";

export interface deviceConfig {
  name: string;
  config: BrowserContextOptions;
}

export const deviceList: deviceConfig[] = [
  { name: 'Desktop 1920x1080', config: devices['Desktop Chrome'] },
  { name: 'iPad Pro', config: devices['iPad Pro'] },
  { name: 'iPhone 12', config: devices['iPhone 12'] },
  { name: 'Pixel 5', config: devices['Pixel 5'] },
].filter(d => d.config); // filter out invalid keys
