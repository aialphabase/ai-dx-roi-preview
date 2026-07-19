(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  const scenarios = {
    downside: {
      name: "下落先行",
      returns: [-0.8, 1.0, 0.5, 0.3]
    },
    volatile: {
      name: "高変動",
      returns: [3.0, -0.7, 0.4, -0.2]
    },
    extreme: {
      name: "極端値テスト",
      returns: [10.0, -0.8, -0.4, 0.2]
    }
  };

  const defaults = {
    initial: 1000,
    baseRate: 5,
    cryptoRatio: 10,
    rebalance: "annual",
    scenarioKey: "downside"
  };

  const state = {
    pattern: "bridge",
    selectedYear: 0,
    result: null,
    resizeTimer: null
  };

  const byId = (id) => document.getElementById(id);

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function formatMan(value) {
    const rounded = Math.round(value);
    const sign = rounded < 0 ? "-" : "";
    const absolute = Math.abs(rounded);
    if (absolute >= 10000) {
      const oku = Math.floor(absolute / 10000);
      const man = absolute % 10000;
      return man
        ? `${sign}${oku.toLocaleString("ja-JP")}億${man.toLocaleString("ja-JP")}万円`
        : `${sign}${oku.toLocaleString("ja-JP")}億円`;
    }
    return `${sign}${absolute.toLocaleString("ja-JP")}万円`;
  }

  function formatSignedMan(value) {
    return `${value > 0 ? "+" : ""}${formatMan(value)}`;
  }

  function formatPercent(value, digits = 1) {
    const percent = value * 100;
    return `${percent > 0 ? "+" : ""}${percent.toFixed(digits)}%`;
  }

  function formatPoint(value) {
    const points = value * 100;
    return `${points > 0 ? "+" : ""}${points.toFixed(1)}pt`;
  }

  function valueClass(value) {
    return value < 0 ? "value-negative" : value > 0 ? "value-positive" : "";
  }

  function readInputs() {
    return {
      initial: clamp(number(byId("lab-initial").value, defaults.initial), 1, 100000),
      baseRate: clamp(number(byId("lab-base-rate").value, defaults.baseRate), 0, 15) / 100,
      cryptoRatio: clamp(number(byId("lab-crypto-ratio").value, defaults.cryptoRatio), 0, 40) / 100,
      rebalance: byId("lab-rebalance").value,
      scenarioKey: byId("lab-scenario").value
    };
  }

  function calculate(input) {
    const scenario = scenarios[input.scenarioKey];
    let base = input.initial * (1 - input.cryptoRatio);
    let crypto = input.initial * input.cryptoRatio;
    let peak = input.initial;
    let maxDrawdown = 0;
    const rows = [];
    const baseOnlyValues = [input.initial];

    scenario.returns.forEach((cryptoReturn, index) => {
      if (index > 0 && input.rebalance === "annual") {
        const totalBeforeRebalance = base + crypto;
        base = totalBeforeRebalance * (1 - input.cryptoRatio);
        crypto = totalBeforeRebalance * input.cryptoRatio;
      }

      const startBase = base;
      const startCrypto = crypto;
      const startTotal = startBase + startCrypto;
      const baseWeight = startTotal > 0 ? startBase / startTotal : 0;
      const cryptoWeight = startTotal > 0 ? startCrypto / startTotal : 0;
      const baseContribution = baseWeight * input.baseRate;
      const cryptoContribution = cryptoWeight * cryptoReturn;
      const baseChange = startBase * input.baseRate;
      const cryptoChange = startCrypto * cryptoReturn;

      base = startBase * (1 + input.baseRate);
      crypto = startCrypto * (1 + cryptoReturn);
      const endTotal = base + crypto;
      peak = Math.max(peak, endTotal);
      const drawdown = peak > 0 ? endTotal / peak - 1 : 0;
      maxDrawdown = Math.min(maxDrawdown, drawdown);

      rows.push({
        year: index + 1,
        startTotal,
        startBase,
        startCrypto,
        baseChange,
        cryptoChange,
        endBase: base,
        endCrypto: crypto,
        endTotal,
        baseWeight,
        cryptoWeight,
        baseContribution,
        cryptoContribution,
        cryptoReturn,
        totalReturn: baseContribution + cryptoContribution,
        drawdown
      });
      baseOnlyValues.push(input.initial * Math.pow(1 + input.baseRate, index + 1));
    });

    const final = rows[rows.length - 1].endTotal;
    const baseOnly = baseOnlyValues[baseOnlyValues.length - 1];
    const cagr = Math.pow(final / input.initial, 1 / scenario.returns.length) - 1;

    return {
      input,
      scenario,
      rows,
      baseOnlyValues,
      final,
      baseOnly,
      difference: final - baseOnly,
      cagr,
      maxDrawdown
    };
  }

  function svgElement(tag, attributes = {}, text = "") {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([name, value]) => {
      element.setAttribute(name, String(value));
    });
    if (text) element.textContent = text;
    return element;
  }

  function append(parent, ...children) {
    children.forEach((child) => parent.appendChild(child));
    return parent;
  }

  function chartWidth(svg) {
    const measured = svg.getBoundingClientRect().width;
    return Math.max(320, Math.round(measured || 940));
  }

  function setSvgFrame(svg, width, height, label) {
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("aria-label", label);
  }

  function addText(svg, x, y, text, className, anchor = "start") {
    return append(svg, svgElement("text", {
      x,
      y,
      class: className,
      "text-anchor": anchor
    }, text));
  }

  function renderMetrics(result) {
    byId("lab-final-assets").textContent = formatMan(result.final);
    byId("lab-cagr").textContent = `年平均成長率 ${formatPercent(result.cagr)}`;
    const difference = byId("lab-difference");
    difference.textContent = formatSignedMan(result.difference);
    difference.className = valueClass(result.difference);
    byId("lab-base-only").textContent = `通常資産のみ ${formatMan(result.baseOnly)}`;
    byId("lab-drawdown").textContent = formatPercent(result.maxDrawdown);
    byId("lab-base-output").textContent = `${(result.input.baseRate * 100).toFixed(1)}%`;
    byId("lab-ratio-output").textContent = `${Math.round(result.input.cryptoRatio * 100)}%`;
  }

  function updateDetail(result, yearIndex = state.selectedYear) {
    const row = result.rows[yearIndex];
    if (!row) return;
    byId("pattern-detail").textContent =
      `${row.year}年目：年初${formatMan(row.startTotal)}。通常資産${formatSignedMan(row.baseChange)}、` +
      `暗号資産${formatSignedMan(row.cryptoChange)}が合流し、年末${formatMan(row.endTotal)}。` +
      `資産全体の変化は${formatPercent(row.totalReturn)}です。`;
  }

  function renderBridge(result) {
    const svg = byId("bridge-chart");
    const width = chartWidth(svg);
    const height = width < 620 ? 460 : 420;
    setSvgFrame(
      svg,
      width,
      height,
      `${result.scenario.name}の寄与度ブリッジ。通常資産と暗号資産の増減を年ごとに表示。`
    );

    const compact = width < 620;
    const padding = {
      left: compact ? 62 : 86,
      right: compact ? 20 : 34,
      top: 42,
      bottom: 30
    };
    const plotWidth = width - padding.left - padding.right;
    const rowHeight = (height - padding.top - padding.bottom) / 4;
    const values = result.rows.flatMap((row) => [
      row.startTotal,
      row.startTotal + row.baseChange,
      row.endTotal
    ]);
    let minimum = Math.min(...values);
    let maximum = Math.max(...values);
    const range = Math.max(1, maximum - minimum);
    minimum = Math.max(0, minimum - range * 0.14);
    maximum += range * 0.14;
    const x = (value) => padding.left + ((value - minimum) / (maximum - minimum || 1)) * plotWidth;

    for (let index = 0; index <= 4; index += 1) {
      const value = minimum + ((maximum - minimum) * index) / 4;
      const gridX = x(value);
      append(svg, svgElement("line", {
        x1: gridX,
        y1: padding.top - 16,
        x2: gridX,
        y2: height - padding.bottom,
        class: "chart-grid-line"
      }));
      addText(svg, gridX, 20, formatMan(value), "chart-text-small", "middle");
    }

    result.rows.forEach((row, index) => {
      const centerY = padding.top + rowHeight * index + rowHeight / 2;
      const startX = x(row.startTotal);
      const afterBaseX = x(row.startTotal + row.baseChange);
      const endX = x(row.endTotal);
      const baseX = Math.min(startX, afterBaseX);
      const baseWidth = Math.max(2, Math.abs(afterBaseX - startX));
      const cryptoX = Math.min(afterBaseX, endX);
      const cryptoWidth = Math.max(2, Math.abs(endX - afterBaseX));
      const group = svgElement("g", {
        class: index === state.selectedYear ? "bridge-row is-selected" : "bridge-row",
        "data-year": index
      });

      append(group,
        svgElement("line", {
          x1: padding.left,
          y1: centerY,
          x2: width - padding.right,
          y2: centerY,
          class: "bridge-track"
        }),
        svgElement("rect", {
          x: startX,
          y: centerY - 12,
          width: 0,
          height: 24,
          rx: 2,
          class: "bridge-base chart-animated-bar",
          "data-final-x": baseX,
          "data-final-width": baseWidth
        }),
        svgElement("rect", {
          x: afterBaseX,
          y: centerY - 12,
          width: 0,
          height: 24,
          rx: 2,
          class: `${row.cryptoChange < 0 ? "bridge-crypto-negative" : "bridge-crypto-positive"} chart-animated-bar`,
          "data-final-x": cryptoX,
          "data-final-width": cryptoWidth
        }),
        svgElement("circle", {
          cx: endX,
          cy: centerY,
          r: 5,
          class: "bridge-end"
        }),
        svgElement("circle", {
          cx: endX,
          cy: centerY,
          r: 10,
          class: "chart-focus-ring"
        }),
        svgElement("rect", {
          x: 0,
          y: centerY - rowHeight / 2,
          width,
          height: rowHeight,
          class: "bridge-hit"
        })
      );

      append(svg, group);
      addText(svg, padding.left - 12, centerY - 4, `${row.year}年目`, "chart-text-strong", "end");
      addText(svg, padding.left - 12, centerY + 14, formatPercent(row.totalReturn), "chart-text-small", "end");
      addText(svg, (startX + afterBaseX) / 2, centerY - 20, formatSignedMan(row.baseChange), "chart-text-small", "middle");
      addText(svg, (afterBaseX + endX) / 2, centerY + 25, formatSignedMan(row.cryptoChange), "chart-text-small", "middle");
      addText(svg, endX, centerY - 20, formatMan(row.endTotal), "chart-text-strong", "middle");

      group.addEventListener("pointerenter", () => selectYear(index));
      group.addEventListener("click", () => selectYear(index));
    });

    requestAnimationFrame(() => {
      svg.querySelectorAll("[data-final-width]").forEach((rect) => {
        rect.setAttribute("x", rect.getAttribute("data-final-x"));
        rect.setAttribute("width", rect.getAttribute("data-final-width"));
      });
    });
  }

  function renderComposition(result) {
    const svg = byId("composition-chart");
    const width = chartWidth(svg);
    const height = width < 620 ? 430 : 390;
    setSvgFrame(
      svg,
      width,
      height,
      `${result.scenario.name}の資産構成カラム。通常資産と暗号資産の年末残高を積み上げて表示。`
    );

    const compact = width < 620;
    const padding = {
      left: compact ? 48 : 66,
      right: compact ? 14 : 28,
      top: 42,
      bottom: 50
    };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const holdings = [
      {
        label: "現在",
        base: result.input.initial * (1 - result.input.cryptoRatio),
        crypto: result.input.initial * result.input.cryptoRatio,
        total: result.input.initial,
        ratio: result.input.cryptoRatio
      },
      ...result.rows.map((row) => ({
        label: `${row.year}年`,
        base: row.endBase,
        crypto: row.endCrypto,
        total: row.endTotal,
        ratio: row.endTotal > 0 ? row.endCrypto / row.endTotal : 0
      }))
    ];
    const maximum = Math.max(
      ...holdings.map((item) => item.total),
      ...result.baseOnlyValues
    ) * 1.14;
    const y = (value) => padding.top + plotHeight * (1 - value / (maximum || 1));
    const band = plotWidth / holdings.length;
    const barWidth = Math.min(compact ? 44 : 70, band * 0.54);

    for (let index = 0; index <= 4; index += 1) {
      const value = (maximum * index) / 4;
      const gridY = y(value);
      append(svg, svgElement("line", {
        x1: padding.left,
        y1: gridY,
        x2: width - padding.right,
        y2: gridY,
        class: "chart-grid-line"
      }));
      addText(svg, padding.left - 8, gridY + 4, formatMan(value), "chart-text-small", "end");
    }

    const referencePoints = result.baseOnlyValues.map((value, index) => ({
      x: padding.left + band * index + band / 2,
      y: y(value)
    }));
    const referencePath = referencePoints.map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    ).join(" ");
    append(svg, svgElement("path", {
      d: referencePath,
      class: "composition-reference"
    }));
    referencePoints.forEach((point) => {
      append(svg, svgElement("circle", {
        cx: point.x,
        cy: point.y,
        r: 3,
        class: "composition-point"
      }));
    });

    holdings.forEach((holding, index) => {
      const centerX = padding.left + band * index + band / 2;
      const baseY = y(holding.base);
      const totalY = y(holding.total);
      const baseHeight = y(0) - baseY;
      const cryptoHeight = baseY - totalY;
      const group = svgElement("g", {
        class: index === state.selectedYear + 1 ? "composition-column is-selected" : "composition-column"
      });

      append(group,
        svgElement("rect", {
          x: centerX - barWidth / 2,
          y: y(0),
          width: barWidth,
          height: 0,
          rx: 2,
          class: "composition-base chart-animated-bar",
          "data-final-y": baseY,
          "data-final-height": baseHeight
        }),
        svgElement("rect", {
          x: centerX - barWidth / 2,
          y: baseY,
          width: barWidth,
          height: 0,
          rx: 2,
          class: "composition-crypto chart-animated-bar",
          "data-final-y": totalY,
          "data-final-height": cryptoHeight
        }),
        svgElement("rect", {
          x: centerX - barWidth / 2 - 5,
          y: totalY - 5,
          width: barWidth + 10,
          height: y(0) - totalY + 10,
          rx: 4,
          class: "chart-focus-ring"
        }),
        svgElement("rect", {
          x: centerX - band / 2,
          y: padding.top,
          width: band,
          height: plotHeight + 28,
          class: "composition-hit"
        })
      );
      append(svg, group);
      addText(svg, centerX, totalY - 10, formatMan(holding.total), "chart-text-strong", "middle");
      addText(svg, centerX, height - 25, holding.label, "chart-text", "middle");
      addText(svg, centerX, height - 8, `暗号 ${Math.round(holding.ratio * 100)}%`, "chart-text-small", "middle");

      if (index > 0) {
        group.addEventListener("pointerenter", () => selectYear(index - 1));
        group.addEventListener("click", () => selectYear(index - 1));
      }
    });

    requestAnimationFrame(() => {
      svg.querySelectorAll("[data-final-height]").forEach((rect) => {
        rect.setAttribute("y", rect.getAttribute("data-final-y"));
        rect.setAttribute("height", rect.getAttribute("data-final-height"));
      });
    });
  }

  function renderImpact(result) {
    const container = byId("impact-grid");
    container.replaceChildren();
    const maximumReturn = Math.max(
      0.01,
      ...result.rows.map((row) => Math.abs(row.totalReturn))
    );

    result.rows.forEach((row, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = index === state.selectedYear ? "impact-year is-selected" : "impact-year";
      button.setAttribute(
        "aria-label",
        `${row.year}年目。暗号資産${formatPercent(row.cryptoReturn, 0)}、` +
        `資産全体${formatPercent(row.totalReturn)}、年末${formatMan(row.endTotal)}`
      );

      const year = document.createElement("span");
      year.className = "impact-year-index";
      year.textContent = `${row.year}年目`;

      const cryptoLabel = document.createElement("span");
      cryptoLabel.className = "impact-crypto-label";
      cryptoLabel.textContent = "暗号資産の値動き";

      const cryptoValue = document.createElement("span");
      cryptoValue.className = `impact-crypto-value ${valueClass(row.cryptoReturn)}`;
      cryptoValue.textContent = formatPercent(row.cryptoReturn, 0);

      const pulse = document.createElement("span");
      pulse.className = "impact-pulse";
      const pulseBar = document.createElement("i");
      pulseBar.className = `impact-pulse-bar ${row.totalReturn < 0 ? "is-negative" : "is-positive"}`;
      const pulseWidth = clamp((Math.abs(row.totalReturn) / maximumReturn) * 48, 3, 48);
      pulseBar.dataset.finalWidth = `${pulseWidth}%`;
      pulse.appendChild(pulseBar);

      const totalLabel = document.createElement("span");
      totalLabel.className = "impact-total-label";
      totalLabel.textContent = "資産全体への影響";
      const totalValue = document.createElement("span");
      totalValue.className = `impact-total-value ${valueClass(row.totalReturn)}`;
      totalValue.textContent = formatPercent(row.totalReturn);
      totalLabel.appendChild(totalValue);

      const endLabel = document.createElement("span");
      endLabel.className = "impact-end-label";
      endLabel.textContent = "年末資産";
      const endValue = document.createElement("span");
      endValue.className = "impact-end-value";
      endValue.textContent = formatMan(row.endTotal);
      endLabel.appendChild(endValue);

      button.append(year, cryptoLabel, cryptoValue, pulse, totalLabel, endLabel);
      button.addEventListener("pointerenter", () => selectYear(index));
      button.addEventListener("click", () => selectYear(index));
      container.appendChild(button);
    });

    requestAnimationFrame(() => {
      container.querySelectorAll("[data-final-width]").forEach((bar) => {
        bar.style.width = bar.dataset.finalWidth;
      });
    });
  }

  function renderActivePattern() {
    if (!state.result) return;
    if (state.pattern === "bridge") {
      renderBridge(state.result);
    } else if (state.pattern === "composition") {
      renderComposition(state.result);
    } else {
      renderImpact(state.result);
    }
    updateDetail(state.result);
  }

  function render() {
    const input = readInputs();
    byId("lab-initial").value = input.initial;
    state.result = calculate(input);
    state.selectedYear = clamp(state.selectedYear, 0, 3);
    renderMetrics(state.result);
    renderActivePattern();
  }

  function selectYear(index) {
    const nextYear = clamp(index, 0, 3);
    if (state.selectedYear === nextYear) {
      updateDetail(state.result, nextYear);
      return;
    }
    state.selectedYear = nextYear;
    renderActivePattern();
  }

  function selectPattern(pattern) {
    state.pattern = pattern;
    document.querySelectorAll("[data-pattern]").forEach((tab) => {
      const active = tab.dataset.pattern === pattern;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== pattern;
    });
    renderActivePattern();
  }

  function bindEvents() {
    byId("lab-controls").addEventListener("input", render);
    byId("lab-controls").addEventListener("change", render);
    document.querySelectorAll("[data-pattern]").forEach((tab) => {
      tab.addEventListener("click", () => selectPattern(tab.dataset.pattern));
    });
    window.addEventListener("resize", () => {
      window.clearTimeout(state.resizeTimer);
      state.resizeTimer = window.setTimeout(renderActivePattern, 120);
    });
  }

  bindEvents();
  render();
})();
