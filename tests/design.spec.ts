import { expect, test, type Page } from "@playwright/test";
import { box, layoutProblems, open, smallText, textContrast } from "./helpers";

const siteName = "Interactive Comments Section";
const siteUrl = "https://interactive-comments-section-fm.royeradames.com/";

// Next may drop the trailing slash of metadataBase in og:url and canonical; both forms name the same page.
const siteUrlPattern = /^https:\/\/interactive-comments-section-fm\.royeradames\.com\/?$/;

test("declares matching identity, canonical, sharing image, icons and the two-line attribution", async ({ page }) => {
  await open(page);
  await expect(page).toHaveTitle("Interactive comments | Interactive Comments Section");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Frontend Mentor.*fictional comments/);
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", siteName);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", siteUrlPattern);
  const jsonLd: unknown = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
  expect(jsonLd).toEqual({ "@context": "https://schema.org", "@type": "WebSite", name: siteName, url: siteUrl });
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", siteUrlPattern);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", /Interactive Comments Section/);
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute("href", "/icon.svg");
  await expect(page.locator('link[rel="icon"][sizes="96x96"]')).toHaveAttribute("href", "/icon-96.png");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/apple-touch-icon.png");
  // Both PNG icons are exported from public/icon.svg and committed.
  for (const path of ["/icon.svg", "/icon-96.png", "/apple-touch-icon.png", "/opengraph-image"]) {
    expect((await page.request.get(path)).status(), path).toBe(200);
  }
  await expect(page.locator(".site-footer p")).toHaveCount(2);
  await expect(page.locator(".site-footer p").nth(0)).toHaveText("Practice demo. Fictional comments stay in this browser. Nothing is sent. Reset the demo");
  await expect(page.locator(".site-footer p").nth(1)).toHaveText("Challenge by Frontend Mentor. Built by Royer Adames.");
  await expect(page.locator(".site-footer").getByRole("link", { name: "Frontend Mentor", exact: true })).toHaveAttribute("href", "https://www.frontendmentor.io/challenges/interactive-comments-section-iG1RugEG9");
  await expect(page.locator(".site-footer").getByRole("link", { name: "Royer Adames", exact: true })).toHaveAttribute("href", "https://royeradames.com");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Interactive comments section");
});

test("desktop keeps a centred 730 px column and FM card, form and thread geometry", async ({ page }) => {
  await open(page);
  const column = await box(page, ".comments-section");
  expect(column).toMatchObject({ x: 355, y: 64, width: 730 });
  expect(column.x + column.width / 2).toBe(720);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(245, 246, 250)");
  await expect(page.locator("body")).toHaveCSS("font-family", /Rubik/);
  await expect(page.locator(".comment-card").first()).toHaveCSS("padding", "24px");
  await expect(page.locator(".comment-card").first()).toHaveCSS("border-radius", "8px");
  const first = await box(page, '[data-comment="1"]');
  expect(first.width).toBe(730);
  expect(first.height).toBe(168);
  expect((await box(page, '[data-comment="1"] .score-control')).width).toBe(40);
  expect((await box(page, '[data-comment="1"] .score-control')).height).toBe(100);
  await expect(page.locator(".score-control").first()).toHaveCSS("flex-direction", "column");
  expect((await box(page, '[data-comment="3"]')).x - first.x).toBe(88);
  expect((await box(page, '[data-comment="3"]')).width).toBe(642);
  expect((await box(page, ".comment-avatar")).width).toBe(32);
  expect((await box(page, ".new-comment-form .composer-avatar")).width).toBe(40);
  expect((await box(page, ".new-comment-form textarea")).height).toBe(96);
  expect((await box(page, ".new-comment-form .primary-button")).width).toBe(104);
});

test("mobile uses the 375 px design's 16 px margins, horizontal votes and lower form controls", async ({ page }) => {
  await open(page, 375);
  const column = await box(page, ".comments-section");
  expect(column).toMatchObject({ x: 16, y: 32, width: 343 });
  const first = await box(page, '[data-comment="1"]');
  expect(first.x).toBe(16);
  expect(first.width).toBe(343);
  await expect(page.locator(".comment-card").first()).toHaveCSS("padding", "16px");
  await expect(page.locator(".score-control").first()).toHaveCSS("flex-direction", "row");
  expect((await box(page, ".score-control")).height).toBe(40);
  const nested = await box(page, '[data-comment="3"]');
  expect(nested.x).toBe(34);
  expect(nested.width).toBe(325);
  const textarea = await box(page, ".new-comment-form textarea");
  const avatar = await box(page, ".new-comment-form .composer-avatar");
  const send = await box(page, ".new-comment-form .primary-button");
  expect(avatar.y).toBeGreaterThanOrEqual(textarea.y + textarea.height + 16);
  expect(send.y).toBeGreaterThanOrEqual(textarea.y + textarea.height + 16);
  expect(avatar.width).toBe(32);
  expect(textarea.x).toBe(32);
  expect(send.x + send.width).toBe(343);
});

test("delete dialog is centred at desktop and mobile widths, matches the supplied sizing and traps focus", async ({ page }) => {
  for (const width of [1440, 375, 320]) {
    await open(page, width);
    await page.locator('[data-comment="4"]').getByRole("button", { name: "Delete your comment", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Delete comment", exact: true });
    const bounds = await box(page, ".delete-dialog");
    expect(bounds.width).toBe(Math.min(400, width - 32));
    expect(bounds.x + bounds.width / 2).toBeCloseTo(width / 2, 1);
    expect(bounds.y + bounds.height / 2).toBeCloseTo(512, 1);
    const cancel = modal.getByRole("button", { name: "No, cancel", exact: true });
    const confirm = modal.getByRole("button", { name: "Yes, delete", exact: true });
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(confirm).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(cancel).toBeFocused();
    expect(await layoutProblems(page), `dialog at ${width}`).toEqual({ scroll: 0, wrapped: [], overflow: [] });
    expect(await smallText(page), `dialog at ${width}`).toEqual([]);
    await page.keyboard.press("Escape");
  }
});

test("320-1920 px sweep preserves reflow, one-line button labels and the 16 px text floor in dynamic states", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  const widths = [...Array.from({ length: 161 }, (_, i) => 320 + i * 10), 359, 360, 767, 768];
  for (const state of ["samples", "forms", "long comment", "dialog"]) {
    if (state === "forms") {
      await page.locator('[data-comment="1"]').getByRole("button", { name: "Reply to amyrobson", exact: true }).click();
      await page.getByRole("form", { name: "Reply to amyrobson", exact: true }).getByRole("button", { name: "Reply to amyrobson", exact: true }).click();
      await page.locator('[data-comment="4"]').getByRole("button", { name: "Edit your comment", exact: true }).click();
      const edit = page.getByRole("form", { name: "Edit your comment", exact: true });
      await edit.getByRole("textbox").fill("");
      await edit.getByRole("button", { name: "Update your comment", exact: true }).click();
      await page.getByRole("button", { name: "Send your comment", exact: true }).click();
    }
    if (state === "long comment") {
      await page.getByRole("textbox", { name: "Add a comment", exact: true }).fill("longword".repeat(120));
      await page.getByRole("button", { name: "Send your comment", exact: true }).click();
    }
    if (state === "dialog") await page.locator('[data-comment="4"]').getByRole("button", { name: "Delete your comment", exact: true }).click();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1024 });
      const problems = await layoutProblems(page);
      expect(problems.scroll, `sideways scroll at ${width}, ${state}`).toBeLessThanOrEqual(0);
      expect(problems.wrapped, `wrapped button at ${width}, ${state}`).toEqual([]);
      expect(problems.overflow, `element overflow at ${width}, ${state}`).toEqual([]);
      expect(await smallText(page), `small text at ${width}, ${state}`).toEqual([]);
      await expect(page.locator("button[disabled]")).toHaveCount(0);
    }
  }
});

async function expectTextContrast(page: Page, context: string) {
  for (const pair of await textContrast(page)) expect(pair.ratio, `${context}: ${pair.text}`).toBeGreaterThanOrEqual(4.5);
}

test("text passes 4.5:1 at rest and hover, including placeholders, errors, pressed scores and delete controls", async ({ page }) => {
  for (const width of [1440, 375]) {
    await open(page, width);
    await expectTextContrast(page, `rest ${width}`);
    for (const selector of [".comment-actions button", ".delete-action", ".new-comment-form .primary-button", ".site-footer button", ".site-footer a"]) {
      for (const target of await page.locator(selector).all()) {
        await target.hover();
        await expectTextContrast(page, `hover ${selector}, ${width}`);
      }
    }
    await page.locator('[data-comment="1"] .score-control button').first().click();
    await expectTextContrast(page, `voted ${width}`);
    await page.getByRole("button", { name: "Send your comment", exact: true }).click();
    await expect(page.locator(".field-error")).toBeVisible();
    await expectTextContrast(page, `error ${width}`);
    await page.locator('[data-comment="4"]').getByRole("button", { name: "Delete your comment", exact: true }).click();
    await expectTextContrast(page, `dialog ${width}`);
    for (const target of await page.locator(".dialog-actions button").all()) {
      await target.hover();
      await expectTextContrast(page, `dialog hover ${width}`);
    }
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Reset the demo", exact: true }).click();
  }
});

test("FM action and vote icons pass 3:1 at rest, hover and when pressed", async ({ page }) => {
  await open(page);
  async function ratios() {
    return page.evaluate(() => {
      const luminance = (colour: string) => {
        const rgb = (colour.match(/[\d.]+/g) ?? []).slice(0, 3).map((value) => {
          const s = Number(value) / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      };
      return [...document.querySelectorAll(".comment-card svg")].map((svg) => {
        let ancestor: Element | null = svg;
        let background = "rgb(255, 255, 255)";
        while (ancestor) {
          const colour = getComputedStyle(ancestor).backgroundColor;
          if (colour !== "rgba(0, 0, 0, 0)" && colour !== "transparent") { background = colour; break; }
          ancestor = ancestor.parentElement;
        }
        const [a, b] = [luminance(getComputedStyle(svg).color), luminance(background)].sort((x, y) => y - x);
        return { label: svg.closest("button")?.getAttribute("aria-label"), ratio: (a + 0.05) / (b + 0.05) };
      });
    });
  }
  for (const pair of await ratios()) expect(pair.ratio, pair.label ?? "icon").toBeGreaterThanOrEqual(3);
  for (const target of await page.locator(".comment-card button").all()) {
    await target.hover();
    for (const pair of await ratios()) expect(pair.ratio, `hover ${pair.label}`).toBeGreaterThanOrEqual(3);
  }
  const up = page.locator('[data-comment="1"]').getByRole("button", { name: "Upvote comment by amyrobson", exact: true });
  await up.click();
  await up.hover();
  for (const pair of await ratios()) expect(pair.ratio, `pressed ${pair.label}`).toBeGreaterThanOrEqual(3);
});
