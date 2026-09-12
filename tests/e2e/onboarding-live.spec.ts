import { expect, test, type Page } from "@playwright/test";

const liveBase = process.env.LIVE_ONBOARDING_BASE_URL;
const email = process.env.LIVE_ONBOARDING_EMAIL;
const password = process.env.LIVE_ONBOARDING_PASSWORD;

async function continueOnboarding(page:Page){
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

test("authenticated three-goal onboarding builds, reviews, activates, starts Reset, and populates Project You+", async ({ page }) => {
  test.skip(!liveBase || !email || !password, "Connected onboarding credentials are not configured");

  await page.goto(`${liveBase}/login`);
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/onboarding(?:\?|$)/, { timeout: 25_000 });

  await expect(page.getByText("Let’s build Project You around your life.")).toBeVisible();
  await page.getByRole("button", { name: /build my system|continue building your system/i }).click();

  // Direction: all three domains needed by the required production scenario.
  await page.getByRole("button", { name: "Health", exact: true }).click();
  await page.getByRole("button", { name: "Money", exact: true }).click();
  await page.getByRole("button", { name: "Discipline", exact: true }).click();
  await continueOnboarding(page);
  await page.getByRole("button", { name: "Discipline", exact: true }).click();
  await continueOnboarding(page);

  await page.getByRole("button", { name: "Inconsistency", exact: true }).click();
  await continueOnboarding(page);

  await page.getByLabel("Goal 1").fill("Lose 15 pounds");
  await page.getByLabel("Goal 2 (optional)").fill("Save $10,000");
  await page.getByLabel("Goal 3 (optional)").fill("Become more disciplined");
  await continueOnboarding(page);
  await expect(page.getByText("Here’s how your Coach understood your goals.")).toBeVisible({ timeout: 25_000 });
  await expect(page.locator('input[placeholder="Target (optional)"]')).toHaveCount(3);
  await continueOnboarding(page);

  // Life Structure: a real fixed work week plus protected family time and sleep.
  await page.getByRole("button", { name: "A fixed schedule", exact: true }).click();
  for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri"]) await page.getByRole("button", { name: day, exact: true }).click();
  await page.getByLabel("Start").fill("09:00");
  await page.getByLabel("End").fill("17:00");
  await page.getByLabel("Commute minutes (optional)").fill("20");
  await continueOnboarding(page);

  await page.getByLabel("Label").fill("Family time");
  await page.getByRole("button", { name: "Wed", exact: true }).click();
  const commitmentTimes = page.locator('input[type="time"]');
  await commitmentTimes.nth(0).fill("18:00");
  await commitmentTimes.nth(1).fill("20:00");
  await page.getByRole("button", { name: "Add commitment", exact: true }).click();
  await expect(page.getByText("Family time", { exact: true })).toBeVisible();
  await continueOnboarding(page);

  await page.getByRole("button", { name: "Usually predictable", exact: true }).click();
  await page.getByLabel("Typical wake").fill("06:30");
  await page.getByLabel("Typical sleep").fill("22:30");
  await continueOnboarding(page);

  // Health: exactly three available training days, 45 minutes, gym, morning.
  await page.getByRole("button", { name: "Lose body fat", exact: true }).click();
  await continueOnboarding(page);
  await page.getByRole("button", { name: "Beginner", exact: true }).click();
  await page.getByRole("button", { name: "3", exact: true }).click();
  for (const day of ["Mon", "Wed", "Fri"]) await page.getByRole("button", { name: day, exact: true }).click();
  await page.getByLabel("Workout duration").selectOption("45");
  await page.getByLabel("Where").selectOption("gym");
  await page.getByRole("button", { name: "Morning", exact: true }).click();
  await continueOnboarding(page);
  await page.getByRole("button", { name: "Fat Loss", exact: true }).click();
  await continueOnboarding(page);

  // Finance: confirm the priority but deliberately omit a deadline/current balance.
  await page.getByRole("button", { name: "Save for a purchase", exact: true }).click();
  await page.getByLabel("One helpful detail (optional)").fill("Build the $10,000 goal without assuming a deadline.");
  await continueOnboarding(page);

  await page.getByRole("button", { name: "Balanced", exact: true }).click();
  await continueOnboarding(page);
  await page.getByRole("button", { name: "Daily", exact: true }).click();
  await page.getByRole("button", { name: "Morning", exact: true }).click();
  await page.locator("select").selectOption("0");
  await continueOnboarding(page);

  // Generation now hands off to the production Auto-Build proposal route.
  await page.waitForURL(/\/onboarding\/system\?session=/, { timeout: 60_000 });
  await expect(page.getByText("Your first Project You+ system", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("How this responds to your friction", { exact: true })).toBeVisible();
  await expect(page.getByText(/Targets that still need confirmation/i)).toBeVisible();
  await expect(page.getByText(/Confirm savings pace/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Make this plan lighter", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Adjust my plan", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve and build my system", exact: true })).toBeVisible();

  // Missing finance inputs are editable; calculations remain deterministic application logic.
  await page.getByLabel("Already saved").fill("1000");
  await page.getByRole("button", { name: /12 mo/i }).click();
  await page.getByRole("button", { name: "Apply finance details", exact: true }).click();
  await expect(page.getByText(/remaining ÷ .*month/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/does not move money automatically/i)).toBeVisible();

  // Review/edit mode is usable without activating anything.
  await page.getByRole("button", { name: "Adjust my plan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Done adjusting", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Done adjusting", exact: true }).click();

  await page.getByRole("button", { name: "Approve and build my system", exact: true }).click();
  await expect(page.getByText("Creating your Project You+ system", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Your system is ready.", { exact: true })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Foundation — calibration in progress", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Start with Today", exact: true }).click();
  await page.waitForURL(/\/today(?:\?|$)/, { timeout: 20_000 });
  await expect(page.getByText("Project You+ Coach", { exact: true })).toBeVisible();
  await expect(page.getByText("Goal momentum", { exact: true })).toBeVisible();
  await expect(page.getByText("Next Weekly Review", { exact: true })).toBeVisible();

  // The activated personal system immediately hands off to the Reset. Depending on local time,
  // the user gets a real Day 1 or a preparation evening rather than an impossible late-night plan.
  const resetCard = page.locator('section[aria-label*="Project You+ Reset"]').first();
  await expect(resetCard).toBeVisible({ timeout: 20_000 });
  await expect(resetCard).toContainText(/Day 1 of 7|Tomorrow starts with a realistic Day 1\./);
  await resetCard.getByRole("link").last().click();
  await page.waitForURL(/\/reset(?:\?|$)/, { timeout: 20_000 });
  await expect(page.getByText("7-Day Project You+ Reset", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Your direction is clear\.|Your 7-Day Project You\+ Reset starts tomorrow\./).first()).toBeVisible();

  await page.goto(`${liveBase}/plan`);
  await expect(page.getByText(/15 pounds|body composition/i).first()).toBeVisible();
  await expect(page.getByText(/10,000/i).first()).toBeVisible();

  await page.goto(`${liveBase}/coach`);
  await expect(page.getByText(/3 active goals/i)).toBeVisible();
  await expect(page.locator('section[aria-label*="Project You+ Reset"]').first()).toBeVisible();

  await page.goto(`${liveBase}/you`);
  await expect(page.getByText(/3 active/i).first()).toBeVisible();
  await expect(page.getByText("Personalize Project You+", { exact: true })).toBeVisible();
  await expect(page.locator('section[aria-label*="Project You+ Reset"]').first()).toBeVisible();
});
