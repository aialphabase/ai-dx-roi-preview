(function () {
  "use strict";

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const number = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const futureValue = (principalMan, monthlyMan, annualRate, years) => {
    const months = Math.max(0, Math.round(years * 12));
    const monthlyRate = Math.max(-0.99, annualRate) / 12;
    if (months === 0) return principalMan;
    if (Math.abs(monthlyRate) < 0.0000001) {
      return principalMan + monthlyMan * months;
    }
    const factor = Math.pow(1 + monthlyRate, months);
    return principalMan * factor + monthlyMan * ((factor - 1) / monthlyRate);
  };

  const requiredMonthly = (principalMan, targetMan, annualRate, years) => {
    const months = Math.max(0, Math.round(years * 12));
    if (months === 0) return Math.max(0, targetMan - principalMan);
    const monthlyRate = Math.max(-0.99, annualRate) / 12;
    if (Math.abs(monthlyRate) < 0.0000001) {
      return Math.max(0, (targetMan - principalMan) / months);
    }
    const factor = Math.pow(1 + monthlyRate, months);
    const annuityFactor = (factor - 1) / monthlyRate;
    return Math.max(0, (targetMan - principalMan * factor) / annuityFactor);
  };

  const formatMan = (value, compact = false) => {
    const amount = Math.round(number(value));
    const sign = amount < 0 ? "-" : "";
    const absolute = Math.abs(amount);
    if (compact && absolute >= 10000) {
      const oku = absolute / 10000;
      return `${sign}${oku.toFixed(oku >= 10 ? 0 : 1)}億円`;
    }
    if (absolute >= 10000) {
      const oku = Math.floor(absolute / 10000);
      const man = absolute % 10000;
      return man === 0
        ? `${sign}${oku.toLocaleString("ja-JP")}億円`
        : `${sign}${oku.toLocaleString("ja-JP")}億${man.toLocaleString("ja-JP")}万円`;
    }
    return `${sign}${absolute.toLocaleString("ja-JP")}万円`;
  };

  const formatMonthly = (value) => `${number(value).toFixed(value < 10 ? 1 : 0)}万円`;

  const scoreProfile = (input) => {
    const annualIncome = number(input.annualIncome);
    const assets = number(input.assets);
    const monthly = number(input.monthly);
    const rate = number(input.rate);
    const target = number(input.target);
    const future = number(input.future);
    const experience = number(input.experience);
    const risk = input.risk || "balanced";
    const interests = Array.isArray(input.interests) ? input.interests : [];
    const consult = input.consult || "none";
    const meeting = Boolean(input.meeting);
    const business = input.business || "employee";

    const need = clamp(
      25 +
        (future < target ? 25 : 5) +
        (monthly < annualIncome / 120 ? 15 : 5) +
        (assets < annualIncome ? 15 : 4) +
        (interests.length >= 3 ? 10 : interests.length * 3),
      0,
      100
    );

    const motivation = clamp(
      20 +
        Math.min(30, monthly * 1.8) +
        experience * 8 +
        (risk === "growth" ? 14 : risk === "balanced" ? 8 : 3) +
        (consult !== "none" ? 12 : 0),
      0,
      100
    );

    const fit = clamp(
      18 +
        Math.min(24, interests.length * 7) +
        (annualIncome >= 700 ? 12 : annualIncome >= 450 ? 7 : 3) +
        (assets >= 500 ? 12 : assets >= 200 ? 7 : 3) +
        (meeting ? 22 : consult !== "none" ? 11 : 2),
      0,
      100
    );

    const ltv = clamp(
      15 +
        (annualIncome >= 1000 ? 20 : annualIncome >= 700 ? 14 : annualIncome >= 450 ? 8 : 3) +
        (assets >= 3000 ? 20 : assets >= 1000 ? 14 : assets >= 500 ? 8 : 3) +
        (business === "owner" || business === "self" ? 15 : 5) +
        (interests.includes("corporate") ? 10 : 0) +
        (meeting ? 16 : 4),
      0,
      100
    );

    const overall = Math.round(need * 0.28 + motivation * 0.27 + fit * 0.3 + ltv * 0.15);
    return {
      need: Math.round(need),
      motivation: Math.round(motivation),
      fit: Math.round(fit),
      ltv: Math.round(ltv),
      overall,
    };
  };

  const diagnose = (input, scores) => {
    const future = number(input.future);
    const target = number(input.target);
    const savingsRate = number(input.annualIncome) > 0
      ? (number(input.monthly) * 12) / number(input.annualIncome)
      : 0;
    const interests = Array.isArray(input.interests) ? input.interests : [];
    const business = input.business || "employee";

    let primary = "安定構築";
    if (business === "owner" || business === "self" || interests.includes("corporate")) {
      primary = "法人・事業成長";
    } else if (interests.includes("realestate") && number(input.assets) >= 500) {
      primary = "不動産活用";
    } else if (savingsRate < 0.12 || number(input.annualIncome) < 500) {
      primary = "収入拡張";
    } else if (future < target * 0.75) {
      primary = "資産形成準備";
    }

    let secondary = "安定構築";
    if (scores.fit >= 78 || input.meeting) {
      secondary = "専門家伴走";
    } else if (future < target) {
      secondary = "資産形成準備";
    } else if (number(input.experience) <= 1) {
      secondary = "学習準備";
    } else if (input.risk === "conservative") {
      secondary = "守り優先";
    } else if (interests.includes("realestate")) {
      secondary = "不動産活用";
    }

    if (secondary === primary) {
      if (primary === "安定構築") {
        secondary = input.risk === "conservative" ? "守り優先" : "資産形成準備";
      } else {
        secondary = future >= target ? "安定構築" : "資産形成準備";
      }
    }

    const heat = input.meeting || scores.overall >= 80
      ? "high"
      : scores.overall >= 60 || input.consult !== "none"
        ? "medium"
        : "low";

    const stage = input.meeting
      ? "相談希望"
      : scores.fit >= 75
        ? "提案候補"
        : scores.motivation >= 60
          ? "育成中"
          : "診断完了";

    return { primary, secondary, heat, stage };
  };

  const actionPlan = (input, diagnosis) => {
    const items = [];
    const gap = number(input.target) - number(input.future);
    const required = number(input.required);
    const monthly = number(input.monthly);
    const interests = Array.isArray(input.interests) ? input.interests : [];

    if (gap > 0) {
      items.push({
        title: "積立額と目標時期を再調整",
        note: `目標到達に必要な積立は月${formatMonthly(required)}。現在との差を段階的に埋めます。`,
      });
    } else {
      items.push({
        title: "達成確率を守る配分へ",
        note: "目標線を上回るため、生活防衛資金と長期運用枠を分けて維持します。",
      });
    }

    if (diagnosis.primary === "収入拡張" || monthly < 8) {
      items.push({
        title: "収入拡張の余白をつくる",
        note: "AI活用・副業・キャリア設計から、月3〜5万円の追加原資を目標にします。",
      });
    } else if (interests.includes("realestate")) {
      items.push({
        title: "不動産の適合条件を確認",
        note: "自己資金・与信・保有目的を整理し、金融資産との役割分担を決めます。",
      });
    } else {
      items.push({
        title: "自動積立を一本化",
        note: "給与直後の自動積立と年1回のリバランスで、判断回数を減らします。",
      });
    }

    if (diagnosis.heat === "high") {
      items.push({
        title: "個別ロードマップを作成",
        note: "家族・税務・事業条件を含め、専門家と次の12か月を具体化します。",
      });
    } else {
      items.push({
        title: "90日後にカルテを更新",
        note: "収入・資産・関心テーマの変化を反映し、優先順位を見直します。",
      });
    }
    return items.slice(0, 3);
  };

  const buildTags = (input, diagnosis, scores) => {
    const tags = [
      `ステージ:${diagnosis.stage}`,
      `温度:${diagnosis.heat === "high" ? "高" : diagnosis.heat === "medium" ? "中" : "低"}`,
      `診断:${diagnosis.primary}`,
    ];
    const interestLabels = {
      investment: "資産形成",
      crypto: "暗号資産",
      realestate: "不動産",
      ai: "AI活用",
      sidejob: "副業",
      corporate: "法人化",
      tax: "節税",
      inheritance: "相続",
    };
    (input.interests || []).forEach((value) => {
      if (interestLabels[value]) tags.push(`関心:${interestLabels[value]}`);
    });
    if (input.meeting) tags.push("面談希望");
    if (scores.overall >= 80) tags.push("スコア80+");
    if (number(input.assets) >= 1000) tags.push("金融資産1000万+");
    return tags.slice(0, 8);
  };

  const track = (name, payload = {}) => {
    const event = {
      event: name,
      occurred_at: new Date().toISOString(),
      ...payload,
    };
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(event);
    }
    window.dispatchEvent(new CustomEvent("mirai:analytics", { detail: event }));
    return event;
  };

  window.MiraiCore = {
    clamp,
    number,
    futureValue,
    requiredMonthly,
    formatMan,
    formatMonthly,
    scoreProfile,
    diagnose,
    actionPlan,
    buildTags,
    track,
  };
})();
