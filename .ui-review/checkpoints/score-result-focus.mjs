export default async function ({ page }) {
  await page.locator("#large-text").check();
  await page.locator('[data-score-column="signals"] > div > button').click();
  await page
    .locator('[data-score-column="contributions"] > div > button')
    .click();
}
