import { expect, test } from "@playwright/test";

const liveBase = process.env.LIVE_ONBOARDING_BASE_URL;
const runId = process.env.GITHUB_RUN_ID;

function credentials() {
  if (!runId) throw new Error("GITHUB_RUN_ID is required for live onboarding E2E");
  return {
    email: `onboarding-e2e-${runId}@example.com`,
    password: `PyE2E!${runId}xQ7`,
  };
}

test("live new user completes onboarding and lands on useful product surfaces", async ({ page }) => {
  test.skip(!liveBase || !runId, "Live onboarding environment is not configured");
  const { email, password } = credentials();

  await page.goto(`${liveBase}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/onboarding(?:\?|$)/, { timeout: 20_000 });

  await expect(page.getByText("Let’s build Project You around your life.")).toBeVisible();
  await page.getByRole("button", { name: /build my system|continue building your system/i }).click();

  await page.getByRole("button", { name: "Discipline", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.getByRole("button", { name: "No clear plan", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.getByPlaceholder("e.g. Get in shape").fill("Build a consistent daily plan");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Here’s how your Coach understood your goals.")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.getByRole("button", { name: "No current work schedule", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.getByRole("button", { name: "My schedule varies", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.getByRole("button", { name: "Not right now", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.getByRole("button", { name: "I’d rather set this up later", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.getByRole("button", { name: "Balanced", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.getByRole("button", { name: "Daily", exact: true }).click();
  await page.getByRole("button", { name: "Morning", exact: true }).click();
  await page.locator("select").selectOption("0");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.getByText("Your starting system")).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "Activate my system", exact: true }).click();
  await expect(page.getByText("Your starting trajectory")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Go to Today", exact: true }).click();
  await page.waitForURL(/\/today(?:\?|$)/, { timeout: 20_000 });

  await expect(page.getByText(/Foundation|calibration in progress/i)).toBeVisible();
  await expect(page.getByText("Build a consistent daily plan", { exact: false }).first()).toBeVisible();

  await page.goto(`${liveBase}/plan`);
  await expect(page.getByText("Build a consistent daily plan", { exact: false }).first()).toBeVisible();

  await page.goto(`${liveBase}/coach`);
  await expect(page.getByText(/1 active goal/i)).toBeVisible();

  await page.goto(`${liveBase}/you`);
  await expect(page.getByText(/1 active/i).first()).toBeVisible();
  await expect(page.getByText("Personalize Project You+", { exact: true })).toBeVisible();
});
