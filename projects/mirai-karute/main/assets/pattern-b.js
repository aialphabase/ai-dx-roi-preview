(function () {
  "use strict";

  const core = window.MiraiCore;
  const form = document.getElementById("roadmap-form");
  const byId = (id) => document.getElementById(id);
  let currentStep = 1;
  let maxVisited = 1;
  let inputStartedTracked = false;

  const setText = (id, value) => {
    byId(id).textContent = value;
  };

  const n = (id, fallback = 0) => core.number(byId(id).value, fallback);
  const checked = (id) => byId(id).checked;
  const interests = () =>
    Array.from(document.querySelectorAll('input[name="bInterest"]:checked')).map((input) => input.value);

  const showStep = (step) => {
    currentStep = step;
    maxVisited = Math.max(maxVisited, step);
    document.querySelectorAll(".wizard-step").forEach((section) => {
      const active = core.number(section.dataset.step) === step;
      section.hidden = !active;
      section.classList.toggle("is-active", active);
    });
    document.querySelectorAll(".step-tab").forEach((button) => {
      const target = core.number(button.dataset.stepTarget);
      button.disabled = target > maxVisited;
      button.classList.toggle("is-current", target === step);
      button.classList.toggle("is-complete", target < step || (target < maxVisited && target !== step));
      if (target === step) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    byId("progress-fill").style.width = `${((step - 1) / 4) * 100}%`;
    core.track("karte_step_viewed", { variant: "B", step });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleEventFields = () => {
    byId("home-fields").classList.toggle("hide", !checked("b-home-enabled"));
    byId("education-fields").classList.toggle("hide", !checked("b-education-enabled"));
    byId("car-fields").classList.toggle("hide", !checked("b-car-enabled"));
  };

  const readState = () => {
    const age = core.clamp(n("b-age", 39), 18, 79);
    const retireAge = Math.max(age + 1, n("b-retire-age", 65));
    const assets = Math.max(0, n("b-assets"));
    const monthly = Math.max(0, n("b-monthly"));
    const rate = n("b-rate") / 100;
    const annualIncome = Math.max(0, n("b-income") + n("b-spouse-income"));
    const expenses = Math.max(0, n("b-expenses"));
    const retirementExpense = Math.max(0, n("b-retirement-expense"));
    const pension = Math.max(0, n("b-pension"));
    const experience = n("b-experience");
    const risk = byId("b-risk").value;
    const business = byId("b-business").value;
    const consult = byId("b-consult").value;
    const meeting = checked("b-meeting");
    const selectedInterests = interests();
    const retirementGapAnnual = Math.max(0, retirementExpense - pension) * 12;
    const target = Math.max(2000, retirementGapAnnual * Math.max(0, 100 - retireAge));
    const future = core.futureValue(assets, monthly, rate, retireAge - age);
    const required = core.requiredMonthly(assets, target, rate, retireAge - age);

    return {
      age,
      retireAge,
      assets,
      monthly,
      rate,
      annualIncome,
      expenses,
      retirementExpense,
      pension,
      retirementGapAnnual,
      experience,
      risk,
      business,
      consult,
      meeting,
      interests: selectedInterests,
      target,
      future,
      required,
      household: byId("b-household").value,
      cryptoRatio: n("b-crypto-ratio"),
      homeEnabled: checked("b-home-enabled"),
      homeAge: n("b-home-age"),
      homeCost: n("b-home-cost"),
      educationEnabled: checked("b-education-enabled"),
      children: n("b-children"),
      educationAge: n("b-education-age"),
      educationCost: n("b-education-cost"),
      carEnabled: checked("b-car-enabled"),
      carAge: n("b-car-age"),
      carCost: n("b-car-cost"),
      carCycle: Math.max(3, n("b-car-cycle", 8)),
    };
  };

  const projectLife = (state) => {
    const values = [];
    const events = [];
    let balance = state.assets;
    const retirementRate = Math.min(state.rate, 0.04);

    const eventCostAt = (age) => {
      let total = 0;
      if (state.homeEnabled && Math.round(state.homeAge) === age) {
        total += state.homeCost;
        events.push({ age, label: "住宅", cost: state.homeCost });
      }

      if (state.educationEnabled && state.children > 0) {
        const startAge = Math.round(state.educationAge) - 4;
        const endAge = startAge + 7;
        if (age >= startAge && age <= endAge) {
          const annualEducation = (state.educationCost * state.children) / 8;
          total += annualEducation;
          if (age === Math.round(state.educationAge)) {
            events.push({ age, label: "教育費の山", cost: annualEducation });
          }
        }
      }

      if (state.carEnabled && age >= state.carAge && (age - Math.round(state.carAge)) % state.carCycle === 0) {
        total += state.carCost;
        events.push({ age, label: "車", cost: state.carCost });
      }
      return total;
    };

    for (let age = state.age; age <= 100; age += 1) {
      if (age > state.age) {
        if (age <= state.retireAge) {
          balance = (balance + state.monthly * 12) * (1 + state.rate);
        } else {
          balance = balance * (1 + retirementRate) - state.retirementGapAnnual;
        }
        balance -= eventCostAt(age);
      }
      values.push({ age, value: balance });
    }

    events.push({ age: state.retireAge, label: "リタイア", cost: 0 });
    events.sort((a, b) => a.age - b.age);
    const retirePoint = values.find((point) => point.age === Math.round(state.retireAge)) || values[0];
    const age100Point = values[values.length - 1];
    const lowest = values.reduce((min, point) => (point.value < min.value ? point : min), values[0]);
    const shortfall = values.find((point) => point.value < 0) || null;
    return { values, events, retirePoint, age100Point, lowest, shortfall };
  };

  const svgEl = (tag, attrs = {}) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  };

  const renderLifeChart = (state, projection) => {
    const width = 900;
    const height = 330;
    const pad = { left: 68, right: 35, top: 24, bottom: 42 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const rawMin = Math.min(0, ...projection.values.map((point) => point.value));
    const rawMax = Math.max(1000, ...projection.values.map((point) => point.value));
    const range = Math.max(1000, rawMax - rawMin);
    const minValue = Math.floor((rawMin - range * 0.08) / 500) * 500;
    const maxValue = Math.ceil((rawMax + range * 0.08) / 500) * 500;
    const x = (age) => pad.left + ((age - state.age) / (100 - state.age)) * plotWidth;
    const y = (value) => pad.top + ((maxValue - value) / (maxValue - minValue)) * plotHeight;
    const path = projection.values.map((point, index) =>
      `${index === 0 ? "M" : "L"} ${x(point.age).toFixed(1)} ${y(point.value).toFixed(1)}`
    ).join(" ");
    const baseline = y(Math.max(0, minValue));
    const area = `${path} L ${x(100).toFixed(1)} ${baseline.toFixed(1)} L ${x(state.age).toFixed(1)} ${baseline.toFixed(1)} Z`;

    byId("b-roadmap-line").setAttribute("d", path);
    byId("b-roadmap-area").setAttribute("d", area);
    byId("b-zero-line").setAttribute("d", `M ${pad.left} ${y(0)} L ${width - pad.right} ${y(0)}`);

    const band = byId("b-retirement-band");
    band.replaceChildren();
    band.appendChild(svgEl("rect", {
      x: x(state.retireAge),
      y: pad.top,
      width: Math.max(0, x(100) - x(state.retireAge)),
      height: plotHeight,
      class: "retirement-band",
    }));

    const grid = byId("b-chart-grid");
    const labels = byId("b-chart-labels");
    const markers = byId("b-event-markers");
    grid.replaceChildren();
    labels.replaceChildren();
    markers.replaceChildren();

    for (let i = 0; i <= 4; i += 1) {
      const value = minValue + ((maxValue - minValue) * i) / 4;
      const gy = y(value);
      grid.appendChild(svgEl("line", {
        x1: pad.left,
        x2: width - pad.right,
        y1: gy,
        y2: gy,
        class: "chart-grid-line",
      }));
      const text = svgEl("text", {
        x: pad.left - 9,
        y: gy + 4,
        "text-anchor": "end",
        class: "chart-axis-label",
      });
      text.textContent = core.formatMan(value, true);
      labels.appendChild(text);
    }

    const tickCandidates = [state.age, 50, state.retireAge, 80, 100]
      .filter((value, index, array) => value >= state.age && array.indexOf(value) === index)
      .sort((a, b) => a - b);
    tickCandidates.forEach((age) => {
      const text = svgEl("text", {
        x: x(age),
        y: height - 13,
        "text-anchor": age === state.age ? "start" : age === 100 ? "end" : "middle",
        class: "chart-axis-label",
      });
      text.textContent = `${Math.round(age)}歳`;
      labels.appendChild(text);
    });

    const visibleEvents = projection.events
      .filter((event, index, array) => array.findIndex((item) => item.age === event.age && item.label === event.label) === index)
      .slice(0, 8);
    visibleEvents.forEach((event, index) => {
      const point = projection.values.find((item) => item.age === Math.round(event.age));
      if (!point) return;
      const cx = x(event.age);
      const cy = y(point.value);
      const labelY = pad.top + 14 + (index % 2) * 16;
      markers.appendChild(svgEl("line", {
        x1: cx,
        x2: cx,
        y1: labelY + 4,
        y2: cy - 5,
        class: "event-marker-line",
      }));
      markers.appendChild(svgEl("circle", {
        cx,
        cy,
        r: 4,
        class: "event-marker-dot",
      }));
      const label = svgEl("text", {
        x: cx,
        y: labelY,
        "text-anchor": "middle",
        class: "event-marker-label",
      });
      label.textContent = event.label;
      markers.appendChild(label);
    });

    const legend = byId("b-event-legend");
    legend.replaceChildren();
    visibleEvents.forEach((event) => {
      const item = document.createElement("span");
      item.className = "event-pill";
      item.textContent = event.cost > 0
        ? `${Math.round(event.age)}歳 ${event.label} ${core.formatMan(event.cost, true)}`
        : `${Math.round(event.age)}歳 ${event.label}`;
      legend.appendChild(item);
    });
  };

  const renderScores = (scores) => {
    const rows = [
      ["資産形成ニーズ", scores.need],
      ["投資意欲", scores.motivation],
      ["提案適合度", scores.fit],
      ["LTV予測", scores.ltv],
    ];
    const list = byId("b-score-list");
    list.replaceChildren();
    rows.forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "score-row";
      row.innerHTML = `<span class="score-name"></span><span class="score-track"><span class="score-fill"></span></span><strong class="score-value"></strong>`;
      row.children[0].textContent = label;
      row.querySelector(".score-fill").style.width = `${value}%`;
      row.children[2].textContent = value;
      list.appendChild(row);
    });
  };

  const annualPlan = (state, diagnosis, projection) => {
    const riskAction = state.cryptoRatio > 20
      ? "高変動資産の上限を20%以下へ見直し、損失許容額を明文化します。"
      : "現預金・長期運用・高変動資産の上限を決め、自動積立を開始します。";
    const incomeAction = diagnosis.primary === "収入拡張" || state.interests.includes("ai")
      ? "AI活用や副業候補を1つ選び、月3万円の追加原資を検証します。"
      : "賞与・余剰資金の追加投資ルールを決め、年間投資額を安定させます。";
    const eventAction = projection.events.some((event) => event.age <= state.age + 10 && event.cost > 0)
      ? "10年以内の住宅・教育・車費用を別口座へ分け、運用資産と混ぜない設計にします。"
      : "ライフイベント予備費を見直し、想定外支出のバッファを確保します。";
    return [
      ["1〜3か月", "家計と守りを整える", `生活費6か月分の目安は${core.formatMan(state.expenses * 6)}。まず現金枠を分離します。`],
      ["4〜6か月", "運用ルールを固定", riskAction],
      ["7〜9か月", "原資を増やす", incomeAction],
      ["10〜12か月", "カルテを更新", eventAction],
    ];
  };

  const renderResult = () => {
    const state = readState();
    const projection = projectLife(state);
    state.future = projection.retirePoint.value;
    const scores = core.scoreProfile(state);
    const diagnosis = core.diagnose(state, scores);
    const actions = core.actionPlan(state, diagnosis);
    const tags = core.buildTags(state, diagnosis, scores);

    setText("b-retire-assets", core.formatMan(projection.retirePoint.value));
    setText("b-retire-assets-note", `${state.retireAge}歳時点 / 積立月${core.formatMonthly(state.monthly)}`);
    setText("b-age100-assets", core.formatMan(projection.age100Point.value));
    setText("b-age100-note", projection.shortfall ? `${projection.shortfall.age}歳で資産がマイナス圏` : "100歳までプラス圏を維持");
    setText("b-diagnosis", `${diagnosis.primary} × ${diagnosis.secondary}`);
    setText("b-stage", `顧客ステージ：${diagnosis.stage}`);

    const healthy = !projection.shortfall && projection.age100Point.value >= 0;
    const caution = !projection.shortfall && projection.lowest.value < state.retirementGapAnnual * 5;
    setText("b-health-status", healthy && !caution ? "資産寿命 100歳+" : caution ? "要バッファ確認" : `${projection.shortfall.age}歳で不足`);
    byId("b-health-status").className = `status-chip ${healthy && !caution ? "good" : "hot"}`;

    const position = projection.shortfall
      ? `大きな支出と老後の取り崩しを反映すると、${projection.shortfall.age}歳ごろに資産が不足する見込みです。積立額・リタイア年齢・老後生活費の3点を優先して見直します。`
      : `現在の条件では100歳まで資産がプラス圏を維持する見込みです。${state.retireAge}歳までの積立継続と、イベント資金を運用資産から分けることが安定の鍵です。`;
    setText("b-position-text", position);
    byId("b-position-callout").className = `callout ${projection.shortfall ? "danger" : caution ? "warn" : ""}`;

    const actionList = byId("b-action-list");
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

    const plan = annualPlan(state, diagnosis, projection);
    const annual = byId("annual-roadmap");
    annual.replaceChildren();
    plan.forEach(([period, title, note]) => {
      const quarter = document.createElement("article");
      quarter.className = "quarter";
      const periodEl = document.createElement("span");
      const titleEl = document.createElement("strong");
      const noteEl = document.createElement("p");
      periodEl.textContent = period;
      titleEl.textContent = title;
      noteEl.textContent = note;
      quarter.append(periodEl, titleEl, noteEl);
      annual.appendChild(quarter);
    });

    renderLifeChart(state, projection);
    renderScores(scores);

    const tagList = byId("b-tag-list");
    tagList.replaceChildren();
    const eventTags = [];
    if (state.homeEnabled) eventTags.push("予定:住宅");
    if (state.educationEnabled) eventTags.push("予定:教育");
    if (state.cryptoRatio >= 20) eventTags.push("高変動資産20%+");
    [...tags, ...eventTags].slice(0, 10).forEach((tag) => {
      const element = document.createElement("span");
      element.className = "tag";
      element.textContent = tag;
      tagList.appendChild(element);
    });

    const notify = diagnosis.heat === "high" ||
      state.meeting ||
      scores.overall >= 80 ||
      (state.interests.some((item) => ["realestate", "corporate", "ai"].includes(item)) && state.assets >= 500);
    setText("b-notification", notify ? "担当者通知 ON" : "教育フォロー");
    byId("b-notification").className = `status-chip ${notify ? "hot" : "good"}`;

    let supportTitle = "おすすめ：学習コンテンツを継続";
    let supportText = "診断結果に合う基礎講座を案内し、90日後のカルテ更新へつなぎます。";
    if (state.meeting || state.consult === "month") {
      supportTitle = "おすすめ：個別ロードマップ相談";
      supportText = "家族・資産・働き方をまとめて確認し、具体的な優先順位を設計します。";
    } else if (state.interests.includes("corporate")) {
      supportTitle = "おすすめ：法人・事業成長診断";
      supportText = "法人化、AI導入、業務効率化、法人資産運用を追加ヒアリングします。";
    } else if (state.interests.includes("realestate")) {
      supportTitle = "おすすめ：不動産適合度チェック";
      supportText = "自己資金、与信、保有目的から不動産活用の適合条件を整理します。";
    }
    setText("b-support-title", supportTitle);
    setText("b-support-text", supportText);
  };

  const saveDraft = () => {
    try {
      const data = {};
      Array.from(form.elements).forEach((element) => {
        if (!element.name) return;
        if (element.type === "checkbox") {
          if (element.name === "bInterest") {
            if (!Array.isArray(data.bInterest)) data.bInterest = [];
            if (element.checked) data.bInterest.push(element.value);
          } else {
            data[element.name] = element.checked;
          }
        } else {
          data[element.name] = element.value;
        }
      });
      localStorage.setItem("mirai-karte-pattern-b-draft", JSON.stringify(data));
    } catch (error) {
      // Draft saving is optional in restricted browser modes.
    }
  };

  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem("mirai-karte-pattern-b-draft");
      if (!raw) return;
      const data = JSON.parse(raw);
      Array.from(form.elements).forEach((element) => {
        if (!element.name || !(element.name in data)) return;
        if (element.type === "checkbox") {
          element.checked = element.name === "bInterest"
            ? data.bInterest.includes(element.value)
            : Boolean(data[element.name]);
        } else {
          element.value = data[element.name];
        }
      });
    } catch (error) {
      // Ignore malformed or unavailable local drafts.
    }
  };

  document.querySelectorAll(".next-step").forEach((button) => {
    button.addEventListener("click", () => showStep(core.number(button.dataset.next)));
  });
  document.querySelectorAll(".previous-step").forEach((button) => {
    button.addEventListener("click", () => showStep(core.number(button.dataset.previous)));
  });
  document.querySelectorAll(".step-tab").forEach((button) => {
    button.addEventListener("click", () => {
      const target = core.number(button.dataset.stepTarget);
      if (target <= maxVisited) showStep(target);
    });
  });

  ["b-home-enabled", "b-education-enabled", "b-car-enabled"].forEach((id) => {
    byId(id).addEventListener("change", toggleEventFields);
  });

  document.querySelectorAll("#b-rate-presets .segment").forEach((button) => {
    button.addEventListener("click", () => {
      byId("b-rate").value = button.dataset.rate;
      document.querySelectorAll("#b-rate-presets .segment").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      setText("b-rate-value", `${n("b-rate").toFixed(1)}%`);
      saveDraft();
    });
  });

  byId("b-rate").addEventListener("input", () => {
    setText("b-rate-value", `${n("b-rate").toFixed(1)}%`);
    document.querySelectorAll("#b-rate-presets .segment").forEach((button) => button.classList.remove("is-active"));
  });
  byId("b-crypto-ratio").addEventListener("input", () => {
    setText("b-crypto-ratio-value", `${n("b-crypto-ratio")}%`);
  });

  byId("show-result").addEventListener("click", () => {
    if (!checked("b-consent")) {
      byId("consent-error").classList.remove("hide");
      byId("b-consent").focus();
      return;
    }
    byId("consent-error").classList.add("hide");
    renderResult();
    core.track("karte_result_viewed", { variant: "B" });
    showStep(5);
  });

  byId("edit-answers").addEventListener("click", () => showStep(1));
  byId("b-consent").addEventListener("change", () => byId("consent-error").classList.add("hide"));
  form.addEventListener("input", () => {
    if (!inputStartedTracked) {
      inputStartedTracked = true;
      core.track("karte_input_started", { variant: "B" });
    }
    saveDraft();
  });
  form.addEventListener("change", saveDraft);
  byId("b-meeting").addEventListener("change", () => {
    core.track("karte_meeting_requested", { variant: "B", requested: byId("b-meeting").checked });
  });

  restoreDraft();
  toggleEventFields();
  setText("b-rate-value", `${n("b-rate").toFixed(1)}%`);
  setText("b-crypto-ratio-value", `${n("b-crypto-ratio")}%`);
  core.track("karte_opened", { variant: "B" });
  showStep(1);
})();
