import tokens from "@easypost/easy-ui-tokens/js/tokens";
import { init, setPlatformAPI } from "echarts";
import { themedOption } from "../Chart/theme";
import { visualizationColors } from "../visualization/colors";
import { flowChart, hubs, pressureChart } from "./NetworkGuide.fixtures";

setPlatformAPI({ measureText: (text) => ({ width: text.length * 8 }) });

it.each(["flow", "pressure"])(
  "resolves %s labels from the rendered dark theme, including system mode",
  (kind) => {
    const element = document.createElement("div");
    element.style.setProperty(
      "--ezui-color-neutral-800",
      tokens["theme.dark.color.neutral.800"],
    );
    element.style.setProperty(
      "--ezui-color-neutral-000",
      tokens["theme.dark.color.neutral.000"],
    );
    document.body.append(element);
    const option =
      kind === "flow" ? flowChart(hubs[1]).option : pressureChart("dtw").option;
    expect(JSON.stringify(option)).toContain(visualizationColors.text);
    const chart = init(null, undefined, {
      renderer: "svg",
      ssr: true,
      width: 820,
      height: 400,
    });
    try {
      chart.setOption(themedOption(element, option, false));
      const svg = chart.renderToSVGString();
      expect(svg).toContain(`fill="${tokens["theme.dark.color.neutral.800"]}"`);
      expect(svg).toContain(kind === "flow" ? "Economy" : "130%");
    } finally {
      chart.dispose();
      element.remove();
    }
  },
);
