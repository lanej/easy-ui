import React, { useEffect, useId, useRef, useState } from "react";

import styles from "./PriceRangeSlider.module.scss";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatCurrencyPrecise = (price: number) =>
  currencyFormatter.format(price);

export interface PriceRatioRange {
  minRatio: number;
  maxRatio: number;
}

export interface PriceRangeSliderProps {
  basePriceUsd: number;
  range: PriceRatioRange;
  onRangeChange: (range: PriceRatioRange) => void;
  resetKey?: number;
}

type Bound = "min" | "max";
type FieldState = Partial<Record<Bound, string>>;

function fitTrackRange(
  range: PriceRatioRange,
  basePriceUsd: number,
): PriceRatioRange {
  if (!Number.isFinite(basePriceUsd) || basePriceUsd <= 0) {
    return { minRatio: 0, maxRatio: 1 };
  }
  const minimum = range.minRatio * basePriceUsd;
  const maximum = range.maxRatio * basePriceUsd;
  const padding = Math.max((maximum - minimum) / 2, 0.02);
  const floor = Math.max(0, Math.floor((minimum - padding) * 100 + 1e-7) / 100);
  const ceiling = Math.ceil((maximum + padding) * 100 - 1e-7) / 100;
  return { minRatio: floor / basePriceUsd, maxRatio: ceiling / basePriceUsd };
}

export function PriceRangeSlider({
  basePriceUsd: basePrice,
  range,
  onRangeChange,
  resetKey = 0,
}: PriceRangeSliderProps) {
  const basePriceUsd =
    Number.isFinite(basePrice) && basePrice > 0 ? basePrice : 0;
  const id = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const [drafts, setDrafts] = useState<FieldState>({});
  const [errors, setErrors] = useState<FieldState>({});
  const [keyboardRange, setKeyboardRange] = useState<PriceRatioRange | null>(
    null,
  );
  const [previousValue, setPreviousValue] = useState({
    ...range,
    basePriceUsd,
    resetKey,
  });
  const [drag, setDrag] = useState<{
    anchorRatio: number;
    pointerId: number;
    trackRange: PriceRatioRange;
  } | null>(null);
  if (
    previousValue.minRatio !== range.minRatio ||
    previousValue.maxRatio !== range.maxRatio ||
    previousValue.basePriceUsd !== basePriceUsd ||
    previousValue.resetKey !== resetKey
  ) {
    if (
      previousValue.basePriceUsd !== basePriceUsd ||
      previousValue.resetKey !== resetKey
    ) {
      setKeyboardRange(null);
    }
    if (previousValue.basePriceUsd !== basePriceUsd) setDrag(null);
    setPreviousValue({ ...range, basePriceUsd, resetKey });
    setDrafts({});
    setErrors({});
  }
  const priceAvailable = Number.isFinite(basePriceUsd) && basePriceUsd > 0;
  const trackRange =
    drag?.trackRange ?? keyboardRange ?? fitTrackRange(range, basePriceUsd);
  const floorUsd = basePriceUsd * trackRange.minRatio;
  const ceilingUsd = basePriceUsd * trackRange.maxRatio;
  const ratioSpan = trackRange.maxRatio - trackRange.minRatio;
  const minPct = !priceAvailable
    ? 0
    : Math.min(
        100,
        Math.max(0, ((range.minRatio - trackRange.minRatio) / ratioSpan) * 100),
      );
  const maxPct = !priceAvailable
    ? 0
    : Math.min(
        100,
        Math.max(0, ((range.maxRatio - trackRange.minRatio) / ratioSpan) * 100),
      );

  useEffect(() => {
    if (drag === null || !priceAvailable) return;
    const { anchorRatio, pointerId, trackRange: dragRange } = drag;

    function handleMove(event: PointerEvent) {
      if (event.pointerId !== pointerId) return;
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      const fraction = Math.min(
        1,
        Math.max(0, (event.clientX - rect.left) / rect.width),
      );
      const candidateRatio =
        dragRange.minRatio +
        fraction * (dragRange.maxRatio - dragRange.minRatio);
      onRangeChange({
        minRatio: Math.min(candidateRatio, anchorRatio),
        maxRatio: Math.max(candidateRatio, anchorRatio),
      });
    }

    function handleEnd(event: PointerEvent) {
      if (event.pointerId === pointerId) setDrag(null);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
    };
  }, [drag, onRangeChange, priceAvailable]);

  function clearField(bound: Bound) {
    setDrafts((previous) => ({ ...previous, [bound]: undefined }));
    setErrors((previous) => ({ ...previous, [bound]: undefined }));
  }

  function commitField(bound: Bound) {
    const text = drafts[bound];
    if (text === undefined) return;
    const price = Number(text);
    const candidateRatio = price / basePriceUsd;
    if (
      !priceAvailable ||
      text.trim() === "" ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isFinite(candidateRatio)
    ) {
      setErrors((previous) => ({
        ...previous,
        [bound]: "Enter a valid price.",
      }));
      return;
    }
    const oppositeRatio = bound === "min" ? range.maxRatio : range.minRatio;
    const tolerance =
      Number.EPSILON *
      8 *
      Math.max(1, Math.abs(candidateRatio), Math.abs(oppositeRatio));
    const normalizedRatio =
      Math.abs(candidateRatio - oppositeRatio) <= tolerance
        ? oppositeRatio
        : candidateRatio;
    const nextRange = {
      minRatio: bound === "min" ? normalizedRatio : range.minRatio,
      maxRatio: bound === "max" ? normalizedRatio : range.maxRatio,
    };
    if (nextRange.minRatio > nextRange.maxRatio) {
      setErrors((previous) => ({
        ...previous,
        [bound]: "Minimum price cannot exceed maximum price.",
      }));
      return;
    }
    clearField(bound);
    onRangeChange(nextRange);
  }

  function handleFieldKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    bound: Bound,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      clearField(bound);
    }
  }

  function startDrag(
    event: React.PointerEvent<HTMLButtonElement>,
    bound: Bound,
  ) {
    if (!priceAvailable || drag !== null || event.button !== 0) return;
    event.preventDefault();
    setDrafts({});
    setErrors({});
    setKeyboardRange(null);
    setDrag({
      anchorRatio: bound === "min" ? range.maxRatio : range.minRatio,
      pointerId: event.pointerId,
      trackRange,
    });
  }

  function handleSliderKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    bound: Bound,
  ) {
    if (!priceAvailable) return;
    const currentRatio = bound === "min" ? range.minRatio : range.maxRatio;
    let candidateRatio: number;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      candidateRatio = currentRatio - 0.01 / basePriceUsd;
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      candidateRatio = currentRatio + 0.01 / basePriceUsd;
    } else if (event.key === "Home") {
      candidateRatio = trackRange.minRatio;
    } else if (event.key === "End") {
      candidateRatio = trackRange.maxRatio;
    } else {
      return;
    }
    event.preventDefault();
    setKeyboardRange(trackRange);
    setDrafts({});
    setErrors({});
    const visibleCandidate = Math.min(
      trackRange.maxRatio,
      Math.max(trackRange.minRatio, candidateRatio),
    );
    onRangeChange(
      bound === "min"
        ? {
            minRatio: Math.min(visibleCandidate, range.maxRatio),
            maxRatio: range.maxRatio,
          }
        : {
            minRatio: range.minRatio,
            maxRatio: Math.max(visibleCandidate, range.minRatio),
          },
    );
  }

  return (
    <div className={styles.control} data-testid="price-range-control">
      <div className={styles.fields}>
        {(["min", "max"] as const).map((bound) => {
          const label = bound === "min" ? "Minimum price" : "Maximum price";
          const ratio = bound === "min" ? range.minRatio : range.maxRatio;
          const draft = drafts[bound];
          const draftPrice =
            draft === undefined || draft.trim() === "" ? NaN : Number(draft);
          const displayedRatio =
            priceAvailable && Number.isFinite(draftPrice)
              ? draftPrice / basePriceUsd
              : ratio;
          const position =
            !priceAvailable || displayedRatio < 0 || errors[bound]
              ? undefined
              : Math.abs((displayedRatio - 1) * basePriceUsd) < 0.005
                ? "standard"
                : displayedRatio < 1
                  ? "below"
                  : "above";
          return (
            <div className={styles.field} key={bound} data-position={position}>
              <label htmlFor={`${id}-${bound}`} className={styles.label}>
                {label}
              </label>
              <div className={styles.priceEntry} data-invalid={!!errors[bound]}>
                <span aria-hidden="true">$</span>
                <input
                  id={`${id}-${bound}`}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  disabled={!priceAvailable}
                  value={
                    priceAvailable
                      ? (drafts[bound] ?? (ratio * basePriceUsd).toFixed(2))
                      : ""
                  }
                  placeholder={priceAvailable ? undefined : "—"}
                  data-testid={`price-range-${bound}-price-input`}
                  aria-invalid={errors[bound] ? true : undefined}
                  aria-describedby={`${id}-${bound}-share${errors[bound] ? ` ${id}-${bound}-error` : ""}`}
                  onChange={(event) => {
                    setDrafts((previous) => ({
                      ...previous,
                      [bound]: event.target.value,
                    }));
                    setErrors((previous) => ({
                      ...previous,
                      [bound]: undefined,
                    }));
                  }}
                  onBlur={() => commitField(bound)}
                  onKeyDown={(event) => handleFieldKeyDown(event, bound)}
                />
              </div>
              <span
                id={`${id}-${bound}-share`}
                className={styles.standardShare}
                data-testid={`price-range-${bound}-standard-share`}
              >
                <span className={styles.direction} aria-hidden="true">
                  {position === "below" ? "↓" : position === "above" ? "↑" : ""}
                </span>
                <span className={styles.shareText}>
                  {priceAvailable
                    ? `${(displayedRatio * 100).toLocaleString("en-US", {
                        maximumFractionDigits: 1,
                      })}% of standard`
                    : "Unavailable"}
                </span>
              </span>
              {errors[bound] ? (
                <span
                  id={`${id}-${bound}-error`}
                  className={styles.error}
                  role="alert"
                >
                  {errors[bound]}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className={styles.trackArea}>
        <div
          ref={trackRef}
          className={styles.track}
          data-testid="price-range-track"
        >
          <span className={styles.rail} aria-hidden="true" />
          <span
            className={styles.selectedRange}
            aria-hidden="true"
            style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
          />
          {(["min", "max"] as const).map((bound) => {
            const ratio = bound === "min" ? range.minRatio : range.maxRatio;
            return (
              <button
                key={bound}
                type="button"
                role="slider"
                className={styles.handle}
                style={{ left: `${bound === "min" ? minPct : maxPct}%` }}
                disabled={!priceAvailable}
                aria-label={`${bound === "min" ? "Minimum" : "Maximum"} price handle`}
                aria-orientation="horizontal"
                aria-valuemin={
                  bound === "min" ? floorUsd : range.minRatio * basePriceUsd
                }
                aria-valuemax={
                  bound === "min" ? range.maxRatio * basePriceUsd : ceilingUsd
                }
                aria-valuenow={ratio * basePriceUsd}
                aria-valuetext={
                  priceAvailable
                    ? formatCurrencyPrecise(ratio * basePriceUsd)
                    : "Unavailable"
                }
                onPointerDown={(event) => startDrag(event, bound)}
                onKeyDown={(event) => handleSliderKeyDown(event, bound)}
                onBlur={() => setKeyboardRange(null)}
              />
            );
          })}
        </div>
        <div className={styles.endpoints} aria-hidden="true">
          <span>{priceAvailable ? formatCurrencyPrecise(floorUsd) : "—"}</span>
          <span>
            {priceAvailable ? formatCurrencyPrecise(ceilingUsd) : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
