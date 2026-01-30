// API Base URL
const API_BASE = window.location.origin;

// DOM Elements
const testForm = document.getElementById('testForm');
const websiteUrlInput = document.getElementById('websiteUrl');
const startButton = document.getElementById('startButton');

const testSection = document.getElementById('testSection');
const progressSection = document.getElementById('progressSection');
const resultsSection = document.getElementById('resultsSection');
const errorSection = document.getElementById('errorSection');

const progressStatus = document.getElementById('progressStatus');
const progressDevice = document.getElementById('progressDevice');
const progressFill = document.getElementById('progressFill');
const progressPercentage = document.getElementById('progressPercentage');
const completedDevices = document.getElementById('completedDevices');
const totalDevices = document.getElementById('totalDevices');
const progressLog = document.getElementById('progressLog');

const reportPreview = document.getElementById('reportPreview');
const viewReportButton = document.getElementById('viewReportButton');
const newTestButton = document.getElementById('newTestButton');
const retryButton = document.getElementById('retryButton');
const errorMessage = document.getElementById('errorMessage');

// State
let currentTestId = null;
let pollInterval = null;

// Event Listeners
testForm.addEventListener('submit', handleTestSubmit);
viewReportButton.addEventListener('click', handleViewReport);
newTestButton.addEventListener('click', handleNewTest);
retryButton.addEventListener('click', handleRetry);

// Handle test form submission
async function handleTestSubmit(e) {
    e.preventDefault();
    
    const url = websiteUrlInput.value.trim();
    
    if (!url) {
        showError('Please enter a valid URL');
        return;
    }

    // Validate URL format
    try {
        new URL(url);
    } catch (error) {
        showError('Please enter a valid URL (e.g., https://example.com)');
        return;
    }

    startButton.disabled = true;
    startButton.innerHTML = '<div class="spinner"></div>';

    try {
        const enableInteractive = document.getElementById('enableInteractive').checked;
        
        const response = await fetch(`${API_BASE}/api/start-test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                url,
                enableInteractive 
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to start test');
        }

        const data = await response.json();
        currentTestId = data.testId;

        // Show progress section
        showSection('progress');
        
        // Start polling for progress
        startProgressPolling();

    } catch (error) {
        console.error('Error starting test:', error);
        showError(error.message || 'Failed to start test. Please try again.');
        startButton.disabled = false;
        startButton.innerHTML = '<span class="btn-text">Start Testing</span><span class="btn-icon">→</span>';
    }
}

// Start polling for test progress
function startProgressPolling() {
    // Clear any existing interval
    if (pollInterval) {
        clearInterval(pollInterval);
    }

    // Poll every 2 seconds
    pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/test-status/${currentTestId}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch test status');
            }

            const progress = await response.json();
            updateProgress(progress);

            // Stop polling if test is completed or failed
            if (progress.status === 'completed') {
                clearInterval(pollInterval);
                setTimeout(() => showResults(), 1000);
            } else if (progress.status === 'failed') {
                clearInterval(pollInterval);
                showError(progress.message || 'Test failed');
            }

        } catch (error) {
            console.error('Error polling progress:', error);
        }
    }, 2000);
}

// Update progress UI
function updateProgress(progress) {
    progressStatus.textContent = progress.message || 'Processing...';
    
    if (progress.currentDevice) {
        progressDevice.textContent = `Current: ${progress.currentDevice.replace(/_/g, ' ')}`;
    }

    progressFill.style.width = `${progress.progress}%`;
    progressPercentage.textContent = `${Math.round(progress.progress)}%`;

    completedDevices.textContent = progress.completedDevices;
    totalDevices.textContent = progress.totalDevices;

    // Add log entry
    if (progress.message) {
        addLogEntry(progress.message);
    }
}

// Add entry to progress log
function addLogEntry(message) {
    const entry = document.createElement('div');
    entry.className = 'progress-log-entry';
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    progressLog.appendChild(entry);
    progressLog.scrollTop = progressLog.scrollHeight;
}

// Show test results
async function showResults() {
    try {
        const response = await fetch(`${API_BASE}/api/report/${currentTestId}/json`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch report');
        }

        const data = await response.json();
        
        // Show results section
        showSection('results');
        
        // Update report preview
        reportPreview.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <h3 style="margin-bottom: 1rem; color: var(--text-primary);">Report Generated Successfully!</h3>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                    Test ID: <code style="background: var(--bg-light); padding: 0.25rem 0.5rem; border-radius: 4px;">${data.testId}</code>
                </p>
                <p style="color: var(--text-secondary);">
                    Click "View Full Report" to see detailed analysis with annotated screenshots.
                </p>
            </div>
        `;

        // Store report URL for view button
        viewReportButton.dataset.reportUrl = data.reportUrl;

    } catch (error) {
        console.error('Error showing results:', error);
        showError('Test completed but failed to load report');
    }
}

// Handle view report button
function handleViewReport() {
    const reportUrl = viewReportButton.dataset.reportUrl;
    if (reportUrl) {
        window.open(`${API_BASE}${reportUrl}`, '_blank');
    }
}

// Handle new test button
function handleNewTest() {
    // Reset form
    testForm.reset();
    startButton.disabled = false;
    startButton.innerHTML = '<span class="btn-text">Start Testing</span><span class="btn-icon">→</span>';
    
    // Clear progress
    progressFill.style.width = '0%';
    progressPercentage.textContent = '0%';
    progressLog.innerHTML = '';
    reportPreview.innerHTML = '';
    
    // Reset state
    currentTestId = null;
    if (pollInterval) {
        clearInterval(pollInterval);
    }
    
    // Show test section
    showSection('test');
}

// Handle retry button
function handleRetry() {
    handleNewTest();
}

// Show specific section
function showSection(section) {
    testSection.classList.add('hidden');
    progressSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    errorSection.classList.add('hidden');

    switch (section) {
        case 'test':
            testSection.classList.remove('hidden');
            break;
        case 'progress':
            progressSection.classList.remove('hidden');
            break;
        case 'results':
            resultsSection.classList.remove('hidden');
            break;
        case 'error':
            errorSection.classList.remove('hidden');
            break;
    }
}

// Show error
function showError(message) {
    errorMessage.textContent = message;
    showSection('error');
    
    // Reset button
    startButton.disabled = false;
    startButton.innerHTML = '<span class="btn-text">Start Testing</span><span class="btn-icon">→</span>';
}

// Health check on load
window.addEventListener('load', async () => {
    try {
        const response = await fetch(`${API_BASE}/api/health`);
        if (!response.ok) {
            throw new Error('Server not responding');
        }
        console.log('✅ Server is healthy');
    } catch (error) {
        console.error('⚠️ Server health check failed:', error);
        showError('Unable to connect to server. Please ensure the server is running.');
    }
});
