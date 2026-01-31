import ollama from 'ollama';
import { Ollama } from 'ollama';
import fs from 'fs';
import path from 'path';
import { VisualIssue, AIResponse } from './types';
import dotenv from 'dotenv';

dotenv.config();

const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const MODEL = 'qwen3-vl:235b-cloud';

// Initialize Ollama client for cloud usage
const ollamaClient = new Ollama({
  host: 'https://ollama.com',
  headers: {
    'Authorization': `Bearer ${OLLAMA_API_KEY}`
  }
});

// Comprehensive visual check prompt based on requirements
const VISUAL_CHECK_PROMPT = `You are analyzing TWO screenshots:
1. **Website Screenshot** - The actual implementation
2. **Figma Design Screenshot** - The intended design

**YOUR TASK:** Compare these screenshots and find ALL differences and issues.

---

## COMPARISON CATEGORIES

### 1) LAYOUT & POSITIONING COMPARISON
Compare Figma vs Website for:
- **Element Overlap**
  - Text overlapping other text
  - Images covering text
  - Buttons overlapping content
  - Modal or popup positioning issues
  - Sticky headers/footers covering content
  - Modals/dropdowns hidden behind overlays (z-index issues)
  - Fixed/sticky elements covering clickable content

- **Content Overflow**
  - Text extending beyond containers
  - Horizontal scrollbar appearing
  - Images breaking out of bounds
  - Content cut off at viewport edges
  - Dropdowns/tooltips clipped by parent containers

- **Alignment Issues**
  - Elements not aligned to grid (compared to Figma)
  - Inconsistent margins or padding (vs Figma spacing)
  - Text baseline misalignment
  - Icons overlapping text or overflowing buttons
  - Form fields not aligned
  - Labels not aligned with inputs

- **Broken Layouts**
  - Elements stacking incorrectly (vs Figma structure)
  - Uneven whitespace distribution (vs Figma)
  - Grid or flexbox failures
  - Float clearing issues
  - Cards/components breaking when content changes

---

### 2) RESPONSIVE DESIGN ISSUES
Check the website screenshot for:

**Mobile Issues (if screenshot shows mobile view):**
- Horizontal scroll present
- Content not readable without zooming
- Touch targets smaller than 44x44 pixels
- Body font size below 16px
- Line-height cramped/unreadable
- Navigation not accessible (hamburger menu broken)
- Forms unusable on small screens
- Buttons wrapping text awkwardly
- Images stretched or not scaling properly

**Tablet Issues (if screenshot shows tablet view):**
- Poor use of screen space
- Layout not adapting smoothly from mobile
- Content stretched unnecessarily
- Navigation not transitioning correctly

---

### 3) TYPOGRAPHY COMPARISON (Figma vs Website)
Compare and report differences in:
- Text unexpectedly truncated with "..."
- Line-height too tight (especially on mobile)
- Button text wrapping into multiple lines
- Labels overlapping inputs
- Headings too close to content
- **Font family mismatch** (Figma shows one font, website shows another)
- **Font size differences** (bigger/smaller than Figma)
- **Font weight differences** (Figma shows bold, website shows regular, etc.)
- **Text color mismatch** (different from Figma)
- **Text casing differences** (Figma shows uppercase, website shows lowercase, etc.)

---

### 4) VISUAL STYLE COMPARISON (Figma vs Website)
Compare these exact styling elements:
- **Background colors** - Does website match Figma background colors?
- **Text colors** - Are text colors identical to Figma?
- **Icon colors** - Do icons match Figma icon colors?
- **Border radius** - Are rounded corners the same as Figma?
- **Border style and color** - Do borders match Figma (thickness, color, style)?
- **Button styles** - Are buttons filled/outlined/text style matching Figma?
- **Disabled state opacity** - Do disabled elements match Figma opacity?
- **Spacing differences** - Are margins/padding different from Figma?
- **Shadow differences** - Are drop shadows matching Figma?

---

### 5) IMAGE & MEDIA QUALITY
Check website screenshot for:
- Blurry images due to low resolution scaling
- Stretched or distorted image aspect ratios
- Pixelated icons
- Images not centered inside containers
- **Different images than Figma** (wrong image used)
- **Missing images** (present in Figma, absent in website)

---

## OUTPUT FORMAT

For each issue found, provide:
{
  "category": "One of: Layout Issues, Responsive Design, Typography, Visual Style Mismatch, Image Quality",
  "severity": "critical" | "high" | "medium" | "low",
  "description": "Clear description of the difference or issue. Be specific.",
  "location": "Where in the UI (e.g., 'Header navigation Start Now button')",
  "boundingBox": { "x": number, "y": number, "width": number, "height": number } // Approximate coordinates on the website screenshot
  "howToReproduce": "Step-by-step instructions to spot this issue (e.g. 'Observe the blue button alignment relative to the text')",
  "figmaExpected": "What Figma shows",
  "websiteActual": "What website screenshot shows"
}

Return ONLY valid JSON:
{
  "issues": [...],
  "summary": "Overall assessment",
  "figmaMatchScore": 85
}

If NO issues: {"issues": [], "summary": "Perfect match", "figmaMatchScore": 100}

**IMPORTANT:**
- Compare BOTH screenshots systematically
- Report ALL visual differences between Figma and Website
- Be thorough but practical - focus on noticeable differences
- Return ONLY valid JSON, no markdown, no code blocks, no extra text`;

interface VisionAnalysisOptions {
  websiteImagePath: string;
  figmaImagePath: string;
  deviceName: string;
  isStyleReferenceOnly?: boolean;
}

export async function analyzeVisualDifferences(
  options: VisionAnalysisOptions
): Promise<AIResponse> {
  const { websiteImagePath, figmaImagePath, deviceName, isStyleReferenceOnly } = options;

  try {
    console.log(`🤖 Analyzing ${deviceName} with Qwen3 VL...`);

    // Read and encode images
    const websiteImage = fs.readFileSync(websiteImagePath);
    const figmaImage = fs.readFileSync(figmaImagePath);

    const websiteBase64 = websiteImage.toString('base64');
    const figmaBase64 = figmaImage.toString('base64');

    // Prepare the prompt with device context
    let promptPrefix = VISUAL_CHECK_PROMPT;
    
    if (isStyleReferenceOnly) {
       promptPrefix = `
       IMPORTANT: You are comparing a **MOBILE WEBSITE** against a **DESKTOP DESIGN REFERENCE**.
       
       IGNORE ALL LAYOUT DIFFERENCES. The layout is expected to be different.
       
       FOCUS ONLY ON VISUAL STYLE CONSISTENCY:
       1. **Colors**: Do button colors, background colors, and text colors match the desktop branding?
       2. **Typography**: Are the font families and font weights consistent with the desktop design?
       3. **Border/Shadows**: Do UI elements share the same border radius and shadow styles?
       
       Report ONLY style mismatches (e.g. "Mobile button is blue but Desktop design uses red").
       IGNORE alignment, size, wrapping, and positioning.
       `;
    }

    const deviceSpecificPrompt = `${promptPrefix}\n\nDevice: ${deviceName}\nActual Website Screenshot: First image\nFigma Design Reference: Second image\n\nAnalyze the differences:`;

    // Call Ollama Cloud API with images
    const response = await ollamaClient.chat({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: deviceSpecificPrompt,
          images: [websiteBase64, figmaBase64],
        },
      ],
      options: {
        temperature: 0.1, // Low temperature for consistent analysis
      },
    });

    console.log(`✅ AI analysis complete for ${deviceName}`);

    // Parse the AI response
    const aiContent = response.message.content;
    let parsedResponse: AIResponse;

    try {
      // Try to extract JSON from response (handles cases where AI adds extra text)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        parsedResponse = JSON.parse(aiContent);
      }
    } catch (parseError) {
      console.warn(`⚠️ Failed to parse AI response for ${deviceName}, creating manual structure`);
      console.log('AI Response:', aiContent);
      
      // Fallback: create a manual issue if parsing fails
      parsedResponse = {
        issues: [
          {
            category: 'AI Analysis Error',
            severity: 'medium',
            description: `AI analysis completed but response format was unexpected: ${aiContent.substring(0, 200)}`,
            howToReproduce: `Review ${deviceName} manually`,
            deviceName: deviceName,
          },
        ],
        summary: 'AI response parsing error - manual review recommended',
      };
    }

    // Add device name and map fields to VisualIssue format
    parsedResponse.issues = parsedResponse.issues.map((issue: any) => {
      // Map AI response fields to our VisualIssue type
      const mappedIssue: VisualIssue = {
        category: issue.category || 'Unknown',
        severity: issue.severity || 'medium',
        description: issue.description || issue.websiteActual || 'No description',
        deviceName: deviceName,
        // Create howToReproduce from available AI fields
        // Create howToReproduce from available AI fields with strict fallback
        howToReproduce: (issue.howToReproduce && issue.howToReproduce !== 'undefined') 
          ? issue.howToReproduce 
          : (issue.howToSpot || 
             (issue.location ? `Check ${issue.location}` : 
             `Compare ${deviceName} screenshot with Figma manually`)),
        element: issue.location || issue.element || undefined,
        boundingBox: issue.boundingBox || undefined,
      };
      return mappedIssue;
    });

    console.log(`📊 Found ${parsedResponse.issues.length} issues on ${deviceName}`);

    return parsedResponse;
  } catch (error: any) {
    console.error(`❌ Error analyzing ${deviceName}:`, error.message);

    // Return error as an issue
    return {
      issues: [
        {
          category: 'AI Service Error',
          severity: 'high',
          description: `Failed to analyze images: ${error.message}`,
          howToReproduce: `Check Ollama API configuration and retry`,
          deviceName: deviceName,
        },
      ],
      summary: `Error during AI analysis: ${error.message}`,
    };
  }
}

// Helper function to validate image paths exist
export function validateImagePaths(websitePath: string, figmaPath: string): boolean {
  if (!fs.existsSync(websitePath)) {
    console.error(`❌ Website screenshot not found: ${websitePath}`);
    return false;
  }
  if (!fs.existsSync(figmaPath)) {
    console.error(`❌ Figma screenshot not found: ${figmaPath}`);
    return false;
  }
  return true;
}

export async function detectInteractiveElements(imagePath: string, domContext: string): Promise<any[]> {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const prompt = `
    Analyze this UI screenshot and the simplified DOM list below.
    Identify the top 3-5 most important interactive elements (buttons, menus, inputs) that should be tested to explore different states.
    
    Simplified DOM Context:
    ${domContext}

    Return a JSON array of actions in this strict format:
    {
      "actions": [
        {
          "name": "Click [Element Name]",
          "selector": "CSS selector", 
          "action": "click" | "type", 
          "description": "Brief description of what this does" 
        }
      ]
    }
    
    Rules:
    1. Prefer ID selectors or specific classes found in the DOM list.
    2. Focus on navigation, primary CTAs, and inputs.
    3. Return ONLY valid JSON.
  `;

  try {
    const response = await ollamaClient.chat({
      model: MODEL,
      messages: [{
        role: 'user',
        content: prompt,
        images: [base64Image]
      }],
      format: 'json', 
      options: { temperature: 0.1 } 
    });

    const result = JSON.parse(response.message.content);
    return Array.isArray(result) ? result : (result.actions || []);

  } catch (error) {
    console.error('Error identifying interactions:', error);
    return [];
  }
}
