const EPSILON = 1e-10;

const LOGIC_SYMBOL_OPERATORS = new Map([
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

const LOGIC_WORD_OPERATORS = new Map([
  ["not", "NOT"],
  ["and", "AND"],
  ["or", "OR"],
  ["xor", "XOR"],
  ["implies", "IMPLIES"],
  ["iff", "IFF"],
]);

const LOGIC_LABELS = {
  and: "AND",
  or: "OR",
  xor: "XOR",
  implies: "IMPLIES",
  iff: "IFF",
};

const MATH_FUNCTIONS = new Set(["sin", "cos", "tan", "exp", "ln", "sqrt"]);

export function analyzeLogic(statement, values = {}, compareStatement = "") {
  const tree = parseLogic(statement);
  const names = logicVariables(tree);
  const assignment = {};

  for (const name of names) {
    assignment[name] = Boolean(values[name] ?? true);
  }

  const result = evaluateLogic(tree, assignment);
  const table = logicTruthTable(tree);
  const classification = classifyLogic(table);
  const metrics = treeMetrics(tree);
  const steps = [
    {
      title: "Parse statement",
      expression: logicToString(tree),
      detail: "The statement becomes a propositional expression tree.",
    },
    {
      title: "Evaluate current assignment",
      expression: formatAssignment(assignment),
      detail: `Recursive tree evaluation returns ${formatTruth(result)}.`,
    },
    {
      title: "Classify truth table",
      expression: `${classification.trueRows}/${classification.totalRows} true rows`,
      detail: `This statement is a ${classification.name}.`,
    },
  ];

  let comparison = null;
  if (compareStatement.trim()) {
    const otherTree = parseLogic(compareStatement);
    const counterexample = findLogicCounterexample(tree, otherTree);
    comparison = {
      equivalent: counterexample === null,
      counterexample,
    };
    steps.push({
      title: "Check equivalence",
      expression: compareStatement,
      detail:
        counterexample === null
          ? "Every truth-table row matches, so the statements are equivalent."
          : `Counterexample found: ${formatAssignment(counterexample)}.`,
    });
  }

  return {
    mode: "logic",
    tree,
    answer: formatTruth(result),
    summary: classification.name,
    details: comparison
      ? comparison.equivalent
        ? "Equivalent comparison"
        : "Not equivalent"
      : "Truth logic evaluation",
    variables: names,
    assignment,
    classification,
    comparison,
    metrics,
    steps,
    table: {
      headers: [...names, "result"],
      rows: table.map((row) => [
        ...names.map((name) => row.assignment[name]),
        row.result,
      ]),
    },
  };
}

export function analyzeSimplification(statement) {
  const parsed = parseMath(statement);
  if (parsed.kind === "equation") {
    throw new Error("Simplification mode expects an expression, not an equation.");
  }

  const steps = [
    {
      title: "Parse expression",
      expression: formatMath(parsed),
      detail: "The input is converted into an arithmetic expression tree.",
    },
  ];

  const simplified = simplifyNode(parsed, steps);
  const polynomial = polynomialFrom(simplified);
  const finalTree = polynomial ? polynomialToNode(polynomial) : simplified;
  const answer = polynomial ? formatPolynomial(polynomial) : formatMath(finalTree);

  if (polynomial) {
    steps.push({
      title: "Collect like terms",
      expression: answer,
      detail: "Polynomial terms with the same variables and powers are combined.",
    });
  }

  return {
    mode: "simplify",
    tree: parsed,
    answer,
    summary: "simplified",
    details: "Symbolic algebra simplification",
    variables: mathVariables(parsed),
    metrics: treeMetrics(parsed),
    steps,
    artifacts: [
      ["Original", formatMath(parsed)],
      ["Simplified", answer],
    ],
  };
}

export function analyzeEquation(statement, variableHint = "x") {
  const parsed = parseMath(statement);
  if (parsed.kind !== "equation") {
    throw new Error("Equation mode expects an equals sign, such as x^2 - 5x + 6 = 0.");
  }

  const steps = [
    {
      title: "Parse equation",
      expression: `${formatMath(parsed.left)} = ${formatMath(parsed.right)}`,
      detail: "The left and right sides are parsed into expression trees.",
    },
  ];

  const normalized = mathBinary("-", parsed.left, parsed.right);
  steps.push({
    title: "Move terms to one side",
    expression: `${formatMath(normalized)} = 0`,
    detail: "Subtract the right side from both sides so the equation equals zero.",
  });

  const simplified = simplifyNode(normalized, steps);
  const polynomial = polynomialFrom(simplified);
  if (!polynomial) {
    return unsupportedEquation(parsed, steps, "Only polynomial equations are supported right now.");
  }

  const variableNames = polynomialVariables(polynomial);
  const variable = chooseVariable(variableNames, variableHint);
  if (variableNames.length > 1) {
    return unsupportedEquation(
      parsed,
      steps,
      "This solver currently handles one-variable polynomial equations.",
    );
  }

  const polynomialText = formatPolynomial(polynomial);
  steps.push({
    title: "Simplify polynomial",
    expression: `${polynomialText} = 0`,
    detail: "Constants and like terms are combined.",
  });

  const solution = solvePolynomial(polynomial, variable);
  steps.push(...solution.steps);

  return {
    mode: "equation",
    tree: parsed,
    answer: solution.answer,
    summary: solution.summary,
    details: `Solving for ${variable}`,
    variables: variable ? [variable] : [],
    metrics: treeMetrics(parsed),
    steps,
    artifacts: [
      ["Normalized", `${polynomialText} = 0`],
      ["Solution", solution.answer],
    ],
  };
}

export function analyzeDerivative(statement, variable = "x") {
  const parsed = parseMath(statement);
  if (parsed.kind === "equation") {
    throw new Error("Derivative mode expects an expression, not an equation.");
  }

  const cleanVariable = variable.trim() || "x";
  const steps = [
    {
      title: "Parse expression",
      expression: formatMath(parsed),
      detail: `The derivative will be taken with respect to ${cleanVariable}.`,
    },
  ];

  const derivative = differentiate(parsed, cleanVariable, steps);
  const simplified = simplifyNode(derivative, steps);
  const polynomial = polynomialFrom(simplified);
  const finalTree = polynomial ? polynomialToNode(polynomial) : simplified;
  const answer = polynomial ? formatPolynomial(polynomial) : formatMath(finalTree);

  steps.push({
    title: "Simplify derivative",
    expression: answer,
    detail: "The raw derivative tree is simplified after applying calculus rules.",
  });

  return {
    mode: "derivative",
    tree: parsed,
    answer,
    summary: "derivative",
    details: `d/d${cleanVariable}`,
    variables: mathVariables(parsed),
    metrics: treeMetrics(parsed),
    steps,
    artifacts: [
      ["Expression", formatMath(parsed)],
      [`d/d${cleanVariable}`, answer],
    ],
  };
}

export function parseLogic(statement) {
  return new LogicParser(tokenizeLogic(statement)).parse();
}

function tokenizeLogic(statement) {
  const tokens = [];
  let index = 0;

  while (index < statement.length) {
    const char = statement[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    const symbol = matchLogicSymbol(statement, index);
    if (symbol) {
      tokens.push({
        kind: "OP",
        value: LOGIC_SYMBOL_OPERATORS.get(symbol),
        position: index,
      });
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
      } else if (LOGIC_WORD_OPERATORS.has(lower)) {
        tokens.push({
          kind: "OP",
          value: LOGIC_WORD_OPERATORS.get(lower),
          position: start,
        });
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

function matchLogicSymbol(statement, index) {
  for (const symbol of LOGIC_SYMBOL_OPERATORS.keys()) {
    if (statement.startsWith(symbol, index)) {
      return symbol;
    }
  }
  return null;
}

class LogicParser {
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
      expression = logicBinary("iff", expression, this.parseImplies());
    }
    return expression;
  }

  parseImplies() {
    const expression = this.parseOr();
    if (this.matchOp("IMPLIES")) {
      return logicBinary("implies", expression, this.parseImplies());
    }
    return expression;
  }

  parseOr() {
    let expression = this.parseXor();
    while (this.matchOp("OR")) {
      expression = logicBinary("or", expression, this.parseXor());
    }
    return expression;
  }

  parseXor() {
    let expression = this.parseAnd();
    while (this.matchOp("XOR")) {
      expression = logicBinary("xor", expression, this.parseAnd());
    }
    return expression;
  }

  parseAnd() {
    let expression = this.parseNot();
    while (this.matchOp("AND")) {
      expression = logicBinary("and", expression, this.parseNot());
    }
    return expression;
  }

  parseNot() {
    if (this.matchOp("NOT")) {
      return { kind: "logicNot", operand: this.parseNot() };
    }
    return this.parseAtom();
  }

  parseAtom() {
    const token = this.current();
    if (this.match("CONST")) {
      return { kind: "logicConstant", value: token.value === "true" };
    }
    if (this.match("VAR")) {
      return { kind: "logicVariable", name: token.value };
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
    if (!this.is(kind, value)) {
      return false;
    }
    this.index += 1;
    return true;
  }

  matchOp(operator) {
    return this.match("OP", operator);
  }
}

function logicBinary(operator, left, right) {
  return { kind: "logicBinary", operator, left, right };
}

export function evaluateLogic(node, assignment) {
  switch (node.kind) {
    case "logicConstant":
      return node.value;
    case "logicVariable":
      return Boolean(assignment[node.name]);
    case "logicNot":
      return !evaluateLogic(node.operand, assignment);
    case "logicBinary": {
      const left = evaluateLogic(node.left, assignment);
      const right = evaluateLogic(node.right, assignment);
      if (node.operator === "and") return left && right;
      if (node.operator === "or") return left || right;
      if (node.operator === "xor") return left !== right;
      if (node.operator === "implies") return !left || right;
      if (node.operator === "iff") return left === right;
      throw new Error(`Unknown logic operator '${node.operator}'.`);
    }
    default:
      throw new Error(`Unknown logic node '${node.kind}'.`);
  }
}

export function logicVariables(node, names = new Set()) {
  if (node.kind === "logicVariable") {
    names.add(node.name);
  }
  for (const child of nodeChildren(node)) {
    logicVariables(child, names);
  }
  return [...names].sort();
}

function logicTruthTable(node) {
  const names = logicVariables(node);
  return booleanAssignments(names).map((assignment) => ({
    assignment,
    result: evaluateLogic(node, assignment),
  }));
}

function classifyLogic(rows) {
  const trueRows = rows.filter((row) => row.result).length;
  const falseRows = rows.length - trueRows;
  let name = "contingency";
  if (trueRows === rows.length) name = "tautology";
  if (falseRows === rows.length) name = "contradiction";
  return { name, trueRows, falseRows, totalRows: rows.length };
}

function booleanAssignments(names) {
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

function findLogicCounterexample(left, right) {
  const names = [...new Set([...logicVariables(left), ...logicVariables(right)])].sort();
  for (const assignment of booleanAssignments(names)) {
    if (evaluateLogic(left, assignment) !== evaluateLogic(right, assignment)) {
      return assignment;
    }
  }
  return null;
}

function logicToString(node, parentPrecedence = 0) {
  if (node.kind === "logicConstant") {
    return formatTruth(node.value);
  }
  if (node.kind === "logicVariable") {
    return node.name;
  }
  if (node.kind === "logicNot") {
    const text = `not ${logicToString(node.operand, 5)}`;
    return parentPrecedence > 4 ? `(${text})` : text;
  }

  const precedence = logicPrecedence(node.operator);
  const left = logicToString(node.left, precedence);
  const right = logicToString(node.right, precedence + 0.1);
  const text = `${left} ${node.operator} ${right}`;
  return precedence < parentPrecedence ? `(${text})` : text;
}

function logicPrecedence(operator) {
  if (operator === "iff") return 1;
  if (operator === "implies") return 2;
  if (operator === "or") return 3;
  if (operator === "xor") return 3.5;
  if (operator === "and") return 4;
  return 5;
}

export function parseMath(statement) {
  return new MathParser(tokenizeMath(statement)).parse();
}

function tokenizeMath(statement) {
  const tokens = [];
  let index = 0;

  while (index < statement.length) {
    const char = statement[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      const token = readNumber(statement, index);
      tokens.push(token);
      index = token.end;
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      index += 1;
      while (index < statement.length && /[A-Za-z0-9_]/.test(statement[index])) {
        index += 1;
      }
      tokens.push({
        kind: "IDENT",
        value: statement.slice(start, index),
        position: start,
      });
      continue;
    }

    if ("+-*/^=()".includes(char)) {
      tokens.push({ kind: char, value: char, position: index });
      index += 1;
      continue;
    }

    throw new Error(`Unexpected character '${char}' at position ${index}.`);
  }

  tokens.push({ kind: "EOF", value: "", position: statement.length });
  return tokens;
}

function readNumber(statement, start) {
  let index = start;
  let dots = 0;
  while (index < statement.length && /[0-9.]/.test(statement[index])) {
    if (statement[index] === ".") {
      dots += 1;
    }
    index += 1;
  }

  const raw = statement.slice(start, index);
  if (dots > 1 || raw === ".") {
    throw new Error(`Invalid number '${raw}' at position ${start}.`);
  }

  return {
    kind: "NUMBER",
    value: Number(raw),
    position: start,
    end: index,
  };
}

class MathParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }

  parse() {
    const left = this.parseExpression();
    if (this.match("=")) {
      const right = this.parseExpression();
      this.expect("EOF");
      return { kind: "equation", left, right };
    }
    this.expect("EOF");
    return left;
  }

  parseExpression() {
    let expression = this.parseTerm();
    while (this.is("+") || this.is("-")) {
      const operator = this.current().value;
      this.index += 1;
      expression = mathBinary(operator, expression, this.parseTerm());
    }
    return expression;
  }

  parseTerm() {
    let expression = this.parsePower();

    while (this.is("*") || this.is("/") || this.canStartImplicitFactor()) {
      if (this.is("*") || this.is("/")) {
        const operator = this.current().value;
        this.index += 1;
        expression = mathBinary(operator, expression, this.parsePower());
      } else {
        expression = mathBinary("*", expression, this.parsePower());
      }
    }

    return expression;
  }

  parsePower() {
    const base = this.parseUnary();
    if (this.match("^")) {
      return mathBinary("^", base, this.parsePower());
    }
    return base;
  }

  parseUnary() {
    if (this.match("+")) {
      return this.parseUnary();
    }
    if (this.match("-")) {
      return { kind: "mathUnary", operator: "-", operand: this.parseUnary() };
    }
    return this.parseAtom();
  }

  parseAtom() {
    const token = this.current();
    if (this.match("NUMBER")) {
      return { kind: "mathNumber", value: token.value };
    }

    if (this.match("IDENT")) {
      const name = token.value;
      if (MATH_FUNCTIONS.has(name.toLowerCase()) && this.match("(")) {
        const argument = this.parseExpression();
        this.expect(")");
        return { kind: "mathFunction", name: name.toLowerCase(), argument };
      }
      return { kind: "mathSymbol", name };
    }

    if (this.match("(")) {
      const expression = this.parseExpression();
      this.expect(")");
      return expression;
    }

    throw new Error(`Expected expression at position ${token.position}.`);
  }

  canStartImplicitFactor() {
    const token = this.current();
    return token.kind === "NUMBER" || token.kind === "IDENT" || token.kind === "(";
  }

  current() {
    return this.tokens[this.index];
  }

  is(kind) {
    return this.current().kind === kind;
  }

  match(kind) {
    if (!this.is(kind)) {
      return false;
    }
    this.index += 1;
    return true;
  }

  expect(kind) {
    if (!this.match(kind)) {
      const token = this.current();
      throw new Error(`Expected '${kind}' before position ${token.position}.`);
    }
  }
}

function mathBinary(operator, left, right) {
  return { kind: "mathBinary", operator, left, right };
}

function mathNumber(value) {
  return { kind: "mathNumber", value };
}

function mathSymbol(name) {
  return { kind: "mathSymbol", name };
}

export function formatMath(node, parentPrecedence = 0) {
  if (node.kind === "equation") {
    return `${formatMath(node.left)} = ${formatMath(node.right)}`;
  }
  if (node.kind === "mathNumber") {
    return formatNumber(node.value);
  }
  if (node.kind === "mathSymbol") {
    return node.name;
  }
  if (node.kind === "mathFunction") {
    return `${node.name}(${formatMath(node.argument)})`;
  }
  if (node.kind === "mathUnary") {
    const text = `-${formatMath(node.operand, 4)}`;
    return parentPrecedence > 4 ? `(${text})` : text;
  }

  const precedence = mathPrecedence(node.operator);
  const left = formatMath(node.left, precedence);
  const right = formatMath(
    node.right,
    node.operator === "^" || node.operator === "-" || node.operator === "/"
      ? precedence + 0.1
      : precedence,
  );
  const symbol = node.operator;
  const text = `${left} ${symbol} ${right}`;
  return precedence < parentPrecedence ? `(${text})` : text;
}

function mathPrecedence(operator) {
  if (operator === "+" || operator === "-") return 1;
  if (operator === "*" || operator === "/") return 2;
  if (operator === "^") return 3;
  return 5;
}

function simplifyNode(node, steps = []) {
  if (node.kind === "mathNumber" || node.kind === "mathSymbol") {
    return node;
  }

  if (node.kind === "mathFunction") {
    const argument = simplifyNode(node.argument, steps);
    if (argument.kind === "mathNumber" && MATH_FUNCTIONS.has(node.name)) {
      const value = evaluateFunction(node.name, argument.value);
      if (Number.isFinite(value)) {
        steps.push({
          title: "Evaluate function",
          expression: `${node.name}(${formatNumber(argument.value)}) = ${formatNumber(value)}`,
          detail: "Numeric function calls are folded into constants.",
        });
        return mathNumber(value);
      }
    }
    return { ...node, argument };
  }

  if (node.kind === "mathUnary") {
    const operand = simplifyNode(node.operand, steps);
    if (operand.kind === "mathNumber") {
      steps.push({
        title: "Fold negation",
        expression: `-${formatNumber(operand.value)} = ${formatNumber(-operand.value)}`,
        detail: "A negated constant is replaced by one number.",
      });
      return mathNumber(-operand.value);
    }
    if (operand.kind === "mathUnary") {
      steps.push({
        title: "Remove double negative",
        expression: formatMath(operand.operand),
        detail: "Two negatives cancel each other.",
      });
      return operand.operand;
    }
    return { kind: "mathUnary", operator: "-", operand };
  }

  const left = simplifyNode(node.left, steps);
  const right = simplifyNode(node.right, steps);

  if (left.kind === "mathNumber" && right.kind === "mathNumber") {
    const value = evaluateBinary(node.operator, left.value, right.value);
    if (Number.isFinite(value)) {
      steps.push({
        title: "Fold constants",
        expression: `${formatMath(left)} ${node.operator} ${formatMath(right)} = ${formatNumber(value)}`,
        detail: "A subtree with only numbers can be evaluated immediately.",
      });
      return mathNumber(value);
    }
  }

  if (node.operator === "+") {
    if (isZero(left)) return right;
    if (isZero(right)) return left;
  }

  if (node.operator === "-") {
    if (isZero(right)) return left;
    if (isZero(left)) return { kind: "mathUnary", operator: "-", operand: right };
  }

  if (node.operator === "*") {
    if (isZero(left) || isZero(right)) return mathNumber(0);
    if (isOne(left)) return right;
    if (isOne(right)) return left;
  }

  if (node.operator === "/") {
    if (isZero(left)) return mathNumber(0);
    if (isOne(right)) return left;
  }

  if (node.operator === "^") {
    if (isZero(right)) return mathNumber(1);
    if (isOne(right)) return left;
    if (isOne(left)) return mathNumber(1);
  }

  return { kind: "mathBinary", operator: node.operator, left, right };
}

function evaluateBinary(operator, left, right) {
  if (operator === "+") return left + right;
  if (operator === "-") return left - right;
  if (operator === "*") return left * right;
  if (operator === "/") return right === 0 ? Number.NaN : left / right;
  if (operator === "^") return left ** right;
  return Number.NaN;
}

function evaluateFunction(name, value) {
  if (name === "sin") return Math.sin(value);
  if (name === "cos") return Math.cos(value);
  if (name === "tan") return Math.tan(value);
  if (name === "exp") return Math.exp(value);
  if (name === "ln") return Math.log(value);
  if (name === "sqrt") return Math.sqrt(value);
  return Number.NaN;
}

function isZero(node) {
  return node.kind === "mathNumber" && nearlyEqual(node.value, 0);
}

function isOne(node) {
  return node.kind === "mathNumber" && nearlyEqual(node.value, 1);
}

function polynomialFrom(node) {
  if (node.kind === "mathNumber") {
    return cleanPolynomial(new Map([["", node.value]]));
  }
  if (node.kind === "mathSymbol") {
    return new Map([[monomialKey({ [node.name]: 1 }), 1]]);
  }
  if (node.kind === "mathUnary") {
    const operand = polynomialFrom(node.operand);
    return operand ? scalePolynomial(operand, -1) : null;
  }
  if (node.kind !== "mathBinary") {
    return null;
  }

  const left = polynomialFrom(node.left);
  const right = polynomialFrom(node.right);

  if (node.operator === "+") return left && right ? addPolynomials(left, right) : null;
  if (node.operator === "-") return left && right ? addPolynomials(left, scalePolynomial(right, -1)) : null;
  if (node.operator === "*") return left && right ? multiplyPolynomials(left, right) : null;
  if (node.operator === "/") {
    if (!left || !right || right.size !== 1 || !right.has("")) return null;
    const denominator = right.get("");
    if (nearlyEqual(denominator, 0)) return null;
    return scalePolynomial(left, 1 / denominator);
  }
  if (node.operator === "^") {
    if (!left || node.right.kind !== "mathNumber") return null;
    const power = node.right.value;
    if (!Number.isInteger(power) || power < 0 || power > 8) return null;
    return powerPolynomial(left, power);
  }

  return null;
}

function addPolynomials(left, right) {
  const result = new Map(left);
  for (const [key, coefficient] of right.entries()) {
    result.set(key, (result.get(key) ?? 0) + coefficient);
  }
  return cleanPolynomial(result);
}

function scalePolynomial(poly, scalar) {
  return cleanPolynomial(new Map([...poly.entries()].map(([key, value]) => [key, value * scalar])));
}

function multiplyPolynomials(left, right) {
  const result = new Map();
  for (const [leftKey, leftCoeff] of left.entries()) {
    for (const [rightKey, rightCoeff] of right.entries()) {
      const key = multiplyMonomialKeys(leftKey, rightKey);
      result.set(key, (result.get(key) ?? 0) + leftCoeff * rightCoeff);
    }
  }
  return cleanPolynomial(result);
}

function powerPolynomial(poly, power) {
  let result = new Map([["", 1]]);
  for (let index = 0; index < power; index += 1) {
    result = multiplyPolynomials(result, poly);
  }
  return cleanPolynomial(result);
}

function cleanPolynomial(poly) {
  const result = new Map();
  for (const [key, coefficient] of poly.entries()) {
    if (!nearlyEqual(coefficient, 0)) {
      result.set(key, normalizeNumber(coefficient));
    }
  }
  if (result.size === 0) {
    result.set("", 0);
  }
  return result;
}

function monomialKey(powers) {
  return Object.entries(powers)
    .filter(([, power]) => power > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, power]) => `${name}:${power}`)
    .join("|");
}

function powersFromKey(key) {
  if (!key) return {};
  return Object.fromEntries(
    key.split("|").map((part) => {
      const [name, power] = part.split(":");
      return [name, Number(power)];
    }),
  );
}

function multiplyMonomialKeys(leftKey, rightKey) {
  const powers = powersFromKey(leftKey);
  for (const [name, power] of Object.entries(powersFromKey(rightKey))) {
    powers[name] = (powers[name] ?? 0) + power;
  }
  return monomialKey(powers);
}

function polynomialToNode(poly) {
  const terms = sortedPolynomialTerms(poly).map(([key, coefficient]) =>
    termToNode(key, coefficient),
  );
  return terms.reduce((expression, term) =>
    expression ? mathBinary("+", expression, term) : term,
  );
}

function termToNode(key, coefficient) {
  if (!key) {
    return mathNumber(coefficient);
  }

  let expression = null;
  for (const [name, power] of Object.entries(powersFromKey(key))) {
    const factor = power === 1 ? mathSymbol(name) : mathBinary("^", mathSymbol(name), mathNumber(power));
    expression = expression ? mathBinary("*", expression, factor) : factor;
  }

  if (nearlyEqual(coefficient, 1)) return expression;
  if (nearlyEqual(coefficient, -1)) return { kind: "mathUnary", operator: "-", operand: expression };
  return mathBinary("*", mathNumber(coefficient), expression);
}

function sortedPolynomialTerms(poly) {
  return [...poly.entries()]
    .filter(([, coefficient]) => !nearlyEqual(coefficient, 0))
    .sort(([leftKey], [rightKey]) => {
      const degreeDelta = monomialDegree(rightKey) - monomialDegree(leftKey);
      return degreeDelta || leftKey.localeCompare(rightKey);
    });
}

function monomialDegree(key) {
  return Object.values(powersFromKey(key)).reduce((sum, power) => sum + power, 0);
}

function formatPolynomial(poly) {
  const terms = sortedPolynomialTerms(poly);
  if (terms.length === 0) {
    return "0";
  }

  return terms
    .map(([key, coefficient], index) => {
      const sign = coefficient < 0 ? "-" : "+";
      const body = formatPolynomialTerm(key, Math.abs(coefficient));
      if (index === 0) {
        return coefficient < 0 ? `-${body}` : body;
      }
      return ` ${sign} ${body}`;
    })
    .join("");
}

function formatPolynomialTerm(key, coefficient) {
  const monomial = formatMonomial(key);
  if (!monomial) {
    return formatNumber(coefficient);
  }
  if (nearlyEqual(coefficient, 1)) {
    return monomial;
  }
  return `${formatNumber(coefficient)}${monomial}`;
}

function formatMonomial(key) {
  const powers = powersFromKey(key);
  return Object.entries(powers)
    .map(([name, power]) => (power === 1 ? name : `${name}^${power}`))
    .join("*");
}

function polynomialVariables(poly) {
  const names = new Set();
  for (const key of poly.keys()) {
    for (const name of Object.keys(powersFromKey(key))) {
      names.add(name);
    }
  }
  return [...names].sort();
}

function chooseVariable(variableNames, hint) {
  if (variableNames.includes(hint)) {
    return hint;
  }
  return variableNames[0] ?? hint;
}

function solvePolynomial(poly, variable) {
  const coefficients = polynomialCoefficients(poly, variable);
  const degree = polynomialDegree(coefficients);

  if (degree === 0) {
    const constant = coefficients[0] ?? 0;
    return {
      answer: nearlyEqual(constant, 0) ? "all real numbers" : "no solution",
      summary: nearlyEqual(constant, 0) ? "identity" : "inconsistent",
      steps: [
        {
          title: "Check constant equation",
          expression: `${formatNumber(constant)} = 0`,
          detail: nearlyEqual(constant, 0)
            ? "The equation is always true."
            : "A nonzero constant cannot equal zero.",
        },
      ],
    };
  }

  if (degree === 1) {
    const b = coefficients[0] ?? 0;
    const a = coefficients[1] ?? 0;
    const root = -b / a;
    return {
      answer: `${variable} = ${formatNumber(root)}`,
      summary: "linear solution",
      steps: [
        {
          title: "Apply linear formula",
          expression: `${formatNumber(a)}${variable} + ${formatNumber(b)} = 0`,
          detail: `${variable} = -b / a = ${formatNumber(root)}.`,
        },
      ],
    };
  }

  if (degree === 2) {
    const c = coefficients[0] ?? 0;
    const b = coefficients[1] ?? 0;
    const a = coefficients[2] ?? 0;
    const discriminant = b * b - 4 * a * c;
    const roots = quadraticRoots(a, b, c, discriminant);
    return {
      answer: roots.map((root) => `${variable} = ${root}`).join(", "),
      summary: "quadratic solution",
      steps: [
        {
          title: "Compute discriminant",
          expression: `b^2 - 4ac = ${formatNumber(discriminant)}`,
          detail: "The discriminant determines the quadratic roots.",
        },
        {
          title: "Apply quadratic formula",
          expression: `${variable} = (-b +/- sqrt(b^2 - 4ac)) / 2a`,
          detail: `Solutions: ${roots.join(", ")}.`,
        },
      ],
    };
  }

  return {
    answer: `degree ${degree} polynomial`,
    summary: "unsupported degree",
    steps: [
      {
        title: "Detect polynomial degree",
        expression: `degree ${degree}`,
        detail: "The browser demo currently solves constant, linear, and quadratic equations.",
      },
    ],
  };
}

function polynomialCoefficients(poly, variable) {
  const coefficients = [];
  for (const [key, coefficient] of poly.entries()) {
    const powers = powersFromKey(key);
    const degree = powers[variable] ?? 0;
    const otherVariables = Object.keys(powers).filter((name) => name !== variable);
    if (otherVariables.length > 0) {
      return [];
    }
    coefficients[degree] = (coefficients[degree] ?? 0) + coefficient;
  }
  return coefficients.map((value) => normalizeNumber(value ?? 0));
}

function polynomialDegree(coefficients) {
  for (let index = coefficients.length - 1; index >= 0; index -= 1) {
    if (!nearlyEqual(coefficients[index] ?? 0, 0)) {
      return index;
    }
  }
  return 0;
}

function quadraticRoots(a, b, c, discriminant) {
  const denominator = 2 * a;
  if (nearlyEqual(discriminant, 0)) {
    return [formatNumber(-b / denominator)];
  }
  if (discriminant > 0) {
    const root = Math.sqrt(discriminant);
    return [
      formatNumber((-b + root) / denominator),
      formatNumber((-b - root) / denominator),
    ];
  }

  const real = -b / denominator;
  const imaginary = Math.sqrt(-discriminant) / Math.abs(denominator);
  if (nearlyEqual(real, 0)) {
    return [`${formatNumber(imaginary)}i`, `-${formatNumber(imaginary)}i`];
  }
  return [
    `${formatNumber(real)} + ${formatNumber(imaginary)}i`,
    `${formatNumber(real)} - ${formatNumber(imaginary)}i`,
  ];
}

function unsupportedEquation(parsed, steps, detail) {
  steps.push({
    title: "Stop at supported scope",
    expression: formatMath(parsed),
    detail,
  });
  return {
    mode: "equation",
    tree: parsed,
    answer: "unsupported equation",
    summary: "unsupported",
    details: detail,
    variables: mathVariables(parsed),
    metrics: treeMetrics(parsed),
    steps,
    artifacts: [["Reason", detail]],
  };
}

function differentiate(node, variable, steps) {
  if (node.kind === "mathNumber") {
    return mathNumber(0);
  }

  if (node.kind === "mathSymbol") {
    const value = node.name === variable ? 1 : 0;
    steps.push({
      title: node.name === variable ? "Variable rule" : "Constant variable rule",
      expression: `d/d${variable} ${node.name} = ${value}`,
      detail: node.name === variable
        ? "The derivative of the active variable is one."
        : "Other variables are treated as constants.",
    });
    return mathNumber(value);
  }

  if (node.kind === "mathUnary") {
    return { kind: "mathUnary", operator: "-", operand: differentiate(node.operand, variable, steps) };
  }

  if (node.kind === "mathFunction") {
    const innerDerivative = differentiate(node.argument, variable, steps);
    const rule = functionDerivative(node, innerDerivative);
    steps.push({
      title: "Function rule",
      expression: `d/d${variable} ${formatMath(node)} = ${formatMath(rule)}`,
      detail: `Apply the derivative rule for ${node.name} and the chain rule.`,
    });
    return rule;
  }

  const leftDerivative = differentiate(node.left, variable, steps);
  const rightDerivative = differentiate(node.right, variable, steps);

  if (node.operator === "+") {
    steps.push({
      title: "Sum rule",
      expression: `d/d${variable} (${formatMath(node)})`,
      detail: "Differentiate each term and add the results.",
    });
    return mathBinary("+", leftDerivative, rightDerivative);
  }

  if (node.operator === "-") {
    steps.push({
      title: "Difference rule",
      expression: `d/d${variable} (${formatMath(node)})`,
      detail: "Differentiate each term and subtract the results.",
    });
    return mathBinary("-", leftDerivative, rightDerivative);
  }

  if (node.operator === "*") {
    steps.push({
      title: "Product rule",
      expression: `d/d${variable} (${formatMath(node)})`,
      detail: "Use f'g + fg' for multiplied expressions.",
    });
    return mathBinary(
      "+",
      mathBinary("*", leftDerivative, node.right),
      mathBinary("*", node.left, rightDerivative),
    );
  }

  if (node.operator === "/") {
    steps.push({
      title: "Quotient rule",
      expression: `d/d${variable} (${formatMath(node)})`,
      detail: "Use (f'g - fg') / g^2 for divided expressions.",
    });
    return mathBinary(
      "/",
      mathBinary(
        "-",
        mathBinary("*", leftDerivative, node.right),
        mathBinary("*", node.left, rightDerivative),
      ),
      mathBinary("^", node.right, mathNumber(2)),
    );
  }

  if (node.operator === "^") {
    if (node.right.kind === "mathNumber") {
      const exponent = node.right.value;
      steps.push({
        title: "Power rule",
        expression: `d/d${variable} (${formatMath(node)})`,
        detail: "Use n*f^(n-1)*f' for a constant exponent.",
      });
      return mathBinary(
        "*",
        mathBinary(
          "*",
          mathNumber(exponent),
          mathBinary("^", node.left, mathNumber(exponent - 1)),
        ),
        leftDerivative,
      );
    }

    steps.push({
      title: "General power rule",
      expression: `d/d${variable} (${formatMath(node)})`,
      detail: "Use f^g * (g'ln(f) + g*f'/f).",
    });
    return mathBinary(
      "*",
      node,
      mathBinary(
        "+",
        mathBinary("*", rightDerivative, { kind: "mathFunction", name: "ln", argument: node.left }),
        mathBinary("*", node.right, mathBinary("/", leftDerivative, node.left)),
      ),
    );
  }

  throw new Error(`Cannot differentiate operator '${node.operator}'.`);
}

function functionDerivative(node, innerDerivative) {
  const arg = node.argument;
  if (node.name === "sin") {
    return mathBinary("*", { kind: "mathFunction", name: "cos", argument: arg }, innerDerivative);
  }
  if (node.name === "cos") {
    return mathBinary(
      "*",
      { kind: "mathUnary", operator: "-", operand: { kind: "mathFunction", name: "sin", argument: arg } },
      innerDerivative,
    );
  }
  if (node.name === "tan") {
    return mathBinary(
      "*",
      mathBinary("^", { kind: "mathFunction", name: "cos", argument: arg }, mathNumber(-2)),
      innerDerivative,
    );
  }
  if (node.name === "exp") {
    return mathBinary("*", { kind: "mathFunction", name: "exp", argument: arg }, innerDerivative);
  }
  if (node.name === "ln") {
    return mathBinary("/", innerDerivative, arg);
  }
  if (node.name === "sqrt") {
    return mathBinary(
      "/",
      innerDerivative,
      mathBinary("*", mathNumber(2), { kind: "mathFunction", name: "sqrt", argument: arg }),
    );
  }
  throw new Error(`Unsupported function '${node.name}'.`);
}

export function mathVariables(node, names = new Set()) {
  if (node.kind === "mathSymbol") {
    names.add(node.name);
  }
  for (const child of nodeChildren(node)) {
    mathVariables(child, names);
  }
  return [...names].sort();
}

export function treeMetrics(node) {
  const children = nodeChildren(node);
  if (children.length === 0) {
    return {
      nodes: 1,
      height: 1,
      operators: 0,
    };
  }

  const childMetrics = children.map(treeMetrics);
  return {
    nodes: 1 + childMetrics.reduce((sum, metric) => sum + metric.nodes, 0),
    height: 1 + Math.max(...childMetrics.map((metric) => metric.height)),
    operators: Number(isOperatorNode(node)) + childMetrics.reduce((sum, metric) => sum + metric.operators, 0),
  };
}

function isOperatorNode(node) {
  return [
    "logicNot",
    "logicBinary",
    "mathUnary",
    "mathBinary",
    "mathFunction",
    "equation",
  ].includes(node.kind);
}

export function nodeChildren(node) {
  if (node.kind === "logicNot") return [node.operand];
  if (node.kind === "logicBinary") return [node.left, node.right];
  if (node.kind === "mathUnary") return [node.operand];
  if (node.kind === "mathBinary") return [node.left, node.right];
  if (node.kind === "mathFunction") return [node.argument];
  if (node.kind === "equation") return [node.left, node.right];
  return [];
}

export function nodeLabel(node) {
  if (node.kind === "logicConstant") return node.value ? "TRUE" : "FALSE";
  if (node.kind === "logicVariable") return node.name;
  if (node.kind === "logicNot") return "NOT";
  if (node.kind === "logicBinary") return LOGIC_LABELS[node.operator] ?? node.operator.toUpperCase();
  if (node.kind === "mathNumber") return formatNumber(node.value);
  if (node.kind === "mathSymbol") return node.name;
  if (node.kind === "mathUnary") return "NEG";
  if (node.kind === "mathBinary") return node.operator;
  if (node.kind === "mathFunction") return node.name.toUpperCase();
  if (node.kind === "equation") return "=";
  return "?";
}

export function nodeTone(node) {
  if (node.kind.startsWith("logic")) return "logic";
  if (node.kind === "mathNumber") return "number";
  if (node.kind === "mathSymbol") return "symbol";
  if (node.kind === "mathFunction") return "function";
  if (node.kind === "equation") return "equation";
  return "operator";
}

function formatAssignment(assignment) {
  const entries = Object.entries(assignment).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) {
    return "no variables";
  }
  return entries.map(([name, value]) => `${name}=${formatTruth(value)}`).join(", ");
}

export function formatTruth(value) {
  return value ? "true" : "false";
}

function formatNumber(value) {
  const normalized = normalizeNumber(value);
  if (Object.is(normalized, -0)) {
    return "0";
  }
  if (Number.isInteger(normalized)) {
    return String(normalized);
  }
  return String(Number(normalized.toFixed(6))).replace(/\.0+$/, "");
}

function normalizeNumber(value) {
  return nearlyEqual(value, 0) ? 0 : Number(value.toFixed(10));
}

function nearlyEqual(left, right) {
  return Math.abs(left - right) < EPSILON;
}
