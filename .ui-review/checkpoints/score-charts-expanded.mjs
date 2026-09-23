export default async function ({ page }) {
  await page.locator('[data-score-id="ratio"] button').click();
  await page.locator('[data-score-id="international"] button').click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(
        '[data-score-chart] [data-chart-state="ready"] svg',
      ).length === 2,
  );
}
