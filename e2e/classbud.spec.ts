import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-15T02:17:00.000Z"));
  await page.goto("/today");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
});

test("renders exact schedule and responsive navigation", async ({ page }, testInfo) => {
  await page.goto("/schedule");
  await expect(page).toHaveTitle("ClassBud 2.0");
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
  await expect(page.getByText("Recurring timetable · holidays and exceptions not included")).toBeVisible();

  if (testInfo.project.name.endsWith("-mobile")) {
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
    await expect(page.locator(".mobile-agenda")).toBeVisible();
  } else {
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    await expect(page.locator(".day-grid")).toBeVisible();
  }

  await expect(page.getByRole("button", { name: /การออกแบบและพัฒนาเกม/ })).toBeVisible();
  await page.getByRole("button", { name: /การออกแบบและพัฒนาเกม/ }).first().click();
  const inspector = page.getByLabel("การออกแบบและพัฒนาเกม details");
  await expect(inspector).toBeVisible();
  await expect(inspector.getByText("Room 1901", { exact: true })).toBeVisible();
  if (testInfo.project.name.endsWith("-mobile")) {
    await page.getByRole("button", { name: "Close class details" }).click();
  }

  await page.getByRole("button", { name: "Week" }).click();
  await expect(page.locator(".week-grid .schedule-event")).toHaveCount(17);
});

test("creates, completes, and persists a task", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByRole("button", { name: "New task" }).click();
  await page.getByLabel("Task title").fill("Prepare game prototype");
  await page.getByLabel("Due date Bangkok time").fill("2026-07-15T23:59");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Prepare game prototype")).toBeVisible();
  await page.getByRole("button", { name: "Complete Prepare game prototype" }).click();
  await page.reload();
  await expect(page.getByText("Prepare game prototype")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reopen Prepare game prototype" })).toBeVisible();
});

test("search and Buddy use local timetable data", async ({ page }) => {
  await page.goto("/today");
  await page.getByRole("button", { name: "Search ClassBud" }).click();
  await page.getByRole("searchbox", { name: "Search" }).fill("ค32214");
  const searchResult = page.locator(".command-menu__results").getByRole("button", {
    name: /คณิตศาสตร์เพิ่มเติม 3 ค32214/,
  });
  await expect(searchResult).toBeVisible();
  await searchResult.click();
  await expect(page).toHaveURL(/\/subjects/);

  await page.goto("/buddy");
  await page.getByLabel("Ask Buddy").fill("Where is Additional Mathematics?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/Room 1712/)).toBeVisible();
  await expect(page.getByText(/Room 555/)).toBeVisible();
});

test("shows the frozen current class and next class", async ({ page }, testInfo) => {
  await page.goto("/today");
  await expect(page.getByRole("button", { name: /Now การออกแบบและพัฒนาเกม/ })).toContainText("Ends in 28 min");
  await expect(page.getByRole("button", { name: /คณิตศาสตร์ 9 09:50–11:20/ })).toBeVisible();

  if (!testInfo.project.name.endsWith("-mobile")) {
    await page.goto("/schedule");
    await expect(page.getByLabel("Current time 09:17")).toBeVisible();
  }
});

test("recovers unknown deep links without remembering a redirect loop", async ({ page }) => {
  await page.goto("/not-a-classbud-route");
  const expected = "/today";
  await expect(page).toHaveURL(new RegExp(`${expected}$`));
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(new RegExp(`${expected}$`));
  const lastRoute = await page.evaluate(() => JSON.parse(localStorage.getItem("classbud:state:v2") ?? "{}").settings?.lastRoute);
  expect(Object.values(lastRoute ?? {})).not.toContain("/not-a-classbud-route");
});

test("meets automated accessibility gate", async ({ page }) => {
  await page.goto("/schedule");
  for (const route of ["/schedule", "/settings"] as const) {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious, `${route} accessibility violations`).toEqual([]);
  }
  await page.goto("/tasks");
  await page.getByRole("button", { name: "New task" }).click();
  const dialogResults = await new AxeBuilder({ page }).analyze();
  expect(dialogResults.violations.filter(({ impact }) => impact === "serious" || impact === "critical"))
    .toEqual([]);
});

test("ships version, manifest, and service worker", async ({ page, request }) => {
  const version = await request.get("/version.json");
  expect(version.ok()).toBeTruthy();
  await expect(version.json()).resolves.toMatchObject({
    name: "ClassBud",
    version: "2.0.0",
    scheduleVersion: "m5-im-s1-2569",
  });

  await page.goto("/settings");
  await expect(page.getByText("2.0.0", { exact: true })).toBeVisible();
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBeTruthy();
  const manifest = await request.get(manifestHref!);
  expect(manifest.ok()).toBeTruthy();
  const serviceWorker = await request.get("/sw.js");
  expect(serviceWorker.ok()).toBeTruthy();
});

test("cross-tab route state settles without revision ping-pong", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  await page.goto("/schedule");
  const second = await context.newPage();
  await second.goto("/tasks");
  await second.waitForTimeout(700);
  const revisionBefore = await second.evaluate(() =>
    JSON.parse(localStorage.getItem("classbud:state:v2") ?? "{}").revision,
  );
  await second.waitForTimeout(900);
  const revisionAfter = await second.evaluate(() =>
    JSON.parse(localStorage.getItem("classbud:state:v2") ?? "{}").revision,
  );
  expect(revisionAfter).toBe(revisionBefore);
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(second).toHaveURL(/\/tasks$/);
  await second.close();
});

test("Bangkok calendar stays correct in a foreign browser timezone", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4173",
    timezoneId: "America/Los_Angeles",
    viewport: { width: 1536, height: 1024 },
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date("2026-07-15T02:17:00.000Z"));
  await page.goto("/schedule");
  await page.getByRole("button", { name: "Week" }).click();
  await expect(page.locator(".date-stepper strong")).toHaveText(/Week of Mon.*13 Jul/);
  await page.getByRole("button", { name: "Month" }).click();
  await expect(page.getByRole("button", { name: /Monday 29 June, 0 classes/ })).toBeVisible();
  await context.close();
});

test("installed Chromium app reloads a deep link offline", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  await page.goto("/schedule");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.goto("/schedule");
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
  await context.setOffline(false);
});
