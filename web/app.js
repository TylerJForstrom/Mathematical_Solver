import {
  analyzeDerivative,
  analyzeEquation,
  analyzeLogic,
  analyzeSimplification,
  analyzeStatistics,
  analyzeUniversal,
  formatTruth,
  nodeChildren,
  nodeLabel,
  nodeTone,
} from "./solver-engine.mjs";

const MODE_CONFIG = {
  ask: {
    label: "Ask",
    input: "solve x^2 - 5x + 6 = 0",
    compare: "",
    detail: "Route common math questions automatically.",
  },
  equation: {
    label: "Equation",
    input: "x^2 - 5x + 6 = 0",
    compare: "",
    detail: "Solve linear and quadratic equations.",
  },
  simplify: {
    label: "Simplify",
    input: "2x + 3x - 4 + 10",
    compare: "",
    detail: "Combine constants and like terms.",
  },
  derivative: {
    label: "Derivative",
    input: "x^3 + 2x^2 - 7x + 4",
    compare: "",
    detail: "Apply calculus rules to expression trees.",
  },
  statistics: {
    label: "Stats",
    input: "mean, median, and standard deviation of 2, 4, 4, 5, 9",
    compare: "",
    detail: "Summarize data, regression, correlation, and binomial probability.",
  },
  logic: {
    label: "Logic",
    input: "(P and Q) -> (R or not S)",
    compare: "not (P and Q) or (R or not S)",
    detail: "Evaluate propositional truth logic.",
  },
};

const state = {
  mode: "equation",
  logicValues: new Map(),
  logicVariables: [],
};

const elements = {
  modeButtons: document.querySelectorAll("[data-mode]"),
  sampleButtons: document.querySelectorAll("[data-sample]"),
  statementInput: document.querySelector("#statementInput"),
  variableInput: document.querySelector("#variableInput"),
  compareInput: document.querySelector("#compareInput"),
  logicControls: document.querySelector("#logicControls"),
  mathControls: document.querySelector("#mathControls"),
  valuesPanel: document.querySelector("#valuesPanel"),
  flipAllButton: document.querySelector("#flipAllButton"),
  errorBox: document.querySelector("#errorBox"),
  resultBanner: document.querySelector("#resultBanner"),
  resultLabel: document.querySelector("#resultLabel"),
  resultDetail: document.querySelector("#resultDetail"),
  modeBadge: document.querySelector("#modeBadge"),
  summaryBadge: document.querySelector("#summaryBadge"),
  variableCount: document.querySelector("#variableCount"),
  nodesMetric: document.querySelector("#nodesMetric"),
  heightMetric: document.querySelector("#heightMetric"),
  operatorsMetric: document.querySelector("#operatorsMetric"),
  variablesMetric: document.querySelector("#variablesMetric"),
  treeSvg: document.querySelector("#treeSvg"),
  outputPanel: document.querySelector("#outputPanel"),
  stepsList: document.querySelector("#stepsList"),
};

function setMode(mode, shouldUseDefault = false) {
  state.mode = mode;
  const config = MODE_CONFIG[mode];
  if (shouldUseDefault || !elements.statementInput.value.trim()) {
    elements.statementInput.value = config.input;
  }
  if (shouldUseDefault) {
    elements.compareInput.value = config.compare;
  }

  for (const button of elements.modeButtons) {
    const active = button.dataset.mode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }

  elements.logicControls.hidden = mode !== "logic";
  elements.mathControls.hidden = !["ask", "equation", "derivative"].includes(mode);
  elements.statementInput.setAttribute("aria-label", `${config.label} input`);
  update();
}

function update() {
  try {
    const analysis = runAnalysis();
    elements.errorBox.hidden = true;
    renderAnalysis(analysis);
  } catch (error) {
    elements.errorBox.hidden = false;
    elements.errorBox.textContent = error.message;
  }
}

function runAnalysis() {
  const input = elements.statementInput.value.trim();
  if (!input) {
    throw new Error("Enter a statement or expression to analyze.");
  }

  if (state.mode === "ask") {
    return analyzeUniversal(input, Object.fromEntries(state.logicValues.entries()));
  }
  if (state.mode === "logic") {
    return analyzeLogic(input, Object.fromEntries(state.logicValues.entries()), elements.compareInput.value);
  }
  if (state.mode === "simplify") {
    return analyzeSimplification(input);
  }
  if (state.mode === "derivative") {
    return analyzeDerivative(input, elements.variableInput.value);
  }
  if (state.mode === "statistics") {
    return analyzeStatistics(input);
  }
  return analyzeEquation(input, elements.variableInput.value);
}

function renderAnalysis(analysis) {
  if (analysis.mode === "logic") {
    syncLogicValues(analysis.variables);
    if (!sameVariables(analysis.variables, state.logicVariables)) {
      const refreshed = state.mode === "ask"
        ? analyzeUniversal(elements.statementInput.value, Object.fromEntries(state.logicValues.entries()))
        : analyzeLogic(
            elements.statementInput.value,
            Object.fromEntries(state.logicValues.entries()),
            elements.compareInput.value,
          );
      renderAnalysis(refreshed);
      return;
    }
    renderLogicValues(analysis.variables);
  } else {
    elements.valuesPanel.innerHTML = "";
  }

  elements.modeBadge.textContent = MODE_CONFIG[state.mode].label;
  elements.summaryBadge.textContent = analysis.summary;
  elements.variableCount.textContent = String(analysis.variables.length);
  elements.resultLabel.textContent = analysis.answer;
  elements.resultDetail.textContent = analysis.details;
  elements.resultBanner.className = "answer-band";
  elements.resultBanner.classList.toggle("false", analysis.mode === "logic" && analysis.answer === "false");
  elements.resultBanner.classList.toggle("math", analysis.mode !== "logic");

  elements.nodesMetric.textContent = String(analysis.metrics.nodes);
  elements.heightMetric.textContent = String(analysis.metrics.height);
  elements.operatorsMetric.textContent = String(analysis.metrics.operators);
  elements.variablesMetric.textContent = String(analysis.variables.length);

  renderTree(analysis.tree);
  renderOutput(analysis);
  renderSteps(analysis.steps);
}

function syncLogicValues(names) {
  for (const name of names) {
    if (!state.logicValues.has(name)) {
      state.logicValues.set(name, true);
    }
  }

  for (const name of [...state.logicValues.keys()]) {
    if (!names.includes(name)) {
      state.logicValues.delete(name);
    }
  }

  state.logicVariables = names;
}

function sameVariables(left, right) {
  return left.length === right.length && left.every((name, index) => name === right[index]);
}

function renderLogicValues(names) {
  elements.valuesPanel.innerHTML = "";
  if (names.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No variables";
    elements.valuesPanel.append(empty);
    return;
  }

  for (const name of names) {
    const value = state.logicValues.get(name);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "value-toggle";
    button.dataset.value = String(value);
    button.setAttribute("aria-pressed", String(value));
    button.innerHTML = `<span>${escapeHtml(name)}</span><span class="state">${formatTruth(value)}</span>`;
    button.addEventListener("click", () => {
      state.logicValues.set(name, !state.logicValues.get(name));
      update();
    });
    elements.valuesPanel.append(button);
  }
}

function renderOutput(analysis) {
  const graphMarkup = analysis.graph ? renderGraph(analysis.graph) : "";
  const artifactMarkup = renderArtifacts(analysis.artifacts);

  if (analysis.table) {
    const headerCells = analysis.table.headers
      .map((header) => `<th scope="col">${escapeHtml(header)}</th>`)
      .join("");
    const bodyRows = analysis.table.rows
      .map((row) => `<tr>${row.map(outputCell).join("")}</tr>`)
      .join("");
    elements.outputPanel.innerHTML = `${graphMarkup}<div class="table-wrap"><table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>${artifactMarkup}`;
    return;
  }

  const artifacts = analysis.artifacts ?? [["Answer", analysis.answer]];
  elements.outputPanel.innerHTML = `${graphMarkup}${renderArtifacts(artifacts)}`;
}

function renderArtifacts(artifacts = []) {
  return artifacts
    .map(
      ([label, value]) => `
        <div class="artifact-row">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join("");
}

function renderGraph(graph) {
  const width = 640;
  const height = 260;
  const pad = 30;
  const lineSeries = graph.lines ?? (graph.points ? [{ label: graph.expression, points: graph.points }] : []);
  const scatterPoints = graph.scatter ?? [];
  const allPoints = [...lineSeries.flatMap((series) => series.points), ...scatterPoints];
  const baseXMin = Number.isFinite(graph.xMin) ? graph.xMin : Math.min(...allPoints.map((point) => point.x));
  const baseXMax = Number.isFinite(graph.xMax) ? graph.xMax : Math.max(...allPoints.map((point) => point.x));
  const baseYMin = Number.isFinite(graph.yMin) ? graph.yMin : Math.min(...allPoints.map((point) => point.y));
  const baseYMax = Number.isFinite(graph.yMax) ? graph.yMax : Math.max(...allPoints.map((point) => point.y));
  const xSpan = baseXMax - baseXMin || 1;
  const ySpan = baseYMax - baseYMin || 1;
  const xMin = baseXMin;
  const xMax = baseXMin === baseXMax ? baseXMax + xSpan : baseXMax;
  const yPad = Math.max(1, ySpan * 0.08);
  const yMin = baseYMin - yPad;
  const yMax = baseYMax + yPad;
  const mapX = (x) => pad + ((x - xMin) / (xMax - xMin)) * (width - pad * 2);
  const mapY = (y) => height - pad - ((y - yMin) / (yMax - yMin)) * (height - pad * 2);
  const lineMarkup = lineSeries
    .map((series) => {
      const points = series.points.map((point) => `${mapX(point.x).toFixed(2)},${mapY(point.y).toFixed(2)}`).join(" ");
      return `<polyline class="graph-line" points="${points}"></polyline>`;
    })
    .join("");
  const scatterMarkup = scatterPoints
    .map((point) => `<circle class="graph-point" cx="${mapX(point.x).toFixed(2)}" cy="${mapY(point.y).toFixed(2)}" r="4.6"></circle>`)
    .join("");
  const legendItems = [
    ...(scatterPoints.length ? ["Data"] : []),
    ...lineSeries.map((series) => series.label).filter(Boolean),
  ];
  const legend = legendItems.length > 1
    ? `<div class="graph-legend">${legendItems.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
    : "";
  const xAxis = yMin <= 0 && yMax >= 0 ? `<line class="graph-axis" x1="${pad}" y1="${mapY(0)}" x2="${width - pad}" y2="${mapY(0)}"></line>` : "";
  const yAxis = xMin <= 0 && xMax >= 0 ? `<line class="graph-axis" x1="${mapX(0)}" y1="${pad}" x2="${mapX(0)}" y2="${height - pad}"></line>` : "";
  const graphLabel = graph.kind === "scatter-fit" ? "Statistical graph" : "Function graph";

  return `
    <div class="graph-card" aria-label="${graphLabel}">
      <div class="graph-header">
        <strong>${escapeHtml(graph.expression)}</strong>
        <span>x ${escapeHtml(`[${formatPlotNumber(xMin)}, ${formatPlotNumber(xMax)}]`)}</span>
      </div>
      ${legend}
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(graph.expression)}">
        <rect x="0" y="0" width="${width}" height="${height}"></rect>
        ${xAxis}
        ${yAxis}
        ${lineMarkup}
        ${scatterMarkup}
        <text class="graph-label" x="${pad}" y="20">${escapeHtml(`y ${formatPlotNumber(yMin)} to ${formatPlotNumber(yMax)}`)}</text>
      </svg>
    </div>
  `;
}

function formatPlotNumber(value) {
  if (Object.is(value, -0) || Math.abs(value) < 1e-10) return "0";
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(3)));
}

function outputCell(value) {
  if (typeof value === "boolean") {
    return `<td class="${value ? "true" : "false"}">${formatTruth(value)}</td>`;
  }
  return `<td>${escapeHtml(String(value))}</td>`;
}

function renderSteps(steps) {
  elements.stepsList.innerHTML = steps
    .map(
      (step, index) => `
        <li class="step-item">
          <span class="step-index">${index + 1}</span>
          <div>
            <h3>${escapeHtml(step.title)}</h3>
            <code>${escapeHtml(step.expression)}</code>
            <p>${escapeHtml(step.detail)}</p>
          </div>
        </li>
      `,
    )
    .join("");
}

function renderTree(root) {
  const svg = elements.treeSvg;
  svg.innerHTML = "";

  const layout = layoutTree(root);
  const width = Math.max(720, layout.leaves * 120 + 90);
  const height = Math.max(360, layout.depth * 92 + 90);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const edges = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const nodes = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svg.append(edges, nodes);

  for (const item of layout.nodes) {
    for (const child of item.children) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("class", "tree-edge");
      line.setAttribute("x1", String(item.x));
      line.setAttribute("y1", String(item.y + 25));
      line.setAttribute("x2", String(child.x));
      line.setAttribute("y2", String(child.y - 25));
      edges.append(line);
    }
  }

  for (const item of layout.nodes) {
    const label = nodeLabel(item.node);
    const tone = nodeTone(item.node);
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", `tree-node ${tone}`);

    if (label.length <= 5) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(item.x));
      circle.setAttribute("cy", String(item.y));
      circle.setAttribute("r", "27");
      group.append(circle);
    } else {
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      const width = Math.max(86, label.length * 9);
      rect.setAttribute("x", String(item.x - width / 2));
      rect.setAttribute("y", String(item.y - 26));
      rect.setAttribute("width", String(width));
      rect.setAttribute("height", "52");
      rect.setAttribute("rx", "8");
      group.append(rect);
    }

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(item.x));
    text.setAttribute("y", String(item.y));
    text.textContent = label;
    group.append(text);
    nodes.append(group);
  }
}

function layoutTree(root) {
  const nodes = [];
  let nextLeaf = 0;
  let maxDepth = 0;

  function visit(node, depth) {
    const childItems = nodeChildren(node).map((child) => visit(child, depth + 1));
    const x =
      childItems.length === 0
        ? nextLeaf++ * 120 + 64
        : childItems.reduce((sum, child) => sum + child.x, 0) / childItems.length;
    const item = {
      node,
      x,
      y: depth * 92 + 54,
      children: childItems,
    };
    nodes.push(item);
    maxDepth = Math.max(maxDepth, depth);
    return item;
  }

  visit(root, 0);
  return {
    nodes,
    leaves: Math.max(1, nextLeaf),
    depth: maxDepth + 1,
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.statementInput.addEventListener("input", update);
elements.compareInput.addEventListener("input", update);
elements.variableInput.addEventListener("input", update);
elements.flipAllButton.addEventListener("click", () => {
  for (const name of state.logicVariables) {
    state.logicValues.set(name, !state.logicValues.get(name));
  }
  update();
});

for (const button of elements.modeButtons) {
  button.addEventListener("click", () => setMode(button.dataset.mode, true));
}

for (const button of elements.sampleButtons) {
  button.addEventListener("click", () => {
    const mode = button.dataset.sampleMode;
    setMode(mode, false);
    elements.statementInput.value = button.dataset.sample;
    elements.compareInput.value = button.dataset.compare ?? MODE_CONFIG[mode].compare;
    update();
  });
}

if (!loadInitialState()) {
  setMode("ask", true);
}

function loadInitialState() {
  const params = new URLSearchParams(window.location.search);
  const sampleLabel = params.get("sample");
  if (sampleLabel) {
    const sampleButton = [...elements.sampleButtons].find(
      (button) => button.textContent.trim().toLowerCase() === sampleLabel.toLowerCase(),
    );
    if (sampleButton) {
      const mode = sampleButton.dataset.sampleMode;
      setMode(mode, false);
      elements.statementInput.value = sampleButton.dataset.sample;
      elements.compareInput.value = sampleButton.dataset.compare ?? MODE_CONFIG[mode].compare;
      update();
      return true;
    }
  }

  const problem = params.get("problem");
  if (!problem) {
    return false;
  }

  const requestedMode = params.get("mode") ?? "ask";
  const mode = MODE_CONFIG[requestedMode] ? requestedMode : "ask";
  setMode(mode, false);
  elements.statementInput.value = problem;
  elements.compareInput.value = params.get("compare") ?? MODE_CONFIG[mode].compare;
  update();
  return true;
}
