import { Page } from 'playwright';
import { detectInteractiveElements } from './qwenVisionService';

export interface InteractionPlan {
  name: string;
  selector: string;
  action: 'click' | 'hover' | 'type';
  description: string;
}

export async function generateInteractionPlan(page: Page, screenshotPath: string): Promise<InteractionPlan[]> {
  console.log('🤖 Analyzing page for interactive elements...');

  // 1. Get simplified DOM snapshot (helps AI understand structure)
  const simpleDOM = await page.evaluate(() => {
    const getImportantAttributes = (el: Element) => {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const cls = Array.from(el.classList).map(c => `.${c}`).join('');
      const text = (el.textContent || '').slice(0, 50).trim();
      return `${tag}${id}${cls} [text="${text}"]`;
    };

    const interactables = Array.from(document.querySelectorAll('button, a, input, [role="button"]'));
    return interactables.map(el => getImportantAttributes(el)).join('\n');
  });

  // 2. Ask AI to identify key interactions
  const interactions = await detectInteractiveElements(screenshotPath, simpleDOM);

  console.log(`📋 Generated ${interactions.length} interaction scenarios`);
  return interactions;
}

export async function executeInteraction(page: Page, plan: InteractionPlan) {
  console.log(`▶️ Executing: ${plan.description} (${plan.action} on ${plan.selector})`);

  try {
    const element = page.locator(plan.selector).first();
    await element.waitFor({ state: 'visible', timeout: 5000 });

    if (plan.action === 'click') {
      await element.click();
    } else if (plan.action === 'hover') {
      await element.hover();
    } else if (plan.action === 'type') {
      // Smart Input Filling Logic
      const inputValue = await element.evaluate((el: Element) => {
        const input = el as HTMLInputElement;
        const type = (input.type || '').toLowerCase();
        const name = (input.name || '').toLowerCase();
        const placeholder = (input.placeholder || '').toLowerCase();
        const id = (input.id || '').toLowerCase();

        // Helper to check if any attribute contains a keyword
        const matches = (keywords: string[]) => {
          return keywords.some(k => name.includes(k) || placeholder.includes(k) || id.includes(k));
        };

        if (type === 'email' || matches(['email', 'mail'])) return 'test@example.com';
        if (type === 'password' || matches(['password', 'pass'])) return 'TestPass123!';
        if (type === 'tel' || type === 'number' || matches(['phone', 'mobile', 'cell', 'zip', 'postal'])) return '1234567890';
        if (type === 'date' || matches(['date', 'dob', 'birth'])) return '2024-01-01';
        if (type === 'url' || matches(['url', 'website', 'link'])) return 'https://example.com';
        if (matches(['search', 'query'])) return 'test search';
        if (matches(['name', 'first', 'last', 'user'])) return 'John Doe';
        if (matches(['address', 'location', 'city'])) return '123 Test St';

        return 'Test Input';
      });

      // Handle Checkboxes/Radios if 'type' action was wrongly assigned
      const isCheckable = await element.evaluate((el: Element) => {
        const input = el as HTMLInputElement;
        return input.type === 'checkbox' || input.type === 'radio';
      });

      if (isCheckable) {
        console.log(`  ↳ Clicking checkbox/radio`);
        await element.click(); // Just click it to toggle/select
      } else {
        console.log(`  ↳ Filling input with: "${inputValue}"`);
        await element.fill(inputValue);
      }
    }

    // Wait for any animations/transitions
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

  } catch (error: any) {
    console.warn(`⚠️ Failed to execute ${plan.name}: ${error.message}`);
    throw error;
  }
}
