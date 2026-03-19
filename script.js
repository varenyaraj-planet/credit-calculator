const state = {
  selectedNodeIds: new Set(),
  edges: [],
  dragging: null,
};

const questionOrder = { q1: 1, q2: 2 };
const canvas = document.getElementById("flow-canvas");
const svg = document.getElementById("flow-lines");
const connectionListEl = document.getElementById("connection-list");
const clearAllButton = document.getElementById("clear-all-button");
const accessProfileEl = document.getElementById("access-profile");
const frequencyProfileEl = document.getElementById("frequency-profile");
const analysisProfileEl = document.getElementById("analysis-profile");
const creditsOutputEl = document.getElementById("credits-output");
const calcExplainEl = document.getElementById("calc-explain");
const nodeElements = Array.from(document.querySelectorAll(".answer-card"));
const outputHandles = Array.from(document.querySelectorAll(".output-handle"));
const nodeMap = new Map(nodeElements.map((node) => [node.dataset.nodeId, node]));

nodeElements.forEach((node) => {
  node.addEventListener("click", () => toggleSelectedNode(node));
});

outputHandles.forEach((handle) => {
  handle.addEventListener("pointerdown", onOutputHandlePointerDown);
});

clearAllButton.addEventListener("click", resetEverything);
window.addEventListener("resize", drawAllConnections);

function toggleSelectedNode(node) {
  const nodeId = node.dataset.nodeId;
  if (state.selectedNodeIds.has(nodeId)) {
    state.selectedNodeIds.delete(nodeId);
  } else {
    state.selectedNodeIds.add(nodeId);
  }

  refreshNodeState();
  updateSystemCalculations();
}

function onOutputHandlePointerDown(event) {
  event.preventDefault();
  event.stopPropagation();

  const sourceNode = event.currentTarget.closest(".answer-card");
  if (!sourceNode) return;

  const handleRect = event.currentTarget.getBoundingClientRect();
  state.dragging = {
    fromId: sourceNode.dataset.nodeId,
    pointerX: event.clientX,
    pointerY: event.clientY,
    startX: handleRect.left + handleRect.width / 2,
    startY: handleRect.top + handleRect.height / 2,
  };

  refreshNodeState();
  drawAllConnections();
  window.addEventListener("pointermove", onPointerMoveWhileDragging);
  window.addEventListener("pointerup", onPointerUpWhileDragging);
}

function onPointerMoveWhileDragging(event) {
  if (!state.dragging) return;

  state.dragging.pointerX = event.clientX;
  state.dragging.pointerY = event.clientY;
  refreshDropTargetState(event.clientX, event.clientY);
  drawAllConnections();
}

function onPointerUpWhileDragging(event) {
  if (!state.dragging) return;

  const draggingState = state.dragging;
  const targetNode = getValidDropTarget(event.clientX, event.clientY, draggingState.fromId);
  if (targetNode) {
    addEdge(draggingState.fromId, targetNode.dataset.nodeId);
  }

  state.dragging = null;
  clearDropTargetState();
  refreshNodeState();
  drawAllConnections();
  updateSystemCalculations();
  window.removeEventListener("pointermove", onPointerMoveWhileDragging);
  window.removeEventListener("pointerup", onPointerUpWhileDragging);
}

function getValidDropTarget(clientX, clientY, fromId) {
  const fromNode = nodeMap.get(fromId);
  if (!fromNode) return null;

  const hovered = document.elementFromPoint(clientX, clientY);
  if (!hovered) return null;

  const targetNode = hovered.closest(".answer-card");
  if (!targetNode || targetNode.dataset.nodeId === fromId) return null;

  const fromOrder = questionOrder[fromNode.dataset.questionId];
  const targetOrder = questionOrder[targetNode.dataset.questionId];
  if (!fromOrder || !targetOrder || fromOrder >= targetOrder) return null;

  return targetNode;
}

function refreshDropTargetState(clientX, clientY) {
  clearDropTargetState();
  if (!state.dragging) return;

  const targetNode = getValidDropTarget(clientX, clientY, state.dragging.fromId);
  if (targetNode) targetNode.classList.add("drop-target");
}

function clearDropTargetState() {
  nodeElements.forEach((node) => node.classList.remove("drop-target"));
}

function addEdge(fromId, toId) {
  const duplicate = state.edges.some((edge) => edge.from === fromId && edge.to === toId);
  if (duplicate) return;
  state.edges.push({ from: fromId, to: toId });
  renderConnectionList();
}

function removeEdge(index) {
  state.edges.splice(index, 1);
  renderConnectionList();
  refreshNodeState();
  drawAllConnections();
  updateSystemCalculations();
}

function renderConnectionList() {
  connectionListEl.innerHTML = "";

  if (state.edges.length === 0) {
    connectionListEl.innerHTML = '<li class="muted-item">No links created yet.</li>';
    return;
  }

  state.edges.forEach((edge, index) => {
    const row = document.createElement("li");
    row.className = "connection-item";
    row.innerHTML = `
      <span>${labelForNode(edge.from)} → ${labelForNode(edge.to)}</span>
      <button type="button" class="remove-link" data-edge-index="${index}">Remove</button>
    `;
    connectionListEl.appendChild(row);
  });

  connectionListEl.querySelectorAll(".remove-link").forEach((button) => {
    button.addEventListener("click", () => {
      removeEdge(Number(button.dataset.edgeIndex));
    });
  });
}

function drawAllConnections() {
  const canvasRect = canvas.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${canvasRect.width} ${canvasRect.height}`);
  svg.innerHTML = "";

  state.edges.forEach((edge) => {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (!fromNode || !toNode) return;

    const fromHandle = fromNode.querySelector(".output-handle");
    const toHandle = toNode.querySelector(".input-handle");
    if (!fromHandle || !toHandle) return;

    const fromRect = fromHandle.getBoundingClientRect();
    const toRect = toHandle.getBoundingClientRect();
    const startX = fromRect.left + fromRect.width / 2 - canvasRect.left;
    const startY = fromRect.top + fromRect.height / 2 - canvasRect.top;
    const endX = toRect.left + toRect.width / 2 - canvasRect.left;
    const endY = toRect.top + toRect.height / 2 - canvasRect.top;

    appendPath(startX, startY, endX, endY, false);
  });

  if (state.dragging) {
    const startX = state.dragging.startX - canvasRect.left;
    const startY = state.dragging.startY - canvasRect.top;
    const endX = state.dragging.pointerX - canvasRect.left;
    const endY = state.dragging.pointerY - canvasRect.top;
    appendPath(startX, startY, endX, endY, true);
  }
}

function appendPath(startX, startY, endX, endY, isPreview) {
  const controlOffset = Math.max(95, Math.abs(endX - startX) * 0.42);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`,
  );
  path.setAttribute("class", "flow-path");

  if (isPreview) {
    path.setAttribute("stroke-dasharray", "7 7");
    path.setAttribute("opacity", "0.82");
  }

  svg.appendChild(path);
}

function refreshNodeState() {
  nodeElements.forEach((node) => {
    const nodeId = node.dataset.nodeId;
    node.classList.toggle("selected", state.selectedNodeIds.has(nodeId));
    node.classList.remove("connected");
  });

  state.edges.forEach((edge) => {
    nodeMap.get(edge.from)?.classList.add("connected");
    nodeMap.get(edge.to)?.classList.add("connected");
  });
}

function updateSystemCalculations() {
  const selectedNodes = Array.from(state.selectedNodeIds)
    .map((nodeId) => nodeMap.get(nodeId))
    .filter(Boolean);
  const selectedQ1 = selectedNodes.filter((node) => node.dataset.questionId === "q1");
  const selectedQ2 = selectedNodes.filter((node) => node.dataset.questionId === "q2");

  accessProfileEl.textContent = formatUniqueList(selectedQ1.map((node) => node.dataset.accessMode), "Not set");
  frequencyProfileEl.textContent = formatUniqueList(
    selectedQ1.map((node) => `${node.dataset.frequencyMode} (${node.dataset.profileLean})`),
    "Not set",
  );
  analysisProfileEl.textContent = formatUniqueList(selectedQ2.map((node) => node.dataset.analysisMode), "Not set");

  const baseCredits = 320;
  const accessMultiplier = averageMultiplier(selectedQ1, "accessMultiplier", 1);
  const frequencyMultiplier = averageMultiplier(selectedQ1, "frequencyMultiplier", 1);
  const leanMultiplier = averageMultiplier(selectedQ1, "leanMultiplier", 1);
  const analysisMultiplier = averageMultiplier(selectedQ2, "analysisMultiplier", 1);
  const connectionMultiplier = 1 + state.edges.length * 0.12;

  const total = Math.round(
    baseCredits * accessMultiplier * frequencyMultiplier * leanMultiplier * analysisMultiplier * connectionMultiplier,
  );

  creditsOutputEl.textContent = Number.isFinite(total) ? total.toLocaleString() : "0";
  calcExplainEl.textContent = `Base ${baseCredits} × Access ${accessMultiplier.toFixed(2)} × Frequency ${frequencyMultiplier.toFixed(2)} × Plan ${leanMultiplier.toFixed(2)} × Analysis ${analysisMultiplier.toFixed(2)} × Links ${connectionMultiplier.toFixed(2)}`;
}

function averageMultiplier(nodes, key, fallback) {
  if (nodes.length === 0) return fallback;
  const sum = nodes.reduce((acc, node) => acc + Number(node.dataset[key] || fallback), 0);
  return sum / nodes.length;
}

function labelForNode(nodeId) {
  return nodeMap.get(nodeId)?.dataset.answerLabel || nodeId;
}

function formatUniqueList(values, fallback) {
  const unique = Array.from(new Set(values.filter(Boolean)));
  if (unique.length === 0) return fallback;
  return unique.join(" + ");
}

function resetEverything() {
  state.selectedNodeIds.clear();
  state.edges = [];
  state.dragging = null;
  clearDropTargetState();
  renderConnectionList();
  refreshNodeState();
  drawAllConnections();
  updateSystemCalculations();
}

renderConnectionList();
refreshNodeState();
drawAllConnections();
updateSystemCalculations();
