import React from "react";
import { Card } from "../Card";
import { Icon } from "../Icon";
import { MetricContent } from "../MetricCard";
import { Pill } from "../Pill";
import { IconSymbol } from "../types";
import { classNames, getComponentThemeToken } from "../utilities/css";
import styles from "./KpiTile.module.scss";

export type KpiTileMetric = {
  label: string;
  displayValue: string;
  deltaDisplay?: string;
  deltaDirection?: "positive" | "negative" | "neutral";
};

export type KpiTileProps = {
  metric: KpiTileMetric;
  icon: IconSymbol;
  accent?: "blue" | "red" | "green" | "purple";
  compact?: boolean;
  hideUnavailableLabel?: boolean;
  bare?: boolean;
};

const accents = {
  blue: "primary.100",
  red: "negative.100",
  green: "positive.100",
  purple: "secondary.100",
} as const;

export function KpiTile({
  metric,
  icon,
  accent = "blue",
  compact = false,
  hideUnavailableLabel = false,
  bare = false,
}: KpiTileProps) {
  const tone =
    metric.deltaDirection === "positive"
      ? "success"
      : metric.deltaDirection === "negative"
        ? "danger"
        : "neutral";
  const content = (
    <div className={classNames(styles.tile, compact && styles.compact)}>
      <span
        className={styles.iconChip}
        style={getComponentThemeToken(
          "kpi",
          "accent",
          "color",
          accents[accent],
        )}
      >
        <Icon symbol={icon} size="sm" />
      </span>
      <div className={styles.body}>
        <MetricContent
          label={metric.label}
          value={metric.displayValue}
          typography={{ title: 12 }}
          valueSize={compact ? 16 : 24}
        />
        {metric.deltaDisplay ? (
          <Pill tone={tone} size="sm">
            {metric.deltaDisplay}
          </Pill>
        ) : !hideUnavailableLabel ? (
          <Pill size="sm">Point-in-time</Pill>
        ) : null}
      </div>
    </div>
  );
  return bare ? (
    content
  ) : (
    <Card.Container variant="outlined" borderRadius="md">
      <Card.Area padding={compact ? "2" : "3"}>{content}</Card.Area>
    </Card.Container>
  );
}
