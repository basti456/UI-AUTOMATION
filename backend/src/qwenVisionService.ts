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

// ─────────────────────────────────────────────────────────────────────────────
// BASE64 IMAGE CACHE
// Images (especially the Figma reference) are read & encoded once per path.
// Without this, a 9-device run with 5 interactions each would re-encode the
// same Figma file up to 54 times — wasting disk I/O and API token budget.
// Call clearImageCache() at the start of each new test run.
// ─────────────────────────────────────────────────────────────────────────────
const _imageBase64Cache = new Map<string, string>();

/** Returns the base64-encoded content of an image file, using cache if available. */
function readImageBase64(filePath: string): string {
  const cached = _imageBase64Cache.get(filePath);
  if (cached) {
    console.log(`📦 Cache hit for image: ${path.basename(filePath)} (saved re-encode)`);
    return cached;
  }
  const base64 = fs.readFileSync(filePath).toString('base64');
  _imageBase64Cache.set(filePath, base64);
  return base64;
}

/** Clear the image cache between test runs to avoid stale references. */
export function clearImageCache(): void {
  const count = _imageBase64Cache.size;
  _imageBase64Cache.clear();
  if (count > 0) console.log(`🗑️  Cleared base64 image cache (${count} entries)`);
}

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

    // Use cache: the Figma reference is the same file across many device calls.
    // The website screenshot is unique per device, but caching it still avoids
    // a re-encode if the same screenshot is used in interactive-state analysis.
    const websiteBase64 = readImageBase64(websiteImagePath);
    const figmaBase64   = readImageBase64(figmaImagePath);

    // Prepare the prompt with device context
    let promptPrefix = VISUAL_CHECK_PROMPT;

    if (isStyleReferenceOnly) {
      // Shorter prompt for style-only comparisons saves ~40% tokens vs full VISUAL_CHECK_PROMPT.
      promptPrefix = `You are comparing a MOBILE website screenshot against a DESKTOP design reference.
IGNORE all layout/sizing differences — focus ONLY on brand consistency:
1. Colors — buttons, backgrounds, text
2. Typography — font family, weight
3. Borders/Shadows — border-radius, shadow style
Report ONLY style mismatches. Return ONLY valid JSON:
{"issues":[{"category":"Visual Style Mismatch","severity":"high|medium|low","description":"...","location":"...","boundingBox":{"x":0,"y":0,"width":0,"height":0},"howToReproduce":"...","figmaExpected":"...","websiteActual":"..."}],"summary":"...","figmaMatchScore":0}`;
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

// ─────────────────────────────────────────────────────────────────────────────
// NO-FIGMA MODE: Analyze against universal web / mobile design guidelines
// ─────────────────────────────────────────────────────────────────────────────

const NO_FIGMA_PROMPT = `You are a senior UX/UI auditor. Analyze this website screenshot against universal web and mobile design best practices.

## DESIGN STANDARDS TO EVALUATE

### 1) WCAG 2.1 ACCESSIBILITY
- Color contrast ratio: text must meet 4.5:1 (normal) or 3:1 (large text) minimum
- Focus indicators visible for interactive elements
- Text resizable without loss of content
- Touch targets >= 44x44 CSS pixels (for mobile)
- Font size not below 16px for body text on mobile

### 2) RESPONSIVE DESIGN
- No horizontal scrollbar on the visible viewport
- Content not cut off or overflowing
- Flexible images / videos (not fixed pixel widths)
- Readable line lengths (45–85 characters per line)
- Appropriate use of whitespace

### 3) TYPOGRAPHY BEST PRACTICES
- Font size hierarchy clear (headings > subheadings > body)
- Line height 1.4–1.7 for body text
- No more than 2–3 typefaces
- Sufficient contrast between text and background
- No orphans/widows or awkward text wrapping

### 4) LAYOUT & VISUAL HIERARCHY
- Clear focal point / CTA above the fold
- Consistent spacing rhythm
- Grid alignment maintained
- cards/components properly aligned
- Logical reading order (F-pattern or Z-pattern)

### 5) INTERACTION & UX PATTERNS (Nielsen's Heuristics)
- Navigation is visible and intuitive
- Primary actions are prominent (not hidden)
- Error states / empty states handled
- Loading indicators where needed
- No clutter — cognitive load minimized

### 6) VISUAL DESIGN QUALITY
- Consistent color palette
- Shadow and elevation hierarchy consistent
- Border radius pattern consistent
- Image quality and aspect ratios correct
- Professional look and feel

## OUTPUT FORMAT
For each issue found, return:
{
  "category": "Accessibility | Responsive Design | Typography | Layout | UX Pattern | Visual Design",
  "severity": "critical" | "high" | "medium" | "low",
  "description": "Specific issue description",
  "location": "Where in the UI",
  "boundingBox": { "x": number, "y": number, "width": number, "height": number },
  "howToReproduce": "How to spot this issue",
  "figmaExpected": "What best practice recommends",
  "websiteActual": "What is observed"
}

Return ONLY valid JSON:
{ "issues": [...], "summary": "Overall UX quality assessment", "figmaMatchScore": 0 }

If NO issues: { "issues": [], "summary": "Excellent design quality", "figmaMatchScore": 0 }

IMPORTANT: Be thorough but practical. Focus on real, noticeable issues that affect user experience.
Return ONLY valid JSON, no markdown, no extra text.`;

/**
 * Analyze a screenshot against universal design guidelines (no Figma required).
 */
export async function analyzeWithoutFigma(
  websiteImagePath: string,
  deviceName: string
): Promise<AIResponse> {
  try {
    console.log(`🌐 Analyzing ${deviceName} against universal design guidelines…`);

    // Use cache — in no-Figma mode the website screenshot is unique per device
    // but caching avoids a re-encode if the same path appears in interactive passes.
    const websiteBase64 = readImageBase64(websiteImagePath);

    const prompt = `${NO_FIGMA_PROMPT}\n\nDevice: ${deviceName}\nAnalyze this screenshot for design issues:`;

    const response = await ollamaClient.chat({
      model: MODEL,
      messages: [{ role: 'user', content: prompt, images: [websiteBase64] }],
      options: { temperature: 0.1 },
    });

    console.log(`✅ Universal analysis complete for ${deviceName}`);
    const aiContent = response.message.content;
    let parsedResponse: AIResponse;

    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      parsedResponse = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(aiContent);
    } catch {
      parsedResponse = {
        issues: [{
          category: 'AI Analysis Error',
          severity: 'medium',
          description: `Response format unexpected: ${aiContent.substring(0, 200)}`,
          howToReproduce: `Review ${deviceName} manually`,
          deviceName,
        }],
        summary: 'AI response parsing error',
      };
    }

    parsedResponse.issues = parsedResponse.issues.map((issue: any): VisualIssue => ({
      category: issue.category || 'Design Issue',
      severity: issue.severity || 'medium',
      description: issue.description || 'No description',
      deviceName,
      howToReproduce: issue.howToReproduce || issue.location ? `Check ${issue.location}` : `Review ${deviceName} screenshot`,
      element: issue.location || undefined,
      boundingBox: issue.boundingBox || undefined,
    }));

    console.log(`📊 Found ${parsedResponse.issues.length} design issues on ${deviceName} (no-Figma mode)`);
    return parsedResponse;
  } catch (error: any) {
    console.error(`❌ Error in no-Figma analysis for ${deviceName}:`, error.message);
    return {
      issues: [{
        category: 'AI Service Error',
        severity: 'medium',
        description: `Failed to analyze: ${error.message}`,
        howToReproduce: 'Check Ollama API configuration',
        deviceName,
      }],
      summary: `Error during analysis: ${error.message}`,
    };
  }
}

export async function detectInteractiveElements(imagePath: string, domContext: string): Promise<any[]> {
  // Cache the screenshot — detectInteractiveElements may be called multiple
  // times on the same initial screenshot if interactive testing iterates.
  const base64Image = readImageBase64(imagePath);

  const prompt = `
    Analyze this UI screenshot and the simplified DOM list below.
    Identify the top 5-8 most important interactive elements that should be tested to explore different states.
    
    **PRIORITY ORDER:**
    1. **INPUT FIELDS** (email, password, text, search, etc.) - These should have action:"type"
    2. **BUTTONS** (submit, login, CTA, etc.) - These should have action:"click"
    3. **NAVIGATION** (links, menu items)
    
    Simplified DOM Context:
    ${domContext}

    Return a JSON array of actions in this strict format:
    {
      "actions": [
        {
          "name": "Fill email field",
          "selector": "input[type='email']", 
          "action": "type", 
          "description": "Enter email address" 
        },
        {
          "name": "Fill password field",
          "selector": "input[type='password']", 
          "action": "type", 
          "description": "Enter password" 
        },
        {
          "name": "Click login button",
          "selector": "button[type='submit']", 
          "action": "click", 
          "description": "Submit login form" 
        }
      ]
    }
    
    **CRITICAL RULES:**
    1. For ALL input fields (email, password, text, search, etc.), use action: "type"
    2. For buttons, use action: "click"
    3. Prioritize form inputs FIRST, then buttons
    4. Use specific CSS selectors from the DOM list (prefer IDs, then type attributes, then classes)
    5. Name format: "Fill [field type] field" for inputs, "Click [button name]" for buttons
    6. Return ONLY valid JSON, no markdown, no explanations
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
