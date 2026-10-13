// Explicit registry for the 24 non-geographic analytical recipes. This is an application
// preset, not a replacement for the library's unrestricted ECharts option API.
import { init, use as register } from "echarts/core";
import {
  BarChart,
  BoxplotChart,
  CustomChart,
  HeatmapChart,
  LineChart,
  PieChart,
  SankeyChart,
  ScatterChart,
  TreemapChart,
} from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  VisualMapContinuousComponent,
} from "echarts/components";
import { LabelLayout, LegacyGridContainLabel } from "echarts/features";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";

// Match the full entry's installation order. Marker preprocessors affect
// component drawing order where a point and a reference line overlap.
register([
  CanvasRenderer,
  SVGRenderer,
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  TreemapChart,
  SankeyChart,
  BoxplotChart,
  HeatmapChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  MarkPointComponent,
  MarkLineComponent,
  MarkAreaComponent,
  LegendComponent,
  DataZoomComponent,
  VisualMapContinuousComponent,
  LabelLayout,
  LegacyGridContainLabel,
]);

export { init };
