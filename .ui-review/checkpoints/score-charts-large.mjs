export default async function ({ page }) {
  await page.locator('[data-score-id="ratio"] button').click();
  await page.locator('[data-score-id="international"] button').click();
  await page.locator("#large-text").check();
  for (const summary of await page.locator("[data-score-chart] summary").all())
    await summary.click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(
        '[data-score-chart] [data-chart-state="ready"] svg',
      ).length === 2,
  );
}
