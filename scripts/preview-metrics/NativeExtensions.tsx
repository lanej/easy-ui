import React from "react";
import { Card } from "../../easy-ui-react/src/Card";
import { CompactTimeSeries } from "../../easy-ui-react/src/CompactTimeSeries";
import { RangePlot } from "../../easy-ui-react/src/RangePlot";
import { BulletChart } from "../../easy-ui-react/src/BulletChart";
import {
  WarehouseCapacity,
  ForecastCapacity,
} from "../../easy-ui-react/src/BulletChart/BulletChart.stories";
import {
  Comparison,
  StepChanges,
  SharedScales,
} from "../../easy-ui-react/src/CompactTimeSeries/CompactTimeSeries.stories";
import {
  Default as Price,
  TransitWindow,
} from "../../easy-ui-react/src/RangePlot/RangePlot.stories";

const Shared = SharedScales.render as React.ComponentType;
export function NativeExtensions() {
  return (
    <section aria-label="Native chart extensions" className="extension-section">
      <h1>More context, still compact</h1>
      <p className="note">
        Synthetic examples · Time axes, benchmarks, intervals, and observation
        markers
      </p>
      <div className="comparison-grid">
        <div className="capacity-panel">
          <Card background="primary" padding="3">
            <div className="example-content">
              <h2>Capacity at a glance</h2>
              <p className="panel-note">
                Oakland · Daily parcels on a shared 0–13,000 scale · Synthetic
                observed and forecast values
              </p>
              <div className="target-stack">
                <BulletChart
                  {...WarehouseCapacity.args!}
                  label="Oakland · observed Aug 5"
                  value={9700}
                  target={10000}
                  max={13000}
                />
                <BulletChart
                  {...ForecastCapacity.args!}
                  label="Oakland · forecast peak Aug 7"
                  value={11400}
                  target={10000}
                  max={13000}
                />
              </div>
            </div>
          </Card>
        </div>
        <Card background="primary" padding="3">
          <CompactTimeSeries
            {...Comparison.args}
            label="Observed and plan"
            description={Comparison.args!.description!}
            domain={Comparison.args!.domain!}
            series={Comparison.args!.series!}
            formatTime={Comparison.args!.formatTime!}
          />
        </Card>
        <Card background="primary" padding="3">
          <RangePlot
            {...Price.args}
            label="Price position"
            description={Price.args!.description!}
            domain={Price.args!.domain!}
            points={Price.args!.points!}
          />
        </Card>
        <Card background="primary" padding="3">
          <CompactTimeSeries
            {...StepChanges.args}
            label="Published service price"
            description={StepChanges.args!.description!}
            domain={StepChanges.args!.domain!}
            series={StepChanges.args!.series!}
            formatTime={StepChanges.args!.formatTime!}
          />
        </Card>
        <Card background="primary" padding="3">
          <RangePlot
            {...TransitWindow.args}
            label="Arrival percentiles"
            description={TransitWindow.args!.description!}
            domain={TransitWindow.args!.domain!}
            points={TransitWindow.args!.points!}
          />
        </Card>
      </div>
      <Card background="primary" padding="3">
        <div className="extension-panel">
          <h2>Compare regions on shared scales</h2>
          <p className="panel-note">
            Identical date and percentage domains preserve magnitude comparisons
          </p>
          <Shared />
        </div>
      </Card>
    </section>
  );
}
