import { expect, type Page } from "@playwright/test";

export async function waitForHydrated(page: Page) {
  await expect(page.locator(".comments-section")).toHaveAttribute("data-restored", "true");
}

export async function open(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 1024 });
  await page.goto("/");
  await waitForHydrated(page);
  await page.evaluate(() => document.fonts.ready);
}

export async function box(page: Page, selector: string) {
  const bounds = await page.locator(selector).first().boundingBox();
  if (!bounds) throw new Error(`Missing visible element: ${selector}`);
  return bounds;
}

export async function smallText(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || !node.textContent?.trim() || parent.closest("script,style,noscript,.sr-only")) continue;
      if (!parent.getClientRects().length || parent.closest("dialog:not([open])")) continue;
      if (parseFloat(getComputedStyle(parent).fontSize) < 16) out.push(node.textContent.trim());
    }
    return out;
  });
}

export async function textContrast(page: Page) {
  return page.evaluate(() => {
    const parse = (colour: string) => {
      const values = colour.match(/\d+(\.\d+)?/g);
      if (!values) throw new Error(`Unrecognised colour: ${colour}`);
      return values.slice(0, 3).map(Number);
    };
    const lum = (rgb: number[]) => {
      const [r, g, b] = rgb.map((value) => {
        const s = value / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const bg = (element: Element | null): string => {
      while (element) {
        const colour = getComputedStyle(element).backgroundColor;
        if (colour !== "rgba(0, 0, 0, 0)" && colour !== "transparent") return colour;
        element = element.parentElement;
      }
      return "rgb(255, 255, 255)";
    };
    const pairs: { text: string; ratio: number }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || !node.textContent?.trim() || parent.closest("script,style,noscript,.sr-only,dialog:not([open])") || !parent.getClientRects().length) continue;
      // Native modal backdrops cover the rest of the page, which is inert while open.
      if (document.querySelector("dialog[open]") && !parent.closest("dialog[open]")) continue;
      const [a, b] = [lum(parse(getComputedStyle(parent).color)), lum(parse(bg(parent)))].sort((x, y) => y - x);
      pairs.push({ text: node.textContent.trim(), ratio: (a + 0.05) / (b + 0.05) });
    }
    for (const textarea of document.querySelectorAll<HTMLTextAreaElement>("textarea")) {
      if (!textarea.getClientRects().length || document.querySelector("dialog[open]")) continue;
      const colour = textarea.value ? getComputedStyle(textarea).color : getComputedStyle(textarea, "::placeholder").color;
      const [a, b] = [lum(parse(colour)), lum(parse(bg(textarea)))].sort((x, y) => y - x);
      pairs.push({ text: textarea.value || textarea.placeholder, ratio: (a + 0.05) / (b + 0.05) });
    }
    return pairs;
  });
}

export async function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const visible = (element: Element) => !!element.getClientRects().length && !element.closest("dialog:not([open])");
    const wrapped: string[] = [];
    for (const element of document.querySelectorAll<HTMLButtonElement>("button")) {
      if (!visible(element)) continue;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent?.trim() || node.parentElement?.closest(".sr-only")) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        if (new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size > 1) wrapped.push(element.textContent ?? "");
      }
    }
    const overflow = [...document.querySelectorAll<HTMLElement>(".comment-card,.comment-form,.comment-header,.comment-actions,button,textarea,.delete-dialog[open]")]
      .filter((element) => visible(element) && element.scrollWidth > element.clientWidth + 1)
      .map((element) => element.className || element.tagName);
    return { scroll: document.documentElement.scrollWidth - innerWidth, wrapped, overflow };
  });
}
