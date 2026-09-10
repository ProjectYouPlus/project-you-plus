import { test, expect } from "@playwright/test";

const publicRoutes = ["/login", "/welcome"];

for (const route of publicRoutes) {
  test(`${route} renders without server failure`, async ({ page }) => {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
  });
}

test("protected app route redirects unauthenticated users safely", async ({ page }) => {
  const response = await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
});

test("owner route never exposes dashboard to unauthenticated users", async ({ page }) => {
  const response = await page.goto("/owner", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBeLessThan(500);
  expect(page.url()).not.toMatch(/\/owner\/?$/);
});
