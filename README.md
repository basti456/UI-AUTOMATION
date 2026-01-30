# UI Automation Testing Tool

AI-powered visual testing automation tool that compares website implementations with Figma designs across multiple device sizes using the Qwen3 VL vision model.

## Features

- 🎯 **Multi-Device Testing**: Tests across 9 different screen sizes (320px to 1920px)
- 🤖 **AI-Powered Analysis**: Uses Qwen3 VL model via Ollama API for intelligent visual comparison
- 📊 **Comprehensive Reports**: Generates detailed HTML reports with annotated screenshots
- 🎨 **Screenshot Annotation**: Automatically marks issues on screenshots with color-coded bounding boxes
- ⚡ **Real-Time Progress**: Live updates during test execution
- 🔍 **Extensive Visual Checks**: Detects layout issues, typography problems, responsive design failures, and style mismatches

## Visual Checks

The AI model checks for:

1. **Visual Bugs & Layout Issues**: Element overlap, content overflow, alignment issues, broken layouts
2. **Responsive Design**: Horizontal scroll, readable text, touch targets, proper scaling
3. **Typography**: Text truncation, line-height, button text wrapping
4. **Image Quality**: Blurry images, distorted aspect ratios, pixelation
5. **Style Matching**: Colors, fonts, borders, button styles (compared with Figma designs)

## Installation

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Add your Ollama API key (get one at https://ollama.com/settings/keys)

```bash
OLLAMA_API_KEY=your_api_key_here
PORT=3000
```

3. Add Figma design screenshots to the `FigmaScreens/` folder:
   - **Option A (Exact Match):** Name files to match device names (e.g., `iPhone_SE_320px.png`)
   - **Option B (Smart Match):** Use generic names for broader matching:
     - `mobile.png` (will be used for all phones < 600px)
     - `tablet.png` (will be used for tablets < 1024px)
     - `desktop.png` (will be used for all desktop sizes)

   The system smartly prioritizes exact matches first, then looks for these generic files based on screen width.

## Usage

### Start the Server

```bash
npm start
```

The server will start at `http://localhost:3000`

### Run a Test

1. Open your browser and navigate to `http://localhost:3000`
2. Enter the website URL you want to test
3. Click "Start Testing"
4. Watch real-time progress as the tool:
   - Captures screenshots for each device
   - Performs AI-powered visual analysis
   - Generates annotated screenshots
   - Creates comprehensive HTML report
5. View the report with all detected issues

### API Endpoints

- `POST /api/start-test` - Start a new test

  ```json
  {
    "url": "https://example.com"
  }
  ```

- `GET /api/test-status/:testId` - Get real-time test progress

- `GET /api/report/:testId` - View HTML report

- `GET /api/report/:testId/json` - Get report metadata as JSON

## Project Structure

```
UI-AUTOMATION/
├── src/
│   ├── types.ts                 # TypeScript type definitions
│   ├── qwenVisionService.ts     # AI vision analysis service
│   ├── imageAnnotator.ts        # Screenshot annotation service
│   ├── testOrchestrator.ts      # Test workflow orchestrator
│   └── reportGenerator.ts       # HTML report generator
├── public/
│   ├── index.html               # Web UI
│   ├── styles.css               # Premium styling
│   └── app.js                   # Client-side functionality
├── tests/
│   ├── devices.ts               # Device configurations
│   └── visualCompare.ts         # Visual comparison utilities
├── screenshots/                 # Captured website screenshots
├── FigmaScreens/               # Figma design screenshots
├── reports/                    # Generated reports
├── server.ts                   # Express server
├── .env                        # Environment variables
└── package.json

```

## How It Works

1. **Screenshot Capture**: Playwright captures full-page screenshots across all configured devices
2. **AI Analysis**: Each screenshot is sent to Qwen3 VL model along with the corresponding Figma design
3. **Issue Detection**: The AI analyzes differences and returns structured issue data with:
   - Category (layout, typography, responsive, etc.)
   - Severity (critical, high, medium, low)
   - Description and how to reproduce
   - Bounding box coordinates
4. **Annotation**: Issues are visually marked on screenshots with color-coded boxes
5. **Report Generation**: Comprehensive HTML report is created with:
   - Executive summary with statistics
   - Device-specific sections
   - Annotated screenshots
   - Side-by-side comparisons
   - Issue categorization

## Report Features

- 📊 Executive summary with issue counts
- 🎨 Color-coded severity levels
- 📱 Device-specific sections
- 🔍 Annotated screenshots with issue markers
- 📸 Side-by-side comparison (actual vs Figma)
- 🎯 Expandable/collapsible device sections
- 🖼️ Full-screen image modal viewer
- 💅 Premium design with animations

## Requirements

- Node.js 16+
- Ollama API key
- Figma design screenshots

## Troubleshooting

### No Figma screenshots found

Make sure to add your Figma design screenshots to the `FigmaScreens/` folder with correct filenames matching device names.

### AI analysis errors

- Verify your `OLLAMA_API_KEY` is set correctly in `.env`
- Check your internet connection
- Ensure you have sufficient API credits

### Screenshots not capturing

- Check if the website URL is accessible
- Some websites may block automated browsers - try with different URLs

## Technologies Used

- **Playwright**: Browser automation and screenshot capture
- **Qwen3 VL**: AI vision model for visual analysis
- **Ollama API**: Cloud-hosted AI model access
- **Sharp**: Image processing and annotation
- **Express**: Web server
- **TypeScript**: Type-safe development

## License

ISC

## Author

UI Automation Testing Tool - Visual Comparison with AI
