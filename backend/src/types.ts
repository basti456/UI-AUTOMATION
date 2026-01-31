export interface VisualIssue {
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  howToReproduce: string;
  deviceName: string;
  element?: string;
  annotatedScreenshot?: string;
}

export interface TestResult {
  deviceName: string;
  screenshotPath: string;
  figmaPath: string;
  annotatedPath?: string;
  issues: VisualIssue[];
  timestamp: string;
}

export interface AIResponse {
  issues: VisualIssue[];
  summary: string;
}

export interface TestProgress {
  testId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  currentDevice?: string;
  totalDevices: number;
  completedDevices: number;
  progress: number; // 0-100
  message: string;
}

export interface ReportData {
  testId: string;
  url: string;
  timestamp: string;
  results: TestResult[];
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
}

export interface DeviceConfig {
  name: string;
  config: any;
}
