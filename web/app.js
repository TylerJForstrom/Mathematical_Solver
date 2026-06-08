const state = {
  expression: null,
  values: new Map(),
  lastVariables: [],
};

const elements = {
  statementInput: document.querySelector("#statementInput"),
  compareInput: document.querySelector("#compareInput"),
  errorBox: document.querySelector("#errorBox"),
  valuesPanel: document.querySelector("#valuesPanel"),
  flipAllButton: document.querySelector("#flipAllButton"),
  resultBanner: document.querySelector("#resultBanner"),
  resultLabel: document.querySelector("#resultLabel"),
  classificationBadge: document.querySelector("#classificationBadge"),
  variableCount: document.querySelector("#variableCount"),
  nodesMetric: document.querySelector("#nodesMetric"),
  heightMetric: document.querySelector("#heightMetric"),
  operatorsMetric: document.querySelector("#operatorsMetric"),
  trueRowsMetric: document.querySelector("#trueRowsMetric"),
  treeSvg: document.querySelector("#treeSvg"),
  truthTable: document.querySelector("#truthTable"),
  compareResult: document.querySelector("#compareResult"),
};

const SYMBOL_OPERATORS = new Map([
  ["<->", "IFF"],
  ["<=>", "IFF"],
  ["->", "IMPLIES"],
  ["=>", "IMPLIES"],
  ["&&", "AND"],
  ["||", "OR"],
  ["!", "NOT"],
  ["~", "NOT"],
  ["&", "AND"],
  ["|", "OR"],
  ["^", "XOR"],
]);

const WORD_OPERATORS = new Map([
  ["not", "NOT"],
  ["and", "AND"],
  ["or", "OR"],
  ["xor", "XOR"],
  ["implies", "IMPLIES"],
  ["iff", "IFF"],
]);

const OPERATOR_LABELS = {
  and: "AND",
  or: "OR",
  xor: "XOR",
  implies: "IMPLIES",
  iff: "IFF",
};

const NODE_COLORS = {
  variable: "#1d2428",
  constant: "#6b5ea8",
  not: "#b56d11",
  binary: "#0f8b8d",
};

function tokenize(statement) {
  const tokens = [];
  let index = 0;

  while (index < statement.length) {
    const char = statement[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    const symbol = matchSymbol(statement, index);
    if (symbol) {
      tokens.push({ kind: "OP", value: SYMBOL_OPERATORS.get(symbol), position: index });
      index += symbol.length;
      continue;
    }

    if (char === "(") {
      tokens.push({ kind: "LPAREN", value: char, position: index });
      index += 1;
      continue;
    }

    if (char === ")") {
      tokens.push({ kind: "RPAREN", value: char, position: index });
      index += 1;
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      index += 1;
      while (index < statement.length && /[A-Za-z0-9_]/.test(statement[index])) {
        index += 1;
      }
      const word = statement.slice(start, index);
      const lower = word.toLowerCase();
      if (lower === "true" || lower === "false") {
        tokens.push({ kind: "CONST", value: lower, position: start });
      } else if (WORD_OPERATORS.has(lower)) {
        tokens.push({ kind: "OP", value: WORD_OPERATORS.get(lower), position: start });
      } else {
        tokens.push({ kind: "VAR", value: word, position: start });
      }
      continue;
    }

    throw new Error(`Unexpected character '${char}' at position ${index}.`);
  }

  tokens.push({ kind: "EOF", value: "", position: statement.length });
  return tokens;
}

function matchSymbol(statement, index) {
  for (const symbol of SYMBOL_OPERATORS.keys()) {
    if (statement.startsWith(symbol, index)) {
      return symbol;
    }
  }
  return null;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }

  parse() {
    const expression = this.parseIff();
    if (!this.is("EOF")) {
      const token = this.current();
      throw new Error(`Unexpected token '${token.value}' at position ${token.position}.`);
    }
    return expression;
  }

  parseIff() {
    let expression = this.parseImplies();
    while (this.matchOp("IFF")) {
      expression = binary("iff", expression, this.parseImplies());
    }
    return expression;
  }

  parseImplies() {
    let expression = this.parseOr();
    if (this.matchOp("IMPLIES")) {
      expression = binary("implies", expression, this.parseImplies());
    }
    return expression;
  }

  parseOr() {
    let expression = this.parseXor();
    while (this.matchOp("OR")) {
      expression = binary("or", expression, this.parseXor());
    }
    return expression;
  }

  parseXor() {
    let expression = this.parseAnd();
    while (this.matchOp("XOR")) {
      expression = binary("xor", expression, this.parseAnd());
    }
    return expression;
  }

  parseAnd() {
    let expression = this.parseNot();
    while (this.matchOp("AND")) {
      expression = binary("and", expression, this.parseNot());
    }
    return expression;
  }

  parseNot() {
    if (this.matchOp("NOT")) {
      return { type: "not", operand: this.parseNot() };
    }
    return this.parseAtom();
  }

  parseAtom() {
    const token = this.current();
    if (this.match("CONST")) {
      return { type: "constant", value: token.value === "true" };
    }
    if (this.match("VAR")) {
      return { type: "variable", name: token.value };
    }
    if (this.match("LPAREN")) {
      const expression = this.parseIff();
      if (!this.match("RPAREN")) {
        throw new Error(`Expected ')' before position ${this.current().position}.`);
      }
      return expression;
    }
    throw new Error(`Expected expression at position ${token.position}.`);
  }

  current() {
    return this.tokens[this.index];
  }

  is(kind, value = null) {
    const token = this.current();
    return token.kind === kind && (value === null || token.value === value);
  }

  match(kind, value = null) {
    if (this.is(kind, value)) {
      this.index += 1;
      return true;
    }
    return false;
  }

  matchOp(operator) {
    return this.match("OP", operator);
  }
}

function parse(statement) {
  return new Parser(tokenize(statement)).parse();
}

function binary(operator, left, right) {
  return { type: "binary", operator, left, right };
}

function evaluate(node, assignment) {
  switch (node.type) {
    case "constant":
      return node.value;
    case "variable":
      return Boolean(assignment[node.name]);
    case "not":
      return !evaluate(node.operand, assignment);
    case "binary": {
      const left = evaluate(node.left, assignment);
      const right = evaluate(node.right, assignment);
      if (node.operator === "and") return left && right;
      if (node.operator === "or") return left || right;
      if (node.operator === "xor") return left !== right;
      if (node.operator === "implies") return !left || right;
      if (node.operator === "iff") return left === right;
      throw new Error(`Unknown operator '${node.operator}'.`);
    }
    default:
      throw new Error(`Unknown node type '${node.type}'.`);
  }
}

function variables(node, names = new Set()) {
  if (node.type === "variable") {
    names.add(node.name);
  } else if (node.type === "not") {
    variables(node.operand, names);
  } else if (node.type === "binary") {
    variables(node.left, names);
    variables(node.right, names);
  }
  return [...names].sort();
}

function assignmentsFor(names) {
  const rows = [];
  const total = 2 ** names.length;
  for (let mask = 0; mask < total; mask += 1) {
    const assignment = {};
    names.forEach((name, index) => {
      const bit = names.length - index - 1;
      assignment[name] = Boolean(mask & (1 << bit));
    });
    rows.push(assignment);
  }
  return rows;
}

function truthTable(node) {
  const names = variables(node);
  return assignmentsFor(names).map((assignment) => ({
    assignment,
    result: evaluate(node, assignment),
  }));
}

function classify(node) {
  const rows = truthTable(node);
  const trueRows = rows.filter((row) => row.result).length;
  const falseRows = rows.length - trueRows;
  let name = "contingency";
  if (trueRows === rows.length) name = "tautology";
  if (falseRows === rows.length) name = "contradiction";
  return { name, trueRows, falseRows, totalRows: rows.length };
}

function complexity(node) {
  const childNodes = children(node);
  if (childNodes.length === 0) {
    return {
      nodes: 1,
      height: 1,
      operators: 0,
    };
  }

  const childMetrics = childNodes.map(complexity);
  return {
    nodes: 1 + childMetrics.reduce((sum, metric) => sum + metric.nodes, 0),
    height: 1 + Math.max(...childMetrics.map((metric) => metric.height)),
    operators: 1 + childMetrics.reduce((sum, metric) => sum + metric.operators, 0),
  };
}

function children(node) {
  if (node.type === "not") return [node.operand];
  if (node.type === "binary") return [node.left, node.right];
  return [];
}

function nodeLabel(node) {
  if (node.type === "variable") return node.name;
  if (node.type === "constant") return node.value ? "TRUE" : "FALSE";
  if (node.type === "not") return "NOT";
  return OPERATOR_LABELS[node.operator];
}

function syncVariables(names) {
  for (const name of names) {
    if (!state.values.has(name)) {
      state.values.set(name, true);
    }
  }
  for (const name of [...state.values.keys()]) {
    if (!names.includes(name)) {
      state.values.delete(name);
    }
  }
  state.lastVariables = names;
}

function currentAssignment() {
  return Object.fromEntries(state.values.entries());
}

function renderValues(names) {
  elements.valuesPanel.innerHTML = "";
  if (names.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No variables";
    elements.valuesPanel.append(empty);
    return;
  }

  for (const name of names) {
    const value = state.values.get(name);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "value-toggle";
    button.dataset.value = String(value);
    button.setAttribute("aria-pressed", String(value));
    button.innerHTML = `<span>${escapeHtml(name)}</span><span class="state">${formatTruth(value)}</span>`;
    button.addEventListener("click", () => {
      state.values.set(name, !state.values.get(name));
      update();
    });
    elements.valuesPanel.append(button);
  }
}

function renderResult(node) {
  const result = evaluate(node, currentAssignment());
  elements.resultLabel.textContent = formatTruth(result);
  elements.resultBanner.classList.toggle("false", !result);
}

function renderMetrics(node) {
  const summary = classify(node);
  const metrics = complexity(node);
  elements.classificationBadge.textContent = summary.name;
  elements.variableCount.textContent = String(variables(node).length);
  elements.nodesMetric.textContent = String(metrics.nodes);
  elements.heightMetric.textContent = String(metrics.height);
  elements.operatorsMetric.textContent = String(metrics.operators);
  elements.trueRowsMetric.textContent = `${summary.trueRows}/${summary.totalRows}`;
}

function renderTruthTable(node) {
  const names = variables(node);
  const rows = truthTable(node);
  const headerCells = [...names, "result"]
    .map((name) => `<th scope="col">${escapeHtml(name)}</th>`)
    .join("");
  const bodyRows = rows
    .map((row) => {
      const values = names.map((name) => truthCell(row.assignment[name]));
      return `<tr>${values.join("")}${truthCell(row.result)}</tr>`;
    })
    .join("");
  elements.truthTable.innerHTML = `<thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody>`;
}

function truthCell(value) {
  return `<td class="${value ? "true" : "false"}">${formatTruth(value)}</td>`;
}

function renderTree(root) {
  const svg = elements.treeSvg;
  svg.innerHTML = "";

  const layout = layoutTree(root);
  const width = Math.max(680, layout.leaves * 118 + 80);
  const height = Math.max(330, layout.depth * 92 + 90);
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
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", "tree-node");
    const label = nodeLabel(item.node);
    const fill = NODE_COLORS[item.node.type] ?? NODE_COLORS.binary;
    if (label.length <= 5) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(item.x));
      circle.setAttribute("cy", String(item.y));
      circle.setAttribute("r", "27");
      circle.setAttribute("fill", fill);
      group.append(circle);
    } else {
      const width = Math.max(86, label.length * 9);
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(item.x - width / 2));
      rect.setAttribute("y", String(item.y - 26));
      rect.setAttribute("width", String(width));
      rect.setAttribute("height", "52");
      rect.setAttribute("rx", "8");
      rect.setAttribute("fill", fill);
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
    const childItems = children(node).map((child) => visit(child, depth + 1));
    const x =
      childItems.length === 0
        ? nextLeaf++ * 118 + 60
        : childItems.reduce((sum, child) => sum + child.x, 0) / childItems.length;
    const item = {
      node,
      x,
      y: depth * 92 + 50,
      children: childItems,
    };
    maxDepth = Math.max(maxDepth, depth);
    nodes.push(item);
    return item;
  }

  visit(root, 0);
  return {
    nodes,
    leaves: Math.max(1, nextLeaf),
    depth: maxDepth + 1,
  };
}

function renderComparison(node) {
  const raw = elements.compareInput.value.trim();
  if (!raw) {
    elements.compareResult.textContent = "empty";
    elements.compareResult.className = "compare-result error";
    return;
  }

  try {
    const other = parse(raw);
    const counterexample = findCounterexample(node, other);
    if (counterexample === null) {
      elements.compareResult.textContent = "equivalent";
      elements.compareResult.className = "compare-result";
    } else {
      elements.compareResult.textContent = "not equivalent";
      elements.compareResult.className = "compare-result not-equivalent";
    }
  } catch {
    elements.compareResult.textContent = "invalid";
    elements.compareResult.className = "compare-result error";
  }
}

function findCounterexample(left, right) {
  const names = [...new Set([...variables(left), ...variables(right)])].sort();
  for (const assignment of assignmentsFor(names)) {
    if (evaluate(left, assignment) !== evaluate(right, assignment)) {
      return assignment;
    }
  }
  return null;
}

function update() {
  try {
    const expression = parse(elements.statementInput.value);
    state.expression = expression;
    const names = variables(expression);
    syncVariables(names);

    elements.errorBox.hidden = true;
    renderValues(names);
    renderResult(expression);
    renderMetrics(expression);
    renderTruthTable(expression);
    renderTree(expression);
    renderComparison(expression);
  } catch (error) {
    elements.errorBox.hidden = false;
    elements.errorBox.textContent = error.message;
  }
}

function formatTruth(value) {
  return value ? "true" : "false";
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
elements.flipAllButton.addEventListener("click", () => {
  for (const name of state.lastVariables) {
    state.values.set(name, !state.values.get(name));
  }
  update();
});

for (const button of document.querySelectorAll("[data-sample]")) {
  button.addEventListener("click", () => {
    elements.statementInput.value = button.dataset.sample;
    if (button.dataset.sample === "P or not P") {
      elements.compareInput.value = "true";
    } else if (button.dataset.sample === "P and not P") {
      elements.compareInput.value = "false";
    } else if (button.dataset.sample === "(P and Q) -> R") {
      elements.compareInput.value = "not (P and Q) or R";
    } else {
      elements.compareInput.value = "true";
    }
    update();
  });
}

update();
