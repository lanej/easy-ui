export default async function ({ page }) {
  await page.locator("#large-text").check();
  await page
    .getByRole("button", { name: "Explanation: Underdeclaration", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Explanation: NDA / International",
      exact: true,
    })
    .click();
}
