const state = {
  selectedSourceId: null,
  edges: [],
  dragging: null,
};

const questionOrder = { q1: 1, q2: 2 };
const canvas = document.getElementById("flow-canvas");
const svg = document.getElementById("flow-lines");
const selectedSourceEl = document.getElementById("selected-source");
const connectionListEl = document.getElementById("connection-list");
const decisionOutputEl = document.getElementById("decision-output");
const evaluateButton = document.getElementById("evaluate-button");
const resetButton = document.getElementById("reset-button");
const homeView = document.getElementById("home-view");
const dataflowView = document.getElementById("dataflow-view");
const navLinks = Array.from(document.querySelectorAll("[data-route-link]"));
const goToDataflowButton = document.getElementById("go-to-dataflow");
const backToHomeButton = document.getElementById("back-to-home");
const nodeElements = Array.from(document.querySelectorAll(".answer-node"));
const outputHandles = Array.from(document.querySelectorAll(".output-handle"));
const nodeMap = new Map(nodeElements.map((node) => [node.dataset.nodeId, node]));

nodeElements.forEach((node) => {
  node.addEventListener("click", () => onNodeClick(node));
});

outputHandles.forEach((handle) => {
  handle.addEventListener("pointerdown", onOutputHandlePointerDown);
});

evaluateButton.addEventListener("click", evaluateDecisionFlow);
resetButton.addEventListener("click", resetFlow);
window.addEventListener("resize", drawAllConnections);
window.addEventListener("hashchange", onHashRouteChange);

navLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setRoute(link.dataset.routeLink, true);
  });
});

goToDataflowButton.addEventListener("click", () => setRoute("dataflow", true));
backToHomeButton.addEventListener("click", () => setRoute("home", true));

function normalizeRoute(route) {
  return route === "dataflow" ? "dataflow" : "home";
}

function onHashRouteChange() {
  setRoute(normalizeRoute(window.location.hash.replace("#", "")), false);
}

function setRoute(route, updateHash) {
  const normalizedRoute = normalizeRoute(route);
  const isHomeRoute = normalizedRoute === "home";

  homeView.hidden = !isHomeRoute;
  dataflowView.hidden = isHomeRoute;

  navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.routeLink === normalizedRoute);
  });

  if (updateHash && window.location.hash !== `#${normalizedRoute}`) {
    window.location.hash = normalizedRoute;
  }

  if (!isHomeRoute) {
    requestAnimationFrame(drawAllConnections);
  }
}

function onOutputHandlePointerDown(event) {
  event.preventDefault();
  event.stopPropagation();

  const sourceNode = event.currentTarget.closest(".answer-node");
  if (!sourceNode) return;

  const sourceQuestionId = sourceNode.dataset.questionId;
  if (sourceQuestionId !== "q1") {
    decisionOutputEl.textContent = "Drag links forward from Question 1 answers to Question 2 answers.";
    return;
  }

  const sourceNodeId = sourceNode.dataset.nodeId;
  const handleRect = event.currentTarget.getBoundingClientRect();

  state.dragging = {
    fromId: sourceNodeId,
    pointerX: event.clientX,
    pointerY: event.clientY,
    startX: handleRect.left + handleRect.width / 2,
    startY: handleRect.top + handleRect.height / 2,
  };

  state.selectedSourceId = sourceNodeId;
  updateSelectedSource();
  refreshNodeState();
  decisionOutputEl.textContent = "Drag onto a Question 2 input dot and release to connect.";
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
  } else {
    decisionOutputEl.textContent = "Drop on a valid Question 2 input dot to form a link.";
  }

  state.dragging = null;
  clearDropTargetState();
  state.selectedSourceId = null;
  updateSelectedSource();
  refreshNodeState();
  drawAllConnections();

  window.removeEventListener("pointermove", onPointerMoveWhileDragging);
  window.removeEventListener("pointerup", onPointerUpWhileDragging);
}

function getValidDropTarget(clientX, clientY, fromId) {
  const fromNode = nodeMap.get(fromId);
  if (!fromNode) return null;

  const fromQuestionId = fromNode.dataset.questionId;
  const hovered = document.elementFromPoint(clientX, clientY);
  if (!hovered) return null;

  let targetNode = null;
  if (hovered.classList.contains("input-handle")) {
    targetNode = hovered.closest(".answer-node");
  } else {
    targetNode = hovered.closest(".answer-node");
  }

  if (!targetNode) return null;
  const targetQuestionId = targetNode.dataset.questionId;
  if (questionOrder[targetQuestionId] <= questionOrder[fromQuestionId]) return null;

  return targetNode;
}

function refreshDropTargetState(clientX, clientY) {
  clearDropTargetState();
  if (!state.dragging) return;

  const targetNode = getValidDropTarget(clientX, clientY, state.dragging.fromId);
  if (!targetNode) return;
  targetNode.classList.add("drop-target");
}

function clearDropTargetState() {
  nodeElements.forEach((node) => node.classList.remove("drop-target"));
}

function onNodeClick(node) {
  const { nodeId, questionId } = node.dataset;

  if (!state.selectedSourceId) {
    if (questionId !== "q1") {
      decisionOutputEl.textContent = "Pick a source from Question 1 first.";
      return;
    }

    state.selectedSourceId = nodeId;
    updateSelectedSource();
    refreshNodeState();
    decisionOutputEl.textContent = "Now click a target answer from Question 2.";
    return;
  }

  const sourceNode = nodeMap.get(state.selectedSourceId);
  const sourceQuestionId = sourceNode.dataset.questionId;

  if (nodeId === state.selectedSourceId) {
    state.selectedSourceId = null;
    updateSelectedSource();
    refreshNodeState();
    decisionOutputEl.textContent = "Source selection cleared.";
    return;
  }

  const sourceOrder = questionOrder[sourceQuestionId];
  const targetOrder = questionOrder[questionId];

  if (targetOrder <= sourceOrder) {
    decisionOutputEl.textContent =
      "Connect forward only: Question 1 answer should flow into Question 2 answer.";
    return;
  }

  addEdge(state.selectedSourceId, nodeId);
  state.selectedSourceId = null;
  updateSelectedSource();
  refreshNodeState();
  drawAllConnections();
}

function addEdge(fromId, toId) {
  const duplicate = state.edges.some((edge) => edge.from === fromId && edge.to === toId);
  if (duplicate) {
    decisionOutputEl.textContent = "This connection already exists.";
    return;
  }

  state.edges.push({ from: fromId, to: toId });
  renderConnectionList();
  decisionOutputEl.textContent = "Connection added. Click Evaluate Decision to run the flow.";
}

function renderConnectionList() {
  connectionListEl.innerHTML = "";

  if (state.edges.length === 0) {
    connectionListEl.innerHTML = `<li class="muted-item">No connections yet.</li>`;
    return;
  }

  state.edges.forEach((edge, index) => {
    const fromLabel = labelForNode(edge.from);
    const toLabel = labelForNode(edge.to);
    const item = document.createElement("li");
    item.className = "connection-item";
    item.innerHTML = `
      <span>${fromLabel} → ${toLabel}</span>
      <button type="button" data-edge-index="${index}">Remove</button>
    `;
    connectionListEl.appendChild(item);
  });

  connectionListEl.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const edgeIndex = Number(button.dataset.edgeIndex);
      state.edges.splice(edgeIndex, 1);
      renderConnectionList();
      drawAllConnections();
      refreshNodeState();
      decisionOutputEl.textContent = "Connection removed.";
    });
  });
}

function drawAllConnections() {
  if (dataflowView.hidden) return;

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

    const controlOffset = Math.max(90, Math.abs(endX - startX) * 0.45);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`,
    );
    path.setAttribute("class", "flow-path");
    svg.appendChild(path);
  });

  if (state.dragging) {
    const startX = state.dragging.startX - canvasRect.left;
    const startY = state.dragging.startY - canvasRect.top;
    const endX = state.dragging.pointerX - canvasRect.left;
    const endY = state.dragging.pointerY - canvasRect.top;
    const controlOffset = Math.max(90, Math.abs(endX - startX) * 0.45);

    const previewPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    previewPath.setAttribute(
      "d",
      `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`,
    );
    previewPath.setAttribute("class", "flow-path");
    previewPath.setAttribute("stroke-dasharray", "7 7");
    previewPath.setAttribute("opacity", "0.85");
    svg.appendChild(previewPath);
  }
}

function refreshNodeState() {
  nodeElements.forEach((node) => {
    const nodeId = node.dataset.nodeId;
    node.classList.toggle("active-source", nodeId === state.selectedSourceId);
    node.classList.remove("connected", "active-target");
  });

  state.edges.forEach((edge) => {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (fromNode) fromNode.classList.add("connected");
    if (toNode) toNode.classList.add("connected", "active-target");
  });
}

function labelForNode(nodeId) {
  const node = nodeMap.get(nodeId);
  if (!node) return nodeId;
  const qLabel = node.dataset.questionId === "q1" ? "Who are you" : "Born in";
  return `${qLabel}: ${node.dataset.answer}`;
}

function updateSelectedSource() {
  if (!state.selectedSourceId) {
    selectedSourceEl.textContent = "None";
    return;
  }

  selectedSourceEl.textContent = labelForNode(state.selectedSourceId);
}

function evaluateDecisionFlow() {
  if (state.edges.length === 0) {
    decisionOutputEl.textContent = "No flow to evaluate yet.";
    return;
  }

  const outputs = state.edges.map((edge) => {
    const who = nodeMap.get(edge.from)?.dataset.answer;
    const year = nodeMap.get(edge.to)?.dataset.answer;
    return `${capitalize(who)} born in ${year} → ${decisionTag(who, year)}`;
  });

  decisionOutputEl.innerHTML = outputs.map((line) => `<div>• ${line}</div>`).join("");
}

function decisionTag(who, year) {
  if (who === "human" && year === "1992") return "Modern-era profile";
  if (who === "insect" && year === "1892") return "Industrial-era tiny survivor";
  if (who === "dolphin" && year === "1792") return "Historic-ocean intelligence";
  return "Custom connected scenario";
}

function resetFlow() {
  state.selectedSourceId = null;
  state.edges = [];
  state.dragging = null;
  clearDropTargetState();
  updateSelectedSource();
  renderConnectionList();
  refreshNodeState();
  drawAllConnections();
  decisionOutputEl.textContent = "Flow reset. Start by selecting a Question 1 answer.";
}

function capitalize(value) {
  if (!value) return "";
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

updateSelectedSource();
renderConnectionList();
refreshNodeState();
setRoute(normalizeRoute(window.location.hash.replace("#", "")), false);
drawAllConnections();
