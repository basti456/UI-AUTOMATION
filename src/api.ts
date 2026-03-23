import axios from 'axios';

const api = axios.create({ baseURL: '' });

export interface TestProgress {
  testId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  totalDevices: number;
  completedDevices: number;
  progress: number;
  message: string;
  currentDevice?: string;
}

export interface ReportMeta {
  testId: string;
  url: string;
  timestamp: string;
  reportUrl: string;
}

export const startTest = (url: string, enableInteractive: boolean, deviceType: string) =>
  api.post<{ testId: string; statusUrl: string; reportUrl: string }>('/api/start-test', {
    url,
    enableInteractive,
    deviceType,
  });

export const getTestStatus = (testId: string) =>
  api.get<TestProgress>(`/api/test-status/${testId}`);

export const getReportJson = (testId: string) =>
  api.get<{ testId: string; url: string; reportUrl: string; viewUrl: string }>(
    `/api/report/${testId}/json`
  );

export const listReports = () => api.get<ReportMeta[]>('/api/reports');

export const uploadFigma = (formData: FormData) =>
  api.post('/api/upload-figma', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const checkHealth = () => api.get('/api/health');
