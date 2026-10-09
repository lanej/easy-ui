/** Run with page.evaluate(checkHealthObservationLayout) on the reference-option stories. */
export function checkHealthObservationLayout() {
  const textBounds = (element, last = false) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const visible = [];
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(walker.currentNode);
      const bounds = range.getBoundingClientRect();
      if (bounds.width && bounds.height) visible.push(bounds);
    }
    if (!visible.length) throw new Error("Expected visible reference text");
    return visible.reduce((edge, bounds) =>
      last
        ? bounds.bottom > edge.bottom
          ? bounds
          : edge
        : bounds.top < edge.top
          ? bounds
          : edge,
    );
  };
  return Array.from(document.querySelectorAll("[data-reference-option]")).map(
    (card) => {
      const name = card.dataset.referenceOption;
      const layout = card.querySelector("[data-has-reference]");
      const [information, primary, details] = layout.children;
      const left = information.getBoundingClientRect();
      if (!primary) return { name, reference: false, height: left.height };
      const right = primary.getBoundingClientRect();
      if (left.left === right.left)
        throw new Error("Use a viewport wide enough for two-column examples");
      const plot = primary.querySelector('[class*="plot"][role="img"]');
      if (card.querySelector('[class*="yTitle"], [class*="yAxis"]'))
        throw new Error(`${name}: unexpected vertical axis`);
      for (const chart of card.querySelectorAll('figure [role="img"]')) {
        const mode = chart.closest("[data-percentiles]").dataset.percentiles;
        const dots = chart.querySelectorAll(
          'svg circle, [class*="histogramPoint"]',
        );
        const isCurve = !!chart.querySelector("svg");
        const expectedDots =
          mode === "none" ? 0 : isCurve || mode === "points" ? 2 : 0;
        if (dots.length !== expectedDots)
          throw new Error(`${name}: incorrect percentile points`);
        const guides = chart.querySelectorAll(
          '[class*="percentile_"], [class*="histogramPercentile_"]',
        );
        const labels = chart.parentElement.querySelectorAll(
          '[class*="percentileLabel"]',
        );
        if (
          labels.length !== (mode === "labeled" ? 2 : 0) ||
          guides.length !== (mode === "labeled" ? 2 : 0)
        )
          throw new Error(`${name}: incorrect percentile labels or guides`);
        for (const label of chart.parentElement.querySelectorAll(
          '[class*="thresholdLabel"]',
        )) {
          const bounds = label.getBoundingClientRect();
          const tick = getComputedStyle(label, "::before");
          const center =
            bounds.left +
            parseFloat(tick.left) +
            new DOMMatrix(tick.transform).m41 +
            parseFloat(tick.width) / 2;
          if (Math.abs(center - (bounds.left + bounds.right) / 2) > 0.1)
            throw new Error(`${name}: threshold tick is not centered`);
        }
        guides.forEach((guide, index) => {
          const bounds = guide.getBoundingClientRect();
          const tick = getComputedStyle(guide, "::after");
          const guideCenter = bounds.left + bounds.width / 2;
          const tickCenter =
            bounds.left +
            parseFloat(getComputedStyle(guide).borderLeftWidth) +
            parseFloat(tick.left) +
            parseFloat(tick.width) / 2;
          const label = labels[index].getBoundingClientRect();
          if (
            !Number.isFinite(tickCenter) ||
            Math.abs(guideCenter - tickCenter) > 0.1 ||
            Math.abs(guideCenter - (label.left + label.right) / 2) > 0.1
          )
            throw new Error(
              `${name}: percentile guide, tick, and label do not share a center`,
            );
        });
      }
      const footer = details || primary;
      const rightBottom = footer.getBoundingClientRect().bottom;
      const header = primary.querySelector(
        '[class*="regionLabels"], figcaption',
      );
      const topDelta = header
        ? textBounds(information.firstElementChild).top - textBounds(header).top
        : plot.getBoundingClientRect().top - right.top;
      const bottomDelta =
        textBounds(information.querySelector("time")).bottom -
        textBounds(
          footer.querySelector("details:not([open]) summary") || footer,
          true,
        ).bottom;
      if (
        Math.abs(left.top - right.top) > 1 ||
        Math.abs(left.bottom - rightBottom) > 1 ||
        Math.abs(topDelta) > 1 ||
        Math.abs(bottomDelta) > 1
      )
        throw new Error(
          `${name}: column or visible text alignment differs by more than 1px (top ${topDelta}, bottom ${bottomDelta})`,
        );
      return {
        name,
        reference: true,
        leftHeight: left.height,
        rightHeight: rightBottom - right.top,
        topDelta,
        bottomDelta,
      };
    },
  );
}
