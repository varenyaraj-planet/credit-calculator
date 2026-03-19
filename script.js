const state = {
  selectedNodes: new Set(),
  edges: [],
  dragging: null,
};

const GENERAL_MONITORING_NODE_ID = "q3-general-monitoring";
const questionOrder = { q1: 1, q2: 2, q3: 3, q4: 4 };
const baseCredits = 300;
const canvas = document.getElementById("flow-canvas");
const svg = document.getElementById("flow-lines");
const connectionList = document.getElementById("connection-list");
const clearButton = document.getElementById("clear-button");
const q4Block = document.getElementById("q4-block");
const q1Profile = document.getElementById("q1-profile");
const q2Profile = document.getElementById("q2-profile");
const q3Profile = document.getElementById("q3-profile");
const q4Profile = document.getElementById("q4-profile");
const creditTotal = document.getElementById("credit-total");
const calcDetails = document.getElementById("calc-details");
const cards = Array.from(document.querySelectorAll(".answer-card"));
const outputHandles = Array.from(document.querySelectorAll(".output-handle"));
const cardMap = new Map(cards.map((card) => [card.dataset.nodeId, card]));

cards.forEach((card) => {
  card.addEventListener("click", () => toggleCard(card.dataset.nodeId));
});

outputHandles.forEach((handle) => {
  handle.addEventListener("pointerdown", startDragConnection);
});

clearButton.addEventListener("click", clearAll);
window.addEventListener("resize", drawConnections);

function toggleCard(nodeId) {
  if (state.selectedNodes.has(nodeId)) {
    state.selectedNodes.delete(nodeId);
  } else {
    state.selectedNodes.add(nodeId);
  }

  syncConditionalQuestionState();
  refreshCardState();
  updateSystemCalculations();
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

function onDragPointerMove(event) {
  if (!state.dragging) return;
  state.dragging.pointerX = event.clientX;
  state.dragging.pointerY = event.clientY;
  highlightDropTarget(event.clientX, event.clientY);
  drawConnections();
}

function onDragPointerUp(event) {
  if (!state.dragging) return;

  const targetCard = resolveDropTarget(event.clientX, event.clientY, state.dragging.fromNodeId);
  if (targetCard) {
    addEdge(state.dragging.fromNodeId, targetCard.dataset.nodeId);
  }

  state.dragging = null;
  clearDropHighlights();
  refreshCardState();
  drawConnections();
  updateSystemCalculations();
  window.removeEventListener("pointermove", onDragPointerMove);
  window.removeEventListener("pointerup", onDragPointerUp);
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
  renderConnectionList();
}

function removeEdge(index) {
  state.edges.splice(index, 1);
  syncConditionalQuestionState();
  renderConnectionList();
  refreshCardState();
  drawConnections();
  updateSystemCalculations();
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

  state.edges.forEach((edge) => {
    drawEdgePath(edge.from, edge.to, false, canvasRect);
  });

  if (state.dragging) {
    drawPreviewPath(canvasRect);
  }
}

function drawEdgePath(fromNodeId, toNodeId, dashed, canvasRect) {
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
  appendPath(startX, startY, endX, endY, dashed);
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

  q1Profile.textContent = combineUnique(q1Cards.map((card) => card.dataset.summary));
  q2Profile.textContent = combineUnique(q2Cards.map((card) => card.dataset.summary));
  q3Profile.textContent = combineUnique(q3Cards.map((card) => card.dataset.summary));
  q4Profile.textContent = combineUnique(q4Cards.map((card) => card.dataset.summary));

  const q1Multiplier = averageMultiplier(q1Cards);
  const q2Multiplier = averageMultiplier(q2Cards);
  const q3Multiplier = averageMultiplier(q3Cards);
  const q4Multiplier = averageMultiplier(q4Cards);
  const connectionMultiplier = 1 + state.edges.length * 0.1;
  const total = Math.round(baseCredits * q1Multiplier * q2Multiplier * q3Multiplier * q4Multiplier * connectionMultiplier);

  creditTotal.textContent = Number.isFinite(total) ? total.toLocaleString() : "0";
  calcDetails.textContent = `Base ${baseCredits} × Q1 ${q1Multiplier.toFixed(2)} × Q2 ${q2Multiplier.toFixed(2)} × Q3 ${q3Multiplier.toFixed(2)} × Q4 ${q4Multiplier.toFixed(2)} × Links ${connectionMultiplier.toFixed(2)}`;
}

function averageMultiplier(cardsSubset) {
  if (cardsSubset.length === 0) return 1;
  const sum = cardsSubset.reduce((acc, card) => acc + Number(card.dataset.multiplier || 1), 0);
  return sum / cardsSubset.length;
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
  syncConditionalQuestionState();
  clearDropHighlights();
  renderConnectionList();
  refreshCardState();
  drawConnections();
  updateSystemCalculations();
}

function syncConditionalQuestionState() {
  const shouldShowQ4 = hasRequiredGeneralMonitoringLink();
  if (q4Block) {
    q4Block.hidden = !shouldShowQ4;
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

function isCardVisible(card) {
  return !card.closest("[hidden]");
}

syncConditionalQuestionState();
renderConnectionList();
refreshCardState();
drawConnections();
updateSystemCalculations();
