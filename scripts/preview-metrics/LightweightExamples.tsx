import React from "react";
import { Card } from "../../easy-ui-react/src/Card";
import { BarList } from "../../easy-ui-react/src/BarList";
import { BulletChart } from "../../easy-ui-react/src/BulletChart";
import { ShippingOverview } from "../../easy-ui-react/src/MetricCard/MetricCard.stories";
import { Default as Volume } from "../../easy-ui-react/src/BarList/BarList.stories";
import {
  Default as OnTime,
  CostTarget,
} from "../../easy-ui-react/src/BulletChart/BulletChart.stories";

const Overview = ShippingOverview.render as React.ComponentType;

export function LightweightExamples() {
  return (
    <section aria-label="Lightweight chart examples">
      <h1>Everyday metrics</h1>
      <p className="note">
        Synthetic shipping data · Exact metrics, category comparisons, and
        targets · No chart engine
      </p>
      <section aria-label="Shipping overview example">
        <Overview />
      </section>
      <div className="comparison-grid lightweight-comparisons">
        <Card
          as="section"
          aria-label="Service mix"
          background="primary"
          padding="3"
        >
          <div className="example-content">
            <h2>Service mix</h2>
            <p className="panel-note">June volume · One shared scale</p>
            <BarList
              {...Volume.args}
              label="June parcel volume by service"
              data={Volume.args!.data!}
            />
          </div>
        </Card>
        <Card
          as="section"
          aria-label="Performance against targets"
          background="primary"
          padding="3"
        >
          <div className="example-content">
            <h2>Performance against targets</h2>
            <p className="panel-note">
              Explicit scales · Direction has no implied sentiment
            </p>
            <div className="target-stack">
              <BulletChart
                {...OnTime.args}
                label="On-time delivery"
                value={97.8}
                target={97}
                max={100}
              />
              <BulletChart
                {...CostTarget.args}
                label="Average rated cost"
                value={5.2}
                target={5.5}
                max={8}
              />
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
