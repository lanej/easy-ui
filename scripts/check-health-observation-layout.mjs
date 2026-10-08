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
      if (plot) {
        const bounds = plot.getBoundingClientRect();
        const ticks = plot.querySelectorAll('[class*="yAxis"] span');
        ticks.forEach((tick, index) => {
          const label = tick.getBoundingClientRect();
          const expected = bounds.top + (bounds.height * index) / 2;
          if (
            Math.abs((label.top + label.bottom) / 2 - expected) > 1 ||
            label.right > bounds.left - 4
          )
            throw new Error(`${name}: vertical axis tick is misplaced`);
        });
      }
      const footer = details || primary;
      const rightBottom = footer.getBoundingClientRect().bottom;
      const topDelta =
        textBounds(information.firstElementChild).top - textBounds(primary).top;
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
