const state = {
  selectedNodes: new Set(),
  edges: [],
  dragging: null,
  expandedQuestions: new Set(),
  manualPoints: [],
  geojsonFeatureCount: 0,
};

const GENERAL_MONITORING_NODE_ID = "q3-general-monitoring";
const questionOrder = { q1: 1, q2: 2, q3: 3, q4: 4, q5: 5, q6: 6 };
const canvas = document.getElementById("flow-canvas");
const svg = document.getElementById("flow-lines");
const connectionList = document.getElementById("connection-list");
const clearButton = document.getElementById("clear-button");
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
const manualMapSummary = document.getElementById("manual-map-summary");
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
  manualMap.addEventListener("click", onManualMapClick);
}

if (geojsonFileInput) {
  geojsonFileInput.addEventListener("change", onGeoJsonFileChange);
}

clearButton.addEventListener("click", clearAll);
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

  syncConditionalQuestionState();
  applyQuestionAnswerVisibility();
  refreshCardState();
  updateSystemCalculations();
  updateAreaInputModeUI();
  drawConnections();
}

function onCardClick(card) {
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
  const selectedCards = Array.from(state.selectedNodes)
    .map((nodeId) => cardMap.get(nodeId))
    .filter(Boolean);
  const q1Cards = selectedCards.filter((card) => card.dataset.questionId === "q1");
  const q2Cards = selectedCards.filter((card) => card.dataset.questionId === "q2");
  const q3Cards = selectedCards.filter((card) => card.dataset.questionId === "q3");
  const q4Cards = selectedCards.filter((card) => card.dataset.questionId === "q4");
  const q5Cards = selectedCards.filter((card) => card.dataset.questionId === "q5");
  const q6Cards = selectedCards.filter((card) => card.dataset.questionId === "q6");

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
    " USD conversion uses Total Estimated Credits × $0.015 (Annual) or × $0.01 (Monthly)." +
    reservedNote;
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
    if (state.manualPoints.length === 0) return 50;
    return state.manualPoints.length * 25;
  }

  if (mode === "geojson") {
    if (state.geojsonFeatureCount <= 0) return 80;
    return state.geojsonFeatureCount * 40;
  }

  return 0;
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
  state.manualPoints = [];
  state.geojsonFeatureCount = 0;
  if (geojsonFileInput) {
    geojsonFileInput.value = "";
  }
  if (geojsonFileSummary) {
    geojsonFileSummary.textContent = "No file selected.";
  }
  if (manualMapSummary) {
    manualMapSummary.textContent = "Click on the map to drop AOI points.";
  }
  syncConditionalQuestionState();
  applyQuestionAnswerVisibility();
  clearDropHighlights();
  renderConnectionList();
  refreshCardState();
  renderManualMapMarkers();
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

function updateAreaInputModeUI() {
  const areaMode = resolveActiveAreaInputMode();

  if (manualEntryPanel) {
    manualEntryPanel.hidden = areaMode !== "manual";
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

function onManualMapClick(event) {
  if (resolveActiveAreaInputMode() !== "manual") return;
  if (!manualMap) return;

  const rect = manualMap.getBoundingClientRect();
  const xRatio = (event.clientX - rect.left) / rect.width;
  const yRatio = (event.clientY - rect.top) / rect.height;
  if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) return;

  state.manualPoints.push({ xRatio, yRatio });
  renderManualMapMarkers();

  if (manualMapSummary) {
    manualMapSummary.textContent = `${state.manualPoints.length} AOI point(s) marked.`;
  }
  updateSystemCalculations();
}

function renderManualMapMarkers() {
  if (!manualMap) return;

  manualMap.querySelectorAll(".map-marker").forEach((marker) => marker.remove());
  state.manualPoints.forEach((point) => {
    const marker = document.createElement("span");
    marker.className = "map-marker";
    marker.style.left = `${point.xRatio * 100}%`;
    marker.style.top = `${point.yRatio * 100}%`;
    manualMap.appendChild(marker);
  });
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
renderManualMapMarkers();
updateAreaInputModeUI();
drawConnections();
updateSystemCalculations();
