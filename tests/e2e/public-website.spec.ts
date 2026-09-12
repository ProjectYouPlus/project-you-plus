import { test, expect } from "@playwright/test";

test("public story, navigation and accessible beta signup", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/?utm_source=instagram&utm_medium=social&utm_campaign=website_qa");
  await expect(page).toHaveTitle("Project You+ — Your AI Life Operating System");
  await expect(page.locator("h1")).toContainText("Become who");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://projectyouplus.com");
  await page.locator('[data-beta-cta="hero"]').click();
  await expect(page.locator("#beta-name")).toBeInViewport();
  await expect(page.locator("#beta-name")).toHaveAttribute("required", "");
  await expect(page.locator("#beta-email")).toHaveAttribute("type", "email");
  await expect(page.locator('input[name="willingness_to_pay"]')).toHaveCount(0);
  await expect(page.locator(".form-submit")).toBeEnabled();
  await expect(page.locator(".youplus-site")).toBeVisible();
  const size = await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:innerWidth}));
  expect(size.scroll).toBeLessThanOrEqual(size.view);
  for (const id of ["trajectory", "today", "coach", "review"]) await expect(page.locator(`#${id} h2`)).toBeVisible();
  await page.locator('a[href="#privacy"]').first().click(); await page.locator("#privacy summary").click();
  await expect(page.locator("#privacy")).toHaveAttribute("open", "");
  expect(errors).toEqual([]);
});

test("reduced motion retains every product chapter and signup", async ({ page }) => {
  await page.emulateMedia({reducedMotion:"reduce"}); await page.goto("/?utm_campaign=website_qa");
  await expect(page.locator(".youplus-site")).not.toHaveAttribute("data-motion", "true");
  for (const id of ["trajectory", "today", "coach", "review"]) await expect(page.locator(`#${id} .mobile-product`)).toBeVisible();
  await page.locator('[data-beta-cta="nav"]').click(); await expect(page.locator("#beta-name")).toBeInViewport();
});

test("a failed request preserves form values and can be retried", async ({ page }) => {
  await page.route("**/api/beta-waitlist",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Please try again in a moment."})}));
  await page.goto("/?utm_campaign=website_qa#beta");await page.locator("#beta-name").fill("Website QA");await page.locator("#beta-email").fill("website-qa@example.invalid");await page.locator("#beta-goal").fill("Consistency");await page.locator(".form-submit").click();
  await expect(page.locator(".form-error[role=alert]")).toContainText("Please try again");await expect(page.locator("#beta-name")).toHaveValue("Website QA");await expect(page.locator(".form-submit")).toBeEnabled();
});
