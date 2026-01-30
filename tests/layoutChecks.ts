import { Page } from "playwright";

export async function detectLayoutIssues(page: Page) {
  return await page.evaluate(() => {
    const issues: string[] = [];

    // 🎯 Only important interactive / visual elements
    const selector = `
      button, a, input, textarea, select,
      img, h1, h2, h3, h4, h5, h6, p, span, label
    `;

    const elements = Array.from(document.querySelectorAll(selector));

    function isVisible(el: Element) {
      const style = window.getComputedStyle(el);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        (el as HTMLElement).offsetParent !== null &&
        el.getBoundingClientRect().width > 0 &&
        el.getBoundingClientRect().height > 0
      );
    }

    const rects: { name: string; rect: DOMRect }[] = [];

    elements.forEach(el => {
      if (!isVisible(el)) return;

      const rect = el.getBoundingClientRect();
      const name = `${el.tagName}.${(el as HTMLElement).className}`;

      // ❌ Cut off screen
      if (
        rect.right > window.innerWidth ||
        rect.bottom > window.innerHeight ||
        rect.left < 0 ||
        rect.top < 0
      ) {
        issues.push(`Cut off: ${name}`);
      }

      // ❌ Text overflow
      if ((el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth) {
        issues.push(`Text overflow: ${name}`);
      }

      rects.push({ name, rect });
    });

    // ❌ Overlap detection (LIMITED)
    const MAX_CHECKS = 300; // safety limit

    for (let i = 0; i < rects.length && i < MAX_CHECKS; i++) {
      for (let j = i + 1; j < rects.length && j < MAX_CHECKS; j++) {
        const r1 = rects[i].rect;
        const r2 = rects[j].rect;

        const overlap = !(
          r1.right < r2.left ||
          r1.left > r2.right ||
          r1.bottom < r2.top ||
          r1.top > r2.bottom
        );

        if (overlap) {
          issues.push(`Overlap: ${rects[i].name} with ${rects[j].name}`);
        }
      }
    }

    return [...new Set(issues)].slice(0, 20); // limit output
  });
}
