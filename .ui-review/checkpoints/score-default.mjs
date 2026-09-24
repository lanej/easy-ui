export default async function ({ page }) {
  await page
    .locator("[data-score-node=contribution] [role=meter]")
    .first()
    .waitFor();
}
