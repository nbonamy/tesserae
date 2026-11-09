// weather_hourly, Spectra chart archetype. Temperature curve with a
// vertical warm-to-cool gradient line + filled area, rain-probability
// bars stacked behind on a right axis, and night-hour bands shaded in
// the chart background so the eye reads "evening is coming" at a
// glance. Hour count culls with cell width: 24 at lg, 18 at md, 12 at
// sm, 6 at xs. Axis labels grow so the time strip stays legible from
// across a room.

import { tokens } from "../../static/spectra-chart.js";

const PH_BY_NAME = {
  sun: "ph-sun",
  moon: "ph-moon",
  cloud: "ph-cloud",
  partly: "ph-cloud-sun",
  "partly-night": "ph-cloud-moon",
  drizzle: "ph-drop",
  rain: "ph-cloud-rain",
  "rain-heavy": "ph-cloud-rain",
  showers: "ph-cloud-rain",
  snow: "ph-snowflake",
  storm: "ph-cloud-lightning",
  fog: "ph-cloud-fog",
};

const COND_ACCENT = {
  sun: "var(--accent-2)",
  moon: "var(--text-secondary)",
  cloud: "var(--accent-5)",
  partly: "var(--accent-2)",
  "partly-night": "var(--text-secondary)",
  drizzle: "var(--accent-4)",
  rain: "var(--accent-4)",
  "rain-heavy": "var(--accent-4)",
  showers: "var(--accent-4)",
  snow: "var(--accent-5)",
  storm: "var(--accent-1)",
  fog: "var(--text-muted)",
};

// Semantic icon name → strings/<locale>.json key for the icon strip's
// tooltip (title attr). server.py's _icon_name() only exposes the
// coarse icon name in the structured hoursArr (not the WMO code), so
// this is icon-grained rather than per-code like weather_now's
// COND_KEY_BY_CODE — sun/moon share "Clear", partly/partly-night share
// "Partly cloudy". Same vocabulary as weather_now for consistency.
const ICON_COND_KEY = {
  sun: "cond_clear",
  moon: "cond_clear",
  cloud: "cond_overcast",
  partly: "cond_partly_cloudy",
  "partly-night": "cond_partly_cloudy",
  drizzle: "cond_drizzle",
  rain: "cond_rain",
  "rain-heavy": "cond_rain_heavy",
  showers: "cond_showers",
  snow: "cond_snow",
  storm: "cond_thunderstorm",
  fog: "cond_fog",
};

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fmtTemp(v) {
  if (v == null) return "-";
  return Math.round(Number(v)) + "°";
}

// Hex / rgb / rgba color string → rgba with new alpha. Same logic
// spectra-chart.js uses internally, inlined here so we don't depend on
// it for the mixed-chart path.
function withAlpha(color, alpha) {
  if (typeof color !== "string") return color;
  if (color.startsWith("#") && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    if (!Number.isNaN(r)) return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const m = color.match(
    /^\s*rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/
  );
  if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
  return color;
}

// 6–18 = day, 18–06 = night. Open-Meteo doesn't ship a per-hour is_day
// flag in the hourly endpoint, so we approximate from the hour label
// rather than over-fetching for sunrise/sunset.
function isNightHour(hourStr) {
  const h = parseInt(hourStr, 10);
  if (!Number.isFinite(h)) return false;
  return h >= 18 || h < 6;
}

// Pick how many of the available 24 hours actually paint, based on the
// cell's measured width. xs / sm cells with the full 24-slot strip end
// up with icons compressed into illegible 5px slivers, capping the
// count keeps each tick + icon at a readable scale.
function maxHoursForWidth(w) {
  if (w <= 280) return 6;
  if (w <= 440) return 12;
  if (w <= 699) return 18;
  return 24;
}

// Custom Chart.js plugin: shade night-hour spans with a faint tint in
// the chart background before the datasets paint. The boolean nightFlags
// array (one per category) runs through; spans of true are merged into a
// single rect so adjacent night hours don't show a seam at the band
// boundary.
function nightBandsPlugin(nightFlags, color) {
  return {
    id: "tsr-night-bands",
    beforeDatasetsDraw(chart) {
      if (!Array.isArray(nightFlags) || nightFlags.length === 0) return;
      const x = chart.scales?.x;
      const area = chart.chartArea;
      if (!x || !area) return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.fillStyle = color;
      // Compute the half-step pixel spacing so each category fills the
      // full slot, not just its centre tick, otherwise the band would
      // leave a thin gap between hours.
      const stepHalf = (() => {
        if (nightFlags.length < 2) return (area.right - area.left) / 2;
        return Math.abs(x.getPixelForValue(1) - x.getPixelForValue(0)) / 2;
      })();
      let bandStart = null;
      for (let i = 0; i <= nightFlags.length; i++) {
        const isNight = i < nightFlags.length && nightFlags[i];
        if (isNight && bandStart === null) bandStart = i;
        if ((!isNight || i === nightFlags.length) && bandStart !== null) {
          // Clamp to the chart's plot area so the band never spills
          // into the axis gutter on either side (which would draw a
          // strip past the last tick, especially noticeable when the
          // final hour is a night hour).
          const x1 = Math.max(area.left, x.getPixelForValue(bandStart) - stepHalf);
          const x2 = Math.min(area.right, x.getPixelForValue(i - 1) + stepHalf);
          if (x2 > x1) {
            ctx.fillRect(x1, area.top, x2 - x1, area.bottom - area.top);
          }
          bandStart = null;
        }
      }
      ctx.restore();
    },
  };
}

export default function render(shadow, ctx) {
  const data = ctx?.data ?? {};
  const t = ctx?.t || ((key, fallback) => fallback ?? key);
  const css = `<link rel="stylesheet" href="/static/style/spectra-widgets.css">`;

  if (data.error) {
    shadow.innerHTML = `
      ${css}
      <div class="w" data-widget="weather_hourly">
        <div class="w-title"><i class="ph-bold ph-warning-circle"></i><h3>${escapeHtml(t("hourly", "Hourly"))}</h3></div>
        <div class="w-body"><p class="u-muted">${escapeHtml(data.error)}</p></div>
      </div>`;
    return;
  }

  const label = data.place || data.label || "";

  const hoursArr = Array.isArray(data.hoursArr) ? data.hoursArr : [];
  const tempsArr = Array.isArray(data.temps) ? data.temps : [];
  const rainArr = Array.isArray(data.rain) ? data.rain : [];
  const points = Array.isArray(data.points) ? data.points : [];

  let allLabels = [];
  let allValues = [];
  let allIcons = [];
  let allRain = [];
  if (hoursArr.length && tempsArr.length) {
    const n = Math.min(hoursArr.length, tempsArr.length);
    allLabels = hoursArr.slice(0, n).map((h) => h.t || "");
    allIcons = hoursArr.slice(0, n).map((h) => h.icon || "");
    allValues = tempsArr.slice(0, n).map((v) => Number(v));
    allRain = rainArr.slice(0, n).map((v) => Number(v) || 0);
  } else if (points.length) {
    allLabels = points.map((h) => h.hour ?? "");
    allIcons = points.map(() => "");
    allValues = points.map((h) => {
      const v = Number(h.temp);
      return Number.isNaN(v) ? 0 : v;
    });
    allRain = points.map((h) => {
      const v = Number(h.rain);
      return Number.isFinite(v) ? v : 0;
    });
  }

  // Cell width drives the hour cull. shadow.host is .cell-content
  // (transform-scaled), but clientWidth reads the layout dimension
  // pre-scale so we get the virtual cell width, the same number the
  // container query breakpoints fire against.
  const cellWidth = shadow.host?.clientWidth || 600;
  const maxHrs = maxHoursForWidth(cellWidth * 0.75);

  const labels = allLabels.slice(0, maxHrs);
  const values = allValues.slice(0, maxHrs);
  const icons = allIcons.slice(0, maxHrs);
  const rainValues = allRain.slice(0, maxHrs);
  const nightFlags = labels.map(isNightHour);
  const hasData = values.length >= 2;
  const hasRain = rainValues.some((v) => v > 0);

  // Icon strip, drop on xs (too cramped), keep elsewhere. Now hour
  // is the first slot; flag it with accent-1 so the eye lands on "now".
  const showIconStrip = cellWidth > 280 && icons.length > 0;
  const iconStrip = showIconStrip
    ? `
      <div class="hr-icons" style="grid-template-columns:repeat(${icons.length}, 1fr)">
        ${icons.map((name, i) => {
          if (!name) return `<span></span>`;
          const ph = PH_BY_NAME[name] || "ph-cloud";
          const accent = COND_ACCENT[name] || "var(--text-secondary)";
          const isNow = i === 0;
          const condKey = ICON_COND_KEY[name];
          const condLabel = condKey ? t(condKey, name) : name;
          return `<i class="ph-bold ${ph}" style="color:${isNow ? "var(--accent-1)" : accent}" title="${escapeHtml(condLabel)}"></i>`;
        }).join("")}
      </div>`
    : "";

  const dailyRain = Number.isFinite(data.daily_rain_probability)
    ? `${Math.round(data.daily_rain_probability)}%`
    : "—";
  const legend = `
      <div class="hr-legend">
        <span class="hr-key"><span class="dot dot--rain"></span>${escapeHtml(t("cond_rain", "Rain"))} ${dailyRain}</span>
      </div>`;

  const sunEvent = (rising, value) => {
    const label = rising ? t("sunrise", "Sunrise") : t("sunset", "Sunset");
    const time = value || "—";
    const arrow = rising ? "M27 20V5m-3 3 3-3 3 3" : "M27 5v15m-3-3 3 3 3-3";
    return `<span class="hr-sun-event" aria-label="${escapeHtml(`${label} ${time}`)}">
      <svg class="hr-sun-icon" viewBox="0 0 32 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M2 19h19M5 16a7 7 0 0 1 14 0M12 5V2M5 8 3 6m16 2 2-2"/><path d="${arrow}"/>
      </svg><span>${escapeHtml(time)}</span></span>`;
  };
  const sunTimes = `<div class="hr-sun-times">${sunEvent(true, data.sunrise)}${sunEvent(false, data.sunset)}</div>`;

  // Inline layout. Container queries scope behavior to cell size; the
  // axis label cap clamps off cqmin so a wide cell really does paint
  // legible 18-24px tick numbers (the old fixed 10px was the user
  // complaint: unreadable from a distance).
  const layout = `
    .hr-body { gap: var(--space-2); }
    .hr-split { display: flex; flex: 1 1 auto; min-height: 0; gap: 1.5em; }
    .hr-forecast { display: flex; flex-direction: column; flex: 1 1 75%; min-width: 0; min-height: 0; gap: var(--space-2); }
    .hr-details { flex: 0 0 22%; min-width: 0; border-left: 2px solid var(--text-primary); padding-left: 1em; display: flex; flex-direction: column; justify-content: space-between; gap: var(--space-2); text-align: center; }
    .hr-temperatures { display: grid; gap: var(--space-3); }
    .hr-temperature { display: flex; flex-direction: column; gap: var(--space-1); }
    .hr-temperature-label { font-size: var(--fs-caption); font-weight: var(--fw-bold); text-transform: uppercase; }
    .hr-temperature-value { font-size: clamp(1.8em, 12cqmin, 3.5em); font-weight: var(--fw-bold); line-height: 1; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .hr-wind { display: flex; flex-direction: column; align-items: center; gap: 0; border-top: 2px solid var(--text-primary); padding-top: calc(var(--space-1) + .3em); line-height: 1.1; }
    .hr-wind-title { font-size: .85em; font-weight: var(--fw-bold); }
    .hr-wind-bearing { display: flex; align-items: center; gap: var(--space-1); }
    .hr-wind-arrow { font-size: clamp(1.25em, 6cqmin, 1.75em); line-height: 1; }
    .hr-wind-direction { font-size: clamp(1em, 4cqmin, 1.25em); font-weight: var(--fw-bold); }
    .hr-wind-speed { font-size: clamp(1em, 4cqmin, 1.35em); font-weight: var(--fw-bold); white-space: nowrap; }
    .hr-icons {
      display: grid;
      justify-items: center;
      align-items: center;
      gap: var(--space-1);
      font-size: clamp(0.9em, 4cqmin, 1.8em);
      line-height: 1;
      flex: 0 0 auto;
    }
    .hr-chart {
      flex: 1 1 auto;
      min-height: 0;
      position: relative;
    }
    .hr-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2); flex: 0 0 auto; }
    .hr-sun-times { display: flex; align-items: center; gap: var(--space-2); margin-left: auto; }
    .hr-sun-event { display: inline-flex; align-items: center; gap: .3em; font-size: var(--fs-caption); font-weight: var(--fw-bold); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .hr-sun-icon { width: 1.6em; height: 1.2em; flex: none; }
    .hr-legend {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3) var(--space-4);
      align-items: center;
      flex: 0 0 auto;
    }
    .hr-key {
      display: inline-flex;
      align-items: center;
      gap: 0.4em;
      font-size: var(--fs-caption);
      font-weight: var(--fw-bold);
      color: var(--text-secondary);
      letter-spacing: var(--ls-label);
    }
    .hr-key .dot {
      width: 0.7em;
      height: 0.7em;
      border-radius: 0;
    }
    .hr-key .dot--rain { background: var(--accent-4); }
    /* Keep the current reading beside the location; the forecast
       range leads the details column. */
    .hr-range {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--fs-label);
      font-weight: var(--fw-bold);
      letter-spacing: var(--ls-label);
      color: var(--text-muted);
    }
    .hr-range .hi { color: var(--accent-1); }
    .hr-range .lo { color: var(--accent-5); }
    .hr-range .sep { color: var(--text-muted); opacity: 0.5; }
    @container (max-width: 280px) {
      .hr-range { display: none; }
    }
  `;

  const hi = data.hi ?? data.max;
  const lo = data.lo ?? data.min;
  const now = data.now ?? data.current;
  const rangeChip = (hi != null || lo != null || now != null)
    ? `
      <span class="hr-range">
        ${now != null ? `<span class="now">${escapeHtml(fmtTemp(now))} ${escapeHtml(t("now_suffix", "NOW"))}</span>` : ""}
        ${data.feels_like != null ? `<span class="sep">·</span><span class="feels-like">${escapeHtml(t("feels_like", "FEELS LIKE"))} ${escapeHtml(fmtTemp(data.feels_like))}</span>` : ""}
      </span>`
    : "";

  // Fragments (issue #60): place one part on the Panels canvas. "summary"
  // returns early; "chart" falls through to the Chart.js init below so the
  // canvas still gets its chart.
  const frag = ctx?.fragment || "full";
  const direction = Number(data.wind_direction);
  const hasWindDirection = data.wind_direction != null && Number.isFinite(direction);
  const compass = hasWindDirection ? ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(((direction % 360) + 360) % 360 / 45) % 8] : "—";
  const windSpeed = data.wind_speed != null && Number.isFinite(Number(data.wind_speed)) ? Math.round(Number(data.wind_speed)) : "—";
  if (frag === "summary") {
    shadow.innerHTML = `
      ${css}
      <style>.w-body{height:100%;display:flex;align-items:center;justify-content:center}.hr-sum{display:flex;align-items:baseline;gap:var(--space-2);font-weight:var(--fw-bold)}.hr-sum .now{font-size:clamp(2em,26cqmin,6em)}.hr-sum .hi{color:var(--accent-1)}.hr-sum .lo{color:var(--accent-5)}.hr-sum .sep{color:var(--text-muted);opacity:.5}</style>
      <div class="w" data-widget="weather_hourly"><div class="w-body"><span class="hr-sum">
        ${now != null ? `<span class="now">${escapeHtml(fmtTemp(now))}</span>` : ""}
        ${hi != null && lo != null ? `<span class="sep">·</span><span class="hi">${escapeHtml(fmtTemp(hi))}</span><span class="sep">/</span><span class="lo">${escapeHtml(fmtTemp(lo))}</span>` : ""}
      </span></div></div>`;
    return;
  }
  if (frag === "chart") {
    shadow.innerHTML = `
      ${css}
      <style>${layout}.hr-body{padding:var(--space-2)}.hr-chart{flex:1;min-height:0;height:100%;position:relative}</style>
      <div class="w" data-widget="weather_hourly"><div class="w-body hr-body">
        <div class="hr-chart">${hasData ? '<canvas></canvas>' : `<p class="u-muted">${escapeHtml(t("no_hourly_data", "No hourly data."))}</p>`}</div>
      </div></div>`;
  } else {
    shadow.innerHTML = `
      ${css}
      <style>${layout}</style>
      <div class="w" data-widget="weather_hourly">
        <div class="w-title">
          <i class="ph-bold ph-clock" style="color:var(--accent-4)"></i>
          <h3>${escapeHtml(label || t("hourly", "Hourly"))}</h3>
          ${rangeChip}
        </div>
        <div class="w-body hr-body">
          <div class="hr-split">
            <div class="hr-forecast">
              ${iconStrip}
              <div class="hr-chart">
                ${hasData ? '<canvas></canvas>' : `<p class="u-muted">${escapeHtml(t("no_hourly_data", "No hourly data."))}</p>`}
              </div>
              <div class="hr-footer">${legend}${sunTimes}</div>
            </div>
            <div class="hr-details">
              <div class="hr-temperatures">
                <div class="hr-temperature">
                  <span class="hr-temperature-label">Low</span>
                  <span class="hr-temperature-value">${lo != null ? escapeHtml(fmtTemp(lo)) : "—"}</span>
                </div>
                <div class="hr-temperature">
                  <span class="hr-temperature-label">High</span>
                  <span class="hr-temperature-value">${hi != null ? escapeHtml(fmtTemp(hi)) : "—"}</span>
                </div>
              </div>
              <div class="hr-wind">
                <div class="hr-wind-title">Wind</div>
                <div class="hr-wind-bearing">
                  <i class="ph-bold ph-arrow-up hr-wind-arrow" style="transform:rotate(${hasWindDirection ? direction + 180 : 0}deg)"></i>
                  <span class="hr-wind-direction">${compass}</span>
                </div>
                <div class="hr-wind-speed">${windSpeed} ${data.units === "imperial" ? "mph" : "km/h"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  if (!hasData) return;
  const canvas = shadow.querySelector("canvas");
  if (!canvas || !window.Chart) return;
  const tok = tokens(shadow.host);

  // Warm-to-cool vertical gradient for both the line stroke and the
  // area fill. The gradient mirrors actual temperature intuition: the
  // top of the chart is warmer / terracotta, the bottom is cooler /
  // slate. Function-form colours run after layout so chartArea is
  // populated. Falls back to a flat accent when the area isn't ready
  // yet (first paint races).
  function tempGradient(alpha) {
    return (ctxArg) => {
      const chart = ctxArg.chart;
      const area = chart.chartArea;
      if (!area) return withAlpha(tok.accent1, alpha);
      const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
      g.addColorStop(0, withAlpha(tok.accent1, alpha));
      g.addColorStop(0.55, withAlpha(tok.accent2, alpha));
      g.addColorStop(1, withAlpha(tok.accent5, alpha));
      return g;
    };
  }

  const datasets = [];
  if (hasRain) {
    datasets.push({
      type: "bar",
      label: "Rain",
      data: rainValues,
      backgroundColor: withAlpha(tok.accent4, 0.35),
      borderWidth: 0,
      borderRadius: 0,
      categoryPercentage: 0.95,
      barPercentage: 0.9,
      yAxisID: "yRain",
      order: 2,
    });
  }
  datasets.push({
    type: "line",
    label: "Temp",
    data: values,
    borderColor: tempGradient(1),
    backgroundColor: tempGradient(0.22),
    borderWidth: 3,
    tension: 0.3,
    pointRadius: 0,
    fill: "origin",
    yAxisID: "yTemp",
    order: 1,
  });

  // Highlight the current hour with an accent-1 dot so it doesn't get
  // lost in the gradient. Larger radius for the now slot, zero for
  // every other point (matches existing widget behaviour).
  datasets[datasets.length - 1].pointRadius = values.map((_, i) => (i === 0 ? 5 : 0));
  datasets[datasets.length - 1].pointBackgroundColor = values.map((_, i) =>
    i === 0 ? tok.accent1 : "transparent"
  );
  datasets[datasets.length - 1].pointBorderColor = values.map((_, i) =>
    i === 0 ? tok.accent1 : "transparent"
  );

  // Axis tick size, clamp against cqmin so wide cells get legible 16-
  // 22px numbers, while cramped xs cells fall back to 10px without
  // overflowing the chart. The base spectra-chart helpers use a flat
  // size 10 which the user called out as unreadable.
  const cqBase = Math.max(8, Math.min(28, Math.round(cellWidth / 60)));
  const tickFontSize = Math.max(10, Math.min(20, cqBase));

  const tempSpan = Math.max(0.1, Math.max(...values) - Math.min(...values));
  const chart = new window.Chart(canvas, {
    type: "bar",
    data: { labels, datasets },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            color: tok.textSecondary,
            font: { family: tok.fontFamily, weight: 700, size: tickFontSize },
            autoSkip: true,
            maxRotation: 0,
            autoSkipPadding: 8,
          },
          grid: { display: false },
          border: { display: false },
        },
        yTemp: {
          position: "left",
          display: false,
          beginAtZero: false,
          suggestedMin: Math.min(...values) - tempSpan * 0.18,
          suggestedMax: Math.max(...values) + tempSpan * 0.05,
          grid: { display: false },
          border: { display: false },
        },
        yRain: {
          position: "right",
          display: false,
          min: 0,
          max: 100,
          grid: { display: false },
          border: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    },
    plugins: [
      nightBandsPlugin(nightFlags, withAlpha(tok.textPrimary, 0.07)),
    ],
  });
  canvas._chart = chart;
}
