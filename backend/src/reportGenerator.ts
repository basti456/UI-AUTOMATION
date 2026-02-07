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

  // Create horizontal table layout
  const issueRows = result.issues.map((issue, idx) => {
    const websiteImg = result.screenshotPath ? getRelativePath(result.screenshotPath) : '';
    const figmaImg = result.figmaPath ? getRelativePath(result.figmaPath) : '';
    // Use specific annotated screenshot if available, else fall back to master
    const annotatedImg = issue.annotatedScreenshot
      ? getRelativePath(issue.annotatedScreenshot)
      : (result.annotatedPath ? getRelativePath(result.annotatedPath) : '');

    return `
      <tr class="issue-row severity-${issue.severity}">
        <td class="issue-number-cell">
          <span class="issue-number-badge">#${idx + 1}</span>
          <span class="severity-pill ${issue.severity}">${issue.severity.toUpperCase()}</span>
        </td>
        <td class="issue-description-cell">
          <div class="issue-category">${issue.category}</div>
          <div class="issue-text">${issue.description}</div>
          ${issue.element ? `<div class="issue-element">Element: <code>${issue.element}</code></div>` : ''}
        </td>
        <td class="reproduce-cell">
          <div class="reproduce-text">${issue.howToReproduce || 'Review screenshot manually'}</div>
        </td>
        <td class="screenshots-cell">
          <div class="screenshot-thumbnails">
            ${annotatedImg ? `
              <div class="thumbnail-wrapper">
                <div class="thumb-label">Website</div>
                <img src="/${annotatedImg}" alt="Highlighted" class="screenshot-thumb" onclick="openImageModal(this.src)">
              </div>
            ` : ''}
            ${figmaImg ? `
              <div class="thumbnail-wrapper">
                <div class="thumb-label">Figma</div>
                <img src="/${figmaImg}" alt="Figma" class="screenshot-thumb" onclick="openImageModal(this.src)">
              </div>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div class="issues-table-container">
      <table class="issues-table">
        <thead>
          <tr>
            <th style="width: 100px">Issue #</th>
            <th style="width: 35%">Description</th>
            <th style="width: 30%">How to Reproduce</th>
            <th style="width: 300px">Screenshots</th>
          </tr>
        </thead>
        <tbody>
          ${issueRows}
        </tbody>
      </table>
    </div>
    ${generateInteractionStatesSection(result, testId)}
  `;
}

function generateScreenshotComparison(result: TestResult, testId: string): string {
  const websiteImg = result.screenshotPath ? getRelativePath(result.screenshotPath) : '';
  const figmaImg = result.figmaPath ? getRelativePath(result.figmaPath) : '';
  const annotatedImg = result.annotatedPath ? getRelativePath(result.annotatedPath) : '';

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
        ${websiteImg ? `
          <div class="screenshot-item">
            <div class="screenshot-label">Actual Website</div>
            <img src="/${websiteImg}" alt="Website Screenshot" class="screenshot-img" onclick="openImageModal(this.src)">
          </div>
        ` : ''}
        ${figmaImg ? `
          <div class="screenshot-item">
            <div class="screenshot-label">Figma Design</div>
            <img src="/${figmaImg}" alt="Figma Design" class="screenshot-img" onclick="openImageModal(this.src)">
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function generateInteractionStatesSection(result: TestResult, testId: string): string {
  if (!result.interactionStates || result.interactionStates.length === 0) {
    return '';
  }

  const stateItems = result.interactionStates.map((state, idx) => {
    // Use annotated screenshot if available, otherwise use raw screenshot
    const displayImg = state.annotatedPath ? getRelativePath(state.annotatedPath) : getRelativePath(state.screenshotPath);
    return `
      <div class="interaction-state-item">
        <div class="state-header">
          <div class="state-badge">${idx + 1}</div>
          <div class="state-title">${state.actionName}</div>
        </div>
        <div class="state-image-container">
          <img src="/${displayImg}" alt="${state.actionName}" class="state-screenshot" onclick="openImageModal(this.src)">
          <div class="image-overlay">
            <span class="view-icon">🔍 Click to enlarge</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="interaction-states-section">
      <h4>🎬 Interactive States</h4>
      <div class="interaction-states-grid">
        ${stateItems}
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

      /* Table Layout Styles */
      .issues-table-container {
        overflow-x: auto;
        margin-bottom: 2rem;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      }

      .issues-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 900px; /* Ensure table doesn't get too squeezed */
      }

      .issues-table th {
        background: #f8fafc;
        padding: 1rem;
        text-align: left;
        font-size: 0.85rem;
        font-weight: 700;
        color: #4a5568;
        border-bottom: 2px solid #e2e8f0;
        white-space: nowrap;
      }

      .issues-table td {
        padding: 1.25rem 1rem;
        vertical-align: top;
        border-bottom: 1px solid #edf2f7;
      }

      .issue-row:last-child td {
        border-bottom: none;
      }

      .issue-row:hover {
        background-color: #fcfdfe;
      }

      /* Severity Colors for Rows */
      .issue-row.severity-critical { border-left: 4px solid #f56565; }
      .issue-row.severity-high { border-left: 4px solid #ed8936; }
      .issue-row.severity-medium { border-left: 4px solid #ecc94b; }
      .issue-row.severity-low { border-left: 4px solid #4299e1; }

      .issue-number-badge {
        display: inline-block;
        background: #2d3748;
        color: white;
        border-radius: 6px;
        padding: 0.25rem 0.5rem;
        font-size: 0.8rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
      }

      .severity-pill {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        color: white;
        margin-top: 0.25rem;
      }
      .severity-pill.critical { background: #f56565; }
      .severity-pill.high { background: #ed8936; }
      .severity-pill.medium { background: #ecc94b; }
      .severity-pill.low { background: #4299e1; }

      .issue-category {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #718096;
        font-weight: 600;
        margin-bottom: 0.25rem;
      }

      .issue-text {
        color: #2d3748;
        font-weight: 500;
        line-height: 1.5;
        font-size: 0.95rem;
      }

      .issue-element {
        margin-top: 0.5rem;
        font-size: 0.8rem;
        color: #4a5568;
      }

      .issue-element code {
        background: #edf2f7;
        padding: 0.1rem 0.3rem;
        border-radius: 4px;
        font-family: monospace;
      }

      .reproduce-text {
        font-size: 0.85rem;
        color: #4a5568;
        line-height: 1.5;
        background: #fff;
        padding: 0.75rem;
        border-radius: 6px;
        border: 1px solid #e2e8f0;
      }

      .screenshot-thumbnails {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .thumbnail-wrapper {
        border-radius: 6px;
        overflow: hidden;
        border: 1px solid #e2e8f0;
        background: white;
        transition: transform 0.2s, box-shadow 0.2s;
        width: 120px;
      }

      .thumbnail-wrapper:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        border-color: #cbd5e0;
      }

      .thumb-label {
        font-size: 0.65rem;
        background: #f7fafc;
        color: #4a5568;
        padding: 0.25rem;
        text-align: center;
        border-bottom: 1px solid #e2e8f0;
        font-weight: 600;
      }

      .screenshot-thumb {
        width: 100%;
        height: 80px;
        object-fit: contain; /* Show full image scaled down */
        display: block;
        background: #f8fafc;
        cursor: zoom-in;
      }

      /* Existing Screenshot Grid Styles (Kept for Summary Section) */
      .screenshot-comparison {
        margin-top: 3rem;
        padding-top: 2rem;
        border-top: 2px solid #e2e8f0;
      }

      .screenshot-comparison h4 {
        font-size: 1.25rem;
        margin-bottom: 1.5rem;
        color: #2d3748;
      }

      .screenshot-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 2rem;
        align-items: start;
      }

      .screenshot-item {
        background: white;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        border: 1px solid #e2e8f0;
      }

      .screenshot-label {
        padding: 1rem;
        background: #2d3748;
        color: white;
        font-weight: 600;
        text-align: center;
      }

      .screenshot-img {
        width: 100%;
        height: auto;
        max-height: 500px;
        object-fit: contain;
        display: block;
        cursor: zoom-in;
      }

      /* Interaction States Styles - Premium Refinement */
      .interaction-states-section {
        margin-top: 4rem;
        padding-top: 2rem;
        border-top: 2px solid #edf2f7;
      }

      .interaction-states-section h4 {
        font-size: 1.5rem;
        margin-bottom: 2rem;
        color: #1a202c;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .interaction-states-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 2rem;
      }

      .interaction-state-item {
        background: white;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        border: 1px solid #e2e8f0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
      }

      .interaction-state-item:hover {
        transform: translateY(-8px);
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        border-color: #cbd5e0;
      }

      .state-header {
        padding: 1.25rem;
        background: #f8fafc;
        border-bottom: 1px solid #edf2f7;
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .state-badge {
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 0.875rem;
        flex-shrink: 0;
        box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.3);
      }

      .state-title {
        font-weight: 600;
        color: #2d3748;
        font-size: 1rem;
        line-height: 1.4;
      }

      .state-image-container {
        position: relative;
        overflow: hidden;
        background: #f1f5f9;
        cursor: pointer;
      }

      .state-screenshot {
        width: 100%;
        height: 240px;
        object-fit: cover;
        object-position: top;
        transition: transform 0.5s ease;
      }

      .interaction-state-item:hover .state-screenshot {
        transform: scale(1.05);
      }

      .image-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .interaction-state-item:hover .image-overlay {
        opacity: 1;
      }

      .view-icon {
        color: white;
        font-weight: 600;
        font-size: 0.875rem;
        background: rgba(255, 255, 255, 0.2);
        padding: 0.5rem 1rem;
        border-radius: 9999px;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.3);
      }


      @media (max-width: 1024px) {
        .issues-table th:nth-child(4),
        .issues-table td:nth-child(4) {
          display: none; /* Hide thumbnails on smaller screens if needed */
        }
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
