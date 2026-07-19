(function () {
  "use strict";

  const ACK_VERSION = "ack-0.9.0";
  const MODEL_VERSION = "crypto-stress-0.1.0";
  const STORAGE_KEY = "mirai-crypto-understanding";

  const scenarios = {
    downside: {
      name: "下落先行",
      returns: [-0.8, 1.0, 0.5, 0.3],
      note: "最初の大幅下落から、回復後も元本へ戻るとは限らない条件です。",
      color: "#b42318"
    },
    volatile: {
      name: "高変動",
      returns: [3.0, -0.7, 0.4, -0.2],
      note: "大幅上昇の後に急落し、利益がどの程度残るかを確認します。",
      color: "#c66513"
    },
    extreme: {
      name: "極端値テスト",
      returns: [10.0, -0.8, -0.4, 0.2],
      note: "単年の極端な上昇と、その後の大幅下落を組み合わせた条件です。",
      color: "#6558a6"
    }
  };

  const answers = {
    forecast: "no",
    extreme: "no",
    advice: "no"
  };

  const colors = {
    ink: "#17212b",
    muted: "#61707d",
    grid: "#d7e0e4",
    brand: "#13766f",
    blue: "#3269a8",
    danger: "#b42318",
    positiveFill: "rgba(19, 118, 111, 0.16)",
    negativeFill: "rgba(180, 35, 24, 0.14)",
    canvas: "#fbfcfd"
  };

  const defaults = {
    initial: 1000,
    baseRate: 5,
    cryptoRatio: 10,
    rebalance: "annual",
    scenario: "downside"
  };

  const animation = {
    start: performance.now(),
    duration: 1300,
    progress: 1,
    hoveredYear: null,
    reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    result: null
  };

  const byId = (id) => document.getElementById(id);
  const introView = byId("intro-view");
  const learningView = byId("learning-view");
  const simulatorView = byId("simulator-view");

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
    const abs = Math.abs(rounded);
    if (abs >= 10000) {
      const oku = Math.floor(abs / 10000);
      const man = abs % 10000;
      return man
        ? `${sign}${oku.toLocaleString("ja-JP")}億${man.toLocaleString("ja-JP")}万円`
        : `${sign}${oku.toLocaleString("ja-JP")}億円`;
    }
    return `${sign}${abs.toLocaleString("ja-JP")}万円`;
  }

  function formatPercent(value, digits = 1) {
    const percent = value * 100;
    const sign = percent > 0 ? "+" : "";
    return `${sign}${percent.toFixed(digits)}%`;
  }

  function formatPoint(value) {
    const points = value * 100;
    const sign = points > 0 ? "+" : "";
    return `${sign}${points.toFixed(1)}pt`;
  }

  function classFor(value) {
    return value < 0 ? "value-negative" : value > 0 ? "value-positive" : "";
  }

  function showView(name) {
    introView.hidden = name !== "intro";
    learningView.hidden = name !== "learning";
    simulatorView.hidden = name !== "simulator";
    if (name === "simulator") {
      render();
      replay();
    }
    window.scrollTo({ top: 0, behavior: animation.reduced ? "auto" : "smooth" });
  }

  function readStoredAcknowledgement() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!stored || stored.ackVersion !== ACK_VERSION) return null;
      return stored;
    } catch (error) {
      return null;
    }
  }

  function updatePreviousCheck() {
    const stored = readStoredAcknowledgement();
    const box = byId("previous-check");
    if (!stored) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const date = new Date(stored.confirmedAt);
    byId("previous-check-date").textContent = Number.isNaN(date.getTime())
      ? `説明版 ${stored.ackVersion}`
      : `${date.toLocaleString("ja-JP")} / 説明版 ${stored.ackVersion}`;
  }

  function updateKnowledgeCheck() {
    const form = byId("knowledge-check");
    let answered = 0;
    let correct = 0;

    Object.entries(answers).forEach(([name, expected]) => {
      const fieldset = form.querySelector(`[data-question="${name}"]`);
      const selected = form.querySelector(`input[name="${name}"]:checked`);
      const feedback = fieldset.querySelector(".answer-feedback");
      fieldset.classList.remove("is-correct", "is-wrong");

      if (!selected) {
        feedback.textContent = "";
        return;
      }

      answered += 1;
      if (selected.value === expected) {
        correct += 1;
        fieldset.classList.add("is-correct");
        feedback.textContent = "正解です。";
      } else {
        fieldset.classList.add("is-wrong");
        if (name === "forecast") {
          feedback.textContent = "表示額は将来予測ではなく、選んだ条件での試算です。";
        } else if (name === "extreme") {
          feedback.textContent = "+1,000%は毎年の利回りではなく、単年の極端値テストです。";
        } else {
          feedback.textContent = "商品、購入量、売買時期を示す投資助言ではありません。";
        }
      }
    });

    byId("check-progress").textContent = `${answered} / 3`;
    const passed = answered === 3 && correct === 3;
    const result = byId("check-result");
    const acknowledgement = byId("acknowledgement");
    const acknowledgementLabel = byId("acknowledgement-label");

    if (passed) {
      result.textContent = "3問すべて確認できました。最後に理解確認を選択してください。";
      result.classList.add("is-success");
      acknowledgement.disabled = false;
      acknowledgementLabel.classList.remove("is-disabled");
    } else {
      result.textContent = answered < 3
        ? "3問に回答すると、理解確認へ進めます。"
        : `${correct}問正解です。説明を確認して、もう一度回答してください。`;
      result.classList.remove("is-success");
      acknowledgement.checked = false;
      acknowledgement.disabled = true;
      acknowledgementLabel.classList.add("is-disabled");
    }
    byId("enter-simulator").disabled = !(passed && acknowledgement.checked);
  }

  function saveAcknowledgement() {
    const record = {
      ackVersion: ACK_VERSION,
      modelVersion: MODEL_VERSION,
      confirmedAt: new Date().toISOString(),
      quiz: { ...answers },
      scope: "crypto-simulation-understanding",
      storage: "browser-local-prototype"
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch (error) {
      // The simulator remains usable when local storage is unavailable.
    }
  }

  function readInputs() {
    const scenarioInput = document.querySelector('input[name="scenario"]:checked');
    const rebalanceInput = document.querySelector('input[name="rebalance"]:checked');
    return {
      initial: clamp(number(byId("initial-assets").value, defaults.initial), 1, 100000),
      baseRate: clamp(number(byId("base-rate").value, defaults.baseRate), 0, 15) / 100,
      cryptoRatio: clamp(number(byId("crypto-ratio").value, defaults.cryptoRatio), 0, 40) / 100,
      rebalance: rebalanceInput ? rebalanceInput.value : defaults.rebalance,
      scenarioKey: scenarioInput ? scenarioInput.value : defaults.scenario
    };
  }

  function calculate(input) {
    const scenario = scenarios[input.scenarioKey];
    let base = input.initial * (1 - input.cryptoRatio);
    let crypto = input.initial * input.cryptoRatio;
    let peak = input.initial;
    let maxDrawdown = 0;
    const rows = [];
    const totalValues = [input.initial];
    const baseOnlyValues = [input.initial];

    scenario.returns.forEach((cryptoReturn, index) => {
      if (index > 0 && input.rebalance === "annual") {
        const totalBeforeRebalance = base + crypto;
        base = totalBeforeRebalance * (1 - input.cryptoRatio);
        crypto = totalBeforeRebalance * input.cryptoRatio;
      }

      const startTotal = base + crypto;
      const baseWeight = startTotal > 0 ? base / startTotal : 0;
      const cryptoWeight = startTotal > 0 ? crypto / startTotal : 0;
      const baseContribution = baseWeight * input.baseRate;
      const cryptoContribution = cryptoWeight * cryptoReturn;
      const totalReturn = baseContribution + cryptoContribution;

      base *= 1 + input.baseRate;
      crypto *= 1 + cryptoReturn;
      const endTotal = base + crypto;
      peak = Math.max(peak, endTotal);
      const drawdown = peak > 0 ? endTotal / peak - 1 : 0;
      maxDrawdown = Math.min(maxDrawdown, drawdown);

      rows.push({
        year: index + 1,
        startTotal,
        endTotal,
        base,
        crypto,
        baseWeight,
        cryptoWeight,
        cryptoReturn,
        baseContribution,
        cryptoContribution,
        totalReturn,
        drawdown
      });
      totalValues.push(endTotal);
      baseOnlyValues.push(input.initial * Math.pow(1 + input.baseRate, index + 1));
    });

    const final = totalValues[totalValues.length - 1];
    const baseOnly = baseOnlyValues[baseOnlyValues.length - 1];
    const cagr = Math.pow(final / input.initial, 1 / scenario.returns.length) - 1;
    const cryptoCumulative = scenario.returns.reduce((factor, value) => factor * (1 + value), 1) - 1;

    return {
      input,
      scenario,
      rows,
      totalValues,
      baseOnlyValues,
      final,
      baseOnly,
      difference: final - baseOnly,
      cagr,
      maxDrawdown,
      cryptoCumulative
    };
  }

  function renderMetrics(result) {
    byId("final-assets").textContent = formatMan(result.final);
    byId("final-cagr").textContent = `年平均成長率 ${formatPercent(result.cagr)}`;
    byId("difference-assets").textContent = `${result.difference >= 0 ? "+" : ""}${formatMan(result.difference)}`;
    byId("difference-assets").className = classFor(result.difference);
    byId("base-only-assets").textContent = `通常資産のみ ${formatMan(result.baseOnly)}`;
    byId("max-drawdown").textContent = formatPercent(result.maxDrawdown);
    byId("scenario-summary").textContent =
      `${result.scenario.name} / 暗号資産部分の4年累積 ${formatPercent(result.cryptoCumulative)}`;
  }

  function renderYearCards(result) {
    const container = byId("year-cards");
    container.replaceChildren();

    result.rows.forEach((row) => {
      const card = document.createElement("article");
      card.className = "year-card";
      const values = [
        ["暗号資産変動", formatPercent(row.cryptoReturn, 0), classFor(row.cryptoReturn)],
        ["年初の暗号比率", `${(row.cryptoWeight * 100).toFixed(1)}%`, ""],
        ["通常資産の寄与", formatPoint(row.baseContribution), classFor(row.baseContribution)],
        ["暗号資産の寄与", formatPoint(row.cryptoContribution), classFor(row.cryptoContribution)],
        ["資産全体", formatPercent(row.totalReturn), classFor(row.totalReturn)],
        ["年末資産", formatMan(row.endTotal), ""]
      ];

      const title = document.createElement("h3");
      title.textContent = `${row.year}年目`;
      const list = document.createElement("dl");
      values.forEach(([label, value, className]) => {
        const wrapper = document.createElement("div");
        const term = document.createElement("dt");
        const description = document.createElement("dd");
        term.textContent = label;
        description.textContent = value;
        if (className) description.classList.add(className);
        wrapper.append(term, description);
        list.appendChild(wrapper);
      });
      card.append(title, list);
      container.appendChild(card);
    });
  }

  function updateCanvasDescription(result, yearIndex = null) {
    const row = yearIndex === null ? null : result.rows[yearIndex];
    if (!row) {
      byId("river-description").textContent =
        `${result.scenario.name}では4年後の総資産は${formatMan(result.final)}、` +
        `通常資産のみとの差は${result.difference >= 0 ? "+" : ""}${formatMan(result.difference)}です。`;
      return;
    }
    byId("river-description").textContent =
      `${row.year}年目：暗号資産${formatPercent(row.cryptoReturn, 0)}、` +
      `資産全体への寄与${formatPoint(row.cryptoContribution)}、` +
      `通常資産の寄与${formatPoint(row.baseContribution)}、` +
      `資産全体${formatPercent(row.totalReturn)}、年末${formatMan(row.endTotal)}。`;
  }

  function render() {
    const input = readInputs();
    byId("initial-assets").value = input.initial;
    byId("base-rate-output").textContent = `${(input.baseRate * 100).toFixed(1)}%`;
    byId("crypto-ratio-output").textContent = `${Math.round(input.cryptoRatio * 100)}%`;
    const result = calculate(input);
    animation.result = result;
    renderMetrics(result);
    renderYearCards(result);
    updateCanvasDescription(result, animation.hoveredYear);
  }

  function resetInputs() {
    byId("initial-assets").value = defaults.initial;
    byId("base-rate").value = defaults.baseRate;
    byId("crypto-ratio").value = defaults.cryptoRatio;
    document.querySelector(`input[name="rebalance"][value="${defaults.rebalance}"]`).checked = true;
    document.querySelector(`input[name="scenario"][value="${defaults.scenario}"]`).checked = true;
    animation.hoveredYear = null;
    render();
    replay();
  }

  function replay() {
    animation.start = performance.now();
    animation.progress = animation.reduced ? 1 : 0;
  }

  function interpolatePoint(points, progress) {
    if (!points.length) return null;
    const scaled = clamp(progress, 0, 1) * (points.length - 1);
    const index = Math.floor(scaled);
    const fraction = scaled - index;
    const current = points[index];
    const next = points[Math.min(index + 1, points.length - 1)];
    return {
      x: current.x + (next.x - current.x) * fraction,
      y: current.y + (next.y - current.y) * fraction
    };
  }

  function drawPolyline(ctx, points, progress, style) {
    const maxSegment = clamp(progress, 0, 1) * (points.length - 1);
    const fullSegments = Math.floor(maxSegment);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index <= fullSegments; index += 1) {
      ctx.lineTo(points[index].x, points[index].y);
    }
    if (fullSegments < points.length - 1) {
      const fraction = maxSegment - fullSegments;
      const a = points[fullSegments];
      const b = points[fullSegments + 1];
      ctx.lineTo(a.x + (b.x - a.x) * fraction, a.y + (b.y - a.y) * fraction);
    }
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.width;
    ctx.setLineDash(style.dash || []);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawRiver(now) {
    const canvas = byId("asset-river");
    const result = animation.result;
    if (!canvas || !result) {
      requestAnimationFrame(drawRiver);
      return;
    }

    if (!animation.reduced && animation.progress < 1) {
      animation.progress = clamp((now - animation.start) / animation.duration, 0, 1);
    } else {
      animation.progress = 1;
    }

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.floor(rect.width * dpr));
    const pixelHeight = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colors.canvas;
    ctx.fillRect(0, 0, width, height);

    const compact = width < 620;
    const padding = {
      left: compact ? 42 : 66,
      right: compact ? 18 : 34,
      top: 34,
      bottom: compact ? 54 : 48
    };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const allValues = [...result.totalValues, ...result.baseOnlyValues];
    const maxValue = Math.max(...allValues) * 1.13;
    const minValue = 0;
    const x = (index) => padding.left + plotWidth * (index / 4);
    const y = (value) => padding.top + plotHeight * (1 - (value - minValue) / (maxValue - minValue || 1));
    const totalPoints = result.totalValues.map((value, index) => ({ x: x(index), y: y(value), value }));
    const basePoints = result.baseOnlyValues.map((value, index) => ({ x: x(index), y: y(value), value }));

    ctx.font = `${compact ? 10 : 11}px ${getComputedStyle(document.body).fontFamily}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let index = 0; index <= 4; index += 1) {
      const value = (maxValue * index) / 4;
      const gridY = y(value);
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, gridY);
      ctx.lineTo(width - padding.right, gridY);
      ctx.stroke();
      ctx.fillStyle = colors.muted;
      ctx.fillText(compact && value >= 10000 ? `${(value / 10000).toFixed(1)}億` : `${Math.round(value).toLocaleString("ja-JP")}万`, padding.left - 8, gridY);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let index = 0; index <= 4; index += 1) {
      ctx.fillStyle = colors.muted;
      ctx.fillText(index === 0 ? "現在" : `${index}年`, x(index), height - padding.bottom + 13);
    }

    const visibleCount = Math.max(1, Math.ceil(animation.progress * 4));
    for (let index = 0; index < visibleCount; index += 1) {
      const startTotal = totalPoints[index];
      const endTotal = totalPoints[index + 1];
      const startBase = basePoints[index];
      const endBase = basePoints[index + 1];
      const segmentProgress = clamp(animation.progress * 4 - index, 0, 1);
      const endX = startTotal.x + (endTotal.x - startTotal.x) * segmentProgress;
      const endTotalY = startTotal.y + (endTotal.y - startTotal.y) * segmentProgress;
      const endBaseY = startBase.y + (endBase.y - startBase.y) * segmentProgress;
      const positive = result.totalValues[index + 1] >= result.baseOnlyValues[index + 1];

      ctx.beginPath();
      ctx.moveTo(startTotal.x, startTotal.y);
      ctx.lineTo(endX, endTotalY);
      ctx.lineTo(endX, endBaseY);
      ctx.lineTo(startBase.x, startBase.y);
      ctx.closePath();
      ctx.fillStyle = positive ? colors.positiveFill : colors.negativeFill;
      ctx.fill();
    }

    drawPolyline(ctx, basePoints, animation.progress, {
      stroke: colors.blue,
      width: 2,
      dash: [7, 6]
    });
    drawPolyline(ctx, totalPoints, animation.progress, {
      stroke: colors.brand,
      width: compact ? 3 : 4
    });

    const visiblePointIndex = Math.floor(animation.progress * 4 + 0.0001);
    result.rows.forEach((row, index) => {
      if (index + 1 > visiblePointIndex) return;
      const point = totalPoints[index + 1];
      const isHovered = animation.hoveredYear === index;
      const contribution = row.cryptoContribution;
      const labelY = point.y + (index % 2 === 0 ? -42 : 28);
      const controlY = point.y + (labelY - point.y) * 0.55;

      ctx.strokeStyle = contribution < 0 ? colors.danger : result.scenario.color;
      ctx.lineWidth = isHovered ? 2.5 : 1.4;
      ctx.beginPath();
      ctx.moveTo(point.x - (compact ? 18 : 30), labelY);
      ctx.quadraticCurveTo(point.x - 8, controlY, point.x, point.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(point.x, point.y, isHovered ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = contribution < 0 ? colors.danger : result.scenario.color;
      ctx.fill();

      ctx.font = `700 ${compact ? 10 : 11}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = index % 2 === 0 ? "bottom" : "top";
      ctx.fillStyle = colors.ink;
      ctx.fillText(formatPoint(contribution), point.x - (compact ? 20 : 34), labelY + (index % 2 === 0 ? -2 : 2));
    });

    if (!animation.reduced && animation.progress > 0) {
      const time = now / 5000;
      for (let particleIndex = 0; particleIndex < 8; particleIndex += 1) {
        const progress = (time + particleIndex / 8) % Math.max(0.001, animation.progress);
        const point = interpolatePoint(totalPoints, progress);
        if (!point) continue;
        ctx.beginPath();
        ctx.arc(point.x, point.y, particleIndex % 2 ? 1.6 : 2.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(19, 118, 111, 0.42)";
        ctx.fill();
      }
    }

    ctx.font = `700 ${compact ? 10 : 12}px ${getComputedStyle(document.body).fontFamily}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    const currentPoint = totalPoints[0];
    ctx.fillStyle = colors.ink;
    ctx.fillText(formatMan(result.input.initial), currentPoint.x + 6, currentPoint.y - 8);

    if (animation.progress >= 1) {
      const finalPoint = totalPoints[4];
      ctx.textAlign = "right";
      ctx.fillStyle = colors.ink;
      ctx.fillText(formatMan(result.final), finalPoint.x, Math.max(18, finalPoint.y - 10));
    }

    canvas.setAttribute(
      "aria-label",
      `${result.scenario.name}。現在${formatMan(result.input.initial)}から4年後${formatMan(result.final)}。最大下落${formatPercent(result.maxDrawdown)}。`
    );
    requestAnimationFrame(drawRiver);
  }

  function yearFromPointer(event) {
    const canvas = byId("asset-river");
    const rect = canvas.getBoundingClientRect();
    const compact = rect.width < 620;
    const left = compact ? 42 : 66;
    const right = compact ? 18 : 34;
    const plotWidth = rect.width - left - right;
    const relative = clamp((event.clientX - rect.left - left) / plotWidth, 0, 1);
    const pointIndex = Math.round(relative * 4);
    return pointIndex === 0 ? null : pointIndex - 1;
  }

  function bindEvents() {
    byId("start-learning").addEventListener("click", () => showView("learning"));
    byId("back-to-intro").addEventListener("click", () => showView("intro"));
    byId("resume-simulator").addEventListener("click", () => showView("simulator"));
    byId("review-assumptions").addEventListener("click", () => showView("learning"));
    byId("decline-intro").addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        byId("decline-intro").textContent = "この独立素材を閉じてください";
      }
    });

    const knowledgeForm = byId("knowledge-check");
    knowledgeForm.addEventListener("change", updateKnowledgeCheck);
    byId("acknowledgement").addEventListener("change", updateKnowledgeCheck);
    knowledgeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (byId("enter-simulator").disabled) return;
      saveAcknowledgement();
      updatePreviousCheck();
      showView("simulator");
    });

    byId("simulator-form").addEventListener("input", () => {
      animation.hoveredYear = null;
      render();
      replay();
    });
    byId("simulator-form").addEventListener("change", () => {
      animation.hoveredYear = null;
      render();
      replay();
    });
    byId("reset-inputs").addEventListener("click", resetInputs);
    byId("replay-river").addEventListener("click", replay);

    const canvas = byId("asset-river");
    canvas.addEventListener("pointermove", (event) => {
      animation.hoveredYear = yearFromPointer(event);
      if (animation.result) updateCanvasDescription(animation.result, animation.hoveredYear);
    });
    canvas.addEventListener("pointerleave", () => {
      animation.hoveredYear = null;
      if (animation.result) updateCanvasDescription(animation.result, null);
    });
    canvas.addEventListener("click", (event) => {
      animation.hoveredYear = yearFromPointer(event);
      if (animation.result) updateCanvasDescription(animation.result, animation.hoveredYear);
    });
  }

  bindEvents();
  updatePreviousCheck();
  updateKnowledgeCheck();
  render();
  requestAnimationFrame(drawRiver);
})();
