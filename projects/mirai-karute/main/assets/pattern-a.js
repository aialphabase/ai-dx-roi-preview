(function () {
  "use strict";

  const core = window.MiraiCore;
  const form = document.getElementById("dashboard-form");
  let inputStartedTracked = false;
  const defaults = {
    age: 39,
    goalAge: 65,
    assets: 500,
    monthly: 10,
    target: 5000,
    rate: 5,
    income: 600,
    expenses: 30,
    experience: 2,
    risk: "balanced",
    business: "employee",
  };

  const byId = (id) => document.getElementById(id);
  const setText = (id, text) => {
    byId(id).textContent = text;
  };

  const getInterests = () =>
    Array.from(document.querySelectorAll('input[name="interest"]:checked')).map((input) => input.value);

  const readState = () => {
    const age = core.number(byId("age").value, defaults.age);
    const goalAge = Math.max(age + 1, core.number(byId("goal-age").value, defaults.goalAge));
    const assets = Math.max(0, core.number(byId("assets").value));
    const monthly = Math.max(0, core.number(byId("monthly").value));
    const target = Math.max(1, core.number(byId("target").value));
    const rate = core.number(byId("rate").value) / 100;
    const annualIncome = Math.max(0, core.number(byId("income").value));
    const expenses = Math.max(0, core.number(byId("expenses").value));
    const experience = core.number(byId("experience").value);
    const risk = byId("risk").value;
    const business = byId("business").value;
    const consult = byId("consult").value;
    const meeting = byId("meeting").checked;
    const years = goalAge - age;
    const future = core.futureValue(assets, monthly, rate, years);
    const required = core.requiredMonthly(assets, target, rate, years);
    const interests = getInterests();
    return {
      age,
      goalAge,
      assets,
      monthly,
      target,
      rate,
      annualIncome,
      expenses,
      experience,
      risk,
      business,
      consult,
      meeting,
      years,
      future,
      required,
      interests,
    };
  };

  const niceMax = (value) => {
    if (value <= 1000) return Math.ceil(value / 250) * 250 || 1000;
    if (value <= 10000) return Math.ceil(value / 1000) * 1000;
    return Math.ceil(value / 5000) * 5000;
  };

  const svgEl = (tag, attrs = {}) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  };

  const renderChart = (state) => {
    const width = 760;
    const height = 300;
    const pad = { left: 61, right: 40, top: 20, bottom: 39 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const points = [];
    const targetPoints = [];
    const samples = Math.max(2, Math.min(state.years, 26));

    for (let i = 0; i <= samples; i += 1) {
      const years = (state.years * i) / samples;
      points.push({
        age: state.age + years,
        value: core.futureValue(state.assets, state.monthly, state.rate, years),
      });
      targetPoints.push({
        age: state.age + years,
        value: state.assets + ((state.target - state.assets) * i) / samples,
      });
    }

    const maxValue = niceMax(Math.max(state.target, state.future, state.assets) * 1.12);
    const x = (age) => pad.left + ((age - state.age) / state.years) * plotWidth;
    const y = (value) => pad.top + plotHeight - (Math.max(0, value) / maxValue) * plotHeight;
    const pathFrom = (data) =>
      data.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.age).toFixed(1)} ${y(point.value).toFixed(1)}`).join(" ");

    const primaryPath = pathFrom(points);
    const areaPath = `${primaryPath} L ${x(state.goalAge).toFixed(1)} ${(pad.top + plotHeight).toFixed(1)} L ${x(state.age).toFixed(1)} ${(pad.top + plotHeight).toFixed(1)} Z`;
    byId("chart-primary").setAttribute("d", primaryPath);
    byId("chart-area").setAttribute("d", areaPath);
    byId("chart-target").setAttribute("d", pathFrom(targetPoints));

    const grid = byId("chart-grid");
    const labels = byId("chart-labels");
    grid.replaceChildren();
    labels.replaceChildren();

    for (let i = 0; i <= 4; i += 1) {
      const value = (maxValue * i) / 4;
      const gy = y(value);
      grid.appendChild(svgEl("line", {
        x1: pad.left,
        x2: width - pad.right,
        y1: gy,
        y2: gy,
        class: "chart-grid-line",
      }));
      const text = svgEl("text", {
        x: pad.left - 10,
        y: gy + 4,
        "text-anchor": "end",
        class: "chart-axis-label",
      });
      text.textContent = core.formatMan(value, true);
      labels.appendChild(text);
    }

    const ageTicks = [state.age, Math.round((state.age + state.goalAge) / 2), state.goalAge];
    ageTicks.forEach((age) => {
      const text = svgEl("text", {
        x: x(age),
        y: height - 11,
        "text-anchor": age === state.age ? "start" : age === state.goalAge ? "end" : "middle",
        class: "chart-axis-label",
      });
      text.textContent = `${age}歳`;
      labels.appendChild(text);
    });

    labels.appendChild(svgEl("circle", {
      cx: x(state.goalAge),
      cy: y(state.future),
      r: 5,
      class: "chart-point",
    }));

    const finalLabel = svgEl("text", {
      x: x(state.goalAge) - 4,
      y: Math.max(17, y(state.future) - 12),
      "text-anchor": "end",
      class: "chart-annotation",
    });
    finalLabel.textContent = core.formatMan(state.future, true);
    labels.appendChild(finalLabel);
  };

  const allocationFor = (risk) => {
    if (risk === "conservative") {
      return {
        label: "安定重視",
        items: [
          { label: "生活防衛・現預金", value: 35, color: "var(--brand)" },
          { label: "分散型の長期運用", value: 45, color: "var(--accent)" },
          { label: "実物・不動産", value: 10, color: "var(--gold)" },
          { label: "高変動資産", value: 10, color: "var(--purple)" },
        ],
      };
    }
    if (risk === "growth") {
      return {
        label: "成長重視",
        items: [
          { label: "生活防衛・現預金", value: 15, color: "var(--brand)" },
          { label: "分散型の長期運用", value: 50, color: "var(--accent)" },
          { label: "実物・不動産", value: 15, color: "var(--gold)" },
          { label: "高変動資産", value: 20, color: "var(--purple)" },
        ],
      };
    }
    return {
      label: "バランス",
      items: [
        { label: "生活防衛・現預金", value: 25, color: "var(--brand)" },
        { label: "分散型の長期運用", value: 50, color: "var(--accent)" },
        { label: "実物・不動産", value: 15, color: "var(--gold)" },
        { label: "高変動資産", value: 10, color: "var(--purple)" },
      ],
    };
  };

  const renderAllocation = (risk, interests) => {
    const allocation = allocationFor(risk);
    setText("donut-risk", allocation.label);
    let cursor = 0;
    const stops = allocation.items.map((item) => {
      const start = cursor;
      cursor += item.value;
      return `${item.color} ${start}% ${cursor}%`;
    });
    byId("allocation-donut").style.background = `conic-gradient(${stops.join(",")})`;
    byId("allocation-donut").setAttribute(
      "aria-label",
      allocation.items.map((item) => `${item.label}${item.value}%`).join("、")
    );
    const list = byId("allocation-list");
    list.replaceChildren();
    allocation.items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "allocation-row";
      row.innerHTML = `<span class="allocation-dot" aria-hidden="true"></span><span></span><strong></strong>`;
      row.children[0].style.background = item.color;
      row.children[1].textContent = item.label;
      row.children[2].textContent = `${item.value}%`;
      list.appendChild(row);
    });

    let learning = "家計管理と長期分散";
    if (interests.includes("corporate")) learning = "法人化・法人資産運用";
    else if (interests.includes("realestate")) learning = "不動産と金融資産の組み合わせ";
    else if (interests.includes("crypto")) learning = "暗号資産のリスク管理";
    else if (interests.includes("ai")) learning = "AI活用による収入拡張";
    setText("learning-theme", learning);
  };

  const renderScores = (scores) => {
    const data = [
      ["資産形成ニーズ", scores.need],
      ["投資意欲", scores.motivation],
      ["提案適合度", scores.fit],
      ["LTV予測", scores.ltv],
    ];
    const list = byId("score-list");
    list.replaceChildren();
    data.forEach(([name, value]) => {
      const row = document.createElement("div");
      row.className = "score-row";
      row.innerHTML = `<span class="score-name"></span><span class="score-track"><span class="score-fill"></span></span><strong class="score-value"></strong>`;
      row.children[0].textContent = name;
      row.querySelector(".score-fill").style.width = `${value}%`;
      row.children[2].textContent = value;
      list.appendChild(row);
    });
  };

  const render = () => {
    const state = readState();
    if (core.number(byId("goal-age").value) <= state.age) {
      byId("goal-age").value = state.goalAge;
    }
    setText("rate-value", `${(state.rate * 100).toFixed(1)}%`);

    const gap = state.future - state.target;
    const contribution = state.monthly * state.years * 12;
    setText("future-value", core.formatMan(state.future));
    setText("future-note", `元本 ${core.formatMan(state.assets + contribution)} / 運用効果 約${core.formatMan(state.future - state.assets - contribution)}`);
    setText("gap-value", `${gap >= 0 ? "+" : ""}${core.formatMan(gap)}`);
    setText("gap-note", gap >= 0 ? "現在の計画で目標線を上回ります" : "この差を積立・期間・収入で調整します");
    setText("required-value", core.formatMonthly(state.required));
    setText("required-note", `現在との差 ${core.formatMonthly(Math.max(0, state.required - state.monthly))}`);
    setText("chart-period", `${state.age}歳から${state.goalAge}歳まで ${state.years}年間`);

    byId("gap-metric").classList.toggle("is-positive", gap >= 0);
    byId("gap-metric").classList.toggle("is-negative", gap < 0);
    byId("future-metric").classList.toggle("is-positive", gap >= 0);
    setText("goal-status", gap >= 0 ? "目標圏内" : "見直し余地あり");
    byId("goal-status").className = `status-chip ${gap >= 0 ? "good" : "accent"}`;

    const scores = core.scoreProfile(state);
    const diagnosis = core.diagnose(state, scores);
    const actions = core.actionPlan(state, diagnosis);
    const tags = core.buildTags(state, diagnosis, scores);

    setText("diagnosis-type", `${diagnosis.primary} × ${diagnosis.secondary}タイプ`);
    setText("stage-label", `現在の顧客ステージ：${diagnosis.stage}`);
    const heatLabel = diagnosis.heat === "high" ? "高温度" : diagnosis.heat === "medium" ? "中温度" : "低温度";
    setText("heat-status", heatLabel);
    byId("heat-status").className = `status-chip ${diagnosis.heat === "high" ? "hot" : diagnosis.heat === "medium" ? "accent" : ""}`;

    const completion = state.target > 0 ? (state.future / state.target) * 100 : 0;
    const positionText = completion >= 100
      ? `目標の${Math.round(completion)}%が見込める水準です。リターン追求より、達成確率を下げない配分管理が優先です。`
      : `目標の約${Math.round(completion)}%まで到達する見込みです。月${core.formatMonthly(Math.max(0, state.required - state.monthly))}の追加原資、または目標時期の調整が改善ポイントです。`;
    setText("position-text", positionText);
    byId("position-callout").className = `callout ${completion < 70 ? "danger" : completion < 100 ? "warn" : ""}`;

    const actionList = byId("action-list");
    actionList.replaceChildren();
    actions.forEach((action) => {
      const item = document.createElement("li");
      const body = document.createElement("div");
      const title = document.createElement("strong");
      const note = document.createElement("span");
      title.textContent = action.title;
      note.textContent = action.note;
      body.append(title, note);
      item.appendChild(body);
      actionList.appendChild(item);
    });

    renderChart(state);
    renderAllocation(state.risk, state.interests);
    renderScores(scores);

    const tagList = byId("tag-list");
    tagList.replaceChildren();
    tags.forEach((tag) => {
      const element = document.createElement("span");
      element.className = "tag";
      element.textContent = tag;
      tagList.appendChild(element);
    });

    const notify = diagnosis.heat === "high" ||
      state.meeting ||
      (scores.overall >= 80) ||
      (state.assets >= 1000 && state.interests.some((interest) => ["realestate", "corporate", "ai"].includes(interest)));
    setText("notification-status", notify ? "担当者通知 ON" : "通常蓄積");
    byId("notification-status").className = `status-chip ${notify ? "hot" : "good"}`;
  };

  const selectRatePreset = (rate) => {
    const percent = rate * 100;
    byId("rate").value = percent;
    document.querySelectorAll("#rate-presets .segment").forEach((button) => {
      button.classList.toggle("is-active", core.number(button.dataset.rate) === rate);
    });
    render();
  };

  form.addEventListener("input", () => {
    if (!inputStartedTracked) {
      inputStartedTracked = true;
      core.track("karte_input_started", { variant: "A" });
    }
    render();
  });
  byId("consult").addEventListener("change", render);
  byId("meeting").addEventListener("change", () => {
    core.track("karte_meeting_requested", { variant: "A", requested: byId("meeting").checked });
    render();
  });
  byId("rate").addEventListener("input", () => {
    document.querySelectorAll("#rate-presets .segment").forEach((button) => button.classList.remove("is-active"));
    render();
  });
  document.querySelectorAll("#rate-presets .segment").forEach((button) => {
    button.addEventListener("click", () => {
      const selectedRate = core.number(button.dataset.rate);
      core.track("karte_scenario_changed", { variant: "A", annual_rate: selectedRate });
      selectRatePreset(selectedRate);
    });
  });
  byId("reset-a").addEventListener("click", () => {
    byId("age").value = defaults.age;
    byId("goal-age").value = defaults.goalAge;
    byId("assets").value = defaults.assets;
    byId("monthly").value = defaults.monthly;
    byId("target").value = defaults.target;
    byId("income").value = defaults.income;
    byId("expenses").value = defaults.expenses;
    byId("experience").value = defaults.experience;
    byId("risk").value = defaults.risk;
    byId("business").value = defaults.business;
    byId("consult").value = "none";
    byId("meeting").checked = false;
    document.querySelectorAll('input[name="interest"]').forEach((input) => {
      input.checked = ["investment", "ai"].includes(input.value);
    });
    selectRatePreset(0.05);
  });

  core.track("karte_opened", { variant: "A" });
  render();
})();
