from pathlib import Path
import sys
r = Path(sys.argv[1])
def edit(path, old, new):
    p = r / path
    s = p.read_text()
    assert old in s, (path, old)
    p.write_text(s.replace(old, new))

edit('easy-ui-react/src/RiskScore/RiskScore.tsx', 'import { Text, type TextColor } from "../Text";', 'import { Text } from "../Text";')
edit('easy-ui-react/src/RiskScore/RiskScore.tsx', '''const assessmentColors: Record<RiskScoreAssessment | "unassessed", TextColor> = {
  low: "positive.800",
  medium: "warning.800",
  high: "negative.800",
  unassessed: "neutral.900",
};

''', '')
edit('easy-ui-react/src/RiskScore/RiskScore.tsx', 'color={size === "sm" ? assessmentColors[level] : "neutral.900"}', 'color={size === "sm" ? undefined : "neutral.900"}')
edit('easy-ui-react/src/RiskScore/RiskScore.module.scss', '''.root[data-size="sm"] {
  gap: design-token("space.0.5");
}''', '''.root[data-size="sm"] {
  gap: design-token("space.0.5");

  .value {
    color: design-token("color.neutral.900");
  }

  // Use readable, visibly distinct text colors in the inherited color scheme.
  &[data-assessment="low"] .value {
    color: light-dark(
      #{design-token("color.positive.700")},
      #{design-token("color.positive.500")}
    );
  }
  &[data-assessment="medium"] .value {
    color: light-dark(
      #{design-token("color.warning.800")},
      #{design-token("color.warning.500")}
    );
  }
  &[data-assessment="high"] .value {
    color: light-dark(
      #{design-token("color.negative.600")},
      #{design-token("color.negative.500")}
    );
  }
}''')
edit('easy-ui-react/src/RiskScore/RiskScore.compact.test.tsx', '''  ["low", "Low risk", "positive.800"],
  ["medium", "Medium risk", "warning.800"],
  ["high", "High risk", "negative.800"],
  [null, "Not assessed", "neutral.900"],''', '''  ["low", "Low risk"],
  ["medium", "Medium risk"],
  ["high", "High risk"],
  [null, "Not assessed"],''')
edit('easy-ui-react/src/RiskScore/RiskScore.compact.test.tsx', '(assessment, label, color) => {', '(assessment, label) => {')
edit('easy-ui-react/src/RiskScore/RiskScore.compact.test.tsx', '''  expect(screen.getByText("12").style.getPropertyValue("--ezui-c-text-color"))
    .toBe(`var(--ezui-color-${color.replace(".", "-")})`);''', '''  expect(meter).toHaveAttribute("data-assessment", assessment ?? "unassessed");
  // The number inherits the assessment color; browser tests verify both themes.
  expect(screen.getByText("12").style.getPropertyValue("--ezui-c-text-color")).toBe("");''')
edit('scripts/check-meter-bar.mjs', '''        const expectedTokens = { low: "positive-800", medium: "warning-800", high: "negative-800", unassessed: "neutral-900" };''', '''        const darkScheme = getComputedStyle(meters[0]).colorScheme === "dark";
        const expectedTokens = {
          low: darkScheme ? "positive-500" : "positive-700",
          medium: darkScheme ? "warning-500" : "warning-800",
          high: darkScheme ? "negative-500" : "negative-600",
          unassessed: "neutral-900",
        };''')
