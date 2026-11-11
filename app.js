(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const number = (id) => Number($(id).value);
  const fixed = (value, digits = 2) => Number(value).toFixed(digits);
  const near = (a, b, epsilon = 1e-8) => Math.abs(a - b) <= epsilon;

  const zoneDefaults = {
    1: { rA: 1, rB: 0, name: "total A control" },
    2: { rA: 0.75, rB: 0.25, name: "A dominance" },
    3: { rA: 0.5, rB: 0.5, name: "parity" },
    4: { rA: 0.25, rB: 0.75, name: "B dominance" },
    5: { rA: 0, rB: 1, name: "total B control" }
  };

  const zonePredictions = {
    1: {
      defection: "Low toward B · high toward A",
      defectionDetail: "A's monopoly deters collaboration with B; B cannot reliably deter collaboration with A.",
      equilibrium: "(D,N) · A denounces, B does not",
      equilibriumDetail: "A-associated civilians can denounce under protection; B-associated civilians face credible retaliation.",
      violence: "Low selective violence by A",
      violenceDetail: "A has few meaningful defectors. Weak-B violence, if any, is more likely indiscriminate.",
      aSelective: false,
      bSelective: false,
      aOutcome: "Little selective violence predicted",
      bOutcome: "If violence occurs: more likely indiscriminate",
      interpretation: "A's total control leaves few genuine defectors and makes hostile denunciations less informative. Low selective killing is not benevolence; it reflects reduced need."
    },
    2: {
      defection: "Some defection toward B · lower toward A",
      defectionDetail: "A controls the locality but still faces a meaningful collaboration problem.",
      equilibrium: "(D,N) · A denounces, B does not",
      equilibriumDetail: "A can shield its collaborators, so denunciations against B-associated rivals are feasible.",
      violence: "A selective violence peaks",
      violenceDetail: "A combines organizational capacity, usable information, and a continuing defection problem.",
      aSelective: true,
      bSelective: false,
      aOutcome: "Selective violence predicted",
      bOutcome: "If violence occurs: more likely indiscriminate",
      interpretation: "Fragmented but asymmetric control gives A both a reason to punish defection and access to protected denunciations. This is the model's peak zone for A's selective violence."
    },
    3: {
      defection: "High toward both sides",
      defectionDetail: "Neither organization can reliably deter collaboration with its rival.",
      equilibrium: "(N,N) · mutual non-denunciation",
      equilibriumDetail: "Counterdenunciation is credible on both sides, suppressing the supply of personalized information.",
      violence: "Low for both actors",
      violenceDetail: "The demand for information is high, but safe denunciation is scarce.",
      aSelective: false,
      bSelective: false,
      aOutcome: "No selective violence predicted",
      bOutcome: "No selective violence predicted",
      interpretation: "Both organizations face defection, yet neither side can safely obtain denunciations. The model predicts little selective homicidal violence—not literal peace."
    },
    4: {
      defection: "Some defection toward A · lower toward B",
      defectionDetail: "B controls the locality but still faces a meaningful collaboration problem.",
      equilibrium: "(N,D) · B denounces, A does not",
      equilibriumDetail: "B can shield its collaborators, so denunciations against A-associated rivals are feasible.",
      violence: "B selective violence peaks",
      violenceDetail: "B combines organizational capacity, usable information, and a continuing defection problem.",
      aSelective: false,
      bSelective: true,
      aOutcome: "If violence occurs: more likely indiscriminate",
      bOutcome: "Selective violence predicted",
      interpretation: "Fragmented but asymmetric control gives B both a reason to punish defection and access to protected denunciations. This is the model's peak zone for B's selective violence."
    },
    5: {
      defection: "High toward B · low toward A",
      defectionDetail: "B's monopoly deters collaboration with A; A cannot reliably deter collaboration with B.",
      equilibrium: "(N,D) · B denounces, A does not",
      equilibriumDetail: "B-associated civilians can denounce under protection; A-associated civilians face credible retaliation.",
      violence: "Low selective violence by B",
      violenceDetail: "B has few meaningful defectors. Weak-A violence, if any, is more likely indiscriminate.",
      aSelective: false,
      bSelective: false,
      aOutcome: "If violence occurs: more likely indiscriminate",
      bOutcome: "Little selective violence predicted",
      interpretation: "B's total control leaves few genuine defectors and makes hostile denunciations less informative. Low selective killing is not benevolence; it reflects reduced need."
    }
  };

  const tableRows = [
    ["1 · Total A", "High", "Low", "(D,N)", "Low by A; weak B may be indiscriminate"],
    ["2 · A dominance", "High", "Medium", "(D,N)", "A selective violence peaks"],
    ["3 · Parity", "High", "High", "(N,N)", "Low selective violence for both"],
    ["4 · B dominance", "Medium", "High", "(N,D)", "B selective violence peaks"],
    ["5 · Total B", "Low", "High", "(N,D)", "Low by B; weak A may be indiscriminate"]
  ];

  const ordinalDefection = {
    1: { kA: "Low", kB: "High" },
    2: { kA: "Medium", kB: "High" },
    3: { kA: "High", kB: "High" },
    4: { kA: "High", kB: "Medium" },
    5: { kA: "High", kB: "Low" }
  };

  const state = {
    mode: "faithful",
    zone: 3,
    rA: 0.5,
    rB: 0.5,
    customControl: false
  };

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
  }

  function setWarning(id, messages) {
    const box = $(id);
    if (!box) return;
    const clean = messages.filter(Boolean);
    box.hidden = clean.length === 0;
    box.textContent = clean.join(" ");
  }

  function logisticRetaliation(control, steepness) {
    return 1 / (1 + Math.exp(steepness * (control - 0.5)));
  }

  function getQ() {
    const steepness = number("qSteepness");
    if ($("overrideQ").checked) {
      return { qA: number("qASlider"), qB: number("qBSlider") };
    }
    return {
      qA: logisticRetaliation(state.rB, steepness),
      qB: logisticRetaliation(state.rA, steepness)
    };
  }

  function classifyEquilibria(ratio, qA, qB) {
    const eps = 0.000001;
    const equilibria = [];
    if (ratio + eps >= Math.max(qA, qB)) equilibria.push("DD");
    if (ratio - eps <= Math.min(qA, qB)) equilibria.push("NN");
    if (ratio + eps >= qB && ratio - eps <= qA) equilibria.push("DN");
    if (ratio + eps >= qA && ratio - eps <= qB) equilibria.push("ND");
    return [...new Set(equilibria)];
  }

  function equilibriumName(code) {
    return {
      DD: "mutual denunciation",
      DN: "A denounces, B does not",
      ND: "B denounces, A does not",
      NN: "mutual non-denunciation"
    }[code];
  }

  function nearestZone(rA, rB) {
    let best = 3;
    let distance = Infinity;
    Object.entries(zoneDefaults).forEach(([zone, values]) => {
      const nextDistance = Math.hypot(rA - values.rA, rB - values.rB);
      if (nextDistance < distance) {
        distance = nextDistance;
        best = Number(zone);
      }
    });
    return best;
  }

  function updateModeControls() {
    const exploring = state.mode === "explore";
    $("faithfulMode").classList.toggle("is-active", !exploring);
    $("exploreMode").classList.toggle("is-active", exploring);
    $("faithfulMode").setAttribute("aria-pressed", String(!exploring));
    $("exploreMode").setAttribute("aria-pressed", String(exploring));
    $("independentControl").disabled = !exploring;
    if (!exploring) {
      $("independentControl").checked = false;
      $("overrideQ").checked = false;
      $("informationMode").value = "model";
      state.customControl = false;
      applyZone(state.zone, false);
    }
    updateControlAvailability();
  }

  function updateControlAvailability() {
    const exploring = state.mode === "explore";
    const independent = exploring && $("independentControl").checked;
    $("rASlider").disabled = !exploring;
    $("rBSlider").disabled = !independent;
    $("overrideQ").disabled = !exploring;
    const qOverride = exploring && $("overrideQ").checked;
    $("qASlider").disabled = !qOverride;
    $("qBSlider").disabled = !qOverride;
    $("qSteepness").disabled = !exploring || qOverride;
    $("informationMode").disabled = !exploring;
  }

  function applyZone(zone, render = true) {
    const next = zoneDefaults[zone];
    state.zone = zone;
    state.rA = next.rA;
    state.rB = next.rB;
    state.customControl = false;
    $("rASlider").value = state.rA;
    $("rBSlider").value = state.rB;
    if (render) updateAll();
  }

  function updateZoneSelector() {
    $$(".zone-button").forEach((button) => {
      const active = Number(button.dataset.zone) === state.zone && !state.customControl;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-checked", String(active));
    });
  }

  function updateOutputs() {
    [
      ["iOutput", number("iSlider"), 0], ["uOutput", number("uSlider"), 0],
      ["pCatchAOutput", number("pCatchA"), 2], ["pCatchBOutput", number("pCatchB"), 2],
      ["xOutput", number("xSlider"), 0], ["yOutput", number("ySlider"), 0],
      ["pAOutput", number("pASlider"), 2], ["pBOutput", number("pBSlider"), 2],
      ["rAOutput", state.rA, 2], ["rBOutput", state.rB, 2],
      ["qSteepnessOutput", number("qSteepness"), 0],
      ["bAOutput", number("bASlider"), 0], ["vAOutput", number("vASlider"), 0],
      ["bBOutput", number("bBSlider"), 0], ["vBOutput", number("vBSlider"), 0],
      ["militaryShockOutput", number("militaryShock"), 2],
      ["feedbackStrengthOutput", number("feedbackStrength"), 2]
    ].forEach(([id, value, digits]) => setText(id, fixed(value, digits)));
  }

  function updateStatus(equilibria) {
    const prediction = zonePredictions[state.zone];
    const exploring = state.mode === "explore";
    const customControl = exploring && state.customControl;
    setText("zoneStatus", customControl ? "Custom control profile" : `Zone ${state.zone} · ${zoneDefaults[state.zone].name}`);
    setText("controlStatus", `rᴬ = ${fixed(state.rA)} · rᴮ = ${fixed(state.rB)}`);

    if (!exploring) {
      setText("defectionStatus", prediction.defection);
      setText("defectionDetail", prediction.defectionDetail);
      setText("equilibriumStatus", prediction.equilibrium);
      setText("equilibriumDetail", prediction.equilibriumDetail);
      setText("violenceStatus", prediction.violence);
      setText("violenceDetail", prediction.violenceDetail);
    } else {
      const defA = defectionDecision(number("pCatchB"), number("iSlider"), number("uSlider"));
      const defB = defectionDecision(number("pCatchA"), number("iSlider"), number("uSlider"));
      setText("defectionStatus", `Toward A: ${defA.label.toLowerCase()} · toward B: ${defB.label.toLowerCase()}`);
      setText("defectionDetail", "Custom output from the expected benefit–cost comparison; it is not an estimated defection rate.");
      const eqLabel = equilibria.length === 1 ? `(${equilibria[0][0]},${equilibria[0][1]}) · ${equilibriumName(equilibria[0])}` : "Boundary · multiple equilibria";
      setText("equilibriumStatus", eqLabel);
      setText("equilibriumDetail", "Derived from x/y and the illustrative or overridden q values.");
      const violence = deriveExploreViolence(equilibria);
      setText("violenceStatus", violence.status);
      setText("violenceDetail", violence.detail);
    }

    setText("liveSummary", `${customControl ? "Explore mode custom profile" : `Zone ${state.zone}`}. ${$("defectionStatus").textContent}. ${$("equilibriumStatus").textContent}. ${$("violenceStatus").textContent}.`);
  }

  function defectionDecision(p, i, u) {
    const benefit = (1 - p) * i;
    const cost = p * u;
    if (near(benefit, cost, 0.01)) return { benefit, cost, label: "Boundary" };
    return { benefit, cost, label: benefit > cost ? "Attractive" : "Deterred" };
  }

  function updateDefection() {
    const i = number("iSlider");
    const u = number("uSlider");
    const linked = $("linkCatch").checked;
    if (linked) {
      $("pCatchA").value = state.rA;
      $("pCatchB").value = state.rB;
    }
    $("pCatchA").disabled = linked;
    $("pCatchB").disabled = linked;
    const towardB = defectionDecision(number("pCatchA"), i, u);
    const towardA = defectionDecision(number("pCatchB"), i, u);
    const scale = Math.max(i, u, 1);

    setText("benefitToB", fixed(towardB.benefit));
    setText("costToB", fixed(towardB.cost));
    setText("decisionToB", towardB.label);
    setText("benefitToA", fixed(towardA.benefit));
    setText("costToA", fixed(towardA.cost));
    setText("decisionToA", towardA.label);
    $("benefitToBBar").style.width = `${clamp(towardB.benefit / scale) * 100}%`;
    $("costToBBar").style.width = `${clamp(towardB.cost / scale) * 100}%`;
    $("benefitToABar").style.width = `${clamp(towardA.benefit / scale) * 100}%`;
    $("costToABar").style.width = `${clamp(towardA.cost / scale) * 100}%`;
    setText("pThreshold", fixed(i / (i + u)));
    if (state.mode === "faithful") {
      setText("kAStatus", ordinalDefection[state.zone].kA);
      setText("kBStatus", ordinalDefection[state.zone].kB);
    } else {
      const pressure = (decision) => decision.label === "Attractive" ? "High pressure" : decision.label === "Deterred" ? "Low pressure" : "Threshold";
      setText("kAStatus", pressure(towardB));
      setText("kBStatus", pressure(towardA));
    }
    setWarning("defectionWarning", [
      u <= i ? "You have left Kalyvas's baseline assumption u > i; survival-based deterrence may weaken or reverse." : "",
      !linked ? "Custom capture probabilities are an exploratory setting; control and capture are linked only conceptually in Chapter 7." : ""
    ]);
  }

  function updatePayoffMatrix(qA, qB, equilibria) {
    const x = number("xSlider");
    const y = number("ySlider");
    const pA = number("pASlider");
    const pB = number("pBSlider");
    const payoffs = {
      DD: [pA * (x - qB * y) + pB * (qA * x - y), pB * (x - qA * y) + pA * (qB * x - y)],
      DN: [pA * (x - qB * y), pA * (qB * x - y)],
      ND: [pB * (qA * x - y), pB * (x - qA * y)]
    };
    Object.entries(payoffs).forEach(([code, pair]) => setText(`payoff${code}`, `A: ${fixed(pair[0], 1)} · B: ${fixed(pair[1], 1)}`));
    ["DD", "DN", "ND", "NN"].forEach((code) => $("cell" + code).classList.toggle("is-equilibrium", equilibria.includes(code)));
  }

  function renderEquilibriumMap(ratio) {
    const group = $("mapRegions");
    group.innerHTML = "";
    const columns = 30;
    const rows = 20;
    const cellWidth = 420 / columns;
    const cellHeight = 240 / rows;
    const steepness = number("qSteepness");
    const fixedQ = $("overrideQ").checked
      ? { qA: number("qASlider"), qB: number("qBSlider") }
      : null;
    for (let row = 0; row < rows; row += 1) {
      const rA = 1 - (row + 0.5) / rows;
      for (let column = 0; column < columns; column += 1) {
        const rB = (column + 0.5) / columns;
        const qA = fixedQ ? fixedQ.qA : logisticRetaliation(rB, steepness);
        const qB = fixedQ ? fixedQ.qB : logisticRetaliation(rA, steepness);
        const equilibria = classifyEquilibria(ratio, qA, qB);
        const code = equilibria.length === 1 ? equilibria[0].toLowerCase() : "boundary";
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", String(58 + column * cellWidth));
        rect.setAttribute("y", String(24 + row * cellHeight));
        rect.setAttribute("width", String(cellWidth + 0.25));
        rect.setAttribute("height", String(cellHeight + 0.25));
        rect.setAttribute("class", `map-region map-region--${code}`);
        group.append(rect);
      }
    }
  }

  function updateDenunciation() {
    const x = number("xSlider");
    const y = number("ySlider");
    const ratio = x / y;
    const { qA, qB } = getQ();
    $("qASlider").value = qA;
    $("qBSlider").value = qB;
    setText("qAOutput", fixed(qA));
    setText("qBOutput", fixed(qB));
    setText("xyRatio", fixed(ratio));
    setText("qComparison", `qᴬ = ${fixed(qA)} · qᴮ = ${fixed(qB)}`);

    const equilibria = classifyEquilibria(ratio, qA, qB);
    renderEquilibriumMap(ratio);
    const banner = $("equilibriumBanner");
    const label = equilibria.length === 1 ? `(${equilibria[0][0]},${equilibria[0][1]})` : equilibria.map((code) => `(${code[0]},${code[1]})`).join(" / ");
    banner.querySelector("strong").textContent = label;
    banner.querySelector("p").textContent = equilibria.length === 1
      ? `${equilibriumName(equilibria[0])[0].toUpperCase()}${equilibriumName(equilibria[0]).slice(1)} under the current thresholds.`
      : "An equality threshold makes more than one weak equilibrium possible; the model does not select uniquely here.";
    updatePayoffMatrix(qA, qB, equilibria);

    const xPosition = 58 + 420 * state.rB;
    const yPosition = 264 - 240 * state.rA;
    $("mapPoint").setAttribute("cx", fixed(xPosition, 1));
    $("mapPoint").setAttribute("cy", fixed(yPosition, 1));
    $("mapDesc").textContent = `Current point: organization A control ${fixed(state.rA)}, organization B control ${fixed(state.rB)}. Current equilibrium: ${label}.`;

    setWarning("denunciationWarning", [
      x >= y ? "You have left the baseline assumption y > x; eliminating a rival is now at least as valuable as the retaliation cost." : "",
      $("independentControl").checked && state.rA > 0.65 && state.rB > 0.65 ? "Both organizations are strong. Mutual denunciation can be mathematically possible, but Chapter 7 treats two simultaneous local quasi-states as substantively unlikely." : "",
      $("overrideQ").checked ? "The q values are user-defined. Kalyvas gives their direction, not numerical values." : ""
    ]);
    return equilibria;
  }

  function violenceIncentive(b, v) {
    if (b === v) return { wants: false, boundary: true, label: "Boundary: b = v" };
    return { wants: b > v, boundary: false, label: b > v ? "Wants violence" : "Refrains" };
  }

  function hasDenunciation(equilibria, actor) {
    return equilibria.some((code) => actor === "A" ? code[0] === "D" : code[1] === "D");
  }

  function exploreActorOutcome(actor, equilibria) {
    const b = number(actor === "A" ? "bASlider" : "bBSlider");
    const v = number(actor === "A" ? "vASlider" : "vBSlider");
    const incentive = violenceIncentive(b, v);
    const mode = $("informationMode").value;
    const control = actor === "A" ? state.rA : state.rB;
    const opposingControl = actor === "A" ? state.rB : state.rA;
    let information = false;
    if (mode === "monitoring") information = true;
    if (mode === "denunciation") information = hasDenunciation(equilibria, actor);
    if (mode === "model") information = hasDenunciation(equilibria, actor) || control >= 0.9;
    const meaningfulDefection = opposingControl > 0.08 && control < 0.96;

    if (incentive.boundary) return { ...incentive, outcome: "Indeterminate organizational choice", information, selective: false };
    if (!incentive.wants) return { ...incentive, outcome: "No organizational violence predicted", information, selective: false };
    if ((mode === "false" || mode === "none") || !information) {
      return { ...incentive, outcome: control < 0.4 ? "If violence occurs: more likely indiscriminate" : "No selective violence: information constraint", information: false, selective: false };
    }
    if (!meaningfulDefection) return { ...incentive, outcome: "Little selective violence: few meaningful defectors", information, selective: false };
    return { ...incentive, outcome: "Selective violence is feasible", information, selective: true };
  }

  function deriveExploreViolence(equilibria) {
    const a = exploreActorOutcome("A", equilibria);
    const b = exploreActorOutcome("B", equilibria);
    const active = [a.selective ? "A" : "", b.selective ? "B" : ""].filter(Boolean);
    return {
      status: active.length ? `Selective violence feasible for ${active.join(" and ")}` : "No selective violence currently feasible",
      detail: `${a.outcome}; ${b.outcome}. Numeric settings are exploratory, not estimated probabilities.`
    };
  }

  function updateViolence(equilibria) {
    const canonical = state.mode === "faithful" && !state.customControl;
    const prediction = zonePredictions[state.zone];
    const aIncentive = violenceIncentive(number("bASlider"), number("vASlider"));
    const bIncentive = violenceIncentive(number("bBSlider"), number("vBSlider"));
    const canonicalResult = (incentive, predictedOutcome, predictedSelective) => ({
      ...incentive,
      outcome: incentive.boundary ? "Indeterminate organizational choice" : incentive.wants ? predictedOutcome : "No organizational violence predicted: b < v",
      selective: incentive.wants && predictedSelective
    });
    const aResult = canonical
      ? canonicalResult(aIncentive, prediction.aOutcome, prediction.aSelective)
      : exploreActorOutcome("A", equilibria);
    const bResult = canonical
      ? canonicalResult(bIncentive, prediction.bOutcome, prediction.bSelective)
      : exploreActorOutcome("B", equilibria);

    setText("orgADecision", aResult.label);
    setText("orgBDecision", bResult.label);
    $("orgABalance").style.width = `${clamp(number("bASlider") / 100) * 100}%`;
    $("orgBBalance").style.width = `${clamp(number("bBSlider") / 100) * 100}%`;
    setText("orgAOutcome", aResult.outcome);
    setText("orgBOutcome", bResult.outcome);
    setText("orgAReason", aResult.wants
      ? "bᴬ exceeds vᴬ, but selective violence still requires genuine defectors and usable information."
      : aResult.boundary ? "bᴬ equals vᴬ; the strict inequality gives no unique choice." : "vᴬ exceeds bᴬ, so violence would impose more organizational cost than benefit.");
    setText("orgBReason", bResult.wants
      ? "bᴮ exceeds vᴮ, but selective violence still requires genuine defectors and usable information."
      : bResult.boundary ? "bᴮ equals vᴮ; the strict inequality gives no unique choice." : "vᴮ exceeds bᴮ, so violence would impose more organizational cost than benefit.");

    const interpretation = $("violenceInterpretation");
    interpretation.querySelector("strong").textContent = canonical ? `Zone ${state.zone} baseline` : "Exploratory profile";
    interpretation.querySelector("p").textContent = canonical ? prediction.interpretation : `${aResult.outcome}. ${bResult.outcome}. The continuous classification is an implementation aid, not a probability or empirical forecast.`;
    setWarning("violenceWarning", [
      $("informationMode").value !== "model" ? "Information availability is manually overridden for exploration." : "",
      "Low selective homicidal violence does not imply peace: combat, detention, displacement, and other coercion may remain."
    ]);
    return { a: aResult, b: bResult };
  }

  function renderPatternChart() {
    const chart = $("patternChart");
    const left = 92;
    const right = 840;
    const top = 42;
    const bottom = 342;
    const zoneXs = [92, 279, 466, 653, 840];
    const currentX = left + (right - left) * state.rB;
    const currentLabel = state.customControl ? "custom control" : `zone ${state.zone}`;
    chart.innerHTML = `
      <svg class="pattern-svg" viewBox="0 0 900 420" role="img" aria-labelledby="patternTitle patternDesc">
        <title id="patternTitle">Predicted curves across five zones of control</title>
        <desc id="patternDesc">Defection toward B rises while defection toward A falls. Denunciations are lowest at parity in zone 3. A selective violence peaks in zone 2 and B selective violence peaks in zone 4. The current position is ${currentLabel}.</desc>
        <g class="curve-grid" aria-hidden="true">
          <line x1="${left}" y1="${top}" x2="${right}" y2="${top}"></line>
          <line x1="${left}" y1="192" x2="${right}" y2="192"></line>
          <line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}"></line>
          ${zoneXs.map((x) => `<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}"></line>`).join("")}
        </g>
        <rect class="current-zone-band" x="${fixed(currentX - 37, 1)}" y="${top}" width="74" height="${bottom - top}"></rect>
        <line class="current-zone-line" x1="${fixed(currentX, 1)}" y1="${top}" x2="${fixed(currentX, 1)}" y2="${bottom}"></line>
        <path class="curve curve-def-b" d="M 92 342 L 840 50"></path>
        <path class="curve curve-def-a" d="M 92 50 L 840 342"></path>
        <path class="curve curve-denunciation" d="M 92 170 C 220 262, 338 342, 466 342 C 594 342, 712 262, 840 170"></path>
        <path class="curve curve-violence-a" d="M 92 342 C 145 330, 191 88, 279 100 C 367 112, 414 330, 466 342"></path>
        <path class="curve curve-violence-b" d="M 466 342 C 518 330, 565 112, 653 100 C 741 88, 787 330, 840 342"></path>
        <g class="curve-axes" aria-hidden="true">
          <line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}"></line>
          <line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}"></line>
          <text x="54" y="58">HIGH</text><text x="58" y="198">MID</text><text x="58" y="348">LOW</text>
          <text class="axis-title-y" x="24" y="230" transform="rotate(-90 24 230)">RELATIVE LEVEL · ORDINAL</text>
          ${zoneXs.map((x, index) => `<text class="zone-tick${index + 1 === state.zone && !state.customControl ? " is-current" : ""}" x="${x}" y="372">${index + 1}</text>`).join("")}
          <text class="axis-title-x" x="466" y="406">ZONES OF CONTROL · A MONOPOLY → B MONOPOLY</text>
          <text class="current-zone-label" x="${fixed(currentX, 1)}" y="30">${currentLabel.toUpperCase()}</text>
        </g>
      </svg>`;
  }

  function renderPatternTable() {
    const body = $("patternTableBody");
    body.innerHTML = "";
    tableRows.forEach((row, index) => {
      const tr = document.createElement("tr");
      tr.classList.toggle("is-current", index + 1 === state.zone && !state.customControl);
      row.forEach((value, cellIndex) => {
        const cell = document.createElement(cellIndex === 0 ? "th" : "td");
        if (cellIndex === 0) cell.scope = "row";
        cell.textContent = value;
        tr.append(cell);
      });
      body.append(tr);
    });
  }

  function updateDynamic(violence) {
    const shock = number("militaryShock");
    const feedback = number("feedbackStrength");
    const aPush = violence.a.selective ? feedback : 0;
    const bPush = violence.b.selective ? feedback : 0;
    const delta = shock + aPush - bPush;
    let t1A = clamp(state.rA + delta);
    let t1B = clamp(state.rB - delta);
    if (!$("independentControl").checked) t1B = 1 - t1A;
    setText("t0State", `rᴬ ${fixed(state.rA)} · rᴮ ${fixed(state.rB)}`);
    setText("t1State", `rᴬ ${fixed(t1A)} · rᴮ ${fixed(t1B)}`);
    const causes = [];
    if (Math.abs(shock) > 0.001) causes.push(`${shock > 0 ? "A-favoring" : "B-favoring"} external shock`);
    if (aPush) causes.push("A selective-violence feedback");
    if (bPush) causes.push("B selective-violence feedback");
    setText("t1Note", causes.length ? `Illustrative shift from ${causes.join(" and ")}.` : "No modeled shift under the current settings.");
  }

  function updateAll() {
    if ($("linkCatch").checked) {
      $("pCatchA").value = state.rA;
      $("pCatchB").value = state.rB;
    }
    updateControlAvailability();
    updateOutputs();
    updateZoneSelector();
    updateDefection();
    const equilibria = updateDenunciation();
    const violence = updateViolence(equilibria);
    updateStatus(equilibria);
    renderPatternChart();
    renderPatternTable();
    updateDynamic(violence);
    updateOutputs();
  }

  function reset() {
    state.mode = "faithful";
    $("iSlider").value = 33;
    $("uSlider").value = 100;
    $("linkCatch").checked = true;
    $("xSlider").value = 33;
    $("ySlider").value = 100;
    $("pASlider").value = 0.85;
    $("pBSlider").value = 0.85;
    $("independentControl").checked = false;
    $("overrideQ").checked = false;
    $("qSteepness").value = 14;
    $("bASlider").value = 60;
    $("vASlider").value = 40;
    $("bBSlider").value = 60;
    $("vBSlider").value = 40;
    $("informationMode").value = "model";
    $("militaryShock").value = 0;
    $("feedbackStrength").value = 0.1;
    applyZone(3, false);
    updateModeControls();
    updateAll();
  }

  function bindTabs() {
    const tabs = $$(".tab");
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => selectTab(tab));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = tabs.length - 1;
        tabs[next].focus();
        selectTab(tabs[next]);
      });
    });
  }

  function selectTab(activeTab) {
    $$(".tab").forEach((tab) => {
      const active = tab === activeTab;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      const panel = $(`panel${tab.dataset.panel[0].toUpperCase()}${tab.dataset.panel.slice(1)}`);
      panel.hidden = !active;
    });
  }

  function bindEvents() {
    $("faithfulMode").addEventListener("click", () => { state.mode = "faithful"; updateModeControls(); updateAll(); });
    $("exploreMode").addEventListener("click", () => { state.mode = "explore"; updateModeControls(); updateAll(); });
    $$(".zone-button").forEach((button) => button.addEventListener("click", () => applyZone(Number(button.dataset.zone))));
    $("resetButton").addEventListener("click", reset);
    bindTabs();

    const simpleInputs = [
      "iSlider", "uSlider", "pCatchA", "pCatchB", "xSlider", "ySlider", "pASlider", "pBSlider",
      "qASlider", "qBSlider", "qSteepness", "bASlider", "vASlider", "bBSlider", "vBSlider",
      "informationMode", "militaryShock", "feedbackStrength"
    ];
    simpleInputs.forEach((id) => $(id).addEventListener("input", updateAll));
    ["linkCatch", "overrideQ"].forEach((id) => $(id).addEventListener("change", updateAll));

    $("independentControl").addEventListener("change", () => {
      if (!$("independentControl").checked) {
        state.rB = 1 - state.rA;
        $("rBSlider").value = state.rB;
      }
      state.customControl = true;
      state.zone = nearestZone(state.rA, state.rB);
      updateAll();
    });
    $("rASlider").addEventListener("input", () => {
      state.rA = number("rASlider");
      if (!$("independentControl").checked) {
        state.rB = 1 - state.rA;
        $("rBSlider").value = state.rB;
      }
      state.zone = nearestZone(state.rA, state.rB);
      state.customControl = true;
      updateAll();
    });
    $("rBSlider").addEventListener("input", () => {
      state.rB = number("rBSlider");
      state.zone = nearestZone(state.rA, state.rB);
      state.customControl = true;
      updateAll();
    });
  }

  bindEvents();
  reset();
})();
