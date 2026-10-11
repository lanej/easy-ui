
// Measure glyph ranges: textContent and CSS direction alone miss reordered
// Arabic-Indic operands. These assertions inspect the actual rendered order.
async function assertNumericOrder(page, name) {
  const expressions = await page.locator(
    "[data-proportion-counts], [data-risk-score-expression]",
  ).evaluateAll((groups) => groups.map((group) => {
    const walker = document.createTreeWalker(group, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node, offset = 0;
    while ((node = walker.nextNode())) {
      nodes.push({ node, start: offset, end: offset + node.length });
      offset += node.length;
    }
    const text = group.textContent;
    const slash = text.indexOf("/");
    const box = (start, end) => {
      const first = nodes.find((entry) => entry.end > start);
      const last = nodes.find((entry) => entry.end >= end);
      const range = document.createRange();
      range.setStart(first.node, start - first.start);
      range.setEnd(last.node, end - last.start);
      const { left, right, top, bottom } = range.getBoundingClientRect();
      return { left, right, top, bottom };
    };
    return {
      text,
      numerator: box(0, slash),
      slash: box(slash, slash + 1),
      denominator: box(slash + 1, text.length),
    };
  }));
  for (const expression of expressions) {
    assert.ok(expression.numerator.right <= expression.slash.left + 1, `${name}: numerator before slash (${expression.text})`);
    assert.ok(expression.slash.right <= expression.denominator.left + 1, `${name}: denominator after slash (${expression.text})`);
  }
  return expressions;
}

async function checkCompactRisk({ page, base, output, checks, accessibility }) {
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme, forcedColors: "none", media: "screen" });
    for (const width of [1040, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const name = `risk-compact-${theme}-${width}`;
      await page.goto(`${base}/iframe.html?id=components-riskscore--compact-assessments&viewMode=story&globals=colorScheme:${theme}`);
      await page.getByRole("meter").first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const scores = await page.locator('[role="meter"][data-size="sm"]').evaluateAll((meters) => {
        const expectedTokens = { low: "positive-800", medium: "warning-800", high: "negative-800", unassessed: "neutral-900" };
        const rgb = (color) => (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const luminance = (color) => rgb(color).map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);
        return meters.map((meter) => {
          const value = meter.querySelector("[data-risk-score-value]").firstElementChild;
          const expression = meter.querySelector("[data-risk-score-expression]");
          const maximum = expression.lastElementChild.firstElementChild;
          const probe = document.createElement("span");
          meter.append(probe);
          probe.style.color = `var(--ezui-color-${expectedTokens[meter.dataset.assessment]})`;
          const expected = getComputedStyle(probe).color;
          probe.style.color = "var(--ezui-color-neutral-600)";
          const neutral = getComputedStyle(probe).color;
          probe.remove();
          let ancestor = meter, background = "rgba(0, 0, 0, 0)";
          while (ancestor && background === "rgba(0, 0, 0, 0)") {
            background = getComputedStyle(ancestor).backgroundColor;
            ancestor = ancestor.parentElement;
          }
          if (background === "rgba(0, 0, 0, 0)") background = "rgb(255, 255, 255)";
          const color = getComputedStyle(value).color;
          const high = Math.max(luminance(color), luminance(background));
          const low = Math.min(luminance(color), luminance(background));
          const label = meter.querySelector("[data-risk-score-compact-label]");
          return { color, expected, maximum: getComputedStyle(maximum).color, neutral,
            contrast: (high + 0.05) / (low + 0.05), title: meter.title,
            description: meter.getAttribute("aria-valuetext"),
            hiddenLabel: getComputedStyle(label).display === "none",
            pillCount: meter.querySelectorAll('[class*="_pill_"]').length,
          };
        });
      });
      assert.equal(scores.length, 8);
      for (const score of scores) {
        assert.equal(score.color, score.expected, `${name}: supplied assessment color`);
        assert.equal(score.maximum, score.neutral, `${name}: neutral scale`);
        assert.ok(score.contrast >= 4.5, `${name}: score text contrast ${score.contrast}`);
        assert.equal(score.pillCount, 0, `${name}: no compact pill`);
        assert.equal(score.hiddenLabel, true);
        assert.ok(score.description.includes(score.title), `${name}: accessible assessment`);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: overflow`);
      await accessibility(name);
      const expressions = await assertNumericOrder(page, name);
      await page.locator("#storybook-root").screenshot({ path: resolve(output, `${name}.png`) });
      checks.push({ name, scores, expressions });
    }
  }
  for (const mode of ["forced-colors", "print"]) {
    await page.emulateMedia({ forcedColors: mode === "forced-colors" ? "active" : "none", media: mode === "print" ? "print" : "screen" });
    const labels = page.locator("[data-risk-score-compact-label]");
    assert.equal(await labels.count(), 8);
    for (const label of await labels.all()) assert.equal(await label.isVisible(), true, `${mode}: text assessment fallback`);
    await page.locator("#storybook-root").screenshot({ path: resolve(output, `risk-compact-${mode}.png`) });
    checks.push({ name: `risk-compact-${mode}`, visibleAssessments: 8 });
  }
  await page.emulateMedia({ forcedColors: "none", media: "screen" });
}
