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
      await element.fill('test input');
    }

    // Wait for any animations/transitions
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

  } catch (error: any) {
    console.warn(`⚠️ Failed to execute ${plan.name}: ${error.message}`);
    throw error;
  }
}
