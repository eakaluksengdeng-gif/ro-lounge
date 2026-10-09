import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const url = process.env.E2E_URL ?? "http://127.0.0.1:5173";
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });
  assert.equal(await page.locator("#customize select").count(), 0);
  assert.equal(await page.locator(".creator-card canvas").count(), 24);
  assert.equal(await page.locator(".creator-tile input:checked").count(), 6);
  const preview = () => page.locator("#characterPreview").evaluate(canvas => canvas.toDataURL());
  const initial = await preview();
  const select = async (part, value) => page.locator('input[name="appearance-' + part + '"][value="' + value + '"]').evaluate(input => input.closest("label").click());
  const maleStyles = await page.locator('[data-part="style"] canvas').evaluateAll(canvases => canvases.map(canvas => canvas.toDataURL()));
  await select("gender", 1);
  const femaleStyles = await page.locator('[data-part="style"] canvas').evaluateAll(canvases => canvases.map(canvas => canvas.toDataURL()));
  assert.notDeepEqual(maleStyles, femaleStyles, "gender changes the actual hair previews");
  assert.equal(await page.locator('fieldset[data-part="pants"] legend').textContent(), "กระโปรง");
  for (const [part, value] of [["style", 2], ["hair", 5], ["color", 1], ["skin", 2], ["pants", 2]]) {
    await select(part, value);
    assert.equal(await page.locator("#characterPreview").evaluate((canvas, key) => JSON.parse(canvas.dataset.look)[key], part), value);
  }
  assert.notEqual(await preview(), initial);
  await page.locator("#nameInput").fill("Pixel Adventurer");
  assert.equal(await page.locator("#characterPreviewName").textContent(), "Pixel Adventurer");
  await page.getByRole("button", { name: "หมุนตัวละครไปทางขวา", exact: true }).click();
  assert.equal(await page.locator("#characterPreview").getAttribute("data-direction"), "1");
  const side = await preview();
  await page.getByRole("button", { name: "หมุนตัวละครไปทางขวา", exact: true }).click();
  assert.notEqual(await preview(), side);
  await page.reload({ waitUntil: "networkidle" });
  const saved = { color: 1, hair: 5, style: 2, skin: 2, pants: 2, gender: 1 };
  assert.deepEqual(JSON.parse(await page.locator("#characterPreview").getAttribute("data-look")), saved);
  // Native radio arrow keys retain keyboard accessibility even without text dropdowns.
  const focused = page.locator('input[name="appearance-color"][value="1"]');
  await focused.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator("#characterPreview").evaluate(c => JSON.parse(c.dataset.look).color), 2);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "/tmp/ro-lounge-creator-desktop.png", fullPage: true });
  const bg = await page.evaluate(async () => {
    const image = new Image();
    const style = getComputedStyle(document.querySelector(".creator-scenery"));
    if (!style.backgroundImage.includes("character-courtyard-pixel.png")) throw new Error("Pixel background is not wired to the preview");
    if (style.imageRendering !== "pixelated") throw new Error("Pixel background must use nearest-neighbor rendering");
    image.src = new URL("/art/character-courtyard-pixel.png", location.href);
    await image.decode();
    return image.naturalWidth;
  });
  assert.equal(bg, 128);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/ro-lounge-creator-mobile.png", fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole("button", { name: "เข้าเมือง", exact: false }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/ro-lounge-creator-mobile-bottom.png" });
  // Bad or blocked storage must not prevent the character chooser from loading.
  await page.evaluate(() => localStorage.setItem("ro-look", '{"hair":999,"color":-1,"style":"oops"}'));
  await page.reload({ waitUntil: "networkidle" });
  assert.deepEqual(JSON.parse(await page.locator("#characterPreview").getAttribute("data-look")), { color: 3, hair: 0, style: 0, skin: 0, pants: 0, gender: 0 });
  const privateContext = await browser.newContext();
  await privateContext.addInitScript(() => Object.defineProperty(window, "localStorage", { get: () => { throw new Error("Storage disabled"); } }));
  const privatePage = await privateContext.newPage();
  privatePage.on("pageerror", error => errors.push(error.message));
  await privatePage.goto(url, { waitUntil: "networkidle" });
  assert.equal(await privatePage.locator(".creator-card canvas").count(), 24);
  assert.deepEqual(errors, []);
  console.log("PASS: 24 picture choices, gender-matched hair/outfit, live preview, rotation, name, saved appearance, keyboard, mobile, bad/disabled storage");
} finally {
  await browser.close();
}
