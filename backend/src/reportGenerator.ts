import fs from 'fs';
import path from 'path';
import { ReportData, TestResult, VisualIssue } from './types';

const REPORTS_DIR = path.join(process.cwd(), 'public', 'reports');

function getRelativePath(fullPath: string): string {
  if (!fullPath) return '';
  // relative to public folder since server serves static files from there
  const relative = path.relative(path.join(process.cwd(), 'public'), fullPath);
  return relative.replace(/\\/g, '/');
}

interface GenerateReportOptions {
  testId: string;
  url: string;
  results: TestResult[];
}

export function generateHTMLReport(options: GenerateReportOptions): string {
  const { testId, url, results } = options;

  // Calculate summary statistics
  const allIssues: VisualIssue[] = [];
  results.forEach((result) => {
    allIssues.push(...result.issues);
  });

  const criticalIssues = allIssues.filter((i) => i.severity === 'critical').length;
  const highIssues = allIssues.filter((i) => i.severity === 'high').length;
  const mediumIssues = allIssues.filter((i) => i.severity === 'medium').length;
  const lowIssues = allIssues.filter((i) => i.severity === 'low').length;

  const reportData: ReportData = {
    testId,
    url,
    timestamp: new Date().toISOString(),
    results,
    totalIssues: allIssues.length,
    criticalIssues,
    highIssues,
    mediumIssues,
    lowIssues,
  };

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visual Testing Report - ${url}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    ${getReportStyles()}
</head>
<body>
    <div class="container">
        ${generateHeader(reportData)}
        ${generateSummarySection(reportData)}
        ${generateDeviceSections(reportData)}
    </div>
    ${getReportScripts()}
</body>
</html>
`;

  return html;
}

function generateHeader(data: ReportData): string {
  const date = new Date(data.timestamp).toLocaleString();
  
  return `
    <header class="report-header">
        <div class="header-content">
            <h1>🎯 Visual Testing Report</h1>
            <div class="header-details">
                <div class="detail-item">
                    <span class="label">URL:</span>
                    <a href="${data.url}" target="_blank" class="url-link">${data.url}</a>
                </div>
                <div class="detail-item">
                    <span class="label">Test ID:</span>
                    <span class="value">${data.testId}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Date:</span>
                    <span class="value">${date}</span>
                </div>
            </div>
        </div>
    </header>
  `;
}

function generateSummarySection(data: ReportData): string {
  const passRate = data.results.filter(r => r.issues.length === 0).length / data.results.length * 100;
  
  return `
    <section class="summary-section">
        <h2>📊 Executive Summary</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${data.results.length}</div>
                <div class="stat-label">Devices Tested</div>
            </div>
            <div class="stat-card ${data.totalIssues === 0 ? 'success' : 'warning'}">
                <div class="stat-value">${data.totalIssues}</div>
                <div class="stat-label">Total Issues</div>
            </div>
            <div class="stat-card ${data.criticalIssues === 0 ? 'success' : 'critical'}">
                <div class="stat-value">${data.criticalIssues}</div>
                <div class="stat-label">Critical</div>
            </div>
            <div class="stat-card ${data.highIssues === 0 ? 'success' : 'high'}">
                <div class="stat-value">${data.highIssues}</div>
                <div class="stat-label">High</div>
            </div>
            <div class="stat-card ${data.mediumIssues === 0 ? 'success' : 'medium'}">
                <div class="stat-value">${data.mediumIssues}</div>
                <div class="stat-label">Medium</div>
            </div>
            <div class="stat-card ${data.lowIssues === 0 ? 'success' : 'low'}">
                <div class="stat-value">${data.lowIssues}</div>
                <div class="stat-label">Low</div>
            </div>
        </div>
        <div class="pass-rate">
            <div class="pass-rate-bar">
                <div class="pass-rate-fill" style="width: ${passRate}%"></div>
            </div>
            <div class="pass-rate-text">${passRate.toFixed(1)}% devices passed without issues</div>
        </div>
    </section>
  `;
}

function generateDeviceSections(data: ReportData): string {
  const sections = data.results.map((result, index) => {
    const hasIssues = result.issues.length > 0;
    const statusClass = hasIssues ? 'has-issues' : 'passed';
    
    return `
      <section class="device-section ${statusClass}">
        <div class="device-header" onclick="toggleDevice('device-${index}')">
            <div class="device-name">
                <span class="device-icon">${getDeviceIcon(result.deviceName)}</span>
                <h3>${result.deviceName.replace(/_/g, ' ')}</h3>
            </div>
            <div class="device-status">
                ${hasIssues 
                  ? `<span class="badge badge-issues">${result.issues.length} issues</span>` 
                  : `<span class="badge badge-pass">✓ Passed</span>`}
                <span class="toggle-icon">▼</span>
            </div>
        </div>
        
        <div class="device-content" id="device-${index}">
            ${generateDeviceContent(result, data.testId)}
        </div>
      </section>
    `;
  }).join('');

  return `<div class="devices-container">${sections}</div>`;
}

function generateDeviceContent(result: TestResult, testId: string): string {
  if (result.issues.length === 0) {
    return `
      <div class="no-issues">
        <div class="success-icon">✓</div>
        <p>All visual checks passed for this device!</p>
      </div>
      ${generateScreenshotComparison(result, testId)}
    `;
  }

  // Group issues by category
  const issuesByCategory = result.issues.reduce((acc, issue) => {
    if (!acc[issue.category]) {
      acc[issue.category] = [];
    }
    acc[issue.category].push(issue);
    return acc;
  }, {} as Record<string, VisualIssue[]>);

  const categorySections = Object.entries(issuesByCategory).map(([category, issues]) => {
    const issuesList = issues.map((issue, idx) => `
      <div class="issue-item severity-${issue.severity}">
        <div class="issue-header">
          <span class="issue-number">#${idx + 1}</span>
          <span class="severity-badge ${issue.severity}">${issue.severity.toUpperCase()}</span>
          ${issue.element ? `<span class="element-tag">${issue.element}</span>` : ''}
        </div>
        <div class="issue-description">${issue.description}</div>
        <div class="issue-reproduce">
          <strong>How to reproduce:</strong> ${issue.howToReproduce}
        </div>
      </div>
    `).join('');

    return `
      <div class="category-section">
        <h4 class="category-title">${category}</h4>
        <div class="issues-list">
          ${issuesList}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="issues-section">
      ${categorySections}
    </div>
    ${generateScreenshotComparison(result, testId)}
  `;
}

function generateScreenshotComparison(result: TestResult, testId: string): string {
  const websiteImg = result.screenshotPath ? path.relative(process.cwd(), result.screenshotPath).replace(/\\/g, '/') : '';
  const figmaImg = result.figmaPath ? path.relative(process.cwd(), result.figmaPath).replace(/\\/g, '/') : '';
  const annotatedImg = result.annotatedPath ? path.relative(process.cwd(), result.annotatedPath).replace(/\\/g, '/') : '';

  return `
    <div class="screenshot-comparison">
      <h4>📸 Screenshots</h4>
      <div class="screenshot-grid">
        ${annotatedImg ? `
          <div class="screenshot-item">
            <div class="screenshot-label">Annotated (Issues Highlighted)</div>
            <img src="/${annotatedImg}" alt="Annotated Screenshot" class="screenshot-img" onclick="openImageModal(this.src)">
          </div>
        ` : ''}
                <div class="comparison-view">
                    <div class="screenshot-container">
                        <h4>Actual Website</h4>
                        <img src="${getRelativePath(result.annotatedPath || result.screenshotPath)}" alt="Website Screenshot" onclick="openModal(this.src)">
                    </div>
                    ${result.figmaPath ? `
                    <div class="screenshot-container">
                        <h4>Figma Design</h4>
                        <img src="${getRelativePath(result.figmaPath)}" alt="Figma Design" onclick="openModal(this.src)">
                    </div>
                    ` : ''}
                </div>
      </div>
    </div>
  `;
}

function getDeviceIcon(deviceName: string): string {
  if (deviceName.includes('iPhone') || deviceName.includes('SE') || deviceName.includes('375px') || deviceName.includes('320px') || deviceName.includes('414px')) {
    return '📱';
  } else if (deviceName.includes('iPad') || deviceName.includes('768px') || deviceName.includes('1024px')) {
    return '📲';
  } else {
    return '💻';
  }
}

function getReportStyles(): string {
  return `
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        padding: 2rem;
        color: #1a202c;
      }

      .container {
        max-width: 1400px;
        margin: 0 auto;
      }

      .report-header {
        background: white;
        border-radius: 16px;
        padding: 2rem;
        margin-bottom: 2rem;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      }

      .report-header h1 {
        font-size: 2.5rem;
        font-weight: 700;
        color: #2d3748;
        margin-bottom: 1.5rem;
      }

      .header-details {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1rem;
      }

      .detail-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .detail-item .label {
        font-weight: 600;
        color: #4a5568;
      }

      .detail-item .value {
        color: #2d3748;
      }

      .url-link {
        color: #667eea;
        text-decoration: none;
        font-weight: 500;
        transition: color 0.2s;
      }

      .url-link:hover {
        color: #764ba2;
      }

      .summary-section {
        background: white;
        border-radius: 16px;
        padding: 2rem;
        margin-bottom: 2rem;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      }

      .summary-section h2 {
        font-size: 1.75rem;
        font-weight: 700;
        color: #2d3748;
        margin-bottom: 1.5rem;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
      }

      .stat-card {
        background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
        border-radius: 12px;
        padding: 1.5rem;
        text-align: center;
        border: 2px solid #e2e8f0;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .stat-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
      }

      .stat-card.success {
        border-color: #48bb78;
        background: linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%);
      }

      .stat-card.critical {
        border-color: #f56565;
        background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%);
      }

      .stat-card.high {
        border-color: #ed8936;
        background: linear-gradient(135deg, #fffaf0 0%, #feebc8 100%);
      }

      .stat-card.medium {
        border-color: #ecc94b;
        background: linear-gradient(135deg, #fffff0 0%, #fefcbf 100%);
      }

      .stat-card.low {
        border-color: #4299e1;
        background: linear-gradient(135deg, #ebf8ff 0%, #bee3f8 100%);
      }

      .stat-value {
        font-size: 2.5rem;
        font-weight: 700;
        color: #2d3748;
      }

      .stat-label {
        font-size: 0.875rem;
        color: #4a5568;
        margin-top: 0.5rem;
        font-weight: 500;
      }

      .pass-rate {
        margin-top: 2rem;
      }

      .pass-rate-bar {
        height: 30px;
        background: #e2e8f0;
        border-radius: 15px;
        overflow: hidden;
        margin-bottom: 0.5rem;
      }

      .pass-rate-fill {
        height: 100%;
        background: linear-gradient(90deg, #48bb78 0%, #38a169 100%);
        transition: width 1s ease-out;
      }

      .pass-rate-text {
        text-align: center;
        font-weight: 600;
        color: #2d3748;
      }

      .device-section {
        background: white;
        border-radius: 16px;
        margin-bottom: 1.5rem;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        overflow: hidden;
        border-left: 6px solid #e2e8f0;
        transition: all 0.3s;
      }

      .device-section.has-issues {
        border-left-color: #f56565;
      }

      .device-section.passed {
        border-left-color: #48bb78;
      }

      .device-header {
        padding: 1.5rem 2rem;
        background: #f7fafc;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background 0.2s;
      }

      .device-header:hover {
        background: #edf2f7;
      }

      .device-name {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .device-icon {
        font-size: 1.5rem;
      }

      .device-name h3 {
        font-size: 1.25rem;
        font-weight: 600;
        color: #2d3748;
      }

      .device-status {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .badge {
        padding: 0.5rem 1rem;
        border-radius: 20px;
        font-size: 0.875rem;
        font-weight: 600;
      }

      .badge-issues {
        background: #fed7d7;
        color: #c53030;
      }

      .badge-pass {
        background: #c6f6d5;
        color: #22543d;
      }

      .toggle-icon {
        font-size: 0.75rem;
        color: #718096;
        transition: transform 0.3s;
      }

      .device-content {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.4s ease-out;
      }

      .device-content.expanded {
        max-height: 10000px;
        padding: 2rem;
      }

      .no-issues {
        text-align: center;
        padding: 3rem;
        color: #48bb78;
      }

      .success-icon {
        font-size: 4rem;
        margin-bottom: 1rem;
      }

      .category-section {
        margin-bottom: 2rem;
      }

      .category-title {
        font-size: 1.125rem;
        font-weight: 600;
        color: #2d3748;
        margin-bottom: 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid #e2e8f0;
      }

      .issues-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .issue-item {
        background: #f7fafc;
        border-radius: 8px;
        padding: 1rem;
        border-left: 4px solid;
        transition: transform 0.2s;
      }

      .issue-item:hover {
        transform: translateX(4px);
      }

      .issue-item.severity-critical {
        border-left-color: #f56565;
      }

      .issue-item.severity-high {
        border-left-color: #ed8936;
      }

      .issue-item.severity-medium {
        border-left-color: #ecc94b;
      }

      .issue-item.severity-low {
        border-left-color: #4299e1;
      }

      .issue-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
        flex-wrap: wrap;
      }

      .issue-number {
        font-weight: 700;
        color: #2d3748;
      }

      .severity-badge {
        padding: 0.25rem 0.75rem;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 700;
        color: white;
      }

      .severity-badge.critical {
        background: #f56565;
      }

      .severity-badge.high {
        background: #ed8936;
      }

      .severity-badge.medium {
        background: #ecc94b;
      }

      .severity-badge.low {
        background: #4299e1;
      }

      .element-tag {
        padding: 0.25rem 0.75rem;
        background: #e2e8f0;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 600;
        color: #2d3748;
      }

      .issue-description {
        color: #2d3748;
        margin-bottom: 0.5rem;
        line-height: 1.6;
      }

      .issue-reproduce {
        color: #4a5568;
        font-size: 0.875rem;
        font-style: italic;
      }

      .screenshot-comparison {
        margin-top: 2rem;
        padding-top: 2rem;
        border-top: 2px solid #e2e8f0;
      }

      .screenshot-comparison h4 {
        font-size: 1.125rem;
        font-weight: 600;
        color: #2d3748;
        margin-bottom: 1rem;
      }

      .screenshot-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1.5rem;
      }

      .screenshot-item {
        border-radius: 8px;
        overflow: hidden;
        background: #f7fafc;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      }

      .screenshot-label {
        padding: 0.75rem;
        background: #2d3748;
        color: white;
        font-weight: 600;
        text-align: center;
        font-size: 0.875rem;
      }

      .screenshot-img {
        width: 100%;
        height: auto;
        display: block;
        cursor: pointer;
        transition: transform 0.2s;
      }

      .screenshot-img:hover {
        transform: scale(1.02);
      }

      /* Modal for full-size images */
      .image-modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        z-index: 1000;
        justify-content: center;
        align-items: center;
        padding: 2rem;
      }

      .image-modal.active {
        display: flex;
      }

      .image-modal img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }

      .modal-close {
        position: absolute;
        top: 2rem;
        right: 2rem;
        font-size: 2rem;
        color: white;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.2);
        width: 50px;
        height: 50px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }

      .modal-close:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      @media print {
        body {
          background: white;
          padding: 0;
        }

        .device-content {
          max-height: none !important;
          padding: 1rem !important;
        }
      }
    </style>
  `;
}

function getReportScripts(): string {
  return `
    <script>
      function toggleDevice(deviceId) {
        const content = document.getElementById(deviceId);
        const icon = content.previousElementSibling.querySelector('.toggle-icon');
        
        if (content.classList.contains('expanded')) {
          content.classList.remove('expanded');
          icon.style.transform = 'rotate(0deg)';
        } else {
          content.classList.add('expanded');
          icon.style.transform = 'rotate(180deg)';
        }
      }

      function openImageModal(src) {
        let modal = document.querySelector('.image-modal');
        if (!modal) {
          modal = document.createElement('div');
          modal.className = 'image-modal';
          modal.innerHTML = '<span class="modal-close" onclick="closeImageModal()">×</span><img>';
          document.body.appendChild(modal);
        }
        modal.querySelector('img').src = src;
        modal.classList.add('active');
      }

      function closeImageModal() {
        document.querySelector('.image-modal').classList.remove('active');
      }

      // Expand first device with issues by default
      document.addEventListener('DOMContentLoaded', () => {
        const firstDeviceWithIssues = document.querySelector('.device-section.has-issues .device-content');
        if (firstDeviceWithIssues) {
          firstDeviceWithIssues.classList.add('expanded');
          firstDeviceWithIssues.previousElementSibling.querySelector('.toggle-icon').style.transform = 'rotate(180deg)';
        }
      });

      // Close modal on escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeImageModal();
        }
      });
    </script>
  `;
}

export function saveReport(testId: string, html: string): string {
  const reportsDir = process.env.REPORTS_DIR || 'reports';
  const reportPath = path.join(reportsDir, testId, 'report.html');
  
  fs.writeFileSync(reportPath, html, 'utf-8');
  console.log(`📄 Report saved: ${reportPath}`);
  
  return reportPath;
}
