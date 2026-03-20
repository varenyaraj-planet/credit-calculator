const state = {
  selectedNodes: new Set(),
  edges: [],
  dragging: null,
  expandedQuestions: new Set(),
  manualShapes: [],
  manualDraft: null,
  manualTool: "square",
  manualSearchMarker: null,
  manualOverlayDismissed: false,
  geojsonFeatureCount: 0,
  billingMode: "annual",
  latestCalculationContext: null,
};

const GENERAL_MONITORING_NODE_ID = "q3-general-monitoring";
const questionOrder = { q1: 1, q2: 2, q3: 3, q4: 4, q5: 5, q6: 6 };
const annualUsdRate = 0.015;
const monthlyUsdRate = 0.01;
const packageModels = [
  {
    id: "lite",
    name: "Lite Plan",
    maxFreshnessRank: 2,
    supportsReservedAccess: false,
    minimumAcvUsd: 0,
    licenseUseFactor: 0.74,
    basicToolsFactor: 0.62,
    advancedToolsFactor: 0.26,
  },
  {
    id: "hybrid",
    name: "Hybrid Plan",
    maxFreshnessRank: 4,
    supportsReservedAccess: false,
    minimumAcvUsd: 120000,
    licenseUseFactor: 0.92,
    basicToolsFactor: 0.86,
    advancedToolsFactor: 0.5,
  },
  {
    id: "reserved",
    name: "Reserved Plan",
    maxFreshnessRank: 5,
    supportsReservedAccess: true,
    minimumAcvUsd: 250000,
    licenseUseFactor: 1.0,
    basicToolsFactor: 1.0,
    advancedToolsFactor: 0.64,
  },
  {
    id: "flexible-ultimate",
    name: "Flexible Ultimate",
    maxFreshnessRank: 5,
    supportsReservedAccess: true,
    minimumAcvUsd: 1000000,
    licenseUseFactor: 1.16,
    basicToolsFactor: 1.1,
    advancedToolsFactor: 0.84,
  },
];
const canvas = document.getElementById("flow-canvas");
const svg = document.getElementById("flow-lines");
const connectionList = document.getElementById("connection-list");
const viewPackagesButton = document.getElementById("view-packages-button");
const builderPage = document.getElementById("builder-page");
const packagesPage = document.getElementById("packages-page");
const backToBuilderButton = document.getElementById("back-to-builder-button");
const billingAnnualButton = document.getElementById("billing-annual-button");
const billingMonthlyButton = document.getElementById("billing-monthly-button");
const recommendedPackageName = document.getElementById("recommended-package-name");
const recommendedTotalCredits = document.getElementById("recommended-total-credits");
const recommendedUsdCost = document.getElementById("recommended-usd-cost");
const recommendedMessage = document.getElementById("recommended-message");
const packagesAccordion = document.getElementById("packages-accordion");
const q4Block = document.getElementById("q4-block");
const q1Profile = document.getElementById("q1-profile");
const q2Profile = document.getElementById("q2-profile");
const q3Profile = document.getElementById("q3-profile");
const q4Profile = document.getElementById("q4-profile");
const q5Profile = document.getElementById("q5-profile");
const q6Profile = document.getElementById("q6-profile");
const creditTotal = document.getElementById("credit-total");
const calcDetails = document.getElementById("calc-details");
const calcAoiKm2 = document.getElementById("calc-aoi-km2");
const calcPackagePriceKm2 = document.getElementById("calc-package-price-km2");
const calcObservationsYear = document.getElementById("calc-observations-year");
const calcPcMultiplier = document.getElementById("calc-pc-multiplier");
const calcBaseSubscription = document.getElementById("calc-base-subscription");
const calcCreditConsumption = document.getElementById("calc-credit-consumption");
const calcActivationFees = document.getElementById("calc-activation-fees");
const calcUsdAnnual = document.getElementById("calc-usd-annual");
const calcUsdMonthly = document.getElementById("calc-usd-monthly");
const manualEntryPanel = document.getElementById("manual-entry-panel");
const geojsonUploadPanel = document.getElementById("geojson-upload-panel");
const manualMap = document.getElementById("manual-map");
const manualMapOverlay = document.getElementById("manual-map-overlay");
const manualMapSummary = document.getElementById("manual-map-summary");
const manualMapToolButtons = Array.from(document.querySelectorAll("[data-map-tool]"));
const manualMapSearchForm = document.getElementById("manual-map-search-form");
const manualMapSearchInput = document.getElementById("manual-map-search-input");
const manualMapClearButton = document.getElementById("manual-map-clear");
const manualMapDoneButton = document.getElementById("manual-map-done");
const geojsonFileInput = document.getElementById("geojson-file-input");
const geojsonFileSummary = document.getElementById("geojson-file-summary");
const cards = Array.from(document.querySelectorAll(".answer-card"));
const outputHandles = Array.from(document.querySelectorAll(".output-handle"));
const questionBlocks = Array.from(document.querySelectorAll(".question-block[data-question-id]"));
const cardMap = new Map(cards.map((card) => [card.dataset.nodeId, card]));

cards.forEach((card) => {
  card.addEventListener("click", () => onCardClick(card));
});

outputHandles.forEach((handle) => {
  handle.addEventListener("pointerdown", startDragConnection);
});

questionBlocks.forEach((block) => {
  const questionId = block.dataset.questionId;
  const title = block.querySelector(".question-title");
  if (!title || !questionId) return;
  title.addEventListener("click", () => onQuestionTitleClick(questionId));
});

if (manualMap) {
  manualMap.addEventListener("pointerdown", onManualMapPointerDown);
}

if (manualMapToolButtons.length > 0) {
  manualMapToolButtons.forEach((button) => {
    button.addEventListener("click", () => setManualTool(button.dataset.mapTool || "square"));
  });
}

if (manualMapSearchForm) {
  manualMapSearchForm.addEventListener("submit", onManualSearchSubmit);
}

if (manualMapClearButton) {
  manualMapClearButton.addEventListener("click", clearManualDrawings);
}

if (manualMapDoneButton) {
  manualMapDoneButton.addEventListener("click", dismissManualFullscreenMap);
}

if (geojsonFileInput) {
  geojsonFileInput.addEventListener("change", onGeoJsonFileChange);
}

if (viewPackagesButton) {
  viewPackagesButton.addEventListener("click", openPackagesPage);
}
if (backToBuilderButton) {
  backToBuilderButton.addEventListener("click", showBuilderPage);
}
if (billingAnnualButton) {
  billingAnnualButton.addEventListener("click", () => setBillingMode("annual"));
}
if (billingMonthlyButton) {
  billingMonthlyButton.addEventListener("click", () => setBillingMode("monthly"));
}
window.addEventListener("resize", drawConnections);

function toggleCard(nodeId) {
  const card = cardMap.get(nodeId);
  const questionId = card?.dataset.questionId;

  if (questionId === "q6" && !state.selectedNodes.has(nodeId)) {
    // Area input mode is single-select.
    cards.forEach((candidate) => {
      if (candidate.dataset.questionId === "q6") {
        state.selectedNodes.delete(candidate.dataset.nodeId);
      }
    });
  }

  if (state.selectedNodes.has(nodeId)) {
    state.selectedNodes.delete(nodeId);
  } else {
    state.selectedNodes.add(nodeId);
  }

  if (nodeId === "q6-manual-entry" && state.selectedNodes.has(nodeId)) {
    state.manualOverlayDismissed = false;
  }
  if (nodeId === "q6-upload-geojson" && state.selectedNodes.has(nodeId)) {
    state.manualOverlayDismissed = false;
  }

  syncConditionalQuestionState();
  applyQuestionAnswerVisibility();
  refreshCardState();
  updateSystemCalculations();
  updateAreaInputModeUI();
  drawConnections();
}

function onCardClick(card) {
  if (
    card.dataset.nodeId === "q6-manual-entry" &&
    state.selectedNodes.has("q6-manual-entry") &&
    state.manualOverlayDismissed
  ) {
    state.manualOverlayDismissed = false;
    updateAreaInputModeUI();
    return;
  }

  if (shouldExpandOnAnsweredCardClick(card)) {
    const questionId = card.dataset.questionId;
    if (questionId) {
      state.expandedQuestions.add(questionId);
      applyQuestionAnswerVisibility();
      refreshCardState();
      drawConnections();
    }
    return;
  }

  toggleCard(card.dataset.nodeId);
}

function shouldExpandOnAnsweredCardClick(card) {
  const block = card.closest(".question-block");
  if (!block || !block.classList.contains("collapsed")) return false;

  const questionId = block.dataset.questionId;
  if (!questionId) return false;

  const chosenIds = getChosenNodeIdsForQuestion(questionId);
  return chosenIds.has(card.dataset.nodeId);
}

function onQuestionTitleClick(questionId) {
  const chosenIds = getChosenNodeIdsForQuestion(questionId);
  if (chosenIds.size === 0) return;

  if (state.expandedQuestions.has(questionId)) {
    state.expandedQuestions.delete(questionId);
  } else {
    state.expandedQuestions.add(questionId);
  }

  applyQuestionAnswerVisibility();
  refreshCardState();
  updateAreaInputModeUI();
  drawConnections();
}

function startDragConnection(event) {
  event.preventDefault();
  event.stopPropagation();

  const sourceCard = event.currentTarget.closest(".answer-card");
  if (!sourceCard) return;
  if (!isCardVisible(sourceCard)) return;

  const outputRect = event.currentTarget.getBoundingClientRect();
  state.dragging = {
    mode: "new",
    edgeIndex: null,
    fromNodeId: sourceCard.dataset.nodeId,
    startX: outputRect.left + outputRect.width / 2,
    startY: outputRect.top + outputRect.height / 2,
    pointerX: event.clientX,
    pointerY: event.clientY,
  };

  refreshCardState();
  drawConnections();
  window.addEventListener("pointermove", onDragPointerMove);
  window.addEventListener("pointerup", onDragPointerUp);
}

function startExistingEdgeDrag(edgeIndex, event) {
  event.preventDefault();
  event.stopPropagation();

  const edge = state.edges[edgeIndex];
  if (!edge) return;

  const sourceCard = cardMap.get(edge.from);
  if (!sourceCard || !isCardVisible(sourceCard)) return;

  const outputHandle = sourceCard.querySelector(".output-handle");
  if (!outputHandle) return;

  const outputRect = outputHandle.getBoundingClientRect();
  state.dragging = {
    mode: "existing",
    edgeIndex,
    fromNodeId: edge.from,
    startX: outputRect.left + outputRect.width / 2,
    startY: outputRect.top + outputRect.height / 2,
    pointerX: event.clientX,
    pointerY: event.clientY,
  };

  refreshCardState();
  drawConnections();
  window.addEventListener("pointermove", onDragPointerMove);
  window.addEventListener("pointerup", onDragPointerUp);
}

function onDragPointerMove(event) {
  if (!state.dragging) return;
  state.dragging.pointerX = event.clientX;
  state.dragging.pointerY = event.clientY;
  highlightDropTarget(event.clientX, event.clientY);
  drawConnections();
}

function onDragPointerUp(event) {
  if (!state.dragging) return;

  const dragging = state.dragging;
  const targetCard = resolveDropTarget(event.clientX, event.clientY, dragging.fromNodeId);

  if (dragging.mode === "existing") {
    finishExistingEdgeDrag(dragging.edgeIndex, dragging.fromNodeId, targetCard);
  } else if (targetCard) {
    addEdge(dragging.fromNodeId, targetCard.dataset.nodeId);
  }

  state.dragging = null;
  clearDropHighlights();
  refreshCardState();
  drawConnections();
  updateSystemCalculations();
  updateAreaInputModeUI();
  window.removeEventListener("pointermove", onDragPointerMove);
  window.removeEventListener("pointerup", onDragPointerUp);
}

function finishExistingEdgeDrag(edgeIndex, fromNodeId, targetCard) {
  const edge = state.edges[edgeIndex];
  if (!edge || edge.from !== fromNodeId) return;

  if (!targetCard) {
    expandQuestionsForEdge(edge);
    state.edges.splice(edgeIndex, 1);
    syncConditionalQuestionState();
    applyQuestionAnswerVisibility();
    renderConnectionList();
    updateAreaInputModeUI();
    return;
  }

  const nextToNodeId = targetCard.dataset.nodeId;
  const duplicate = state.edges.some((existingEdge, index) => {
    return index !== edgeIndex && existingEdge.from === fromNodeId && existingEdge.to === nextToNodeId;
  });

  if (duplicate) {
    expandQuestionsForEdge(edge);
    state.edges.splice(edgeIndex, 1);
  } else {
    edge.to = nextToNodeId;
  }

  syncConditionalQuestionState();
  applyQuestionAnswerVisibility();
  renderConnectionList();
  updateAreaInputModeUI();
}

function resolveDropTarget(clientX, clientY, fromNodeId) {
  const fromCard = cardMap.get(fromNodeId);
  if (!fromCard) return null;
  if (!isCardVisible(fromCard)) return null;

  const hovered = document.elementFromPoint(clientX, clientY);
  if (!hovered) return null;

  const targetCard = hovered.closest(".answer-card");
  if (!targetCard) return null;
  if (!isCardVisible(targetCard)) return null;

  const fromOrder = questionOrder[fromCard.dataset.questionId];
  const toOrder = questionOrder[targetCard.dataset.questionId];
  if (!fromOrder || !toOrder || fromOrder >= toOrder) return null;

  return targetCard;
}

function highlightDropTarget(clientX, clientY) {
  clearDropHighlights();
  if (!state.dragging) return;
  const target = resolveDropTarget(clientX, clientY, state.dragging.fromNodeId);
  if (target) target.classList.add("drop-target");
}

function clearDropHighlights() {
  cards.forEach((card) => card.classList.remove("drop-target"));
}

function addEdge(from, to) {
  const exists = state.edges.some((edge) => edge.from === from && edge.to === to);
  if (exists) return;
  state.edges.push({ from, to });
  syncConditionalQuestionState();
  applyQuestionAnswerVisibility();
  renderConnectionList();
  updateAreaInputModeUI();
}

function removeEdge(index) {
  const edge = state.edges[index];
  if (edge) {
    expandQuestionsForEdge(edge);
  }
  state.edges.splice(index, 1);
  syncConditionalQuestionState();
  applyQuestionAnswerVisibility();
  renderConnectionList();
  refreshCardState();
  drawConnections();
  updateSystemCalculations();
  updateAreaInputModeUI();
}

function renderConnectionList() {
  connectionList.innerHTML = "";
  if (state.edges.length === 0) {
    connectionList.innerHTML = '<li class="muted">No connections yet.</li>';
    return;
  }

  state.edges.forEach((edge, index) => {
    const row = document.createElement("li");
    row.className = "connection-item";
    row.innerHTML = `
      <span>${label(edge.from)} → ${label(edge.to)}</span>
      <button type="button" class="remove-connection" data-index="${index}">Remove</button>
    `;
    connectionList.appendChild(row);
  });

  connectionList.querySelectorAll(".remove-connection").forEach((button) => {
    button.addEventListener("click", () => removeEdge(Number(button.dataset.index)));
  });
}

function drawConnections() {
  const canvasRect = canvas.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${canvasRect.width} ${canvasRect.height}`);
  svg.innerHTML = "";

  state.edges.forEach((edge, edgeIndex) => {
    const isDraggedExistingEdge =
      state.dragging?.mode === "existing" && Number.isInteger(state.dragging.edgeIndex) && state.dragging.edgeIndex === edgeIndex;
    if (isDraggedExistingEdge) return;
    drawEdgePath(edge.from, edge.to, false, canvasRect, edgeIndex);
  });

  if (state.dragging) {
    drawPreviewPath(canvasRect);
  }
}

function drawEdgePath(fromNodeId, toNodeId, dashed, canvasRect, edgeIndex = null) {
  const fromCard = cardMap.get(fromNodeId);
  const toCard = cardMap.get(toNodeId);
  if (!fromCard || !toCard) return;
  if (!isCardVisible(fromCard) || !isCardVisible(toCard)) return;

  const fromHandle = fromCard.querySelector(".output-handle");
  const toHandle = toCard.querySelector(".input-handle");
  if (!fromHandle || !toHandle) return;

  const fromRect = fromHandle.getBoundingClientRect();
  const toRect = toHandle.getBoundingClientRect();
  const startX = fromRect.left + fromRect.width / 2 - canvasRect.left;
  const startY = fromRect.top + fromRect.height / 2 - canvasRect.top;
  const endX = toRect.left + toRect.width / 2 - canvasRect.left;
  const endY = toRect.top + toRect.height / 2 - canvasRect.top;
  const path = appendPath(startX, startY, endX, endY, dashed);
  if (!path || dashed || edgeIndex === null) return;

  path.classList.add("interactive");
  path.dataset.edgeIndex = String(edgeIndex);
  path.addEventListener("pointerdown", (event) => {
    startExistingEdgeDrag(edgeIndex, event);
  });
}

function drawPreviewPath(canvasRect) {
  const startX = state.dragging.startX - canvasRect.left;
  const startY = state.dragging.startY - canvasRect.top;
  const endX = state.dragging.pointerX - canvasRect.left;
  const endY = state.dragging.pointerY - canvasRect.top;
  appendPath(startX, startY, endX, endY, true);
}

function appendPath(startX, startY, endX, endY, dashed) {
  const controlOffset = Math.max(90, Math.abs(endX - startX) * 0.45);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`,
  );
  path.setAttribute("class", "flow-path");
  if (dashed) {
    path.setAttribute("stroke-dasharray", "7 7");
    path.setAttribute("opacity", "0.85");
  }
  svg.appendChild(path);
  return path;
}

function refreshCardState() {
  cards.forEach((card) => {
    card.classList.toggle("selected", state.selectedNodes.has(card.dataset.nodeId));
    card.classList.remove("connected");
  });

  state.edges.forEach((edge) => {
    cardMap.get(edge.from)?.classList.add("connected");
    cardMap.get(edge.to)?.classList.add("connected");
  });
}

function updateSystemCalculations() {
  const q1Cards = getChosenCardsForQuestion("q1");
  const q2Cards = getChosenCardsForQuestion("q2");
  const q3Cards = getChosenCardsForQuestion("q3");
  const q4Cards = getChosenCardsForQuestion("q4");
  const q5Cards = getChosenCardsForQuestion("q5");
  const q6Cards = getChosenCardsForQuestion("q6");

  q1Profile.textContent = combineUnique(q1Cards.map((card) => card.dataset.summary));
  q2Profile.textContent = combineUnique(q2Cards.map((card) => card.dataset.summary));
  q3Profile.textContent = combineUnique(q3Cards.map((card) => card.dataset.summary));
  q4Profile.textContent = combineUnique(q4Cards.map((card) => card.dataset.summary));
  q5Profile.textContent = combineUnique(q5Cards.map((card) => card.dataset.summary));
  q6Profile.textContent = combineUnique(q6Cards.map((card) => card.dataset.summary));

  const totalAoiKm2 = resolveTotalAoiKm2();
  const packageAnnualPricePerKm2 = averageByDataset(q1Cards, "packagePriceKm2", 0);
  const observationsPerYear = averageByDataset(q1Cards, "obsPerYear", 0);
  const pcActionMultiplier = resolveLatencyPcMultiplier(q5Cards);
  const hasReservedAccess = q1Cards.some((card) => card.dataset.accessMode === "reserved");
  const selectedFreshnessRank = resolveFreshnessRank(q5Cards);
  const hasAdvancedToolsNeed = q2Cards.some((card) => card.dataset.analysis === "Multi-spectral");

  const baseSubscriptionCredits = totalAoiKm2 * packageAnnualPricePerKm2;
  const creditConsumptionCredits = totalAoiKm2 * observationsPerYear * pcActionMultiplier;
  const dataActivationPlatformFees = hasReservedAccess ? 0 : totalAoiKm2 * 2.5;
  const totalEstimatedCredits = baseSubscriptionCredits + creditConsumptionCredits + dataActivationPlatformFees;

  if (calcAoiKm2) calcAoiKm2.textContent = formatDecimal(totalAoiKm2, 2);
  if (calcPackagePriceKm2) calcPackagePriceKm2.textContent = formatDecimal(packageAnnualPricePerKm2, 2);
  if (calcObservationsYear) calcObservationsYear.textContent = formatDecimal(observationsPerYear, 0);
  if (calcPcMultiplier) calcPcMultiplier.textContent = formatDecimal(pcActionMultiplier, 2);
  if (calcBaseSubscription) calcBaseSubscription.textContent = formatCredits(baseSubscriptionCredits);
  if (calcCreditConsumption) calcCreditConsumption.textContent = formatCredits(creditConsumptionCredits);
  if (calcActivationFees) calcActivationFees.textContent = formatCredits(dataActivationPlatformFees);

  const roundedTotalCredits = Math.round(totalEstimatedCredits);
  creditTotal.textContent = Number.isFinite(roundedTotalCredits) ? roundedTotalCredits.toLocaleString() : "0";

  const annualUsd = totalEstimatedCredits * 0.015;
  const monthlyUsd = totalEstimatedCredits * 0.01;
  if (calcUsdAnnual) calcUsdAnnual.textContent = formatCurrency(annualUsd);
  if (calcUsdMonthly) calcUsdMonthly.textContent = formatCurrency(monthlyUsd);

  const reservedNote = hasReservedAccess ? " Access Reserved active: Data Activation platform fees set to 0 PC." : "";
  calcDetails.textContent =
    "Total cost = Base Subscription + Planet Credit Consumption." +
    " Updates live while selections and connections change." +
    " USD conversion uses Total Estimated Credits × $0.015 (Annual) or × $0.01 (Monthly)." +
    reservedNote;

  state.latestCalculationContext = {
    totalAoiKm2,
    packageAnnualPricePerKm2,
    observationsPerYear,
    pcActionMultiplier,
    baseSubscriptionCredits,
    creditConsumptionCredits,
    dataActivationPlatformFees,
    totalEstimatedCredits,
    annualUsd,
    monthlyUsd,
    hasReservedAccess,
    selectedFreshnessRank,
    hasAdvancedToolsNeed,
  };

  if (packagesPage && !packagesPage.hidden) {
    renderPackagesPage();
  }
}

function resolveFreshnessRank(q5Cards) {
  if (q5Cards.length === 0) return 1;
  return Math.max(
    ...q5Cards.map((card) => {
      const freshness = card.dataset.freshness || "";
      if (freshness === ">30 Days") return 1;
      if (freshness === "6-30 Days") return 2;
      if (freshness === "1-5 Days") return 3;
      if (freshness === "Next Day") return 4;
      if (freshness === "Same Day") return 5;
      return 1;
    }),
  );
}

function openPackagesPage() {
  if (builderPage) {
    builderPage.hidden = true;
    builderPage.style.display = "none";
  }
  if (packagesPage) {
    packagesPage.hidden = false;
    packagesPage.style.display = "block";
  }
  renderPackagesPage();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showBuilderPage() {
  if (packagesPage) {
    packagesPage.hidden = true;
    packagesPage.style.display = "none";
  }
  if (builderPage) {
    builderPage.hidden = false;
    builderPage.style.display = "";
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setBillingMode(mode) {
  state.billingMode = mode === "monthly" ? "monthly" : "annual";
  if (billingAnnualButton) billingAnnualButton.classList.toggle("active", state.billingMode === "annual");
  if (billingMonthlyButton) billingMonthlyButton.classList.toggle("active", state.billingMode === "monthly");
  renderPackagesPage();
}

function renderPackagesPage() {
  const context = state.latestCalculationContext;
  if (!context || !packagesAccordion) return;

  const packageEvaluations = evaluatePackageModels(context);
  const recommended = selectRecommendedPackage(packageEvaluations);
  renderRecommendedPackageCard(recommended);
  renderPackageAccordionItems(packageEvaluations, recommended?.id);
}

function evaluatePackageModels(context) {
  const billingDivisor = state.billingMode === "monthly" ? 12 : 1;
  const usdRate = state.billingMode === "monthly" ? monthlyUsdRate : annualUsdRate;

  return packageModels.map((model) => {
    const latencyBlocked = context.selectedFreshnessRank > model.maxFreshnessRank;
    const reservedBlocked = context.hasReservedAccess && !model.supportsReservedAccess;
    const technicallyAvailable = !latencyBlocked && !reservedBlocked;

    const advancedBoost = context.hasAdvancedToolsNeed ? 1.18 : 1;
    const licenseUseCreditsAnnual = context.baseSubscriptionCredits * model.licenseUseFactor;
    const basicToolsCreditsAnnual = context.creditConsumptionCredits * model.basicToolsFactor;
    const advancedToolsCreditsAnnual = context.creditConsumptionCredits * model.advancedToolsFactor * advancedBoost;
    const activationFeesAnnual = context.dataActivationPlatformFees;
    const totalCreditsAnnual =
      licenseUseCreditsAnnual + basicToolsCreditsAnnual + advancedToolsCreditsAnnual + activationFeesAnnual;

    const displayCredits = totalCreditsAnnual / billingDivisor;
    const displayUsd = displayCredits * usdRate;
    const annualUsd = totalCreditsAnnual * annualUsdRate;

    let status = "recommended_candidate";
    let objectionText = "";

    if (!technicallyAvailable) {
      status = "not_available";
      if (latencyBlocked) {
        const selectedFreshnessLabel = freshnessLabelFromRank(context.selectedFreshnessRank);
        objectionText = `Disabled: ${model.name} does not support ${selectedFreshnessLabel} latency.`;
      } else if (reservedBlocked) {
        objectionText = `Disabled: ${model.name} does not support Access Reserved workflows.`;
      } else {
        objectionText = `Disabled: ${model.name} is not technically available for this scenario.`;
      }
    } else if (annualUsd < model.minimumAcvUsd) {
      status = "below_minimum_price";
      objectionText = `Fits technically, but below required minimum ACV of ${formatAcvShort(model.minimumAcvUsd)}.`;
      if (model.minimumAcvUsd >= 1000000) {
        objectionText = `Disabled: ${model.name} requires a minimum ACV of ${formatAcvShort(model.minimumAcvUsd)}.`;
      }
    }

    return {
      ...model,
      status,
      objectionText,
      displayCredits,
      displayUsd,
      annualUsd,
      licenseUseCreditsAnnual,
      basicToolsCreditsAnnual,
      advancedToolsCreditsAnnual,
      activationFeesAnnual,
      totalCreditsAnnual,
      billingDivisor,
      usdRate,
    };
  });
}

function selectRecommendedPackage(evaluations) {
  const eligible = evaluations
    .filter((item) => item.status === "recommended_candidate")
    .sort((a, b) => a.annualUsd - b.annualUsd);
  if (eligible.length > 0) return eligible[0];

  const fallback = evaluations.find((item) => item.status === "below_minimum_price");
  return fallback || evaluations[0] || null;
}

function renderRecommendedPackageCard(recommended) {
  if (!recommendedPackageName || !recommendedTotalCredits || !recommendedUsdCost || !recommendedMessage) return;
  if (!recommended) {
    recommendedPackageName.textContent = "No recommendation yet";
    recommendedTotalCredits.textContent = "0";
    recommendedUsdCost.textContent = "$0.00";
    recommendedMessage.textContent = "Make selections to generate package recommendation.";
    return;
  }

  recommendedPackageName.textContent = recommended.name;
  recommendedTotalCredits.textContent = formatCredits(recommended.displayCredits);
  recommendedUsdCost.textContent = formatCurrency(recommended.displayUsd);

  if (recommended.status === "recommended_candidate") {
    recommendedMessage.textContent = "Best fit from logic engine based on technical feasibility and pricing thresholds.";
    return;
  }

  recommendedMessage.textContent = recommended.objectionText || "Fallback package shown due to constraint limits.";
}

function renderPackageAccordionItems(evaluations, recommendedId) {
  if (!packagesAccordion) return;
  packagesAccordion.innerHTML = "";

  evaluations.forEach((item) => {
    const details = document.createElement("details");
    details.className = "package-item";
    if (item.id === recommendedId) details.open = true;

    const tag = buildPackageTag(item, item.id === recommendedId);
    const note = item.objectionText ? `<div class="package-summary-line">${item.objectionText}</div>` : "";

    details.innerHTML = `
      <summary>
        <div class="package-summary-top">
          <strong>${item.name}</strong>
          ${tag}
        </div>
        <div class="package-summary-line">
          ${formatCredits(item.displayCredits)} credits • ${formatCurrency(item.displayUsd)}
        </div>
        ${note}
      </summary>
      <div class="package-content">
        <div class="calc-row"><span>License Use</span><strong>${formatCredits(item.licenseUseCreditsAnnual / item.billingDivisor)} credits</strong></div>
        <div class="calc-row"><span>Basic Tools</span><strong>${formatCredits(item.basicToolsCreditsAnnual / item.billingDivisor)} credits</strong></div>
        <div class="calc-row"><span>Advanced Tools</span><strong>${formatCredits(item.advancedToolsCreditsAnnual / item.billingDivisor)} credits</strong></div>
        <div class="calc-row"><span>Data Activation Fees</span><strong>${formatCredits(item.activationFeesAnnual / item.billingDivisor)} credits</strong></div>
        <div class="calc-row"><span>Total</span><strong>${formatCredits(item.displayCredits)} credits</strong></div>
      </div>
    `;
    packagesAccordion.appendChild(details);
  });
}

function buildPackageTag(item, isRecommended) {
  if (isRecommended && item.status === "recommended_candidate") {
    return '<span class="tag tag-recommended">🔵 RECOMMENDED</span>';
  }

  if (item.status === "below_minimum_price") {
    return '<span class="tag tag-below-minimum">🟡 BELOW MINIMUM PRICE</span>';
  }

  if (item.status === "not_available") {
    return '<span class="tag tag-not-available">🔴 NOT AVAILABLE</span>';
  }

  if (isRecommended) {
    return '<span class="tag tag-recommended">🔵 RECOMMENDED</span>';
  }

  return '<span class="tag tag-recommended">AVAILABLE</span>';
}

function freshnessLabelFromRank(rank) {
  if (rank === 5) return "Same Day";
  if (rank === 4) return "Next Day";
  if (rank === 3) return "1-5 Days";
  if (rank === 2) return "6-30 Days";
  return ">30 Days";
}

function averageByDataset(cardsSubset, datasetKey, fallbackValue = 0) {
  if (cardsSubset.length === 0) return fallbackValue;
  const sum = cardsSubset.reduce((acc, card) => acc + Number(card.dataset[datasetKey] || fallbackValue), 0);
  return sum / cardsSubset.length;
}

function resolveLatencyPcMultiplier(q5Cards) {
  if (q5Cards.length === 0) return 1;

  const multipliers = q5Cards.map((card) => {
    const freshness = card.dataset.freshness || "";
    if (freshness === ">30 Days") return 0.65;
    if (freshness === "6-30 Days") return 1.0;
    if (freshness === "1-5 Days") return 1.35;
    if (freshness === "Next Day") return 1.75;
    if (freshness === "Same Day") return 2.2;
    return Number(card.dataset.multiplier || 1);
  });

  return Math.max(...multipliers);
}

function resolveTotalAoiKm2() {
  const mode = resolveActiveAreaInputMode();
  if (mode === "manual") {
    if (state.manualShapes.length === 0) return 50;
    return Math.max(50, estimateManualShapeAreaKm2(state.manualShapes));
  }

  if (mode === "geojson") {
    if (state.geojsonFeatureCount <= 0) return 80;
    return state.geojsonFeatureCount * 40;
  }

  return 0;
}

function estimateManualShapeAreaKm2(shapes) {
  const mapScaleKm2 = 20000;
  return shapes.reduce((total, shape) => {
    if (shape.type === "square") {
      const width = Math.abs(shape.end.x - shape.start.x);
      const height = Math.abs(shape.end.y - shape.start.y);
      return total + width * height * mapScaleKm2;
    }

    if (shape.type === "circle") {
      const radius = Math.hypot(shape.end.x - shape.start.x, shape.end.y - shape.start.y);
      return total + Math.PI * radius * radius * mapScaleKm2;
    }

    if (shape.type === "pen") {
      const bounds = getPathBounds(shape.points || []);
      const areaRatio = Math.max((bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY), 0.003);
      return total + areaRatio * mapScaleKm2 * 0.65;
    }

    return total;
  }, 0);
}

function getPathBounds(points) {
  if (!points || points.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  points.forEach((point) => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  });
  return { minX, maxX, minY, maxY };
}

function formatCredits(value) {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString();
}

function formatDecimal(value, digits = 2) {
  if (!Number.isFinite(value)) return "0";
  return Number(value).toFixed(digits);
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "$0.00";
  return `$${value.toFixed(2)}`;
}

function formatAcvShort(value) {
  if (!Number.isFinite(value)) return "$0";
  if (value >= 1000000) return `$${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
  return `$${Math.round(value)}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function combineUnique(items) {
  const unique = Array.from(new Set(items.filter(Boolean)));
  return unique.length > 0 ? unique.join(" + ") : "None";
}

function label(nodeId) {
  return cardMap.get(nodeId)?.dataset.label || nodeId;
}

function clearAll() {
  state.selectedNodes.clear();
  state.edges = [];
  state.dragging = null;
  state.expandedQuestions.clear();
  state.manualShapes = [];
  state.manualDraft = null;
  state.manualSearchMarker = null;
  state.manualOverlayDismissed = false;
  state.geojsonFeatureCount = 0;
  if (geojsonFileInput) {
    geojsonFileInput.value = "";
  }
  if (geojsonFileSummary) {
    geojsonFileSummary.textContent = "No file selected.";
  }
  if (manualMapSummary) {
    manualMapSummary.textContent = "Use the toolbar to draw AOI shapes on the map.";
  }
  syncConditionalQuestionState();
  applyQuestionAnswerVisibility();
  clearDropHighlights();
  renderConnectionList();
  refreshCardState();
  renderManualMapGraphics();
  updateAreaInputModeUI();
  drawConnections();
  updateSystemCalculations();
}

function syncConditionalQuestionState() {
  const shouldShowQ4 = hasRequiredGeneralMonitoringLink();
  if (q4Block) {
    q4Block.hidden = !shouldShowQ4;
  }
  if (!shouldShowQ4) {
    state.expandedQuestions.delete("q4");
  }

  if (shouldShowQ4) return;

  const q4NodeIds = cards
    .filter((card) => card.dataset.questionId === "q4")
    .map((card) => card.dataset.nodeId);
  const q4IdSet = new Set(q4NodeIds);

  q4NodeIds.forEach((nodeId) => state.selectedNodes.delete(nodeId));
  state.edges = state.edges.filter((edge) => !q4IdSet.has(edge.from) && !q4IdSet.has(edge.to));

  if (state.dragging && q4IdSet.has(state.dragging.fromNodeId)) {
    state.dragging = null;
    window.removeEventListener("pointermove", onDragPointerMove);
    window.removeEventListener("pointerup", onDragPointerUp);
  }

  renderConnectionList();
}

function hasRequiredGeneralMonitoringLink() {
  const targetCard = cardMap.get(GENERAL_MONITORING_NODE_ID);
  if (!targetCard) return false;

  const targetQuestionOrder = questionOrder[targetCard.dataset.questionId];
  if (!targetQuestionOrder) return false;

  return state.edges.some((edge) => {
    if (edge.to !== GENERAL_MONITORING_NODE_ID) return false;
    const sourceCard = cardMap.get(edge.from);
    if (!sourceCard) return false;
    return questionOrder[sourceCard.dataset.questionId] === targetQuestionOrder - 1;
  });
}

function applyQuestionAnswerVisibility() {
  questionBlocks.forEach((block) => {
    const questionId = block.dataset.questionId;
    if (!questionId) return;

    const blockCards = Array.from(block.querySelectorAll(".answer-card"));
    if (block.hidden) {
      blockCards.forEach((card) => {
        card.hidden = false;
        card.style.display = "";
      });
      state.expandedQuestions.delete(questionId);
      block.classList.remove("answered", "collapsed");
      return;
    }

    const chosenIds = getChosenNodeIdsForQuestion(questionId);
    const chosenCount = chosenIds.size;

    if (chosenCount === 0) {
      state.expandedQuestions.delete(questionId);
    }

    const isAnswered = chosenCount > 0;
    const isExpanded = state.expandedQuestions.has(questionId);
    const shouldCollapse = questionId !== "q5" && isAnswered && !isExpanded;

    block.classList.toggle("answered", questionId !== "q5" && isAnswered);
    block.classList.toggle("collapsed", shouldCollapse);

    blockCards.forEach((card) => {
      const isChosen = chosenIds.has(card.dataset.nodeId);
      const shouldHideCard = shouldCollapse && !isChosen;
      card.hidden = shouldHideCard;
      // Fallback in case host styles override [hidden].
      card.style.display = shouldHideCard ? "none" : "";
    });
  });
}

function getChosenNodeIdsForQuestion(questionId) {
  const chosenIds = new Set();

  cards.forEach((card) => {
    if (card.dataset.questionId !== questionId) return;
    const nodeId = card.dataset.nodeId;
    if (state.selectedNodes.has(nodeId)) {
      chosenIds.add(nodeId);
    }
  });

  state.edges.forEach((edge) => {
    const fromCard = cardMap.get(edge.from);
    const toCard = cardMap.get(edge.to);
    if (fromCard?.dataset.questionId === questionId) {
      chosenIds.add(edge.from);
    }
    if (toCard?.dataset.questionId === questionId) {
      chosenIds.add(edge.to);
    }
  });

  return chosenIds;
}

function getChosenCardsForQuestion(questionId) {
  return Array.from(getChosenNodeIdsForQuestion(questionId))
    .map((nodeId) => cardMap.get(nodeId))
    .filter(Boolean);
}

function updateAreaInputModeUI() {
  const areaMode = resolveActiveAreaInputMode();

  if (manualEntryPanel) {
    manualEntryPanel.hidden = areaMode !== "manual" || state.manualOverlayDismissed;
  }

  if (geojsonUploadPanel) {
    geojsonUploadPanel.hidden = areaMode !== "geojson";
  }
}

function resolveActiveAreaInputMode() {
  const manualId = "q6-manual-entry";
  const geojsonId = "q6-upload-geojson";

  if (state.selectedNodes.has(manualId)) return "manual";
  if (state.selectedNodes.has(geojsonId)) return "geojson";

  const chosenIds = getChosenNodeIdsForQuestion("q6");
  if (chosenIds.has(manualId)) return "manual";
  if (chosenIds.has(geojsonId)) return "geojson";
  return null;
}

function setManualTool(tool) {
  state.manualTool = tool === "circle" || tool === "pen" ? tool : "square";
  manualMapToolButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mapTool === state.manualTool);
  });
}

function onManualMapPointerDown(event) {
  if (resolveActiveAreaInputMode() !== "manual") return;
  if (!manualMap) return;
  if (event.button !== 0) return;

  const point = pointerEventToMapRatio(event);
  if (!point) return;

  if (state.manualTool === "pen") {
    state.manualDraft = { type: "pen", points: [point] };
  } else {
    state.manualDraft = { type: state.manualTool, start: point, end: point };
  }

  window.addEventListener("pointermove", onManualMapPointerMove);
  window.addEventListener("pointerup", onManualMapPointerUp);
  renderManualMapGraphics();
}

function onManualMapPointerMove(event) {
  if (!state.manualDraft) return;
  const point = pointerEventToMapRatio(event);
  if (!point) return;

  if (state.manualDraft.type === "pen") {
    state.manualDraft.points.push(point);
  } else {
    state.manualDraft.end = point;
  }
  renderManualMapGraphics();
}

function onManualMapPointerUp(event) {
  if (!state.manualDraft) return;
  const point = pointerEventToMapRatio(event);
  if (point) {
    if (state.manualDraft.type === "pen") {
      state.manualDraft.points.push(point);
    } else {
      state.manualDraft.end = point;
    }
  }

  const finalizedShape = finalizeManualDraft(state.manualDraft);
  if (finalizedShape) {
    state.manualShapes.push(finalizedShape);
  }

  state.manualDraft = null;
  window.removeEventListener("pointermove", onManualMapPointerMove);
  window.removeEventListener("pointerup", onManualMapPointerUp);
  updateManualMapSummary();
  renderManualMapGraphics();
  updateSystemCalculations();
}

function pointerEventToMapRatio(event) {
  if (!manualMap) return null;
  const rect = manualMap.getBoundingClientRect();
  const xRatio = (event.clientX - rect.left) / rect.width;
  const yRatio = (event.clientY - rect.top) / rect.height;
  if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) return null;
  return { x: xRatio, y: yRatio };
}

function finalizeManualDraft(draft) {
  if (!draft) return null;

  if (draft.type === "pen") {
    if (!draft.points || draft.points.length < 2) return null;
    return { type: "pen", points: [...draft.points] };
  }

  if (!draft.start || !draft.end) return null;
  const dx = Math.abs(draft.end.x - draft.start.x);
  const dy = Math.abs(draft.end.y - draft.start.y);
  if (dx < 0.003 || dy < 0.003) return null;
  return {
    type: draft.type,
    start: draft.start,
    end: draft.end,
  };
}

function renderManualMapGraphics() {
  if (!manualMapOverlay) return;
  manualMapOverlay.innerHTML = "";

  state.manualShapes.forEach((shape) => {
    const element = createShapeSvgElement(shape, false);
    if (element) manualMapOverlay.appendChild(element);
  });

  if (state.manualDraft) {
    const preview = createShapeSvgElement(state.manualDraft, true);
    if (preview) manualMapOverlay.appendChild(preview);
  }

  if (state.manualSearchMarker) {
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    marker.setAttribute("class", "map-search-marker");
    marker.setAttribute("cx", String(state.manualSearchMarker.x * 1000));
    marker.setAttribute("cy", String(state.manualSearchMarker.y * 1000));
    marker.setAttribute("r", "9");
    manualMapOverlay.appendChild(marker);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("class", "map-search-label");
    label.setAttribute("x", String(state.manualSearchMarker.x * 1000 + 14));
    label.setAttribute("y", String(state.manualSearchMarker.y * 1000 - 8));
    label.textContent = state.manualSearchMarker.label;
    manualMapOverlay.appendChild(label);
  }
}

function createShapeSvgElement(shape, isPreview) {
  if (!shape) return null;

  if (shape.type === "square") {
    const x = Math.min(shape.start.x, shape.end.x) * 1000;
    const y = Math.min(shape.start.y, shape.end.y) * 1000;
    const width = Math.abs(shape.end.x - shape.start.x) * 1000;
    const height = Math.abs(shape.end.y - shape.start.y) * 1000;
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(width));
    rect.setAttribute("height", String(height));
    rect.setAttribute("class", `map-shape${isPreview ? " preview" : ""}`);
    return rect;
  }

  if (shape.type === "circle") {
    const cx = shape.start.x * 1000;
    const cy = shape.start.y * 1000;
    const radius = Math.hypot(shape.end.x - shape.start.x, shape.end.y - shape.start.y) * 1000;
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(cx));
    circle.setAttribute("cy", String(cy));
    circle.setAttribute("r", String(radius));
    circle.setAttribute("class", `map-shape${isPreview ? " preview" : ""}`);
    return circle;
  }

  if (shape.type === "pen") {
    const points = shape.points || [];
    if (points.length < 2) return null;
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polygon.setAttribute(
      "points",
      points.map((point) => `${point.x * 1000},${point.y * 1000}`).join(" "),
    );
    polygon.setAttribute("class", `map-shape pen${isPreview ? " preview" : ""}`);
    polygon.setAttribute("fill", "none");
    return polygon;
  }

  return null;
}

function updateManualMapSummary() {
  if (!manualMapSummary) return;

  const totalShapes = state.manualShapes.length;
  const squareCount = state.manualShapes.filter((shape) => shape.type === "square").length;
  const circleCount = state.manualShapes.filter((shape) => shape.type === "circle").length;
  const penCount = state.manualShapes.filter((shape) => shape.type === "pen").length;
  const searchText = state.manualSearchMarker ? ` | Place: ${state.manualSearchMarker.fullLabel}` : "";

  if (totalShapes === 0 && !state.manualSearchMarker) {
    manualMapSummary.textContent = "Use the toolbar to draw AOI shapes on the map.";
    return;
  }

  manualMapSummary.textContent = `Shapes: ${totalShapes} (square ${squareCount}, circle ${circleCount}, pen ${penCount})${searchText}`;
}

async function onManualSearchSubmit(event) {
  event.preventDefault();
  const query = manualMapSearchInput?.value?.trim();
  if (!query) return;

  if (manualMapSummary) {
    manualMapSummary.textContent = `Searching for "${query}"...`;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Search request failed (${response.status})`);
    const results = await response.json();
    const first = results?.[0];
    if (!first) {
      state.manualSearchMarker = null;
      if (manualMapSummary) {
        manualMapSummary.textContent = `No result found for "${query}".`;
      }
      renderManualMapGraphics();
      return;
    }

    const lon = Number(first.lon);
    const lat = Number(first.lat);
    state.manualSearchMarker = {
      x: clamp((lon + 180) / 360, 0, 1),
      y: clamp((90 - lat) / 180, 0, 1),
      label: "Search hit",
      fullLabel: first.display_name || query,
    };
    renderManualMapGraphics();
    updateManualMapSummary();
  } catch (error) {
    state.manualSearchMarker = null;
    if (manualMapSummary) {
      manualMapSummary.textContent = `Search unavailable for "${query}".`;
    }
    renderManualMapGraphics();
  }
}

function clearManualDrawings() {
  state.manualShapes = [];
  state.manualDraft = null;
  renderManualMapGraphics();
  updateManualMapSummary();
  updateSystemCalculations();
}

function dismissManualFullscreenMap() {
  state.manualOverlayDismissed = true;
  updateAreaInputModeUI();
}

function onGeoJsonFileChange(event) {
  const file = event.target.files?.[0];
  if (!geojsonFileSummary) return;

  if (!file) {
    state.geojsonFeatureCount = 0;
    geojsonFileSummary.textContent = "No file selected.";
    updateSystemCalculations();
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      const featureCount = Array.isArray(parsed.features) ? parsed.features.length : 0;
      state.geojsonFeatureCount = featureCount;
      geojsonFileSummary.textContent = `${file.name} loaded (${featureCount} feature${featureCount === 1 ? "" : "s"}).`;
    } catch {
      state.geojsonFeatureCount = 0;
      geojsonFileSummary.textContent = `${file.name} selected (unable to parse as valid GeoJSON).`;
    }
    updateSystemCalculations();
  };
  reader.onerror = () => {
    state.geojsonFeatureCount = 0;
    geojsonFileSummary.textContent = `${file.name} selected (failed to read file).`;
    updateSystemCalculations();
  };
  reader.readAsText(file);
}

function expandQuestionsForEdge(edge) {
  if (!edge) return;
  [edge.from, edge.to].forEach((nodeId) => {
    const questionId = cardMap.get(nodeId)?.dataset.questionId;
    if (questionId) {
      state.expandedQuestions.add(questionId);
    }
  });
}

function isCardVisible(card) {
  return !card.closest("[hidden]");
}

syncConditionalQuestionState();
applyQuestionAnswerVisibility();
renderConnectionList();
refreshCardState();
renderManualMapGraphics();
updateAreaInputModeUI();
drawConnections();
updateSystemCalculations();
