export default async function ({ page }) {
  await page.locator("#dark-theme").check();
}
