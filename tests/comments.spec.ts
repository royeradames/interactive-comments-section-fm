import { expect, test, type Page } from "@playwright/test";
import data from "../app/data.json";
import { initialComments, storageKey } from "../app/comments-state";
import { open, waitForHydrated } from "./helpers";

const comment = (page: Page, id: number) => page.locator(`[data-comment="${id}"]`);
const composer = (page: Page) => page.getByRole("textbox", { name: "Add a comment", exact: true });

async function addComment(page: Page, content: string) {
  await composer(page).fill(content);
  await page.getByRole("button", { name: "Send your comment", exact: true }).click();
  await expect(page.locator(".comment-content").filter({ hasText: content })).toHaveCount(1);
}

test("keeps all four sample comments, timestamps, identities and assets exactly as FM supplied", async ({ page }) => {
  await open(page);
  const entries = data.comments.flatMap((thread) => [thread, ...thread.replies]);
  for (const entry of entries) {
    const card = comment(page, entry.id);
    await expect(card.locator(".comment-content")).toHaveText(entry.content);
    await expect(card.locator(".comment-time")).toHaveText(entry.createdAt);
    await expect(card.locator(".comment-username")).toHaveText(entry.user.username);
    await expect(card.locator(".comment-score")).toHaveText(String(entry.score));
    await expect(card.locator(".comment-avatar")).toHaveAttribute("src", entry.user.image.webp.replace(/^\.\//, "/"));
    expect(await card.locator("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    if (entry.user.username === data.currentUser.username) {
      await expect(card.locator(".you-tag")).toHaveText("you");
      await expect(card.getByRole("button", { name: "Edit your comment", exact: true })).toBeVisible();
      await expect(card.getByRole("button", { name: "Delete your comment", exact: true })).toBeVisible();
      await expect(card.getByRole("button", { name: /^Reply/ })).toHaveCount(0);
    } else {
      await expect(card.locator(".you-tag")).toHaveCount(0);
      await expect(card.getByRole("button", { name: /^(Edit|Delete)/ })).toHaveCount(0);
      await expect(card.getByRole("button", { name: `Reply to ${entry.user.username}`, exact: true })).toBeVisible();
    }
  }
  await expect(comment(page, 3).locator(".reply-tag")).toHaveText("@maxblagun");
  await expect(comment(page, 4).locator(".reply-tag")).toHaveText("@ramsesmiron");
  await expect(page.locator("button[disabled]")).toHaveCount(0);
});

test("adds a comment as the current user and announces the addition", async ({ page }) => {
  await open(page);
  await addComment(page, "Great work on the responsive layout!");
  const card = comment(page, 5);
  await expect(card.locator(".comment-username")).toHaveText("juliusomo");
  await expect(card.locator(".you-tag")).toHaveText("you");
  await expect(card.locator(".comment-score")).toHaveText("0");
  await expect(card.locator(".comment-time")).toHaveText("just now");
  await expect(card.locator(".reply-tag")).toHaveCount(0);
  await expect(page.locator(".comments-list > li")).toHaveCount(3);
  await expect(composer(page)).toHaveValue("");
  await expect(composer(page)).toBeFocused();
  await expect(page.locator(".comment-announcement")).toContainText("Your comment was added to this demo.");
});

test("replies to a comment and a reply in their original top-level threads with one context tag", async ({ page }) => {
  await open(page, 375);
  await comment(page, 1).getByRole("button", { name: "Reply to amyrobson", exact: true }).click();
  const amyForm = page.getByRole("form", { name: "Reply to amyrobson", exact: true });
  await expect(amyForm.getByRole("textbox")).toBeFocused();
  await expect(amyForm.getByRole("textbox")).toHaveValue("@amyrobson ");
  expect(await amyForm.evaluate((form) => form.previousElementSibling?.getAttribute("data-comment"))).toBe("1");
  await amyForm.getByRole("textbox").fill("@amyrobson Thanks for sharing your feedback!");
  await amyForm.getByRole("button", { name: "Reply to amyrobson", exact: true }).click();
  const firstThread = page.locator('[data-thread="1"]');
  await expect(firstThread.locator('.replies-list [data-comment="5"] .reply-tag')).toHaveText("@amyrobson");
  await expect(comment(page, 5).locator(".comment-content")).toHaveText("Thanks for sharing your feedback!");
  await expect(comment(page, 1).getByRole("button", { name: "Reply to amyrobson", exact: true })).toBeFocused();

  await comment(page, 3).getByRole("button", { name: "Reply to ramsesmiron", exact: true }).click();
  const replyForm = page.getByRole("form", { name: "Reply to ramsesmiron", exact: true });
  await expect(replyForm.getByRole("textbox")).toHaveValue("@ramsesmiron ");
  expect(await replyForm.evaluate((form) => form.previousElementSibling?.getAttribute("data-comment"))).toBe("3");
  await replyForm.getByRole("textbox").fill("@ramsesmiron, The fundamentals are a solid starting point.");
  await replyForm.getByRole("button", { name: "Reply to ramsesmiron", exact: true }).click();
  const replies = page.locator('[data-thread="2"] > .replies-list');
  await expect(replies.locator(":scope > li > article")).toHaveCount(3);
  expect(await replies.locator(":scope > li > article").evaluateAll((cards) => cards.map((card) => card.getAttribute("data-comment")))).toEqual(["3", "4", "6"]);
  await expect(replies.locator(".replies-list")).toHaveCount(0);
  await expect(comment(page, 6).locator(".reply-tag")).toHaveText("@ramsesmiron");
  await expect(comment(page, 6).locator(".comment-content")).toHaveText("The fundamentals are a solid starting point.");
  await expect(page.locator(".comment-announcement")).toContainText("Your reply to ramsesmiron was added");
});

test("edits and updates own replies while retaining their context and focus", async ({ page }) => {
  await open(page);
  const card = comment(page, 4);
  const edit = card.getByRole("button", { name: "Edit your comment", exact: true });
  await edit.click();
  const textarea = card.getByRole("textbox", { name: "Edit your comment", exact: true });
  await expect(textarea).toBeFocused();
  await expect(textarea).toHaveValue(`@ramsesmiron ${data.comments[1].replies[1].content}`);
  await textarea.fill("@ramsesmiron I agree that HTML, CSS and JavaScript come first.");
  await card.getByRole("button", { name: "Update your comment", exact: true }).click();
  await expect(card.getByRole("textbox")).toHaveCount(0);
  await expect(card.locator(".comment-content")).toHaveText("I agree that HTML, CSS and JavaScript come first.");
  await expect(card.locator(".reply-tag")).toHaveText("@ramsesmiron");
  await expect(edit).toBeFocused();
  await expect(page.locator(".comment-announcement")).toContainText("Your comment was updated");
});

test("delete modal cancels, closes on Escape and confirms with predictable focus", async ({ page }) => {
  await open(page, 375);
  const card = comment(page, 4);
  const trigger = card.getByRole("button", { name: "Delete your comment", exact: true });
  const modal = page.getByRole("dialog", { name: "Delete comment", exact: true });
  await trigger.click();
  await expect(modal).toBeVisible();
  await expect(modal.locator("p")).toHaveText("Are you sure you want to delete this comment? This will remove the comment and can't be undone.");
  await expect(modal.getByRole("button", { name: "No, cancel", exact: true })).toBeFocused();
  await modal.getByRole("button", { name: "No, cancel", exact: true }).click();
  await expect(modal).not.toBeVisible();
  await expect(card).toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(card).toBeVisible();
  await trigger.click();
  await modal.getByRole("button", { name: "Yes, delete", exact: true }).click();
  await expect(modal).not.toBeVisible();
  await expect(card).toHaveCount(0);
  await expect(comment(page, 3)).toBeVisible();
  await expect(composer(page)).toBeFocused();
  await expect(page.locator(".comment-announcement")).toContainText("Your comment was deleted");

  await addComment(page, "A temporary top-level comment.");
  const own = page.locator(".comment-card").filter({ hasText: "A temporary top-level comment." });
  await own.getByRole("button", { name: "Delete your comment", exact: true }).click();
  await modal.getByRole("button", { name: "Yes, delete", exact: true }).click();
  await expect(own).toHaveCount(0);
  await expect(composer(page)).toBeFocused();
});

test("votes up, down, switches and toggles off with aria-pressed and announcements", async ({ page }) => {
  await open(page);
  const card = comment(page, 1);
  const up = card.getByRole("button", { name: "Upvote comment by amyrobson", exact: true });
  const down = card.getByRole("button", { name: "Downvote comment by amyrobson", exact: true });
  await expect(up).toHaveAttribute("aria-pressed", "false");
  await up.click();
  await expect(card.locator(".comment-score")).toHaveText("13");
  await expect(up).toHaveAttribute("aria-pressed", "true");
  await expect(down).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".comment-announcement")).toContainText("Upvoted comment by amyrobson. Score 13.");
  await up.click();
  await expect(card.locator(".comment-score")).toHaveText("12");
  await expect(up).toHaveAttribute("aria-pressed", "false");
  await down.click();
  await expect(card.locator(".comment-score")).toHaveText("11");
  await expect(down).toHaveAttribute("aria-pressed", "true");
  await up.click();
  await expect(card.locator(".comment-score")).toHaveText("13");
  await expect(up).toHaveAttribute("aria-pressed", "true");
  await expect(down).toHaveAttribute("aria-pressed", "false");
  await down.click();
  await down.click();
  await expect(card.locator(".comment-score")).toHaveText("12");
  await expect(down).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".comment-announcement")).toContainText("Vote removed comment by amyrobson. Score 12.");
  await expect(down).toBeFocused();
});

test("top-level votes change score order while reply order stays chronological", async ({ page }) => {
  const threads = initialComments().map((thread) => ({ ...thread, score: 5 }));
  await page.addInitScript(({ key, comments }) => localStorage.setItem(key, JSON.stringify({ version: 1, comments })), { key: storageKey, comments: threads });
  await open(page);
  await comment(page, 2).getByRole("button", { name: "Upvote comment by maxblagun", exact: true }).click();
  expect(await page.locator(".comments-list > li").evaluateAll((items) => items.map((item) => item.getAttribute("data-thread")))).toEqual(["2", "1"]);
  await comment(page, 3).getByRole("button", { name: "Downvote comment by ramsesmiron", exact: true }).click();
  expect(await page.locator('[data-thread="2"] .replies-list article').evaluateAll((items) => items.map((item) => item.getAttribute("data-comment")))).toEqual(["3", "4"]);
});

test("empty comments, context-only replies and empty edits show linked errors and retain textarea focus", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Send your comment", exact: true }).click();
  await expect(composer(page)).toBeFocused();
  await expect(composer(page)).toHaveAttribute("aria-invalid", "true");
  const errorId = await composer(page).getAttribute("aria-describedby");
  expect(errorId).toBeTruthy();
  await expect(page.locator(`[id="${errorId}"]`)).toHaveText("Enter a comment before submitting.");
  await composer(page).fill("   ");
  await page.getByRole("button", { name: "Send your comment", exact: true }).click();
  await expect(composer(page)).toBeFocused();
  await expect(page.locator(".comments-list article")).toHaveCount(4);
  await comment(page, 1).getByRole("button", { name: "Reply to amyrobson", exact: true }).click();
  const replyForm = page.getByRole("form", { name: "Reply to amyrobson", exact: true });
  await replyForm.getByRole("button", { name: "Reply to amyrobson", exact: true }).click();
  await expect(replyForm.getByRole("textbox")).toBeFocused();
  await expect(replyForm.getByRole("alert")).toBeVisible();
  await comment(page, 4).getByRole("button", { name: "Edit your comment", exact: true }).click();
  const editForm = page.getByRole("form", { name: "Edit your comment", exact: true });
  await editForm.getByRole("textbox").fill("@ramsesmiron ");
  await editForm.getByRole("button", { name: "Update your comment", exact: true }).click();
  await expect(editForm.getByRole("textbox")).toBeFocused();
  await expect(editForm.getByRole("alert")).toBeVisible();
  await expect(editForm.getByRole("textbox")).toHaveAttribute("aria-describedby", /-error$/);
  await expect(page.locator("button[disabled]")).toHaveCount(0);
});

test("persists CRUD and votes after reload and Reset the demo restores samples and clears drafts", async ({ page }) => {
  await open(page);
  await addComment(page, "Keep this comment after reload.");
  await comment(page, 1).getByRole("button", { name: "Upvote comment by amyrobson", exact: true }).click();
  await comment(page, 4).getByRole("button", { name: "Edit your comment", exact: true }).click();
  await comment(page, 4).getByRole("textbox").fill("@ramsesmiron Saved edit.");
  await comment(page, 4).getByRole("button", { name: "Update your comment", exact: true }).click();
  await comment(page, 3).getByRole("button", { name: "Reply to ramsesmiron", exact: true }).click();
  const replyForm = page.getByRole("form", { name: "Reply to ramsesmiron", exact: true });
  await replyForm.getByRole("textbox").fill("@ramsesmiron Save this reply too.");
  await replyForm.getByRole("button", { name: "Reply to ramsesmiron", exact: true }).click();
  await page.reload();
  await waitForHydrated(page);
  await expect(comment(page, 5).locator(".comment-content")).toHaveText("Keep this comment after reload.");
  await expect(comment(page, 4).locator(".comment-content")).toHaveText("Saved edit.");
  await expect(page.locator('[data-thread="2"] .replies-list [data-comment="6"] .comment-content')).toHaveText("Save this reply too.");
  await expect(comment(page, 6).locator(".reply-tag")).toHaveText("@ramsesmiron");
  await expect(comment(page, 1).locator(".comment-score")).toHaveText("13");
  await expect(comment(page, 1).getByRole("button", { name: "Upvote comment by amyrobson", exact: true })).toHaveAttribute("aria-pressed", "true");
  await comment(page, 5).getByRole("button", { name: "Delete your comment", exact: true }).click();
  await page.getByRole("button", { name: "Yes, delete", exact: true }).click();
  await page.reload();
  await waitForHydrated(page);
  await expect(comment(page, 5)).toHaveCount(0);
  await composer(page).fill("Discard this unfinished draft.");
  await comment(page, 1).getByRole("button", { name: "Reply to amyrobson", exact: true }).click();
  await comment(page, 4).getByRole("button", { name: "Edit your comment", exact: true }).click();
  await page.getByRole("button", { name: "Reset the demo", exact: true }).click();
  await expect(page.locator(".comments-list article")).toHaveCount(4);
  await expect(page.locator(".comments-list form")).toHaveCount(0);
  await expect(composer(page)).toHaveValue("");
  await expect(comment(page, 4).locator(".comment-content")).toHaveText(data.comments[1].replies[1].content);
  await expect(comment(page, 1).locator(".comment-score")).toHaveText("12");
  await expect(page.getByRole("button", { name: "Reset the demo", exact: true })).toBeFocused();
  await page.reload();
  await waitForHydrated(page);
  await expect(page.locator(".comment-content")).toHaveText(data.comments.flatMap((thread) => [thread.content, ...thread.replies.map((reply) => reply.content)]));
  await expect(page.locator('.score-control button[aria-pressed="true"]')).toHaveCount(0);
});

test("invalid stored JSON or records fall back to FM samples without hydration errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && /hydrat/i.test(message.text())) errors.push(message.text()); });
  await open(page);
  const invalid = ["{broken", "null", JSON.stringify({ version: 1, comments: [{ id: 1 }] }), JSON.stringify({ version: 1, comments: [...initialComments(), ...initialComments()] }), JSON.stringify({ version: 1, comments: [{ ...initialComments()[0], user: { username: "unknown" } }] })];
  for (const raw of invalid) {
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: storageKey, raw });
    await page.reload();
    await waitForHydrated(page);
    await expect(page.locator(".comment-content")).toHaveText(data.comments.flatMap((thread) => [thread.content, ...thread.replies.map((reply) => reply.content)]));
  }
  expect(errors).toEqual([]);
});

test("renders FM samples on the server and restores saved content without an empty loading frame", async ({ page, browser, baseURL }) => {
  const serverContext = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const serverPage = await serverContext.newPage();
  await serverPage.goto("/");
  await expect(serverPage.locator(".comment-content")).toHaveText(data.comments.flatMap((thread) => [thread.content, ...thread.replies.map((reply) => reply.content)]));
  await serverContext.close();
  const saved = initialComments();
  saved[0].content = "Restored fictional comment.";
  await page.addInitScript(({ key, comments }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1, comments }));
    const frames: number[] = [];
    Reflect.set(window, "commentFrames", frames);
    function sample() {
      if (document.querySelector(".new-comment-form")) frames.push(document.querySelectorAll(".comment-card").length);
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }, { key: storageKey, comments: saved });
  await open(page);
  await expect(comment(page, 1).locator(".comment-content")).toHaveText("Restored fictional comment.");
  await page.waitForFunction(() => {
    const frames: unknown = Reflect.get(window, "commentFrames");
    return Array.isArray(frames) && frames.length > 0;
  });
  const frames: unknown = await page.evaluate(() => Reflect.get(window, "commentFrames"));
  expect(Array.isArray(frames) && frames.every((count) => count > 0)).toBe(true);
});

test("new timestamps become relative while sample dates stay as supplied", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-13T12:00:00Z") });
  await open(page);
  await addComment(page, "Watch the relative timestamp.");
  await expect(comment(page, 5).locator(".comment-time")).toHaveText("just now");
  await page.clock.fastForward(120_000);
  await expect(comment(page, 5).locator(".comment-time")).toHaveText("2 minutes ago");
  await expect(comment(page, 1).locator(".comment-time")).toHaveText("1 month ago");
});

test("blocked storage keeps the demo usable and explains that changes cannot survive reload", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException("Blocked", "SecurityError"); };
    Storage.prototype.setItem = () => { throw new DOMException("Blocked", "QuotaExceededError"); };
  });
  await open(page);
  await expect(page.locator(".storage-note")).toHaveText("Browser storage is unavailable. Changes will last until you leave or reload this page.");
  await addComment(page, "Still works in memory.");
  await page.getByRole("button", { name: "Reset the demo", exact: true }).click();
  await expect(page.locator(".comments-list article")).toHaveCount(4);
});

test("all demo interactions send no non-GET requests", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET") writes.push(`${request.method()} ${request.url()}`); });
  await open(page);
  await addComment(page, "No network write.");
  await comment(page, 1).getByRole("button", { name: "Downvote comment by amyrobson", exact: true }).click();
  await comment(page, 3).getByRole("button", { name: "Reply to ramsesmiron", exact: true }).click();
  const form = page.getByRole("form", { name: "Reply to ramsesmiron", exact: true });
  await form.getByRole("textbox").fill("@ramsesmiron Another local reply.");
  await form.getByRole("button", { name: "Reply to ramsesmiron", exact: true }).click();
  await comment(page, 4).getByRole("button", { name: "Edit your comment", exact: true }).click();
  await comment(page, 4).getByRole("textbox").fill("Local edit.");
  await comment(page, 4).getByRole("button", { name: "Update your comment", exact: true }).click();
  await comment(page, 4).getByRole("button", { name: "Delete your comment", exact: true }).click();
  await page.getByRole("button", { name: "Yes, delete", exact: true }).click();
  await page.getByRole("button", { name: "Reset the demo", exact: true }).click();
  await page.reload();
  await waitForHydrated(page);
  expect(writes).toEqual([]);
});
