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

export function analyzeFactoring(statement, variableHint = "x") {
  const parsed = parseMath(cleanFactorQuestion(statement));
  const expression = parsed.kind === "equation" ? mathBinary("-", parsed.left, parsed.right) : parsed;
  const steps = [
    {
      title: "Parse expression",
      expression: parsed.kind === "equation"
        ? `${formatMath(parsed.left)} - (${formatMath(parsed.right)})`
        : formatMath(parsed),
      detail: "The input is converted into a polynomial expression tree.",
    },
  ];

  const simplified = simplifyNode(expression, steps);
  const polynomial = polynomialFrom(simplified);
  if (!polynomial) {
    throw new Error("Factoring mode currently supports one-variable polynomials.");
  }

  const variableNames = polynomialVariables(polynomial);
  const variable = chooseVariable(variableNames, variableHint);
  if (variableNames.length > 1) {
    throw new Error("Factoring mode currently supports one-variable polynomials.");
  }

  const polynomialText = formatPolynomial(polynomial);
  steps.push({
    title: "Collect polynomial terms",
    expression: polynomialText,
    detail: "Constants and like terms are combined before factoring.",
  });

  const factorization = factorPolynomialOverRationals(polynomial, variable);
  steps.push(...factorization.steps);

  return {
    mode: "factor",
    tree: parsed,
    answer: factorization.answer,
    summary: factorization.summary,
    details: `Factoring over rational roots${variable ? ` in ${variable}` : ""}`,
    variables: variableNames,
    metrics: treeMetrics(parsed),
    steps,
    artifacts: [
      ["Polynomial", polynomialText],
      ["Factored form", factorization.answer],
      ["Rational roots", factorization.roots.length ? factorization.roots.map((root) => formatNumber(root.value)).join(", ") : "none"],
      ["Remaining factor", factorization.remaining],
    ],
  };
}

export function analyzeInequality(statement, variableHint = "x") {
  const request = extractInequalityQuestion(statement);
  const left = parseMath(request.left);
  const right = parseMath(request.right);
  if (left.kind === "equation" || right.kind === "equation") {
    throw new Error("Inequality mode expects one comparison, such as x^2 - 5x + 6 > 0.");
  }

  const tree = {
    kind: "mathInequality",
    operator: request.operator,
    children: [left, right],
  };
  const steps = [
    {
      title: "Parse inequality",
      expression: `${formatMath(left)} ${request.operator} ${formatMath(right)}`,
      detail: "The left and right sides are parsed into expression trees.",
    },
  ];

  const normalized = mathBinary("-", left, right);
  steps.push({
    title: "Move terms to one side",
    expression: `${formatMath(normalized)} ${request.operator} 0`,
    detail: "Subtract the right side so the inequality can be solved with a sign chart.",
  });

  const simplified = simplifyNode(normalized, steps);
  const polynomial = polynomialFrom(simplified);
  if (!polynomial) {
    throw new Error("Inequality mode currently supports one-variable polynomial inequalities.");
  }

  const variableNames = polynomialVariables(polynomial);
  const variable = chooseVariable(variableNames, variableHint);
  if (variableNames.length > 1) {
    throw new Error("Inequality mode currently supports one-variable polynomial inequalities.");
  }

  const polynomialText = formatPolynomial(polynomial);
  steps.push({
    title: "Simplify polynomial",
    expression: `${polynomialText} ${request.operator} 0`,
    detail: "Constants and like terms are combined.",
  });

  const coefficients = trimPolynomialCoefficients(polynomialCoefficients(polynomial, variable));
  const solution = solvePolynomialInequality(coefficients, request.operator, variable);
  steps.push(...solution.steps);

  return {
    mode: "inequality",
    tree,
    answer: solution.answer,
    summary: "polynomial inequality",
    details: `Solving for ${variable}`,
    variables: variable ? [variable] : [],
    metrics: treeMetrics(tree),
    steps,
    table: solution.table,
    artifacts: [
      ["Normalized", `${polynomialText} ${request.operator} 0`],
      ["Critical points", solution.roots.length ? solution.roots.map(formatNumber).join(", ") : "none"],
      ["Solution", solution.answer],
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

export function analyzeTaylor(statement, variableHint = "x") {
  const request = extractTaylorQuestion(statement, variableHint);
  const expression = parseMath(request.expression);
  if (expression.kind === "equation") {
    throw new Error("Taylor mode expects a function expression, not an equation.");
  }

  const steps = [
    {
      title: "Parse expansion request",
      expression: `${formatMath(expression)} around ${request.variable} = ${formatNumber(request.center)}`,
      detail: `The solver will build terms through degree ${request.order}.`,
    },
  ];
  const terms = [];
  let derivative = expression;
  for (let order = 0; order <= request.order; order += 1) {
    const derivativeSteps = [];
    const simplifiedDerivative = simplifyNode(derivative, derivativeSteps);
    const value = safeEvaluateMath(simplifiedDerivative, { [request.variable]: request.center });
    if (!Number.isFinite(value)) {
      throw new Error(`Taylor expansion needs a finite derivative value at order ${order}.`);
    }
    const coefficient = value / factorial(order);
    terms.push({ order, derivative: simplifiedDerivative, value, coefficient });
    if (order < request.order) {
      derivative = differentiate(simplifiedDerivative, request.variable, []);
    }
  }

  const polynomial = formatTaylorPolynomial(terms, request.variable, request.center);
  steps.push(
    {
      title: "Evaluate derivatives",
      expression: terms.map((term) => `f^(${term.order})(${formatNumber(request.center)})=${formatNumber(term.value)}`).join(", "),
      detail: "Each Taylor coefficient uses a derivative value divided by factorial.",
    },
    {
      title: "Assemble polynomial",
      expression: polynomial,
      detail: "The polynomial is the sum of coefficient times powers of the shifted variable.",
    },
  );

  return {
    mode: "taylor",
    tree: expression,
    answer: polynomial,
    summary: request.center === 0 ? "Maclaurin polynomial" : "Taylor polynomial",
    details: `degree ${request.order} around ${request.variable} = ${formatNumber(request.center)}`,
    variables: mathVariables(expression),
    metrics: treeMetrics(expression),
    steps,
    table: {
      headers: ["Order", "Derivative at center", "Coefficient"],
      rows: terms.map((term) => [
        formatNumber(term.order),
        formatNumber(term.value),
        formatNumber(term.coefficient),
      ]),
    },
    artifacts: [
      ["Function", formatMath(expression)],
      ["Variable", request.variable],
      ["Center", formatNumber(request.center)],
      ["Degree", formatNumber(request.order)],
      ["Polynomial", polynomial],
    ],
  };
}

export function analyzeComplex(statement) {
  const expressionText = cleanComplexQuestion(statement);
  const parsed = parseMath(expressionText);
  if (parsed.kind === "equation") {
    throw new Error("Complex mode evaluates expressions. Use Equation mode for equations with complex roots.");
  }

  const steps = [
    {
      title: "Parse complex expression",
      expression: formatMath(parsed),
      detail: "The expression is parsed into the same math tree used by the algebra solvers.",
    },
    {
      title: "Set imaginary unit",
      expression: "i^2 = -1",
      detail: "Every number is evaluated as a complex pair a + bi, with i as the imaginary unit.",
    },
  ];
  const value = evaluateComplex(parsed);
  const magnitude = complexAbs(value);
  const argument = Math.atan2(value.im, value.re);
  steps.push({
    title: "Evaluate recursively",
    expression: formatComplex(value),
    detail: "Each tree node combines the complex values returned by its child nodes.",
  });

  return {
    mode: "complex",
    tree: parsed,
    answer: formatComplex(value),
    summary: "complex arithmetic",
    details: "Complex-number evaluation through the expression tree",
    variables: [],
    metrics: treeMetrics(parsed),
    steps,
    artifacts: [
      ["Expression", formatMath(parsed)],
      ["Real part", formatNumber(value.re)],
      ["Imaginary part", formatNumber(value.im)],
      ["Magnitude", formatNumber(magnitude)],
      ["Argument", formatNumber(argument)],
    ],
  };
}

export function analyzeCombinatorics(statement) {
  const request = parseCombinatoricsInput(statement);
  const nText = String(request.n);
  let result;
  let answer;
  let summary;
  let detail;
  let formula;

  if (request.operation === "factorial") {
    result = factorialBigInt(request.n);
    answer = `${nText}! = ${result.toString()}`;
    summary = "factorial count";
    detail = "Ordered arrangements of all items";
    formula = "n!";
  } else if (request.operation === "permutation") {
    result = permutationBigInt(request.n, request.k);
    answer = `P(${nText}, ${request.k}) = ${result.toString()}`;
    summary = "permutation count";
    detail = "Ordered arrangements without replacement";
    formula = "n! / (n-k)!";
  } else {
    result = combinationBigInt(request.n, request.k);
    answer = `C(${nText}, ${request.k}) = ${result.toString()}`;
    summary = "combination count";
    detail = "Unordered selections without replacement";
    formula = "n! / (k!(n-k)!)";
  }

  const tree = {
    kind: "statsDistribution",
    label: request.operation === "factorial" ? "FACTORIAL" : request.operation === "permutation" ? "PERMUTE" : "CHOOSE",
    children: [
      statsMetricNode("n", request.n),
      ...(request.operation === "factorial" ? [] : [statsMetricNode("k", request.k)]),
    ],
  };

  return {
    mode: "combinatorics",
    tree,
    answer,
    summary,
    details: detail,
    variables: [],
    metrics: treeMetrics(tree),
    steps: [
      {
        title: "Read counting problem",
        expression: request.operation === "factorial" ? `n = ${nText}` : `n = ${nText}, k = ${request.k}`,
        detail: "The solver identifies whether order matters.",
      },
      {
        title: "Select counting formula",
        expression: formula,
        detail,
      },
      {
        title: "Evaluate count exactly",
        expression: answer,
        detail: "The count is computed with exact integer arithmetic.",
      },
    ],
    artifacts: [
      ["Operation", request.operation],
      ["n", nText],
      ...(request.operation === "factorial" ? [] : [["k", String(request.k)]]),
      ["Formula", formula],
      ["Count", result.toString()],
    ],
  };
}

export function analyzeStatistics(statement) {
  const lower = statement.toLowerCase();

  if (lower.includes("kruskal") || lower.includes("wallis")) {
    return analyzeKruskalWallis(statement);
  }

  if (
    lower.includes("mann-whitney") ||
    lower.includes("mann whitney") ||
    lower.includes("rank-sum") ||
    lower.includes("rank sum")
  ) {
    return analyzeMannWhitney(statement);
  }

  if (lower.includes("wilcoxon") || lower.includes("signed-rank") || lower.includes("signed rank")) {
    return analyzeWilcoxonSignedRank(statement);
  }

  if (lower.includes("anova") || lower.includes("analysis of variance")) {
    return analyzeAnova(statement);
  }

  if (lower.includes("paired") || lower.includes("matched pairs")) {
    return analyzePairedTTest(statement);
  }

  if (lower.includes("chi-square") || lower.includes("chi square") || lower.includes("chisquare")) {
    return analyzeChiSquare(statement);
  }

  if (lower.includes("hypergeometric")) {
    return analyzeHypergeometric(statement);
  }

  if (lower.includes("proportion")) {
    if (lower.includes("two-proportion") || lower.includes("two proportion") || lower.includes("two-sample") || lower.includes("two sample")) {
      return analyzeTwoProportionZTest(statement);
    }
    if (lower.includes("confidence") || /\bci\b/i.test(statement)) {
      return analyzeProportionConfidenceInterval(statement);
    }
    if (lower.includes("test") || lower.includes("z-test") || lower.includes("z test") || lower.includes("hypothesis")) {
      return analyzeOneProportionZTest(statement);
    }
  }

  if (
    lower.includes("two-sample") ||
    lower.includes("two sample") ||
    lower.includes("welch") ||
    lower.includes("independent samples")
  ) {
    return analyzeTwoSampleTTest(statement);
  }

  if (lower.includes("hypothesis") || lower.includes("t-test") || lower.includes("t test") || lower.includes("test mean")) {
    return analyzeHypothesisTest(statement);
  }

  if (lower.includes("confidence") || /\bci\b/i.test(statement)) {
    return analyzeConfidenceInterval(statement);
  }

  if (lower.includes("z-score") || lower.includes("zscore")) {
    return analyzeZScore(statement);
  }

  if (lower.includes("normal")) {
    if (
      lower.includes("inverse") ||
      lower.includes("quantile") ||
      lower.includes("percentile") ||
      lower.includes("critical")
    ) {
      return analyzeInverseNormal(statement);
    }
    return analyzeNormalDistribution(statement);
  }

  if (lower.includes("binomial")) {
    return analyzeBinomial(statement);
  }

  if (lower.includes("geometric")) {
    return analyzeGeometric(statement);
  }

  if (lower.includes("poisson")) {
    return analyzePoisson(statement);
  }

  if (lower.includes("exponential")) {
    return analyzeExponential(statement);
  }

  if (lower.includes("uniform")) {
    return analyzeUniform(statement);
  }

  if (lower.includes("expected value") || lower.includes("expectation") || lower.includes("expected distribution")) {
    return analyzeDiscreteDistribution(statement);
  }

  if (
    lower.includes("bayes") ||
    lower.includes("posterior") ||
    lower.includes("sensitivity") ||
    lower.includes("specificity")
  ) {
    return analyzeBayes(statement);
  }

  if (
    lower.includes("regression") ||
    lower.includes("correlation") ||
    parsePairs(statement).length >= 2 ||
    parseXYLists(statement)
  ) {
    return analyzeRegression(statement);
  }

  return analyzeDescriptiveStatistics(statement);
}

export function analyzeUniversal(question, values = {}) {
  const lower = question.toLowerCase();
  let routed;
  let routedLabel;

  if (isMatrixQuestion(lower)) {
    routed = analyzeMatrix(question);
    routedLabel = "Matrix";
  } else if (isGraphQuestion(lower)) {
    routed = analyzeGraph(question);
    routedLabel = "Graph";
  } else if (isLimitQuestion(lower)) {
    routed = analyzeLimit(question);
    routedLabel = "Limit";
  } else if (isIntegralQuestion(lower)) {
    routed = analyzeIntegral(question);
    routedLabel = "Integral";
  } else if (isOptimizationQuestion(lower)) {
    routed = analyzeOptimization(question);
    routedLabel = "Optimization";
  } else if (isNumericalQuestion(lower)) {
    routed = analyzeNumerical(question);
    routedLabel = "Numerical";
  } else if (isSystemQuestion(lower)) {
    routed = analyzeSystem(question);
    routedLabel = "System";
  } else if (isDerivativeQuestion(lower)) {
    const request = extractDerivativeQuestion(question);
    routed = analyzeDerivative(request.expression, request.variable);
    routedLabel = "Derivative";
  } else if (isTaylorQuestion(lower)) {
    routed = analyzeTaylor(question);
    routedLabel = "Taylor";
  } else if (isComplexQuestion(lower)) {
    routed = analyzeComplex(question);
    routedLabel = "Complex";
  } else if (isFactorQuestion(lower)) {
    routed = analyzeFactoring(question);
    routedLabel = "Factor";
  } else if (isCombinatoricsQuestion(lower)) {
    routed = analyzeCombinatorics(question);
    routedLabel = "Combinatorics";
  } else if (isStatisticsQuestion(lower)) {
    routed = analyzeStatistics(question);
    routedLabel = "Statistics";
  } else if (isInequalityQuestion(question)) {
    routed = analyzeInequality(question);
    routedLabel = "Inequality";
  } else if (isLogicQuestion(question)) {
    routed = analyzeLogic(cleanLogicQuestion(question), values);
    routedLabel = "Logic";
  } else if (question.includes("=")) {
    routed = analyzeEquation(cleanEquationQuestion(question));
    routedLabel = "Equation";
  } else if (isSimplifyQuestion(lower) || looksLikeMathExpression(question)) {
    routed = analyzeSimplification(cleanSimplifyQuestion(question));
    routedLabel = "Simplify";
  } else {
    throw new Error(
      "Try a supported question, such as 'solve x^2 - 5x + 6 = 0', 'mean of 2,4,4,5,9', or 'differentiate x^3'.",
    );
  }

  return {
    ...routed,
    details: `Universal Ask routed this to ${routedLabel}. ${routed.details}`,
    steps: [
      {
        title: "Route question",
        expression: routedLabel,
        detail: "The universal solver detects the problem type, then uses the matching tree engine.",
      },
      ...routed.steps,
    ],
  };
}

export function analyzeSystem(statement) {
  const cleaned = cleanSystemQuestion(statement);
  const parts = cleaned
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    throw new Error("System solving needs at least two equations separated by semicolons.");
  }

  const equations = parts.map((part) => parseMath(part));
  if (equations.some((equation) => equation.kind !== "equation")) {
    throw new Error("Every system part must be an equation, such as 2x + y = 5.");
  }

  const polynomials = equations.map((equation) => polynomialFrom(mathBinary("-", equation.left, equation.right)));
  if (polynomials.some((polynomial) => !polynomial)) {
    throw new Error("System solving currently supports linear polynomial equations.");
  }

  const variables = [...new Set(polynomials.flatMap((polynomial) => polynomialVariables(polynomial)))].sort();
  if (variables.length === 0) {
    throw new Error("The system must contain variables.");
  }
  if (parts.length !== variables.length) {
    throw new Error("This solver needs the same number of independent equations as variables.");
  }

  const rows = polynomials.map((polynomial) => linearPolynomialRow(polynomial, variables));
  const matrix = rows.map((row) => row.coefficients);
  const constants = rows.map((row) => row.constant);
  const solution = solveLinearSystem(matrix, constants);

  const answer = variables
    .map((variable, index) => `${variable} = ${formatNumber(solution[index])}`)
    .join(", ");

  const tree = {
    kind: "system",
    children: equations,
  };

  return {
    mode: "system",
    tree,
    answer,
    summary: "linear system",
    details: `${variables.length} variables`,
    variables,
    metrics: treeMetrics(tree),
    steps: [
      {
        title: "Parse equations",
        expression: parts.join("; "),
        detail: "Each equation is parsed and moved into coefficient form.",
      },
      {
        title: "Build augmented matrix",
        expression: formatAugmentedMatrix(matrix, constants),
        detail: "The coefficients become a matrix and the constants become the right-hand side.",
      },
      {
        title: "Use Gaussian elimination",
        expression: answer,
        detail: "Row operations isolate each variable.",
      },
    ],
    artifacts: [
      ["Variables", variables.join(", ")],
      ["Augmented matrix", formatAugmentedMatrix(matrix, constants)],
      ["Solution", answer],
    ],
  };
}

export function analyzeMatrix(statement) {
  const lower = statement.toLowerCase();
  const matrices = extractMatrices(statement);
  if (matrices.length === 0) {
    throw new Error("Matrix questions need matrix notation like [[1,2],[3,4]].");
  }

  let answer;
  let summary;
  let artifacts;
  let children;
  let steps;

  if (lower.includes("nullspace") || lower.includes("null space") || lower.includes("kernel")) {
    const result = nullSpaceBasis(matrices[0]);
    answer = result.basis.length ? `basis = ${formatVectorList(result.basis)}` : "null space = {0}";
    summary = "matrix null space";
    artifacts = [
      ["Matrix", formatMatrix(matrices[0])],
      ["RREF", formatMatrix(result.rref)],
      ["Rank", formatNumber(result.rank)],
      ["Free columns", result.freeColumns.map((index) => String(index + 1)).join(", ") || "none"],
      ["Basis", result.basis.length ? formatVectorList(result.basis) : "{0}"],
    ];
    children = result.basis.length
      ? [matrixNode("A", matrices[0]), matrixNode("RREF", result.rref), matrixNode("BASIS", result.basis)]
      : [matrixNode("A", matrices[0]), matrixNode("RREF", result.rref), statsMetricNode("dim", 0)];
    steps = [
      {
        title: "Row reduce matrix",
        expression: formatMatrix(result.rref),
        detail: "The null space solves Ax = 0 using row-reduced echelon form.",
      },
      {
        title: "Identify free variables",
        expression: result.freeColumns.map((index) => `x${index + 1}`).join(", ") || "none",
        detail: "Each free variable creates one basis vector.",
      },
      {
        title: "Build basis",
        expression: result.basis.length ? formatVectorList(result.basis) : "{0}",
        detail: "Pivot variables are written in terms of the free variables.",
      },
    ];
  } else if (lower.includes("eigenvector")) {
    const result = eigenvectors2x2(matrices[0]);
    answer = result.map((entry) => `lambda ${entry.lambda}: ${formatVectorList(entry.basis)}`).join("; ");
    summary = "2x2 eigenvectors";
    artifacts = [
      ["Matrix", formatMatrix(matrices[0])],
      ["Eigenvectors", answer],
    ];
    children = [
      matrixNode("A", matrices[0]),
      ...result.map((entry) => matrixNode(`L${entry.lambda}`, entry.basis)),
    ];
    steps = [
      {
        title: "Find eigenvalues",
        expression: result.map((entry) => entry.lambda).join(", "),
        detail: "Eigenvectors are found after solving the characteristic equation.",
      },
      {
        title: "Solve null spaces",
        expression: answer,
        detail: "For each eigenvalue, the solver finds the null space of A - lambda I.",
      },
    ];
  } else if (lower.includes("rref") || lower.includes("row reduce") || lower.includes("row-reduce")) {
    const result = rowReduceMatrix(matrices[0]);
    answer = formatMatrix(result.rref);
    summary = "row-reduced echelon form";
    artifacts = [
      ["Matrix", formatMatrix(matrices[0])],
      ["RREF", answer],
      ["Rank", formatNumber(result.rank)],
      ["Pivot columns", result.pivots.map((index) => String(index + 1)).join(", ") || "none"],
    ];
    children = [matrixNode("A", matrices[0]), matrixNode("RREF", result.rref), statsMetricNode("rank", result.rank)];
    steps = [
      {
        title: "Read matrix",
        expression: matrixShape(matrices[0]),
        detail: "Row reduction works for rectangular and square matrices.",
      },
      {
        title: "Use Gauss-Jordan elimination",
        expression: answer,
        detail: "Each pivot column is normalized, then cleared above and below the pivot.",
      },
    ];
  } else if (lower.includes("rank")) {
    const result = rowReduceMatrix(matrices[0]);
    answer = `rank = ${formatNumber(result.rank)}`;
    summary = "matrix rank";
    artifacts = [
      ["Matrix", formatMatrix(matrices[0])],
      ["RREF", formatMatrix(result.rref)],
      ["Rank", formatNumber(result.rank)],
      ["Pivot columns", result.pivots.map((index) => String(index + 1)).join(", ") || "none"],
    ];
    children = [matrixNode("A", matrices[0]), matrixNode("RREF", result.rref), statsMetricNode("rank", result.rank)];
    steps = [
      {
        title: "Row reduce matrix",
        expression: formatMatrix(result.rref),
        detail: "The rank is the number of pivot rows in row-reduced echelon form.",
      },
      {
        title: "Count pivots",
        expression: answer,
        detail: "Pivot count measures the dimension of the column space.",
      },
    ];
  } else if (lower.includes("eigen")) {
    const eigenvalues = eigenvalues2x2(matrices[0]);
    const trace = matrices[0][0][0] + matrices[0][1][1];
    const determinantValue = determinant(matrices[0]);
    answer = `lambda = ${eigenvalues.join(", ")}`;
    summary = "2x2 eigenvalues";
    artifacts = [
      ["Matrix", formatMatrix(matrices[0])],
      ["Trace", formatNumber(trace)],
      ["Determinant", formatNumber(determinantValue)],
      ["Eigenvalues", eigenvalues.join(", ")],
    ];
    children = [matrixNode("A", matrices[0]), statsMetricNode("lambda1", eigenvalues[0]), statsMetricNode("lambda2", eigenvalues[1])];
    steps = [
      {
        title: "Read 2x2 matrix",
        expression: formatMatrix(matrices[0]),
        detail: "The demo computes eigenvalues from the characteristic polynomial.",
      },
      {
        title: "Solve characteristic equation",
        expression: `lambda = ${eigenvalues.join(", ")}`,
        detail: "For 2x2 matrices, lambda^2 - trace(A)lambda + det(A) = 0.",
      },
    ];
  } else if (lower.includes("multiply") || lower.includes("product")) {
    if (matrices.length < 2) {
      throw new Error("Matrix multiplication needs two matrices.");
    }
    const result = multiplyMatrices(matrices[0], matrices[1]);
    answer = formatMatrix(result);
    summary = "matrix multiplication";
    artifacts = [
      ["A", formatMatrix(matrices[0])],
      ["B", formatMatrix(matrices[1])],
      ["A * B", answer],
    ];
    children = [matrixNode("A", matrices[0]), matrixNode("B", matrices[1]), matrixNode("PRODUCT", result)];
    steps = [
      {
        title: "Read matrices",
        expression: `A is ${matrixShape(matrices[0])}, B is ${matrixShape(matrices[1])}`,
        detail: "For A * B, columns of A must match rows of B.",
      },
      {
        title: "Multiply rows by columns",
        expression: answer,
        detail: "Each result entry is a dot product.",
      },
    ];
  } else if (lower.includes("inverse")) {
    const inverse = invertMatrix(matrices[0]);
    answer = formatMatrix(inverse);
    summary = "matrix inverse";
    artifacts = [
      ["Matrix", formatMatrix(matrices[0])],
      ["Inverse", answer],
    ];
    children = [matrixNode("A", matrices[0]), matrixNode("INV", inverse)];
    steps = [
      {
        title: "Build augmented matrix",
        expression: `[A | I] for ${matrixShape(matrices[0])}`,
        detail: "The inverse is found with Gauss-Jordan elimination.",
      },
      {
        title: "Reduce to identity",
        expression: answer,
        detail: "When the left side becomes I, the right side is A^-1.",
      },
    ];
  } else {
    const determinantValue = determinant(matrices[0]);
    answer = `det = ${formatNumber(determinantValue)}`;
    summary = "determinant";
    artifacts = [
      ["Matrix", formatMatrix(matrices[0])],
      ["Determinant", formatNumber(determinantValue)],
    ];
    children = [matrixNode("A", matrices[0]), statsMetricNode("det", determinantValue)];
    steps = [
      {
        title: "Read square matrix",
        expression: matrixShape(matrices[0]),
        detail: "Determinants are defined for square matrices.",
      },
      {
        title: "Compute determinant",
        expression: answer,
        detail: "The solver expands recursively along the first row.",
      },
    ];
  }

  const tree = { kind: "matrixOperation", label: "MATRIX", children };
  return {
    mode: "matrix",
    tree,
    answer,
    summary,
    details: "Matrix operation",
    variables: [],
    metrics: treeMetrics(tree),
    steps,
    artifacts,
  };
}

export function analyzeOptimization(statement, variableHint = "x") {
  const request = extractOptimizationQuestion(statement, variableHint);
  const expression = parseMath(request.expression);
  if (expression.kind === "equation") {
    throw new Error("Optimization mode expects a function expression, not an equation.");
  }

  const steps = [
    {
      title: "Parse function",
      expression: `f(${request.variable}) = ${formatMath(expression)}`,
      detail: "Optimization starts with the function tree.",
    },
  ];
  const simplified = simplifyNode(expression, steps);
  const polynomial = polynomialFrom(simplified);
  if (!polynomial) {
    throw new Error("Optimization mode currently supports polynomial functions.");
  }

  const coefficients = polynomialCoefficients(polynomial, request.variable);
  if (coefficients.length === 0) {
    throw new Error("Optimization mode currently supports one-variable polynomial functions.");
  }

  const derivativePoly = polynomialDerivative(polynomial, request.variable);
  const derivativeCoefficients = polynomialCoefficients(derivativePoly, request.variable);
  if (polynomialDegree(derivativeCoefficients) === 0 && nearlyEqual(derivativeCoefficients[0] ?? 0, 0)) {
    throw new Error("Every point is critical for a constant function.");
  }
  const criticalPoints = approximateRealPolynomialRoots(derivativeCoefficients);
  if (criticalPoints.length === 0) {
    throw new Error("No real critical points found in the scan range.");
  }

  const secondDerivative = polynomialDerivative(derivativePoly, request.variable);
  const secondDerivativeCoefficients = polynomialCoefficients(secondDerivative, request.variable);
  const rows = criticalPoints.map((point) => {
    const value = evaluatePolynomialCoefficients(coefficients, point);
    const second = evaluatePolynomialCoefficients(secondDerivativeCoefficients, point);
    const kind = second > EPSILON ? "local min" : second < -EPSILON ? "local max" : "critical";
    return {
      x: point,
      y: value,
      second,
      kind,
    };
  });
  const preferred = pickOptimizationResult(rows, request.goal);
  const answer = `${preferred.kind} at ${request.variable} = ${formatNumber(preferred.x)}, f(${request.variable}) = ${formatNumber(preferred.y)}`;

  steps.push(
    {
      title: "Differentiate",
      expression: `f'(${request.variable}) = ${formatPolynomial(derivativePoly)}`,
      detail: "Critical points happen where the first derivative is zero.",
    },
    {
      title: "Solve derivative",
      expression: criticalPoints.map(formatNumber).join(", "),
      detail: "The solver approximates real roots of the derivative.",
    },
    {
      title: "Classify critical points",
      expression: rows.map((row) => `${formatNumber(row.x)}: ${row.kind}`).join("; "),
      detail: "The sign of the second derivative distinguishes local maxima and minima.",
    },
  );

  return {
    mode: "optimization",
    tree: expression,
    answer,
    summary: "critical points",
    details: `${request.goal} polynomial optimization`,
    variables: mathVariables(expression),
    metrics: treeMetrics(expression),
    steps,
    artifacts: [
      ["Function", `f(${request.variable}) = ${formatMath(expression)}`],
      ["Derivative", `f'(${request.variable}) = ${formatPolynomial(derivativePoly)}`],
      ["Critical points", rows.map((row) => `${request.variable}=${formatNumber(row.x)}, f=${formatNumber(row.y)}, ${row.kind}`).join("; ")],
      ["Selected", answer],
    ],
    table: {
      headers: [request.variable, `f(${request.variable})`, `f''(${request.variable})`, "Type"],
      rows: rows.map((row) => [
        formatNumber(row.x),
        formatNumber(row.y),
        formatNumber(row.second),
        row.kind,
      ]),
    },
  };
}

export function analyzeIntegral(statement, variableHint = "x") {
  const request = extractIntegralQuestion(statement, variableHint);
  const expression = parseMath(request.expression);
  if (expression.kind === "equation") {
    throw new Error("Integral mode expects an expression, not an equation.");
  }

  const steps = [
    {
      title: "Parse integrand",
      expression: formatMath(expression),
      detail: `The antiderivative is taken with respect to ${request.variable}.`,
    },
  ];

  const simplifiedExpression = simplifyNode(expression, steps);
  const integral = integrateSymbolic(simplifiedExpression, request.variable);
  if (!integral) {
    throw new Error("Integral mode supports polynomials, scalar multiples, sin, cos, tan, exp, ln, sqrt, and 1/x forms.");
  }

  const antiderivative = integral.antiderivative;
  const definite = Number.isFinite(request.lower) && Number.isFinite(request.upper);
  if (definite && integral.validateBounds) {
    integral.validateBounds(request.lower, request.upper);
  }
  const definiteValue = definite ? integral.evaluate(request.upper) - integral.evaluate(request.lower) : null;
  if (definite && !Number.isFinite(definiteValue)) {
    throw new Error("The antiderivative is not finite at one of the requested bounds.");
  }
  const answer = definite ? `integral = ${formatNumber(definiteValue)}` : `${antiderivative} + C`;
  steps.push({
    title: integral.title,
    expression: `${antiderivative} + C`,
    detail: integral.detail,
  });
  if (definite) {
    steps.push({
      title: "Evaluate bounds",
      expression: `F(${formatNumber(request.upper)}) - F(${formatNumber(request.lower)}) = ${formatNumber(definiteValue)}`,
      detail: "The definite integral uses the antiderivative at the upper and lower bounds.",
    });
  }

  return {
    mode: "integral",
    tree: expression,
    answer,
    summary: definite ? "definite integral" : "indefinite integral",
    details: `with respect to ${request.variable}`,
    variables: mathVariables(expression),
    metrics: treeMetrics(expression),
    steps,
    artifacts: definite
      ? [
          ["Integrand", formatMath(expression)],
          ["Antiderivative", `${antiderivative} + C`],
          ["Bounds", `[${formatNumber(request.lower)}, ${formatNumber(request.upper)}]`],
          ["Value", formatNumber(definiteValue)],
        ]
      : [
          ["Integrand", formatMath(expression)],
          ["Antiderivative", answer],
        ],
  };
}

export function analyzeLimit(statement, variableHint = "x") {
  const request = extractLimitQuestion(statement, variableHint);
  const expression = parseMath(request.expression);
  if (expression.kind === "equation") {
    throw new Error("Limit mode expects a function expression, not an equation.");
  }

  const steps = [
    {
      title: "Parse limit",
      expression: `${formatMath(expression)}, ${request.variable} -> ${formatNumber(request.target)}`,
      detail: "The expression is parsed into a tree and the approach value is identified.",
    },
  ];
  const directValue = safeEvaluateMath(expression, { [request.variable]: request.target });
  let answerValue;
  let answerText;
  let summary;
  let table;
  let method;

  if (Number.isFinite(directValue)) {
    answerValue = directValue;
    answerText = formatNumber(answerValue);
    summary = "direct limit";
    method = "direct substitution";
    table = {
      headers: [request.variable, "f(x)"],
      rows: [[formatNumber(request.target), formatNumber(directValue)]],
    };
    steps.push({
      title: "Substitute approach value",
      expression: `f(${formatNumber(request.target)}) = ${formatNumber(directValue)}`,
      detail: "The expression is continuous at the approach value, so direct substitution gives the limit.",
    });
  } else {
    const estimate = estimateLimit(expression, request);
    answerValue = estimate.value;
    answerText = estimate.valueText ?? formatNumber(answerValue);
    summary = request.direction === "both" ? "numeric two-sided limit" : `${request.direction}-hand limit`;
    method = request.direction === "both" ? "two-sided sampling" : `${request.direction}-hand sampling`;
    table = estimate.table;
    steps.push(
      {
        title: "Direct substitution is indeterminate",
        expression: `f(${formatNumber(request.target)}) is not finite`,
        detail: "The solver samples values close to the approach point instead.",
      },
      {
        title: "Sample near the approach value",
        expression: `${method}: ${answerText}`,
        detail: request.direction === "both"
          ? "The left and right estimates must agree for a two-sided limit."
          : "Only the requested one-sided approach is used.",
      },
    );
  }

  return {
    mode: "limit",
    tree: expression,
    answer: `limit = ${answerText}`,
    summary,
    details: `${request.variable} approaches ${formatNumber(request.target)}`,
    variables: mathVariables(expression),
    metrics: treeMetrics(expression),
    steps,
    table,
    artifacts: [
      ["Expression", formatMath(expression)],
      ["Variable", request.variable],
      ["Approaches", formatNumber(request.target)],
      ["Direction", request.direction],
      ["Method", method],
      ["Limit", answerText],
    ],
  };
}

export function analyzeGraph(statement) {
  const request = extractGraphQuestion(statement);
  const expression = parseMath(request.expression);
  if (expression.kind === "equation") {
    throw new Error("Graph mode expects a function expression, such as graph x^2 - 4.");
  }

  const variable = request.variable;
  const xMin = request.xMin;
  const xMax = request.xMax;
  const points = sampleFunction(expression, variable, xMin, xMax, 121);
  if (points.length < 2) {
    throw new Error("Could not sample enough finite graph points.");
  }

  const yValues = points.map((point) => point.y);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);

  return {
    mode: "graph",
    tree: expression,
    answer: `graph y = ${formatMath(expression)}`,
    summary: "function graph",
    details: `${variable} from ${formatNumber(xMin)} to ${formatNumber(xMax)}`,
    variables: mathVariables(expression),
    metrics: treeMetrics(expression),
    steps: [
      {
        title: "Parse function",
        expression: `y = ${formatMath(expression)}`,
        detail: "The graph uses the parsed expression tree as a function.",
      },
      {
        title: "Sample points",
        expression: `${points.length} finite points`,
        detail: "The solver evaluates the function over the requested x-range.",
      },
      {
        title: "Scale axes",
        expression: `x: [${formatNumber(xMin)}, ${formatNumber(xMax)}], y: [${formatNumber(yMin)}, ${formatNumber(yMax)}]`,
        detail: "The output panel maps sampled points into an SVG plot.",
      },
    ],
    artifacts: [
      ["Function", `y = ${formatMath(expression)}`],
      ["Domain", `[${formatNumber(xMin)}, ${formatNumber(xMax)}]`],
      ["Range shown", `[${formatNumber(yMin)}, ${formatNumber(yMax)}]`],
    ],
    graph: {
      expression: `y = ${formatMath(expression)}`,
      points,
      xMin,
      xMax,
      yMin,
      yMax,
    },
  };
}

export function analyzeNumerical(statement) {
  const request = extractNumericalQuestion(statement);
  const expression = parseMath(request.expression);
  const evaluator = numericFunctionFromExpression(expression);
  const steps = [
    {
      title: "Parse numerical problem",
      expression: request.expression,
      detail: `The solver treats the input as f(${request.variable}) = 0.`,
    },
  ];

  let root;
  let summary;
  if (request.method === "newton") {
    root = newtonRoot(evaluator, request.guess);
    summary = "Newton root";
    steps.push({
      title: "Apply Newton's method",
      expression: `${request.variable} ~= ${formatNumber(root)}`,
      detail: "Newton's method repeatedly follows tangent lines toward a root.",
    });
  } else {
    root = bisectionRoot(evaluator, request.low, request.high);
    summary = "bisection root";
    steps.push({
      title: "Apply bisection",
      expression: `${request.variable} ~= ${formatNumber(root)}`,
      detail: "Bisection repeatedly halves an interval where the function changes sign.",
    });
  }

  return {
    mode: "numerical",
    tree: expression,
    answer: `${request.variable} ~= ${formatNumber(root)}`,
    summary,
    details: "Numerical root approximation",
    variables: mathVariables(expression),
    metrics: treeMetrics(expression),
    steps,
    artifacts: [
      ["Method", request.method],
      ["Function", request.expression],
      ["Root", `${request.variable} ~= ${formatNumber(root)}`],
      ["f(root)", formatNumber(evaluator(root))],
    ],
  };
}

function analyzeHypothesisTest(statement) {
  const { mu, values, alternative, alpha } = parseHypothesisInput(statement);
  if (values.length < 2) {
    throw new Error("Hypothesis tests need at least two sample values.");
  }

  const summary = descriptiveSummary(values);
  if (!(summary.sampleStdDev > 0)) {
    throw new Error("Hypothesis tests need sample variation.");
  }

  const standardError = summary.sampleStdDev / Math.sqrt(summary.count);
  const tStatistic = (summary.mean - mu) / standardError;
  const degreesFreedom = summary.count - 1;
  const pValue = pValueForT(tStatistic, degreesFreedom, alternative);
  const decision = pValue < alpha ? `reject H0 at alpha=${formatNumber(alpha)}` : `fail to reject H0 at alpha=${formatNumber(alpha)}`;
  const cohenD = (summary.mean - mu) / summary.sampleStdDev;

  return {
    mode: "statistics",
    tree: statsDatasetNode(values, [
      statsMetricNode("H0", mu),
      statsMetricNode("MEAN", summary.mean),
      statsMetricNode("T", tStatistic),
      statsMetricNode("P", pValue),
      statsMetricNode("D", cohenD),
    ], "TEST"),
    answer: `t = ${formatNumber(tStatistic)}, p = ${formatNumber(pValue)}`,
    summary: "one-sample t test",
    details: `${alternative} alternative, Student t p-value`,
    variables: [],
    metrics: treeMetrics(statsDatasetNode(values)),
    steps: [
      {
        title: "Read hypothesis test",
        expression: `H0: mean = ${formatNumber(mu)}, n = ${summary.count}`,
        detail: "The solver extracts the null mean and sample data.",
      },
      {
        title: "Compute sample summary",
        expression: `mean = ${formatNumber(summary.mean)}, sample sd = ${formatNumber(summary.sampleStdDev)}`,
        detail: "The one-sample test compares the sample mean to the null mean.",
      },
      {
        title: "Compute test statistic",
        expression: `t = (mean - mu) / (sd / sqrt(n)) = ${formatNumber(tStatistic)}`,
        detail: "The statistic measures how many standard errors the sample mean is from H0.",
      },
      {
        title: "Approximate p-value",
        expression: `p = ${formatNumber(pValue)}`,
        detail: "The p-value comes from the Student t distribution.",
      },
      {
        title: "Compute effect size",
        expression: `Cohen's d = ${formatNumber(cohenD)}`,
        detail: "Effect size reports the mean difference in sample-standard-deviation units.",
      },
      {
        title: "Make decision",
        expression: decision,
        detail: "Small p-values give evidence against the null hypothesis.",
      },
    ],
    artifacts: [
      ["Null mean", formatNumber(mu)],
      ["Alternative", alternative],
      ["Sample mean", formatNumber(summary.mean)],
      ["Sample SD", formatNumber(summary.sampleStdDev)],
      ["Standard error", formatNumber(standardError)],
      ["Degrees of freedom", formatNumber(degreesFreedom)],
      ["t statistic", formatNumber(tStatistic)],
      ["p-value", formatNumber(pValue)],
      ["Cohen's d", formatNumber(cohenD)],
      ["Decision", decision],
    ],
  };
}

function analyzeTwoSampleTTest(statement) {
  const { left, right, alternative, alpha } = parseTwoSampleInput(statement);
  if (left.length < 2 || right.length < 2) {
    throw new Error("Two-sample t tests need at least two values in each group.");
  }

  const leftSummary = descriptiveSummary(left);
  const rightSummary = descriptiveSummary(right);
  if (!(leftSummary.sampleStdDev > 0) || !(rightSummary.sampleStdDev > 0)) {
    throw new Error("Two-sample t tests need variation in both groups.");
  }

  const leftVarianceTerm = leftSummary.sampleVariance / leftSummary.count;
  const rightVarianceTerm = rightSummary.sampleVariance / rightSummary.count;
  const standardError = Math.sqrt(leftVarianceTerm + rightVarianceTerm);
  const tStatistic = (leftSummary.mean - rightSummary.mean) / standardError;
  const dfNumerator = (leftVarianceTerm + rightVarianceTerm) ** 2;
  const dfDenominator =
    (leftVarianceTerm ** 2) / (leftSummary.count - 1) +
    (rightVarianceTerm ** 2) / (rightSummary.count - 1);
  const degreesFreedom = dfNumerator / dfDenominator;
  const pValue = pValueForT(tStatistic, degreesFreedom, alternative);
  const decision = pValue < alpha ? `reject H0 at alpha=${formatNumber(alpha)}` : `fail to reject H0 at alpha=${formatNumber(alpha)}`;
  const pooledStdDev = pooledSampleStdDev(leftSummary, rightSummary);
  const cohenD = (leftSummary.mean - rightSummary.mean) / pooledStdDev;
  const hedgesG = hedgesCorrection(leftSummary.count + rightSummary.count - 2) * cohenD;

  return {
    mode: "statistics",
    tree: statsDatasetNode([...left, ...right], [
      statsMetricNode("MEAN1", leftSummary.mean),
      statsMetricNode("MEAN2", rightSummary.mean),
      statsMetricNode("T", tStatistic),
      statsMetricNode("P", pValue),
      statsMetricNode("G", hedgesG),
    ], "2-SAMPLE"),
    answer: `t = ${formatNumber(tStatistic)}, p = ${formatNumber(pValue)}`,
    summary: "two-sample t test",
    details: "Welch test with Student t p-value",
    variables: [],
    metrics: treeMetrics(statsDatasetNode([...left, ...right])),
    steps: [
      {
        title: "Read two samples",
        expression: `n1 = ${leftSummary.count}, n2 = ${rightSummary.count}`,
        detail: "The solver separates two independent groups.",
      },
      {
        title: "Compute group summaries",
        expression: `mean1 = ${formatNumber(leftSummary.mean)}, mean2 = ${formatNumber(rightSummary.mean)}`,
        detail: "Welch's t test compares the difference in group means.",
      },
      {
        title: "Compute standard error",
        expression: `SE = ${formatNumber(standardError)}`,
        detail: "Welch's method combines the two sample variances without assuming equal variance.",
      },
      {
        title: "Compute test statistic",
        expression: `t = ${formatNumber(tStatistic)}, df = ${formatNumber(degreesFreedom)}`,
        detail: "The solver reports Welch degrees of freedom and a Student t-distribution p-value.",
      },
      {
        title: "Compute effect size",
        expression: `Hedges g = ${formatNumber(hedgesG)}`,
        detail: "Hedges g standardizes the mean difference and corrects Cohen's d for small samples.",
      },
      {
        title: "Make decision",
        expression: decision,
        detail: "Small p-values suggest the group means differ more than expected by sampling noise.",
      },
    ],
    artifacts: [
      ["Group 1 mean", formatNumber(leftSummary.mean)],
      ["Group 2 mean", formatNumber(rightSummary.mean)],
      ["Mean difference", formatNumber(leftSummary.mean - rightSummary.mean)],
      ["Standard error", formatNumber(standardError)],
      ["Degrees of freedom", formatNumber(degreesFreedom)],
      ["t statistic", formatNumber(tStatistic)],
      ["p-value", formatNumber(pValue)],
      ["Cohen's d", formatNumber(cohenD)],
      ["Hedges g", formatNumber(hedgesG)],
      ["Decision", decision],
    ],
  };
}

function analyzePairedTTest(statement) {
  const { left, right, alternative, alpha } = parsePairedInput(statement);
  if (left.length !== right.length || left.length < 2) {
    throw new Error("Paired t tests need equal-length before/after lists with at least two pairs.");
  }

  const differences = right.map((value, index) => value - left[index]);
  const summary = descriptiveSummary(differences);
  if (!(summary.sampleStdDev > 0)) {
    throw new Error("Paired t tests need variation in the pair differences.");
  }

  const standardError = summary.sampleStdDev / Math.sqrt(summary.count);
  const tStatistic = summary.mean / standardError;
  const degreesFreedom = summary.count - 1;
  const pValue = pValueForT(tStatistic, degreesFreedom, alternative);
  const decision = pValue < alpha ? `reject H0 at alpha=${formatNumber(alpha)}` : `fail to reject H0 at alpha=${formatNumber(alpha)}`;
  const cohenDz = summary.mean / summary.sampleStdDev;

  return {
    mode: "statistics",
    tree: statsDatasetNode(differences, [
      statsMetricNode("MEAN DIFF", summary.mean),
      statsMetricNode("T", tStatistic),
      statsMetricNode("P", pValue),
      statsMetricNode("DZ", cohenDz),
    ], "PAIRED"),
    answer: `t = ${formatNumber(tStatistic)}, p = ${formatNumber(pValue)}`,
    summary: "paired t test",
    details: "Mean of paired differences with Student t p-value",
    variables: [],
    metrics: treeMetrics(statsDatasetNode(differences)),
    steps: [
      {
        title: "Read paired samples",
        expression: `${left.length} matched pairs`,
        detail: "The solver compares each second value to the matching first value.",
      },
      {
        title: "Compute differences",
        expression: differences.map(formatNumber).join(", "),
        detail: "A paired test reduces the problem to a one-sample test on differences.",
      },
      {
        title: "Compute test statistic",
        expression: `t = ${formatNumber(tStatistic)}`,
        detail: "The statistic measures mean difference relative to standard error.",
      },
      {
        title: "Compute effect size",
        expression: `Cohen's dz = ${formatNumber(cohenDz)}`,
        detail: "Paired effect size standardizes the mean difference by the SD of differences.",
      },
      {
        title: "Make decision",
        expression: decision,
        detail: "Small p-values suggest the matched differences are not centered at zero.",
      },
    ],
    table: {
      headers: ["Pair", "First", "Second", "Difference"],
      rows: left.map((value, index) => [
        String(index + 1),
        formatNumber(value),
        formatNumber(right[index]),
        formatNumber(differences[index]),
      ]),
    },
    artifacts: [
      ["Mean difference", formatNumber(summary.mean)],
      ["Sample SD of differences", formatNumber(summary.sampleStdDev)],
      ["Standard error", formatNumber(standardError)],
      ["Degrees of freedom", formatNumber(degreesFreedom)],
      ["t statistic", formatNumber(tStatistic)],
      ["p-value", formatNumber(pValue)],
      ["Cohen's dz", formatNumber(cohenDz)],
      ["Decision", decision],
    ],
  };
}

function analyzeAnova(statement) {
  const { groups, alpha } = parseAnovaInput(statement);
  if (groups.length < 2 || groups.some((group) => group.length < 2)) {
    throw new Error("ANOVA needs at least two groups with at least two values each.");
  }

  const allValues = groups.flat();
  const grandMean = mean(allValues);
  const groupSummaries = groups.map(descriptiveSummary);
  const ssBetween = groups.reduce((sum, group, index) =>
    sum + group.length * (groupSummaries[index].mean - grandMean) ** 2,
  0);
  const ssWithin = groups.reduce((sum, group, index) =>
    sum + group.reduce((inner, value) => inner + (value - groupSummaries[index].mean) ** 2, 0),
  0);
  const dfBetween = groups.length - 1;
  const dfWithin = allValues.length - groups.length;
  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;
  if (!(msWithin > 0)) {
    throw new Error("ANOVA needs within-group variation.");
  }
  const fStatistic = msBetween / msWithin;
  const pValue = fRightTail(fStatistic, dfBetween, dfWithin);
  const decision = pValue < alpha ? `reject H0 at alpha=${formatNumber(alpha)}` : `fail to reject H0 at alpha=${formatNumber(alpha)}`;
  const totalSS = ssBetween + ssWithin;
  const etaSquared = ssBetween / totalSS;
  const omegaSquared = Math.max(0, (ssBetween - dfBetween * msWithin) / (totalSS + msWithin));
  const pairwiseComparisons = pairwiseAnovaComparisons(groupSummaries, groups, msWithin, dfWithin);

  return {
    mode: "statistics",
    tree: statsDatasetNode(allValues, [
      statsMetricNode("F", fStatistic),
      statsMetricNode("DF1", dfBetween),
      statsMetricNode("DF2", dfWithin),
      statsMetricNode("P", pValue),
      statsMetricNode("ETA2", etaSquared),
    ], "ANOVA"),
    answer: `F = ${formatNumber(fStatistic)}, p = ${formatNumber(pValue)}`,
    summary: "one-way ANOVA",
    details: `${groups.length} groups`,
    variables: [],
    metrics: treeMetrics(statsDatasetNode(allValues)),
    steps: [
      {
        title: "Read groups",
        expression: groups.map((group, index) => `group ${index + 1}: n=${group.length}`).join("; "),
        detail: "One-way ANOVA compares the means of two or more independent groups.",
      },
      {
        title: "Compute sums of squares",
        expression: `SSB = ${formatNumber(ssBetween)}, SSW = ${formatNumber(ssWithin)}`,
        detail: "Between-group variation is compared with within-group variation.",
      },
      {
        title: "Compute F statistic",
        expression: `F = ${formatNumber(fStatistic)} with df ${dfBetween}, ${dfWithin}`,
        detail: "A larger F means group means are farther apart relative to within-group spread.",
      },
      {
        title: "Compute p-value",
        expression: `p = ${formatNumber(pValue)}`,
        detail: "The solver evaluates the F distribution using the regularized beta function.",
      },
      {
        title: "Compute effect size",
        expression: `eta^2 = ${formatNumber(etaSquared)}, omega^2 = ${formatNumber(omegaSquared)}`,
        detail: "Effect sizes estimate how much outcome variation is associated with group membership.",
      },
      {
        title: "Compare groups pairwise",
        expression: formatPairwiseComparisons(pairwiseComparisons),
        detail: "Pairwise rows use pooled ANOVA error and Bonferroni-adjusted t approximations.",
      },
      {
        title: "Make decision",
        expression: decision,
        detail: "Small p-values suggest at least one group mean differs.",
      },
    ],
    table: {
      headers: ["Source", "SS", "df", "MS", "F"],
      rows: [
        ["Between", formatNumber(ssBetween), formatNumber(dfBetween), formatNumber(msBetween), formatNumber(fStatistic)],
        ["Within", formatNumber(ssWithin), formatNumber(dfWithin), formatNumber(msWithin), ""],
        ["Total", formatNumber(totalSS), formatNumber(allValues.length - 1), "", ""],
      ],
    },
    artifacts: [
      ["Grand mean", formatNumber(grandMean)],
      ["F statistic", formatNumber(fStatistic)],
      ["p-value", formatNumber(pValue)],
      ["Eta squared", formatNumber(etaSquared)],
      ["Omega squared", formatNumber(omegaSquared)],
      ["Pairwise comparisons", formatPairwiseComparisons(pairwiseComparisons)],
      ["Decision", decision],
    ],
  };
}

function analyzeMannWhitney(statement) {
  const { left, right, alternative, alpha } = parseTwoSampleInput(statement);
  if (left.length < 1 || right.length < 1) {
    throw new Error("Mann-Whitney U needs at least one value in each group.");
  }

  const allValues = [...left, ...right];
  const ranked = rankValues(allValues);
  const leftRanks = ranked.ranks.slice(0, left.length);
  const rightRanks = ranked.ranks.slice(left.length);
  const leftRankSum = leftRanks.reduce((sum, rank) => sum + rank, 0);
  const rightRankSum = rightRanks.reduce((sum, rank) => sum + rank, 0);
  const u1 = leftRankSum - (left.length * (left.length + 1)) / 2;
  const u2 = rightRankSum - (right.length * (right.length + 1)) / 2;
  const statistic = Math.min(u1, u2);
  const meanU = (left.length * right.length) / 2;
  const varianceU = (left.length * right.length / 12) *
    (allValues.length + 1 - ranked.tieCorrection / (allValues.length * (allValues.length - 1)));
  if (!(varianceU > 0)) {
    throw new Error("Mann-Whitney U needs rank variation across the combined samples.");
  }

  const z = (u1 - meanU) / Math.sqrt(varianceU);
  const pValue = pValueForNormal(z, alternative);
  const decision = pValue < alpha ? `reject H0 at alpha=${formatNumber(alpha)}` : `fail to reject H0 at alpha=${formatNumber(alpha)}`;
  const rankBiserial = (u1 - u2) / (left.length * right.length);
  const normalR = z / Math.sqrt(allValues.length);

  return {
    mode: "statistics",
    tree: statsDatasetNode(allValues, [
      statsMetricNode("U", statistic),
      statsMetricNode("Z", z),
      statsMetricNode("P", pValue),
      statsMetricNode("RBC", rankBiserial),
    ], "MANN-WHITNEY"),
    answer: `U = ${formatNumber(statistic)}, p = ${formatNumber(pValue)}`,
    summary: "Mann-Whitney U test",
    details: "Rank-sum test with normal-approximation p-value",
    variables: [],
    metrics: treeMetrics(statsDatasetNode(allValues)),
    steps: [
      {
        title: "Read independent samples",
        expression: `n1 = ${left.length}, n2 = ${right.length}`,
        detail: "Mann-Whitney U compares two independent groups using ranks instead of raw means.",
      },
      {
        title: "Rank combined data",
        expression: ranked.ranks.map(formatNumber).join(", "),
        detail: "Tied values receive their average rank.",
      },
      {
        title: "Compute U statistic",
        expression: `U1 = ${formatNumber(u1)}, U2 = ${formatNumber(u2)}`,
        detail: "The smaller U is reported; the signed z-score uses group 1 versus group 2.",
      },
      {
        title: "Approximate p-value",
        expression: `z = ${formatNumber(z)}, p = ${formatNumber(pValue)}`,
        detail: "The p-value uses a tie-corrected normal approximation.",
      },
      {
        title: "Compute effect size",
        expression: `rank-biserial r = ${formatNumber(rankBiserial)}`,
        detail: "Rank-biserial correlation estimates how strongly group 1 tends to rank above group 2.",
      },
      {
        title: "Make decision",
        expression: decision,
        detail: "Small p-values suggest the two distributions are shifted relative to each other.",
      },
    ],
    table: {
      headers: ["Group", "Value", "Rank"],
      rows: [
        ...left.map((value, index) => ["1", formatNumber(value), formatNumber(leftRanks[index])]),
        ...right.map((value, index) => ["2", formatNumber(value), formatNumber(rightRanks[index])]),
      ],
    },
    artifacts: [
      ["Group 1 rank sum", formatNumber(leftRankSum)],
      ["Group 2 rank sum", formatNumber(rightRankSum)],
      ["U1", formatNumber(u1)],
      ["U2", formatNumber(u2)],
      ["Reported U", formatNumber(statistic)],
      ["z statistic", formatNumber(z)],
      ["p-value", formatNumber(pValue)],
      ["Rank-biserial r", formatNumber(rankBiserial)],
      ["Normal approximation r", formatNumber(normalR)],
      ["Decision", decision],
    ],
  };
}

function analyzeWilcoxonSignedRank(statement) {
  const { left, right, alternative, alpha } = parsePairedInput(statement);
  if (left.length !== right.length || left.length < 2) {
    throw new Error("Wilcoxon signed-rank needs equal-length paired samples with at least two pairs.");
  }

  const pairedDifferences = right.map((value, index) => value - left[index]);
  const nonzeroDifferences = pairedDifferences.filter((difference) => !nearlyEqual(difference, 0));
  if (nonzeroDifferences.length < 2) {
    throw new Error("Wilcoxon signed-rank needs at least two nonzero pair differences.");
  }

  const ranked = rankAbsoluteValues(nonzeroDifferences);
  const wPlus = nonzeroDifferences.reduce((sum, difference, index) => difference > 0 ? sum + ranked.ranks[index] : sum, 0);
  const wMinus = nonzeroDifferences.reduce((sum, difference, index) => difference < 0 ? sum + ranked.ranks[index] : sum, 0);
  const statistic = Math.min(wPlus, wMinus);
  const n = nonzeroDifferences.length;
  const meanW = (n * (n + 1)) / 4;
  const varianceW = (n * (n + 1) * (2 * n + 1) - ranked.tieCorrection / 2) / 24;
  if (!(varianceW > 0)) {
    throw new Error("Wilcoxon signed-rank needs rank variation in absolute differences.");
  }

  const z = (wPlus - meanW) / Math.sqrt(varianceW);
  const pValue = pValueForNormal(z, alternative);
  const decision = pValue < alpha ? `reject H0 at alpha=${formatNumber(alpha)}` : `fail to reject H0 at alpha=${formatNumber(alpha)}`;
  const rankBiserial = (wPlus - wMinus) / (wPlus + wMinus);
  const normalR = z / Math.sqrt(n);
  let rankCursor = 0;
  const pairRows = left.map((value, index) => {
    const difference = pairedDifferences[index];
    const rank = nearlyEqual(difference, 0) ? "zero" : formatNumber(ranked.ranks[rankCursor++]);
    return [
      String(index + 1),
      formatNumber(value),
      formatNumber(right[index]),
      formatNumber(difference),
      rank,
    ];
  });

  return {
    mode: "statistics",
    tree: statsDatasetNode(nonzeroDifferences, [
      statsMetricNode("W+", wPlus),
      statsMetricNode("W-", wMinus),
      statsMetricNode("P", pValue),
      statsMetricNode("RBC", rankBiserial),
    ], "WILCOXON"),
    answer: `W = ${formatNumber(statistic)}, p = ${formatNumber(pValue)}`,
    summary: "Wilcoxon signed-rank test",
    details: "Paired nonparametric test with normal-approximation p-value",
    variables: [],
    metrics: treeMetrics(statsDatasetNode(nonzeroDifferences)),
    steps: [
      {
        title: "Read paired samples",
        expression: `${left.length} pairs, ${nonzeroDifferences.length} nonzero differences`,
        detail: "Wilcoxon signed-rank tests whether paired differences are centered at zero.",
      },
      {
        title: "Rank absolute differences",
        expression: ranked.ranks.map(formatNumber).join(", "),
        detail: "The solver ranks the absolute nonzero differences and keeps the original signs.",
      },
      {
        title: "Compute signed rank sums",
        expression: `W+ = ${formatNumber(wPlus)}, W- = ${formatNumber(wMinus)}`,
        detail: "Positive and negative differences contribute separate rank sums.",
      },
      {
        title: "Approximate p-value",
        expression: `z = ${formatNumber(z)}, p = ${formatNumber(pValue)}`,
        detail: "The p-value uses a tie-corrected normal approximation.",
      },
      {
        title: "Compute effect size",
        expression: `matched rank-biserial r = ${formatNumber(rankBiserial)}`,
        detail: "The signed rank-biserial correlation measures direction and strength of the paired shift.",
      },
      {
        title: "Make decision",
        expression: decision,
        detail: "Small p-values suggest a systematic paired shift.",
      },
    ],
    table: {
      headers: ["Pair", "First", "Second", "Difference", "|Difference| rank"],
      rows: pairRows,
    },
    artifacts: [
      ["Nonzero pairs", formatNumber(n)],
      ["W+", formatNumber(wPlus)],
      ["W-", formatNumber(wMinus)],
      ["Reported W", formatNumber(statistic)],
      ["z statistic", formatNumber(z)],
      ["p-value", formatNumber(pValue)],
      ["Matched rank-biserial r", formatNumber(rankBiserial)],
      ["Normal approximation r", formatNumber(normalR)],
      ["Decision", decision],
    ],
  };
}

function analyzeKruskalWallis(statement) {
  const { groups, alpha } = parseKruskalInput(statement);
  if (groups.length < 2 || groups.some((group) => group.length < 1)) {
    throw new Error("Kruskal-Wallis needs at least two groups with at least one value each.");
  }

  const allValues = groups.flat();
  const ranked = rankValues(allValues);
  let offset = 0;
  const groupRankSums = groups.map((group) => {
    const ranks = ranked.ranks.slice(offset, offset + group.length);
    offset += group.length;
    return ranks.reduce((sum, rank) => sum + rank, 0);
  });
  const totalCount = allValues.length;
  const rawH = (12 / (totalCount * (totalCount + 1))) *
    groupRankSums.reduce((sum, rankSum, index) => sum + (rankSum ** 2) / groups[index].length, 0) -
    3 * (totalCount + 1);
  const tieFactor = 1 - ranked.tieCorrection / (totalCount ** 3 - totalCount);
  if (!(tieFactor > 0)) {
    throw new Error("Kruskal-Wallis needs rank variation across groups.");
  }
  const hStatistic = rawH / tieFactor;
  const degreesFreedom = groups.length - 1;
  const pValue = chiSquareRightTailApprox(hStatistic, degreesFreedom);
  const decision = pValue < alpha ? `reject H0 at alpha=${formatNumber(alpha)}` : `fail to reject H0 at alpha=${formatNumber(alpha)}`;
  const epsilonSquared = Math.max(0, (hStatistic - groups.length + 1) / (totalCount - groups.length));
  const dunnComparisons = pairwiseDunnComparisons(groups, groupRankSums, totalCount, ranked.tieCorrection);

  return {
    mode: "statistics",
    tree: statsDatasetNode(allValues, [
      statsMetricNode("H", hStatistic),
      statsMetricNode("DF", degreesFreedom),
      statsMetricNode("P", pValue),
      statsMetricNode("EPS2", epsilonSquared),
    ], "KRUSKAL"),
    answer: `H = ${formatNumber(hStatistic)}, p = ${formatNumber(pValue)}`,
    summary: "Kruskal-Wallis test",
    details: `${groups.length} groups, rank-based ANOVA alternative`,
    variables: [],
    metrics: treeMetrics(statsDatasetNode(allValues)),
    steps: [
      {
        title: "Read independent groups",
        expression: groups.map((group, index) => `group ${index + 1}: n=${group.length}`).join("; "),
        detail: "Kruskal-Wallis compares three or more independent groups using ranks.",
      },
      {
        title: "Rank combined data",
        expression: ranked.ranks.map(formatNumber).join(", "),
        detail: "All observations are ranked together, with tied values averaged.",
      },
      {
        title: "Compute H statistic",
        expression: `H = ${formatNumber(hStatistic)}, df = ${formatNumber(degreesFreedom)}`,
        detail: "Large H values mean the group rank sums are farther apart than expected by chance.",
      },
      {
        title: "Approximate p-value",
        expression: `p = ${formatNumber(pValue)}`,
        detail: "The p-value uses a chi-square approximation with tie correction.",
      },
      {
        title: "Compute effect size",
        expression: `epsilon^2 = ${formatNumber(epsilonSquared)}`,
        detail: "Epsilon squared estimates the share of ranked variation explained by group membership.",
      },
      {
        title: "Compare groups pairwise",
        expression: formatPairwiseComparisons(dunnComparisons),
        detail: "Dunn-style pairwise rows compare mean ranks with Bonferroni-adjusted normal p-values.",
      },
      {
        title: "Make decision",
        expression: decision,
        detail: "Small p-values suggest at least one group distribution is shifted.",
      },
    ],
    table: {
      headers: ["Group", "n", "Rank sum", "Mean rank"],
      rows: groups.map((group, index) => [
        String(index + 1),
        formatNumber(group.length),
        formatNumber(groupRankSums[index]),
        formatNumber(groupRankSums[index] / group.length),
      ]),
    },
    artifacts: [
      ["H statistic", formatNumber(hStatistic)],
      ["Degrees of freedom", formatNumber(degreesFreedom)],
      ["p-value", formatNumber(pValue)],
      ["Epsilon squared", formatNumber(epsilonSquared)],
      ["Pairwise comparisons", formatPairwiseComparisons(dunnComparisons)],
      ["Decision", decision],
    ],
  };
}

function analyzeChiSquare(statement) {
  const { observed, expected, alpha } = parseChiSquareInput(statement);
  if (observed.length !== expected.length || observed.length < 2) {
    throw new Error("Chi-square tests need matching observed and expected lists.");
  }
  if (expected.some((value) => !(value > 0))) {
    throw new Error("Expected chi-square counts must be positive.");
  }

  const contributions = observed.map((value, index) => (value - expected[index]) ** 2 / expected[index]);
  const statistic = contributions.reduce((sum, value) => sum + value, 0);
  const degreesFreedom = observed.length - 1;
  const pValue = chiSquareRightTailApprox(statistic, degreesFreedom);
  const decision = pValue < alpha ? `reject H0 at alpha=${formatNumber(alpha)}` : `fail to reject H0 at alpha=${formatNumber(alpha)}`;
  const totalCount = observed.reduce((sum, value) => sum + value, 0);
  const cohensW = Math.sqrt(statistic / totalCount);

  return {
    mode: "statistics",
    tree: statsDatasetNode(observed, [
      statsMetricNode("X2", statistic),
      statsMetricNode("DF", degreesFreedom),
      statsMetricNode("P", pValue),
      statsMetricNode("W", cohensW),
    ], "CHI2"),
    answer: `chi-square = ${formatNumber(statistic)}, p = ${formatNumber(pValue)}`,
    summary: "chi-square goodness-of-fit",
    details: "Observed vs expected counts",
    variables: [],
    metrics: treeMetrics(statsDatasetNode(observed)),
    steps: [
      {
        title: "Read observed and expected counts",
        expression: `${observed.length} categories`,
        detail: "The goodness-of-fit test compares actual category counts to expected counts.",
      },
      {
        title: "Compute contributions",
        expression: contributions.map(formatNumber).join(", "),
        detail: "Each category contributes (observed - expected)^2 / expected.",
      },
      {
        title: "Sum chi-square statistic",
        expression: `X^2 = ${formatNumber(statistic)}, df = ${formatNumber(degreesFreedom)}`,
        detail: "The total statistic is compared to a chi-square reference curve.",
      },
      {
        title: "Approximate p-value",
        expression: `p = ${formatNumber(pValue)}`,
        detail: "The browser demo uses the Wilson-Hilferty normal approximation.",
      },
      {
        title: "Compute effect size",
        expression: `Cohen's w = ${formatNumber(cohensW)}`,
        detail: "Cohen's w standardizes the size of the difference between observed and expected counts.",
      },
      {
        title: "Make decision",
        expression: decision,
        detail: "Small p-values suggest the observed counts do not fit the expected pattern.",
      },
    ],
    table: {
      headers: ["Category", "Observed", "Expected", "Contribution"],
      rows: observed.map((value, index) => [
        String(index + 1),
        formatNumber(value),
        formatNumber(expected[index]),
        formatNumber(contributions[index]),
      ]),
    },
    artifacts: [
      ["Chi-square", formatNumber(statistic)],
      ["Degrees of freedom", formatNumber(degreesFreedom)],
      ["p-value", formatNumber(pValue)],
      ["Cohen's w", formatNumber(cohensW)],
      ["Decision", decision],
    ],
  };
}

function analyzeHypergeometric(statement) {
  const request = parseHypergeometricInput(statement);
  const minK = Math.max(0, request.draws - (request.population - request.successes));
  const maxK = Math.min(request.successes, request.draws);
  const exact = hypergeometricProbability(request.population, request.successes, request.draws, request.k);
  const atMost = sumRange(minK, request.k, (value) =>
    hypergeometricProbability(request.population, request.successes, request.draws, value),
  );
  const atLeast = sumRange(request.k, maxK, (value) =>
    hypergeometricProbability(request.population, request.successes, request.draws, value),
  );
  const expected = request.draws * (request.successes / request.population);
  const variance = request.draws *
    (request.successes / request.population) *
    (1 - request.successes / request.population) *
    ((request.population - request.draws) / (request.population - 1));
  const label = `P(X = ${request.k})`;

  return {
    mode: "statistics",
    tree: {
      kind: "statsDistribution",
      label: "HYPERGEOM",
      children: [
        statsMetricNode("N", request.population),
        statsMetricNode("K", request.successes),
        statsMetricNode("n", request.draws),
        statsMetricNode("k", request.k),
      ],
    },
    answer: `${label} = ${formatNumber(exact)}`,
    summary: "hypergeometric probability",
    details: "Sampling without replacement",
    variables: [],
    metrics: treeMetrics({
      kind: "statsDistribution",
      children: [
        statsMetricNode("population", request.population),
        statsMetricNode("successes", request.successes),
        statsMetricNode("draws", request.draws),
      ],
    }),
    steps: [
      {
        title: "Read sampling setup",
        expression: `N = ${request.population}, K = ${request.successes}, n = ${request.draws}, k = ${request.k}`,
        detail: "A hypergeometric model counts successes when sampling without replacement.",
      },
      {
        title: "Apply probability formula",
        expression: "P(X = k) = C(K,k) C(N-K,n-k) / C(N,n)",
        detail: "The numerator chooses successful and unsuccessful draws; the denominator chooses all possible samples.",
      },
      {
        title: "Evaluate probability",
        expression: `${label} = ${formatNumber(exact)}`,
        detail: "The solver also reports cumulative tails and distribution moments.",
      },
    ],
    table: {
      headers: ["Term", "Value"],
      rows: [
        ["C(K,k)", formatNumber(combination(request.successes, request.k))],
        ["C(N-K,n-k)", formatNumber(combination(request.population - request.successes, request.draws - request.k))],
        ["C(N,n)", formatNumber(combination(request.population, request.draws))],
      ],
    },
    artifacts: [
      [label, formatNumber(exact)],
      [`P(X <= ${request.k})`, formatNumber(atMost)],
      [`P(X >= ${request.k})`, formatNumber(atLeast)],
      ["Expected value", formatNumber(expected)],
      ["Variance", formatNumber(variance)],
      ["Standard deviation", formatNumber(Math.sqrt(variance))],
    ],
  };
}

function analyzeProportionConfidenceInterval(statement) {
  const { successes, total, level } = parseOneProportionInput(statement, { needsNull: false });
  const proportion = successes / total;
  const critical = zCriticalForLevel(level);
  const standardError = Math.sqrt((proportion * (1 - proportion)) / total);
  const margin = critical * standardError;
  const lower = Math.max(0, proportion - margin);
  const upper = Math.min(1, proportion + margin);
  const percent = formatNumber(level * 100);

  return {
    mode: "statistics",
    tree: statsDatasetNode([successes, total], [
      statsMetricNode("p-hat", proportion),
      statsMetricNode("SE", standardError),
      statsMetricNode("CI", margin),
    ], "PROP CI"),
    answer: `${percent}% CI for p = [${formatNumber(lower)}, ${formatNumber(upper)}]`,
    summary: "one-proportion confidence interval",
    details: "Normal approximation for a population proportion",
    variables: [],
    metrics: treeMetrics(statsDatasetNode([successes, total])),
    steps: [
      {
        title: "Read sample proportion",
        expression: `${formatNumber(successes)} successes out of ${formatNumber(total)}`,
        detail: "The sample proportion estimates the population proportion.",
      },
      {
        title: "Compute standard error",
        expression: `SE = sqrt(p-hat(1 - p-hat) / n) = ${formatNumber(standardError)}`,
        detail: "The normal approximation uses the estimated sampling variation of p-hat.",
      },
      {
        title: "Build confidence interval",
        expression: `${formatNumber(proportion)} +/- ${formatNumber(margin)}`,
        detail: "The margin of error is z critical value times standard error.",
      },
    ],
    table: {
      headers: ["Successes", "n", "p-hat", "Standard error"],
      rows: [[formatNumber(successes), formatNumber(total), formatNumber(proportion), formatNumber(standardError)]],
    },
    artifacts: [
      ["Confidence level", `${percent}%`],
      ["Sample proportion", formatNumber(proportion)],
      ["Standard error", formatNumber(standardError)],
      ["Critical value", formatNumber(critical)],
      ["Margin of error", formatNumber(margin)],
      ["Lower bound", formatNumber(lower)],
      ["Upper bound", formatNumber(upper)],
    ],
  };
}

function analyzeOneProportionZTest(statement) {
  const { successes, total, nullProportion, alternative, alpha } = parseOneProportionInput(statement, { needsNull: true });
  const proportion = successes / total;
  const standardError = Math.sqrt((nullProportion * (1 - nullProportion)) / total);
  if (!(standardError > 0)) {
    throw new Error("One-proportion z tests need a null proportion strictly between 0 and 1.");
  }
  const zStatistic = (proportion - nullProportion) / standardError;
  const pValue = pValueForNormal(zStatistic, alternative);
  const decision = pValue < alpha ? `reject H0 at alpha=${formatNumber(alpha)}` : `fail to reject H0 at alpha=${formatNumber(alpha)}`;
  const cohensH = proportionEffectSize(proportion, nullProportion);

  return {
    mode: "statistics",
    tree: statsDatasetNode([successes, total], [
      statsMetricNode("p-hat", proportion),
      statsMetricNode("p0", nullProportion),
      statsMetricNode("Z", zStatistic),
      statsMetricNode("P", pValue),
    ], "PROP TEST"),
    answer: `z = ${formatNumber(zStatistic)}, p = ${formatNumber(pValue)}`,
    summary: "one-proportion z test",
    details: `${alternative} alternative for a population proportion`,
    variables: [],
    metrics: treeMetrics(statsDatasetNode([successes, total])),
    steps: [
      {
        title: "Read proportion test",
        expression: `H0: p = ${formatNumber(nullProportion)}, p-hat = ${formatNumber(proportion)}`,
        detail: "The solver compares the observed sample proportion to a null proportion.",
      },
      {
        title: "Compute null standard error",
        expression: `SE0 = sqrt(p0(1 - p0) / n) = ${formatNumber(standardError)}`,
        detail: "The test statistic uses the sampling variation expected under the null hypothesis.",
      },
      {
        title: "Compute z statistic",
        expression: `z = (p-hat - p0) / SE0 = ${formatNumber(zStatistic)}`,
        detail: "The z statistic measures how far the sample proportion is from the null.",
      },
      {
        title: "Approximate p-value",
        expression: `p = ${formatNumber(pValue)}`,
        detail: "The p-value uses the standard normal distribution.",
      },
      {
        title: "Make decision",
        expression: decision,
        detail: "Small p-values give evidence against the null proportion.",
      },
    ],
    artifacts: [
      ["Successes", formatNumber(successes)],
      ["Sample size", formatNumber(total)],
      ["Sample proportion", formatNumber(proportion)],
      ["Null proportion", formatNumber(nullProportion)],
      ["Standard error under H0", formatNumber(standardError)],
      ["z statistic", formatNumber(zStatistic)],
      ["p-value", formatNumber(pValue)],
      ["Cohen's h", formatNumber(cohensH)],
      ["Decision", decision],
    ],
  };
}

function analyzeTwoProportionZTest(statement) {
  const { leftSuccesses, leftTotal, rightSuccesses, rightTotal, alternative, alpha } = parseTwoProportionInput(statement);
  const leftProportion = leftSuccesses / leftTotal;
  const rightProportion = rightSuccesses / rightTotal;
  const difference = leftProportion - rightProportion;
  const pooled = (leftSuccesses + rightSuccesses) / (leftTotal + rightTotal);
  const pooledStandardError = Math.sqrt(pooled * (1 - pooled) * (1 / leftTotal + 1 / rightTotal));
  if (!(pooledStandardError > 0)) {
    throw new Error("Two-proportion z tests need pooled sample variation.");
  }
  const zStatistic = difference / pooledStandardError;
  const pValue = pValueForNormal(zStatistic, alternative);
  const decision = pValue < alpha ? `reject H0 at alpha=${formatNumber(alpha)}` : `fail to reject H0 at alpha=${formatNumber(alpha)}`;
  const unpooledStandardError = Math.sqrt(
    (leftProportion * (1 - leftProportion)) / leftTotal +
    (rightProportion * (1 - rightProportion)) / rightTotal,
  );
  const margin = zCriticalForLevel(0.95) * unpooledStandardError;
  const cohensH = proportionEffectSize(leftProportion, rightProportion);

  return {
    mode: "statistics",
    tree: statsDatasetNode([leftSuccesses, leftTotal, rightSuccesses, rightTotal], [
      statsMetricNode("p1", leftProportion),
      statsMetricNode("p2", rightProportion),
      statsMetricNode("Z", zStatistic),
      statsMetricNode("P", pValue),
    ], "2 PROP"),
    answer: `z = ${formatNumber(zStatistic)}, p = ${formatNumber(pValue)}`,
    summary: "two-proportion z test",
    details: `${alternative} alternative for two population proportions`,
    variables: [],
    metrics: treeMetrics(statsDatasetNode([leftSuccesses, leftTotal, rightSuccesses, rightTotal])),
    steps: [
      {
        title: "Read two proportions",
        expression: `p1-hat = ${formatNumber(leftProportion)}, p2-hat = ${formatNumber(rightProportion)}`,
        detail: "The solver compares two independent sample proportions.",
      },
      {
        title: "Pool under H0",
        expression: `pooled p = ${formatNumber(pooled)}`,
        detail: "The null hypothesis assumes the population proportions are equal.",
      },
      {
        title: "Compute z statistic",
        expression: `z = (${formatNumber(leftProportion)} - ${formatNumber(rightProportion)}) / ${formatNumber(pooledStandardError)} = ${formatNumber(zStatistic)}`,
        detail: "The statistic measures the observed difference in pooled-standard-error units.",
      },
      {
        title: "Approximate p-value",
        expression: `p = ${formatNumber(pValue)}`,
        detail: "The p-value uses the standard normal distribution.",
      },
      {
        title: "Make decision",
        expression: decision,
        detail: "Small p-values suggest the two population proportions differ.",
      },
    ],
    table: {
      headers: ["Group", "Successes", "n", "p-hat"],
      rows: [
        ["1", formatNumber(leftSuccesses), formatNumber(leftTotal), formatNumber(leftProportion)],
        ["2", formatNumber(rightSuccesses), formatNumber(rightTotal), formatNumber(rightProportion)],
      ],
    },
    artifacts: [
      ["Group 1 proportion", formatNumber(leftProportion)],
      ["Group 2 proportion", formatNumber(rightProportion)],
      ["Difference", formatNumber(difference)],
      ["Pooled proportion", formatNumber(pooled)],
      ["Pooled standard error", formatNumber(pooledStandardError)],
      ["z statistic", formatNumber(zStatistic)],
      ["p-value", formatNumber(pValue)],
      ["Cohen's h", formatNumber(cohensH)],
      ["95% CI for difference", `[${formatNumber(difference - margin)}, ${formatNumber(difference + margin)}]`],
      ["Decision", decision],
    ],
  };
}

function analyzeDescriptiveStatistics(statement) {
  const values = parseNumbers(statement);
  if (values.length === 0) {
    throw new Error("Statistics mode needs at least one number.");
  }

  const sorted = [...values].sort((left, right) => left - right);
  const summary = descriptiveSummary(values);
  const steps = [
    {
      title: "Parse dataset",
      expression: values.map(formatNumber).join(", "),
      detail: `The dataset contains ${values.length} values.`,
    },
    {
      title: "Sort values",
      expression: sorted.map(formatNumber).join(", "),
      detail: "Sorting supports median, quartile, and range calculations.",
    },
    {
      title: "Compute center",
      expression: `mean = ${formatNumber(summary.mean)}, median = ${formatNumber(summary.median)}`,
      detail: "Mean uses the arithmetic average; median uses the middle sorted value.",
    },
    {
      title: "Compute spread",
      expression: `sample sd = ${formatNumber(summary.sampleStdDev)}`,
      detail: "Variance and standard deviation measure how far the data are spread out.",
    },
  ];

  return {
    mode: "statistics",
    tree: statsDatasetNode(values, [
      statsMetricNode("MEAN", summary.mean),
      statsMetricNode("MEDIAN", summary.median),
      statsMetricNode("SD", summary.sampleStdDev),
    ]),
    answer: descriptiveAnswer(statement, summary),
    summary: "descriptive statistics",
    details: "Dataset summary",
    variables: [],
    metrics: treeMetrics(statsDatasetNode(values)),
    steps,
    artifacts: [
      ["Count", formatNumber(summary.count)],
      ["Mean", formatNumber(summary.mean)],
      ["Median", formatNumber(summary.median)],
      ["Mode", summary.modes.length ? summary.modes.map(formatNumber).join(", ") : "none"],
      ["Range", formatNumber(summary.range)],
      ["Q1", formatNumber(summary.q1)],
      ["Q3", formatNumber(summary.q3)],
      ["IQR", formatNumber(summary.iqr)],
      ["Population variance", formatNumber(summary.populationVariance)],
      ["Population SD", formatNumber(summary.populationStdDev)],
      ["Sample variance", formatNumber(summary.sampleVariance)],
      ["Sample SD", formatNumber(summary.sampleStdDev)],
    ],
  };
}

function analyzeRegression(statement) {
  const parsedLists = parseXYLists(statement);
  const pairs = parsedLists ? zipPairs(parsedLists.x, parsedLists.y) : parsePairs(statement);

  if (pairs.length < 2) {
    throw new Error("Regression needs at least two coordinate pairs, such as (1,2), (2,3), (3,5).");
  }

  const xValues = pairs.map((pair) => pair.x);
  const yValues = pairs.map((pair) => pair.y);
  const meanX = mean(xValues);
  const meanY = mean(yValues);
  const sxx = xValues.reduce((sum, value) => sum + (value - meanX) ** 2, 0);
  const syy = yValues.reduce((sum, value) => sum + (value - meanY) ** 2, 0);
  const sxy = pairs.reduce((sum, pair) => sum + (pair.x - meanX) * (pair.y - meanY), 0);
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  const r = sxy / Math.sqrt(sxx * syy);
  const rSquared = r ** 2;
  const wantsCorrelation = statement.toLowerCase().includes("correlation") && !statement.toLowerCase().includes("regression");

  const steps = [
    {
      title: "Parse coordinate pairs",
      expression: pairs.map((pair) => `(${formatNumber(pair.x)}, ${formatNumber(pair.y)})`).join(", "),
      detail: "Each point contributes an x-value and a y-value.",
    },
    {
      title: "Compute means",
      expression: `xbar = ${formatNumber(meanX)}, ybar = ${formatNumber(meanY)}`,
      detail: "Regression compares each point to the center of the data.",
    },
    {
      title: "Compute slope and intercept",
      expression: `slope = ${formatNumber(slope)}, intercept = ${formatNumber(intercept)}`,
      detail: "The least-squares line minimizes squared vertical error.",
    },
    {
      title: "Compute correlation",
      expression: `r = ${formatNumber(r)}, r^2 = ${formatNumber(rSquared)}`,
      detail: "Correlation measures linear association from -1 to 1.",
    },
  ];

  return {
    mode: "statistics",
    tree: {
      kind: "statsRegression",
      children: [
        statsDatasetNode(xValues, [], "X"),
        statsDatasetNode(yValues, [], "Y"),
        statsMetricNode("r", r),
      ],
    },
    answer: wantsCorrelation
      ? `r = ${formatNumber(r)}`
      : `y = ${formatNumber(slope)}x ${formatSigned(intercept)}`,
    summary: wantsCorrelation ? "correlation" : "linear regression",
    details: `${pairs.length} paired observations`,
    variables: [],
    metrics: treeMetrics({
      kind: "statsRegression",
      children: [statsDatasetNode(xValues), statsDatasetNode(yValues)],
    }),
    steps,
    artifacts: [
      ["Mean x", formatNumber(meanX)],
      ["Mean y", formatNumber(meanY)],
      ["Slope", formatNumber(slope)],
      ["Intercept", formatNumber(intercept)],
      ["Correlation r", formatNumber(r)],
      ["R squared", formatNumber(rSquared)],
    ],
  };
}

function analyzeBinomial(statement) {
  const params = parseNamedProbabilityParams(statement);
  const n = params.n;
  const p = params.p;
  const k = params.k;

  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0 || k > n) {
    throw new Error("Binomial probability needs integer values with 0 <= k <= n.");
  }
  if (!(p >= 0 && p <= 1)) {
    throw new Error("Binomial probability needs p between 0 and 1.");
  }

  const exact = binomialProbability(n, p, k);
  const atMost = sumRange(0, k, (value) => binomialProbability(n, p, value));
  const atLeast = sumRange(k, n, (value) => binomialProbability(n, p, value));
  const expected = n * p;
  const variance = n * p * (1 - p);

  const steps = [
    {
      title: "Read binomial parameters",
      expression: `n = ${n}, p = ${formatNumber(p)}, k = ${k}`,
      detail: "A binomial model counts successes in independent trials.",
    },
    {
      title: "Apply probability formula",
      expression: "P(X = k) = C(n,k) p^k (1-p)^(n-k)",
      detail: "The combination counts which trials are successes.",
    },
    {
      title: "Compute exact probability",
      expression: `P(X = ${k}) = ${formatNumber(exact)}`,
      detail: "This is the probability of exactly k successes.",
    },
  ];

  return {
    mode: "statistics",
    tree: {
      kind: "statsDistribution",
      label: "BINOMIAL",
      children: [
        statsMetricNode("n", n),
        statsMetricNode("p", p),
        statsMetricNode("k", k),
      ],
    },
    answer: `P(X = ${k}) = ${formatNumber(exact)}`,
    summary: "binomial probability",
    details: "Discrete probability distribution",
    variables: [],
    metrics: treeMetrics({
      kind: "statsDistribution",
      children: [statsMetricNode("n", n), statsMetricNode("p", p), statsMetricNode("k", k)],
    }),
    steps,
    artifacts: [
      [`P(X = ${k})`, formatNumber(exact)],
      [`P(X <= ${k})`, formatNumber(atMost)],
      [`P(X >= ${k})`, formatNumber(atLeast)],
      ["Expected value", formatNumber(expected)],
      ["Variance", formatNumber(variance)],
      ["Standard deviation", formatNumber(Math.sqrt(variance))],
    ],
  };
}

function analyzePoisson(statement) {
  const request = parsePoissonInput(statement);
  const lambda = request.lambda;
  const k = request.k;

  if (!(lambda > 0)) {
    throw new Error("Poisson probability needs lambda greater than 0.");
  }
  if (!Number.isInteger(k) || k < 0) {
    throw new Error("Poisson probability needs a nonnegative integer k.");
  }

  const exact = poissonProbability(lambda, k);
  const atMost = sumRange(0, k, (value) => poissonProbability(lambda, value));
  const below = k === 0 ? 0 : sumRange(0, k - 1, (value) => poissonProbability(lambda, value));
  const atLeast = 1 - below;
  const greater = 1 - atMost;
  const probability = request.tail === "at-most"
    ? atMost
    : request.tail === "less"
      ? below
      : request.tail === "at-least"
        ? atLeast
        : request.tail === "greater"
          ? greater
          : exact;
  const label = poissonProbabilityLabel(request.tail, k);

  return {
    mode: "statistics",
    tree: {
      kind: "statsDistribution",
      label: "POISSON",
      children: [
        statsMetricNode("lambda", lambda),
        statsMetricNode("k", k),
        statsMetricNode("P", probability),
      ],
    },
    answer: `${label} = ${formatNumber(probability)}`,
    summary: "Poisson probability",
    details: "Discrete count distribution",
    variables: [],
    metrics: treeMetrics({
      kind: "statsDistribution",
      children: [statsMetricNode("lambda", lambda), statsMetricNode("k", k)],
    }),
    steps: [
      {
        title: "Read Poisson parameters",
        expression: `lambda = ${formatNumber(lambda)}, k = ${k}`,
        detail: "A Poisson model counts events occurring at a constant average rate.",
      },
      {
        title: "Apply probability formula",
        expression: "P(X = k) = e^-lambda lambda^k / k!",
        detail: "The formula gives the probability of exactly k events.",
      },
      {
        title: "Evaluate requested tail",
        expression: `${label} = ${formatNumber(probability)}`,
        detail: "Cumulative questions sum the exact probabilities over the requested counts.",
      },
    ],
    artifacts: [
      [`P(X = ${k})`, formatNumber(exact)],
      [`P(X <= ${k})`, formatNumber(atMost)],
      [`P(X >= ${k})`, formatNumber(atLeast)],
      ["Expected value", formatNumber(lambda)],
      ["Variance", formatNumber(lambda)],
      ["Standard deviation", formatNumber(Math.sqrt(lambda))],
    ],
  };
}

function analyzeGeometric(statement) {
  const request = parseGeometricInput(statement);
  const p = request.p;
  const k = request.k;

  if (!(p > 0 && p <= 1)) {
    throw new Error("Geometric probability needs p with 0 < p <= 1.");
  }
  if (!Number.isInteger(k) || k < 1) {
    throw new Error("Geometric probability uses trial count k with integer k >= 1.");
  }

  const exact = geometricProbability(p, k);
  const atMost = 1 - (1 - p) ** k;
  const below = k === 1 ? 0 : 1 - (1 - p) ** (k - 1);
  const atLeast = (1 - p) ** (k - 1);
  const greater = (1 - p) ** k;
  const probability = request.tail === "at-most"
    ? atMost
    : request.tail === "less"
      ? below
      : request.tail === "at-least"
        ? atLeast
        : request.tail === "greater"
          ? greater
          : exact;
  const label = poissonProbabilityLabel(request.tail, k);
  const expected = 1 / p;
  const variance = (1 - p) / (p ** 2);

  return {
    mode: "statistics",
    tree: {
      kind: "statsDistribution",
      label: "GEOMETRIC",
      children: [
        statsMetricNode("p", p),
        statsMetricNode("k", k),
        statsMetricNode("P", probability),
      ],
    },
    answer: `${label} = ${formatNumber(probability)}`,
    summary: "geometric probability",
    details: "Trials until first success",
    variables: [],
    metrics: treeMetrics({
      kind: "statsDistribution",
      children: [statsMetricNode("p", p), statsMetricNode("k", k)],
    }),
    steps: [
      {
        title: "Read geometric parameters",
        expression: `p = ${formatNumber(p)}, k = ${k}`,
        detail: "A geometric model counts the trial on which the first success occurs.",
      },
      {
        title: "Apply probability formula",
        expression: "P(X = k) = (1-p)^(k-1) p",
        detail: "The first k-1 trials fail and the kth trial succeeds.",
      },
      {
        title: "Evaluate requested tail",
        expression: `${label} = ${formatNumber(probability)}`,
        detail: "Cumulative questions use the geometric series for repeated failures.",
      },
    ],
    artifacts: [
      [`P(X = ${k})`, formatNumber(exact)],
      [`P(X <= ${k})`, formatNumber(atMost)],
      [`P(X >= ${k})`, formatNumber(atLeast)],
      ["Expected value", formatNumber(expected)],
      ["Variance", formatNumber(variance)],
      ["Standard deviation", formatNumber(Math.sqrt(variance))],
    ],
  };
}

function analyzeExponential(statement) {
  const request = parseExponentialInput(statement);
  const lambda = request.lambda;
  const x = request.x;

  if (!(lambda > 0)) {
    throw new Error("Exponential probability needs lambda greater than 0, or a positive mean.");
  }
  if (!(x >= 0)) {
    throw new Error("Exponential probability needs x >= 0.");
  }

  const leftTail = 1 - Math.exp(-lambda * x);
  const rightTail = Math.exp(-lambda * x);
  const probability = request.tail === "greater" || request.tail === "at-least" ? rightTail : leftTail;
  const label = request.tail === "greater" || request.tail === "at-least"
    ? `P(X > ${formatNumber(x)})`
    : `P(X <= ${formatNumber(x)})`;
  const expected = 1 / lambda;
  const variance = 1 / (lambda ** 2);

  return {
    mode: "statistics",
    tree: {
      kind: "statsDistribution",
      label: "EXPONENTIAL",
      children: [
        statsMetricNode("lambda", lambda),
        statsMetricNode("x", x),
        statsMetricNode("P", probability),
      ],
    },
    answer: `${label} = ${formatNumber(probability)}`,
    summary: "exponential probability",
    details: "Continuous waiting-time distribution",
    variables: [],
    metrics: treeMetrics({
      kind: "statsDistribution",
      children: [statsMetricNode("lambda", lambda), statsMetricNode("x", x)],
    }),
    steps: [
      {
        title: "Read exponential parameters",
        expression: `lambda = ${formatNumber(lambda)}, x = ${formatNumber(x)}`,
        detail: "An exponential model measures waiting time between events.",
      },
      {
        title: "Evaluate CDF or survival function",
        expression: request.tail === "greater" || request.tail === "at-least"
          ? "P(X > x) = e^(-lambda x)"
          : "P(X <= x) = 1 - e^(-lambda x)",
        detail: "Continuous tail probabilities come from the exponential curve.",
      },
      {
        title: "Report probability",
        expression: `${label} = ${formatNumber(probability)}`,
        detail: "The solver also reports the distribution moments.",
      },
    ],
    artifacts: [
      [`P(X <= ${formatNumber(x)})`, formatNumber(leftTail)],
      [`P(X > ${formatNumber(x)})`, formatNumber(rightTail)],
      ["Expected value", formatNumber(expected)],
      ["Variance", formatNumber(variance)],
      ["Standard deviation", formatNumber(Math.sqrt(variance))],
    ],
  };
}

function analyzeUniform(statement) {
  const request = parseUniformInput(statement);
  const min = request.min;
  const max = request.max;

  if (!(max > min)) {
    throw new Error("Uniform probability needs max greater than min.");
  }

  const width = max - min;
  const density = 1 / width;
  let probability;
  let label;
  let expression;
  if (request.interval) {
    const lower = Math.max(min, Math.min(request.interval.left, request.interval.right));
    const upper = Math.min(max, Math.max(request.interval.left, request.interval.right));
    probability = Math.max(0, upper - lower) / width;
    label = `P(${formatNumber(request.interval.left)} <= X <= ${formatNumber(request.interval.right)})`;
    expression = "P(a <= X <= b) = interval length / total length";
  } else if (request.tail === "greater" || request.tail === "at-least") {
    probability = clampProbability((max - request.x) / width);
    label = `P(X > ${formatNumber(request.x)})`;
    expression = "P(X > x) = (max - x) / (max - min)";
  } else {
    probability = clampProbability((request.x - min) / width);
    label = `P(X <= ${formatNumber(request.x)})`;
    expression = "P(X <= x) = (x - min) / (max - min)";
  }
  const expected = (min + max) / 2;
  const variance = width ** 2 / 12;

  return {
    mode: "statistics",
    tree: {
      kind: "statsDistribution",
      label: "UNIFORM",
      children: [
        statsMetricNode("min", min),
        statsMetricNode("max", max),
        statsMetricNode("P", probability),
      ],
    },
    answer: `${label} = ${formatNumber(probability)}`,
    summary: "uniform probability",
    details: "Continuous equal-density distribution",
    variables: [],
    metrics: treeMetrics({
      kind: "statsDistribution",
      children: [statsMetricNode("min", min), statsMetricNode("max", max)],
    }),
    steps: [
      {
        title: "Read uniform interval",
        expression: `[${formatNumber(min)}, ${formatNumber(max)}]`,
        detail: "A uniform model gives every equal-length subinterval the same probability.",
      },
      {
        title: "Compute length ratio",
        expression,
        detail: "The probability is a length inside the interval divided by total interval length.",
      },
      {
        title: "Report probability",
        expression: `${label} = ${formatNumber(probability)}`,
        detail: "The solver clamps probabilities to the valid support of the distribution.",
      },
    ],
    artifacts: [
      [label, formatNumber(probability)],
      ["Density", formatNumber(density)],
      ["Expected value", formatNumber(expected)],
      ["Variance", formatNumber(variance)],
      ["Standard deviation", formatNumber(Math.sqrt(variance))],
    ],
  };
}

function analyzeDiscreteDistribution(statement) {
  const { values, probabilities } = parseDiscreteDistributionInput(statement);
  const expectedValue = values.reduce((sum, value, index) => sum + value * probabilities[index], 0);
  const variance = values.reduce((sum, value, index) => sum + probabilities[index] * (value - expectedValue) ** 2, 0);
  const standardDeviation = Math.sqrt(variance);
  let cumulative = 0;
  const rows = values.map((value, index) => {
    cumulative += probabilities[index];
    return [
      formatNumber(value),
      formatNumber(probabilities[index]),
      formatNumber(value * probabilities[index]),
      formatNumber(cumulative),
    ];
  });

  return {
    mode: "statistics",
    tree: {
      kind: "statsDistribution",
      label: "DISCRETE",
      children: [
        statsMetricNode("E[X]", expectedValue),
        statsMetricNode("VAR", variance),
        statsMetricNode("SD", standardDeviation),
      ],
    },
    answer: `E(X) = ${formatNumber(expectedValue)}, Var(X) = ${formatNumber(variance)}`,
    summary: "discrete expected value",
    details: "Expected value and variance from a probability mass function",
    variables: [],
    metrics: treeMetrics({
      kind: "statsDistribution",
      children: values.map((value, index) => statsMetricNode(formatNumber(value), probabilities[index])),
    }),
    steps: [
      {
        title: "Read probability mass function",
        expression: values.map((value, index) => `${formatNumber(value)}:${formatNumber(probabilities[index])}`).join(", "),
        detail: "Each outcome is paired with its probability.",
      },
      {
        title: "Compute expected value",
        expression: `E(X) = sum x p(x) = ${formatNumber(expectedValue)}`,
        detail: "Expected value is the long-run weighted average outcome.",
      },
      {
        title: "Compute variance",
        expression: `Var(X) = sum p(x)(x - E(X))^2 = ${formatNumber(variance)}`,
        detail: "Variance measures the weighted squared distance from the expected value.",
      },
    ],
    table: {
      headers: ["Outcome", "Probability", "x p(x)", "Cumulative"],
      rows,
    },
    artifacts: [
      ["Expected value", formatNumber(expectedValue)],
      ["Variance", formatNumber(variance)],
      ["Standard deviation", formatNumber(standardDeviation)],
    ],
  };
}

function analyzeBayes(statement) {
  const { prior, sensitivity, falsePositiveRate, specificity } = parseBayesInput(statement);
  const truePositiveMass = sensitivity * prior;
  const falsePositiveMass = falsePositiveRate * (1 - prior);
  const positiveProbability = truePositiveMass + falsePositiveMass;
  const posteriorPositive = truePositiveMass / positiveProbability;
  const falseNegativeMass = (1 - sensitivity) * prior;
  const trueNegativeMass = specificity * (1 - prior);
  const negativeProbability = falseNegativeMass + trueNegativeMass;
  const posteriorNegative = negativeProbability > 0 ? falseNegativeMass / negativeProbability : Number.NaN;
  const likelihoodRatioPositive = falsePositiveRate > 0 ? sensitivity / falsePositiveRate : Infinity;
  const likelihoodRatioPositiveText = falsePositiveRate > 0 ? formatNumber(likelihoodRatioPositive) : "infinity";

  return {
    mode: "statistics",
    tree: {
      kind: "statsDistribution",
      label: "BAYES",
      children: [
        statsMetricNode("PRIOR", prior),
        statsMetricNode("TPR", sensitivity),
        statsMetricNode("FPR", falsePositiveRate),
        statsMetricNode("POST", posteriorPositive),
      ],
    },
    answer: `P(H | positive) = ${formatNumber(posteriorPositive)}`,
    summary: "Bayes theorem",
    details: "Posterior probability after a positive test",
    variables: [],
    metrics: treeMetrics({
      kind: "statsDistribution",
      children: [
        statsMetricNode("prior", prior),
        statsMetricNode("sensitivity", sensitivity),
        statsMetricNode("false positive", falsePositiveRate),
      ],
    }),
    steps: [
      {
        title: "Read prior and test rates",
        expression: `prior = ${formatNumber(prior)}, sensitivity = ${formatNumber(sensitivity)}, specificity = ${formatNumber(specificity)}`,
        detail: "Bayes theorem updates a prior probability after observing test evidence.",
      },
      {
        title: "Compute positive evidence",
        expression: `P(positive) = ${formatNumber(truePositiveMass)} + ${formatNumber(falsePositiveMass)} = ${formatNumber(positiveProbability)}`,
        detail: "Positive results can come from true positives or false positives.",
      },
      {
        title: "Apply Bayes theorem",
        expression: `P(H | positive) = ${formatNumber(truePositiveMass)} / ${formatNumber(positiveProbability)} = ${formatNumber(posteriorPositive)}`,
        detail: "The posterior divides true-positive probability mass by all positive probability mass.",
      },
    ],
    table: {
      headers: ["Event", "Probability mass"],
      rows: [
        ["true positive", formatNumber(truePositiveMass)],
        ["false positive", formatNumber(falsePositiveMass)],
        ["positive result", formatNumber(positiveProbability)],
        ["false negative", formatNumber(falseNegativeMass)],
        ["true negative", formatNumber(trueNegativeMass)],
      ],
    },
    artifacts: [
      ["Prior P(H)", formatNumber(prior)],
      ["Sensitivity P(+|H)", formatNumber(sensitivity)],
      ["Specificity P(-|not H)", formatNumber(specificity)],
      ["False positive rate", formatNumber(falsePositiveRate)],
      ["P(positive)", formatNumber(positiveProbability)],
      ["P(H | positive)", formatNumber(posteriorPositive)],
      ["P(H | negative)", formatNumber(posteriorNegative)],
      ["Positive likelihood ratio", likelihoodRatioPositiveText],
    ],
  };
}

function analyzeNormalDistribution(statement) {
  const numbers = parseNumbers(statement);
  const meanValue = readNamedNumber(statement, ["mean", "mu"], numbers[0] ?? 0);
  const sdValue = readNamedNumber(statement, ["sd", "sigma", "std"], numbers.length >= 3 ? numbers[1] : 1);
  const xValue = readNamedNumber(statement, ["x", "value"], numbers.length >= 3 ? numbers[2] : numbers[0]);

  if (!Number.isFinite(xValue)) {
    throw new Error("Normal distribution needs a value, such as normal mean=0 sd=1 x=1.96.");
  }
  if (!(sdValue > 0)) {
    throw new Error("Normal distribution needs a positive standard deviation.");
  }

  const z = (xValue - meanValue) / sdValue;
  const leftTail = normalCdf(z);
  const rightTail = 1 - leftTail;

  return {
    mode: "statistics",
    tree: {
      kind: "statsDistribution",
      label: "NORMAL",
      children: [
        statsMetricNode("mu", meanValue),
        statsMetricNode("sd", sdValue),
        statsMetricNode("x", xValue),
        statsMetricNode("z", z),
      ],
    },
    answer: `P(X <= ${formatNumber(xValue)}) = ${formatNumber(leftTail)}`,
    summary: "normal probability",
    details: "Continuous probability distribution",
    variables: [],
    metrics: treeMetrics({
      kind: "statsDistribution",
      children: [statsMetricNode("mu", meanValue), statsMetricNode("sd", sdValue), statsMetricNode("x", xValue)],
    }),
    steps: [
      {
        title: "Read normal parameters",
        expression: `mean = ${formatNumber(meanValue)}, sd = ${formatNumber(sdValue)}, x = ${formatNumber(xValue)}`,
        detail: "A normal model uses a mean and standard deviation.",
      },
      {
        title: "Convert to z-score",
        expression: `z = (x - mean) / sd = ${formatNumber(z)}`,
        detail: "The z-score measures how many standard deviations x is from the mean.",
      },
      {
        title: "Evaluate normal CDF",
        expression: `P(X <= ${formatNumber(xValue)}) = ${formatNumber(leftTail)}`,
        detail: "The cumulative distribution function gives left-tail probability.",
      },
    ],
    artifacts: [
      ["z-score", formatNumber(z)],
      [`P(X <= ${formatNumber(xValue)})`, formatNumber(leftTail)],
      [`P(X > ${formatNumber(xValue)})`, formatNumber(rightTail)],
    ],
  };
}

function analyzeInverseNormal(statement) {
  const request = parseInverseNormalInput(statement);
  const z = inverseNormalCdf(request.probability);
  const x = request.mean + request.sd * z;

  return {
    mode: "statistics",
    tree: {
      kind: "statsDistribution",
      label: "INV NORMAL",
      children: [
        statsMetricNode("p", request.probability),
        statsMetricNode("mu", request.mean),
        statsMetricNode("sd", request.sd),
        statsMetricNode("x", x),
      ],
    },
    answer: `x = ${formatNumber(x)}`,
    summary: "inverse normal",
    details: "Normal percentile or critical value",
    variables: [],
    metrics: treeMetrics({
      kind: "statsDistribution",
      children: [statsMetricNode("p", request.probability), statsMetricNode("mu", request.mean), statsMetricNode("sd", request.sd)],
    }),
    steps: [
      {
        title: "Read inverse-normal request",
        expression: `P(X <= x) = ${formatNumber(request.probability)}`,
        detail: "The solver finds the value x that leaves the requested probability to the left.",
      },
      {
        title: "Find standard-normal quantile",
        expression: `z = ${formatNumber(z)}`,
        detail: "Binary search inverts the standard normal CDF.",
      },
      {
        title: "Scale to requested normal distribution",
        expression: `x = mean + z*sd = ${formatNumber(x)}`,
        detail: "The standard-normal value is converted back to the original units.",
      },
    ],
    artifacts: [
      ["Left-tail probability", formatNumber(request.probability)],
      ["z critical", formatNumber(z)],
      ["Mean", formatNumber(request.mean)],
      ["Standard deviation", formatNumber(request.sd)],
      ["x value", formatNumber(x)],
    ],
  };
}

function analyzeZScore(statement) {
  const numbers = parseNumbers(statement);
  const value = readNamedNumber(statement, ["value", "x"], numbers[0]);
  const meanValue = readNamedNumber(statement, ["mean", "mu"], numbers[1]);
  const sdValue = readNamedNumber(statement, ["sd", "sigma", "std"], numbers[2]);

  if (![value, meanValue, sdValue].every(Number.isFinite)) {
    throw new Error("Use zscore value=85 mean=70 sd=10.");
  }
  if (!(sdValue > 0)) {
    throw new Error("z-score needs a positive standard deviation.");
  }

  const z = (value - meanValue) / sdValue;
  const percentile = normalCdf(z);

  return {
    mode: "statistics",
    tree: {
      kind: "statsDistribution",
      label: "ZSCORE",
      children: [
        statsMetricNode("x", value),
        statsMetricNode("mu", meanValue),
        statsMetricNode("sd", sdValue),
        statsMetricNode("z", z),
      ],
    },
    answer: `z = ${formatNumber(z)}`,
    summary: "z-score",
    details: "Standardized value",
    variables: [],
    metrics: treeMetrics({
      kind: "statsDistribution",
      children: [statsMetricNode("x", value), statsMetricNode("mu", meanValue), statsMetricNode("sd", sdValue)],
    }),
    steps: [
      {
        title: "Read z-score inputs",
        expression: `x = ${formatNumber(value)}, mean = ${formatNumber(meanValue)}, sd = ${formatNumber(sdValue)}`,
        detail: "A z-score standardizes a value relative to a distribution.",
      },
      {
        title: "Standardize",
        expression: `z = (x - mean) / sd = ${formatNumber(z)}`,
        detail: "Positive z-scores are above the mean; negative z-scores are below it.",
      },
    ],
    artifacts: [
      ["z-score", formatNumber(z)],
      ["Approx percentile", formatNumber(percentile)],
    ],
  };
}

function analyzeConfidenceInterval(statement) {
  const { level, values } = parseConfidenceInput(statement);
  if (values.length < 2) {
    throw new Error("Confidence intervals need at least two data values.");
  }

  const summary = descriptiveSummary(values);
  const critical = zCriticalForLevel(level);
  const standardError = summary.sampleStdDev / Math.sqrt(summary.count);
  const margin = critical * standardError;
  const lower = summary.mean - margin;
  const upper = summary.mean + margin;
  const percent = formatNumber(level * 100);

  return {
    mode: "statistics",
    tree: statsDatasetNode(values, [
      statsMetricNode("MEAN", summary.mean),
      statsMetricNode("SE", standardError),
      statsMetricNode("CI", margin),
    ]),
    answer: `${percent}% CI = [${formatNumber(lower)}, ${formatNumber(upper)}]`,
    summary: "confidence interval",
    details: "Mean confidence interval using a normal critical value",
    variables: [],
    metrics: treeMetrics(statsDatasetNode(values)),
    steps: [
      {
        title: "Parse confidence request",
        expression: `${percent}% confidence, n = ${summary.count}`,
        detail: "The solver extracts the confidence level and dataset.",
      },
      {
        title: "Compute center and spread",
        expression: `mean = ${formatNumber(summary.mean)}, sample sd = ${formatNumber(summary.sampleStdDev)}`,
        detail: "The confidence interval is centered at the sample mean.",
      },
      {
        title: "Compute standard error",
        expression: `SE = sd / sqrt(n) = ${formatNumber(standardError)}`,
        detail: "Standard error estimates the variability of the sample mean.",
      },
      {
        title: "Build interval",
        expression: `${formatNumber(summary.mean)} +/- ${formatNumber(margin)}`,
        detail: "The margin of error is critical value times standard error.",
      },
    ],
    artifacts: [
      ["Confidence level", `${percent}%`],
      ["Mean", formatNumber(summary.mean)],
      ["Sample SD", formatNumber(summary.sampleStdDev)],
      ["Standard error", formatNumber(standardError)],
      ["Critical value", formatNumber(critical)],
      ["Margin of error", formatNumber(margin)],
      ["Lower bound", formatNumber(lower)],
      ["Upper bound", formatNumber(upper)],
    ],
  };
}

function extractMatrices(text) {
  const matrices = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "[" && text[index + 1] === "[") {
      let depth = 0;
      const start = index;
      for (; index < text.length; index += 1) {
        if (text[index] === "[") depth += 1;
        if (text[index] === "]") depth -= 1;
        if (depth === 0) {
          const literal = text.slice(start, index + 1);
          matrices.push(parseMatrixLiteral(literal));
          break;
        }
      }
    }
  }
  return matrices;
}

function parseMatrixLiteral(literal) {
  let matrix;
  try {
    matrix = JSON.parse(literal);
  } catch {
    throw new Error(`Invalid matrix notation '${literal}'. Use [[1,2],[3,4]].`);
  }

  if (
    !Array.isArray(matrix) ||
    matrix.length === 0 ||
    matrix.some((row) => !Array.isArray(row) || row.length !== matrix[0].length)
  ) {
    throw new Error("Matrix rows must be rectangular.");
  }

  return matrix.map((row) => row.map((value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new Error("Matrix entries must be numbers.");
    }
    return number;
  }));
}

function matrixShape(matrix) {
  return `${matrix.length}x${matrix[0].length}`;
}

function formatMatrix(matrix) {
  return `[${matrix.map((row) => `[${row.map(formatNumber).join(", ")}]`).join(", ")}]`;
}

function formatVector(vector) {
  return `[${vector.map(formatNumber).join(", ")}]`;
}

function formatVectorList(vectors) {
  return `[${vectors.map(formatVector).join(", ")}]`;
}

function matrixNode(label, matrix) {
  return {
    kind: "matrix",
    label,
    children: matrix.map((row, index) => ({
      kind: "matrixRow",
      label: `R${index + 1}`,
      children: row.map((value) => statsMetricNode("VALUE", value)),
    })),
  };
}

function multiplyMatrices(left, right) {
  if (left[0].length !== right.length) {
    throw new Error("Matrix multiplication requires columns of A to equal rows of B.");
  }

  return left.map((row) =>
    right[0].map((_, columnIndex) =>
      row.reduce((sum, value, index) => sum + value * right[index][columnIndex], 0),
    ),
  );
}

function determinant(matrix) {
  if (matrix.length !== matrix[0].length) {
    throw new Error("Determinants require a square matrix.");
  }
  if (matrix.length === 1) return matrix[0][0];
  if (matrix.length === 2) return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];

  return matrix[0].reduce((sum, value, column) => {
    const minor = matrix.slice(1).map((row) => row.filter((_, index) => index !== column));
    return sum + (column % 2 === 0 ? 1 : -1) * value * determinant(minor);
  }, 0);
}

function invertMatrix(matrix) {
  if (matrix.length !== matrix[0].length) {
    throw new Error("Matrix inverse requires a square matrix.");
  }

  const size = matrix.length;
  const augmented = matrix.map((row, rowIndex) => [
    ...row,
    ...Array.from({ length: size }, (_, columnIndex) => (rowIndex === columnIndex ? 1 : 0)),
  ]);

  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) {
        pivot = row;
      }
    }
    if (nearlyEqual(augmented[pivot][column], 0)) {
      throw new Error("Matrix is singular and has no inverse.");
    }

    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const pivotValue = augmented[column][column];
    for (let col = 0; col < 2 * size; col += 1) {
      augmented[column][col] /= pivotValue;
    }
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let col = 0; col < 2 * size; col += 1) {
        augmented[row][col] -= factor * augmented[column][col];
      }
    }
  }

  return augmented.map((row) => row.slice(size).map(normalizeNumber));
}

function rowReduceMatrix(matrix) {
  const rref = matrix.map((row) => row.map((value) => Number(value)));
  const rowCount = rref.length;
  const columnCount = rref[0].length;
  const pivots = [];
  let leadRow = 0;

  for (let column = 0; column < columnCount && leadRow < rowCount; column += 1) {
    let pivot = leadRow;
    for (let row = leadRow + 1; row < rowCount; row += 1) {
      if (Math.abs(rref[row][column]) > Math.abs(rref[pivot][column])) {
        pivot = row;
      }
    }
    if (nearlyEqual(rref[pivot][column], 0)) {
      continue;
    }

    [rref[leadRow], rref[pivot]] = [rref[pivot], rref[leadRow]];
    const pivotValue = rref[leadRow][column];
    for (let col = 0; col < columnCount; col += 1) {
      rref[leadRow][col] /= pivotValue;
    }

    for (let row = 0; row < rowCount; row += 1) {
      if (row === leadRow) continue;
      const factor = rref[row][column];
      for (let col = 0; col < columnCount; col += 1) {
        rref[row][col] -= factor * rref[leadRow][col];
      }
    }

    pivots.push(column);
    leadRow += 1;
  }

  return {
    rref: rref.map((row) => row.map(normalizeNumber)),
    rank: pivots.length,
    pivots,
  };
}

function nullSpaceBasis(matrix) {
  const reduced = rowReduceMatrix(matrix);
  const columnCount = matrix[0].length;
  const pivotSet = new Set(reduced.pivots);
  const freeColumns = Array.from({ length: columnCount }, (_, index) => index)
    .filter((index) => !pivotSet.has(index));

  const basis = freeColumns.map((freeColumn) => {
    const vector = Array(columnCount).fill(0);
    vector[freeColumn] = 1;
    reduced.pivots.forEach((pivotColumn, rowIndex) => {
      vector[pivotColumn] = -reduced.rref[rowIndex][freeColumn];
    });
    return vector.map(normalizeNumber);
  });

  return {
    ...reduced,
    freeColumns,
    basis,
  };
}

function eigenvalues2x2(matrix) {
  if (matrix.length !== 2 || matrix[0].length !== 2) {
    throw new Error("Eigenvalue mode currently supports 2x2 matrices.");
  }

  const trace = matrix[0][0] + matrix[1][1];
  const det = determinant(matrix);
  const discriminant = trace ** 2 - 4 * det;
  if (discriminant >= -EPSILON) {
    const root = Math.sqrt(Math.max(0, discriminant));
    return [
      formatNumber((trace + root) / 2),
      formatNumber((trace - root) / 2),
    ];
  }

  const real = trace / 2;
  const imaginary = Math.sqrt(-discriminant) / 2;
  return [
    `${formatNumber(real)} + ${formatNumber(imaginary)}i`,
    `${formatNumber(real)} - ${formatNumber(imaginary)}i`,
  ];
}

function eigenvectors2x2(matrix) {
  const eigenvalues = realEigenvalues2x2(matrix);
  return eigenvalues.map((lambda) => {
    const shifted = matrix.map((row, rowIndex) =>
      row.map((value, columnIndex) => value - (rowIndex === columnIndex ? lambda : 0)),
    );
    const nullSpace = nullSpaceBasis(shifted);
    if (nullSpace.basis.length === 0) {
      throw new Error("Could not find a nonzero eigenvector.");
    }
    return {
      lambda: formatNumber(lambda),
      basis: nullSpace.basis.map(normalizeVector),
    };
  });
}

function realEigenvalues2x2(matrix) {
  if (matrix.length !== 2 || matrix[0].length !== 2) {
    throw new Error("Eigenvector mode currently supports 2x2 matrices.");
  }

  const trace = matrix[0][0] + matrix[1][1];
  const det = determinant(matrix);
  const discriminant = trace ** 2 - 4 * det;
  if (discriminant < -EPSILON) {
    throw new Error("Eigenvector mode currently supports real 2x2 eigenvalues.");
  }
  const root = Math.sqrt(Math.max(0, discriminant));
  return uniqueSortedNumbers([
    normalizeNumber((trace + root) / 2),
    normalizeNumber((trace - root) / 2),
  ]).sort((left, right) => right - left);
}

function normalizeVector(vector) {
  const firstNonzero = vector.find((value) => !nearlyEqual(value, 0));
  if (firstNonzero === undefined || firstNonzero > 0) {
    return vector.map(normalizeNumber);
  }
  return vector.map((value) => normalizeNumber(-value));
}

function extractIntegralQuestion(statement, fallbackVariable) {
  let text = statement
    .replace(/^(integrate|definite integral of|definite integral|integral of|find the integral of|antiderivative of)\s+/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
  let variable = fallbackVariable;
  let lower = null;
  let upper = null;

  const boundsMatch = text.match(/\b(?:from|between)\s+([-+]?\d*\.?\d+)\s+(?:to|,)\s+([-+]?\d*\.?\d+)/i);
  if (boundsMatch) {
    lower = Number(boundsMatch[1]);
    upper = Number(boundsMatch[2]);
    text = text.replace(boundsMatch[0], "").trim();
  }

  const respectMatch = text.match(/\b(?:with respect to|wrt)\s+([A-Za-z_]\w*)/i);
  const dxMatch = text.match(/\bd([A-Za-z_]\w*)\b/i);
  if (respectMatch) {
    variable = respectMatch[1];
    text = text.replace(respectMatch[0], "").trim();
  } else if (dxMatch) {
    variable = dxMatch[1];
    text = text.replace(dxMatch[0], "").trim();
  }

  return {
    expression: text,
    variable,
    lower,
    upper,
  };
}

function integratePolynomial(poly, variable) {
  const result = new Map();
  for (const [key, coefficient] of poly.entries()) {
    const powers = powersFromKey(key);
    for (const otherVariable of Object.keys(powers)) {
      if (otherVariable !== variable) {
        throw new Error("Integral mode currently supports one-variable polynomials.");
      }
    }
    const currentPower = powers[variable] ?? 0;
    powers[variable] = currentPower + 1;
    result.set(monomialKey(powers), coefficient / (currentPower + 1));
  }
  return cleanPolynomial(result);
}

function integrateSymbolic(node, variable) {
  const polynomial = polynomialFrom(node);
  if (polynomial) {
    return integratePolynomialSymbolic(polynomial, variable);
  }

  if (node.kind === "mathUnary") {
    const inner = integrateSymbolic(node.operand, variable);
    return inner ? scaleIntegral(inner, -1) : null;
  }

  if (node.kind === "mathFunction") {
    return integrateFunction(node, variable);
  }

  if (node.kind !== "mathBinary") {
    return null;
  }

  if (node.operator === "+" || node.operator === "-") {
    const left = integrateSymbolic(node.left, variable);
    const right = integrateSymbolic(node.right, variable);
    return left && right ? combineIntegrals(left, right, node.operator) : null;
  }

  if (node.operator === "*") {
    const leftConstant = numericConstantValue(node.left);
    if (Number.isFinite(leftConstant)) {
      const right = integrateSymbolic(node.right, variable);
      return right ? scaleIntegral(right, leftConstant) : null;
    }

    const rightConstant = numericConstantValue(node.right);
    if (Number.isFinite(rightConstant)) {
      const left = integrateSymbolic(node.left, variable);
      return left ? scaleIntegral(left, rightConstant) : null;
    }
  }

  if (node.operator === "/") {
    const denominatorConstant = numericConstantValue(node.right);
    if (Number.isFinite(denominatorConstant) && !nearlyEqual(denominatorConstant, 0)) {
      const numerator = integrateSymbolic(node.left, variable);
      return numerator ? scaleIntegral(numerator, 1 / denominatorConstant) : null;
    }

    return integrateReciprocal(node.left, node.right, variable);
  }

  if (node.operator === "^" && isMinusOnePowerOfVariable(node, variable)) {
    return integrateReciprocal(mathNumber(1), node.left, variable);
  }

  return null;
}

function integratePolynomialSymbolic(poly, variable) {
  const integral = integratePolynomial(poly, variable);
  const coefficients = polynomialCoefficients(integral, variable);
  return {
    antiderivative: formatPolynomial(integral),
    evaluate: (x) => evaluatePolynomialCoefficients(coefficients, x),
    title: "Apply power rule for integrals",
    detail: "Each x^n term becomes x^(n+1)/(n+1).",
  };
}

function integrateFunction(node, variable) {
  const argument = linearArgumentInfo(node.argument, variable);
  if (!argument) {
    return null;
  }

  const scale = 1 / argument.slope;
  const text = argument.text;
  const valueAt = (x) => argument.slope * x + argument.intercept;

  if (node.name === "sin") {
    return elementaryIntegral(formatScaledAntiderivative(-scale, `cos(${text})`), (x) => -scale * Math.cos(valueAt(x)));
  }
  if (node.name === "cos") {
    return elementaryIntegral(formatScaledAntiderivative(scale, `sin(${text})`), (x) => scale * Math.sin(valueAt(x)));
  }
  if (node.name === "tan") {
    return elementaryIntegral(
      formatScaledAntiderivative(-scale, `ln(abs(cos(${text})))`),
      (x) => -scale * Math.log(Math.abs(Math.cos(valueAt(x)))),
    );
  }
  if (node.name === "exp") {
    return elementaryIntegral(formatScaledAntiderivative(scale, `exp(${text})`), (x) => scale * Math.exp(valueAt(x)));
  }
  if (node.name === "ln") {
    const body = `${formatProductFactor(text)}ln(abs(${text})) - ${formatProductFactor(text)}`;
    return elementaryIntegral(
      formatScaledAntiderivative(scale, body),
      (x) => scale * (valueAt(x) * Math.log(Math.abs(valueAt(x))) - valueAt(x)),
      reciprocalBoundsValidator(argument.singularity, "ln has a domain break where its argument is 0."),
    );
  }
  if (node.name === "sqrt") {
    return elementaryIntegral(
      formatScaledAntiderivative((2 * scale) / 3, `${formatPowerBase(text)}^(3/2)`),
      (x) => ((2 * scale) / 3) * valueAt(x) ** 1.5,
      (lower, upper) => {
        if (valueAt(lower) < 0 || valueAt(upper) < 0) {
          throw new Error("sqrt integrals need bounds where the linear argument stays nonnegative.");
        }
      },
    );
  }

  return null;
}

function integrateReciprocal(numeratorNode, denominatorNode, variable) {
  const numerator = numericConstantValue(numeratorNode);
  const denominator = linearArgumentInfo(denominatorNode, variable);
  if (!Number.isFinite(numerator) || !denominator) {
    return null;
  }

  const scale = numerator / denominator.slope;
  return elementaryIntegral(
    formatScaledAntiderivative(scale, `ln(abs(${denominator.text}))`),
    (x) => scale * Math.log(Math.abs(denominator.slope * x + denominator.intercept)),
    reciprocalBoundsValidator(denominator.singularity, "Definite reciprocal integrals cannot cross a zero denominator."),
  );
}

function elementaryIntegral(antiderivative, evaluate, validateBounds = null) {
  return {
    antiderivative,
    evaluate,
    validateBounds,
    title: "Apply elementary integral rules",
    detail: "Use linearity plus standard antiderivatives for trig, exponential, logarithmic, square-root, and reciprocal forms.",
  };
}

function combineIntegrals(left, right, operator) {
  return {
    antiderivative: formatAntiderivativeSum(left.antiderivative, right.antiderivative, operator),
    evaluate: (x) => operator === "+" ? left.evaluate(x) + right.evaluate(x) : left.evaluate(x) - right.evaluate(x),
    validateBounds: combineBoundsValidators(left, right),
    title: "Apply linearity of integrals",
    detail: "Integrate sums, differences, and constant multiples term by term.",
  };
}

function scaleIntegral(integral, scalar) {
  return {
    antiderivative: formatScaledAntiderivative(scalar, integral.antiderivative),
    evaluate: (x) => scalar * integral.evaluate(x),
    validateBounds: integral.validateBounds,
    title: "Apply constant multiple rule",
    detail: "A numeric coefficient can be pulled outside the integral.",
  };
}

function linearArgumentInfo(node, variable) {
  const polynomial = polynomialFrom(node);
  if (!polynomial) {
    return null;
  }

  const coefficients = polynomialCoefficients(polynomial, variable);
  if (
    coefficients.length === 0 ||
    coefficients.length > 2 ||
    coefficients.slice(2).some((coefficient) => !nearlyEqual(coefficient, 0))
  ) {
    return null;
  }

  const intercept = coefficients[0] ?? 0;
  const slope = coefficients[1] ?? 0;
  if (nearlyEqual(slope, 0)) {
    return null;
  }

  return {
    slope,
    intercept,
    singularity: -intercept / slope,
    text: formatMath(node),
  };
}

function numericConstantValue(node) {
  if (node.kind === "mathNumber") {
    return node.value;
  }
  if (node.kind === "mathUnary") {
    const value = numericConstantValue(node.operand);
    return Number.isFinite(value) ? -value : Number.NaN;
  }
  return Number.NaN;
}

function isMinusOnePowerOfVariable(node, variable) {
  return isVariableNode(node.left, variable) && nearlyEqual(numericConstantValue(node.right), -1);
}

function isVariableNode(node, variable) {
  return node.kind === "mathSymbol" && node.name === variable;
}

function combineBoundsValidators(left, right) {
  if (!left.validateBounds && !right.validateBounds) {
    return null;
  }
  return (lower, upper) => {
    if (left.validateBounds) left.validateBounds(lower, upper);
    if (right.validateBounds) right.validateBounds(lower, upper);
  };
}

function reciprocalBoundsValidator(singularity, message) {
  return (lower, upper) => {
    if (isBetweenInclusive(singularity, lower, upper)) {
      throw new Error(message);
    }
  };
}

function isBetweenInclusive(value, left, right) {
  const low = Math.min(left, right);
  const high = Math.max(left, right);
  return value >= low - EPSILON && value <= high + EPSILON;
}

function formatAntiderivativeSum(left, right, operator) {
  if (right === "0") return left;
  if (left === "0") return operator === "+" ? right : formatScaledAntiderivative(-1, right);

  if (operator === "+") {
    if (right.startsWith("-") && isSimpleAntiderivative(right.slice(1))) {
      return `${left} - ${right.slice(1)}`;
    }
    return `${left} + ${right}`;
  }

  if (right.startsWith("-") && isSimpleAntiderivative(right.slice(1))) {
    return `${left} + ${right.slice(1)}`;
  }
  return `${left} - ${needsAntiderivativeParens(right) ? `(${right})` : right}`;
}

function formatScaledAntiderivative(scalar, text) {
  const normalized = normalizeNumber(scalar);
  if (nearlyEqual(normalized, 0)) {
    return "0";
  }
  if (text.startsWith("-") && isSimpleAntiderivative(text.slice(1))) {
    return formatScaledAntiderivative(-normalized, text.slice(1));
  }

  const body = needsAntiderivativeParens(text) ? `(${text})` : text;
  if (nearlyEqual(normalized, 1)) {
    return text;
  }
  if (nearlyEqual(normalized, -1)) {
    return `-${body}`;
  }
  return `${formatNumber(normalized)}${body}`;
}

function needsAntiderivativeParens(text) {
  return / \+ | - /.test(text);
}

function isSimpleAntiderivative(text) {
  return !needsAntiderivativeParens(text);
}

function formatProductFactor(text) {
  return needsAntiderivativeParens(text) ? `(${text})` : text;
}

function formatPowerBase(text) {
  return /^[A-Za-z_]\w*$/.test(text) ? text : `(${text})`;
}

function extractOptimizationQuestion(statement, fallbackVariable) {
  let text = statement
    .replace(/^(maximize|minimize|optimize|critical points of|critical point of|find critical points of|find the maximum of|find the minimum of|find max of|find min of)\s+/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
  let variable = fallbackVariable;
  let goal = "critical";

  const lower = statement.toLowerCase();
  if (lower.includes("maximize") || lower.includes("maximum") || /\bmax\b/.test(lower)) {
    goal = "maximum";
  } else if (lower.includes("minimize") || lower.includes("minimum") || /\bmin\b/.test(lower)) {
    goal = "minimum";
  }

  const variableMatch = text.match(/\b(?:with respect to|wrt|for)\s+([A-Za-z_]\w*)\b/i);
  if (variableMatch) {
    variable = variableMatch[1];
    text = text.replace(variableMatch[0], "").trim();
  }
  text = text.replace(/^f\s*\([A-Za-z_]\w*\)\s*=\s*/i, "").replace(/^y\s*=\s*/i, "").trim();
  text = text.replace(/^-\s*/, "0 - ");

  return { expression: text, variable, goal };
}

function polynomialDerivative(poly, variable) {
  const result = new Map();
  for (const [key, coefficient] of poly.entries()) {
    const powers = powersFromKey(key);
    const power = powers[variable] ?? 0;
    if (power === 0) {
      continue;
    }
    powers[variable] = power - 1;
    if (powers[variable] === 0) {
      delete powers[variable];
    }
    result.set(monomialKey(powers), (result.get(monomialKey(powers)) ?? 0) + coefficient * power);
  }
  return cleanPolynomial(result);
}

function pickOptimizationResult(rows, goal) {
  if (goal === "maximum") {
    const localMax = rows.filter((row) => row.kind === "local max");
    return (localMax.length ? localMax : rows).reduce((best, row) => row.y > best.y ? row : best);
  }
  if (goal === "minimum") {
    const localMin = rows.filter((row) => row.kind === "local min");
    return (localMin.length ? localMin : rows).reduce((best, row) => row.y < best.y ? row : best);
  }
  return rows[0];
}

function extractGraphQuestion(statement) {
  let text = statement
    .replace(/^(graph|plot|draw)\s+/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
  let xMin = -10;
  let xMax = 10;
  let variable = "x";

  const rangeMatch = text.match(/\b(?:from|range)\s+([-+]?\d*\.?\d+)\s+(?:to|,)\s+([-+]?\d*\.?\d+)/i);
  if (rangeMatch) {
    xMin = Number(rangeMatch[1]);
    xMax = Number(rangeMatch[2]);
    text = text.replace(rangeMatch[0], "").trim();
  }

  const variableMatch = text.match(/\bfor\s+([A-Za-z_]\w*)\b/i);
  if (variableMatch) {
    variable = variableMatch[1];
    text = text.replace(variableMatch[0], "").trim();
  }

  text = text.replace(/^y\s*=\s*/i, "").trim();
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMin >= xMax) {
    throw new Error("Graph mode needs a valid range, such as from -5 to 5.");
  }
  return { expression: text, variable, xMin, xMax };
}

function extractLimitQuestion(statement, fallbackVariable) {
  let text = statement
    .replace(/^(limit|lim)\s+/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
  let direction = "both";
  if (/\b(left-hand|from the left|from left)\b/i.test(text)) {
    direction = "left";
    text = text.replace(/\b(left-hand|from the left|from left)\b/gi, "").trim();
  } else if (/\b(right-hand|from the right|from right)\b/i.test(text)) {
    direction = "right";
    text = text.replace(/\b(right-hand|from the right|from right)\b/gi, "").trim();
  }

  const numberPattern = "([-+]?\\d*\\.?\\d+(?:e[-+]?\\d+)?)";
  const asMatch = text.match(new RegExp(`^(.+?)\\s+(?:as|when)\\s+([A-Za-z_]\\w*)\\s*(?:->|=>|approaches|goes\\s+to|tends\\s+to|to)\\s*${numberPattern}$`, "i"));
  if (asMatch) {
    return {
      expression: cleanLimitExpression(asMatch[1]),
      variable: asMatch[2],
      target: Number(asMatch[3]),
      direction,
    };
  }

  const prefixMatch = text.match(new RegExp(`^([A-Za-z_]\\w*)\\s*(?:->|=>|approaches|goes\\s+to|tends\\s+to|to)\\s*${numberPattern}\\s+(.+)$`, "i"));
  if (prefixMatch) {
    return {
      expression: cleanLimitExpression(prefixMatch[3]),
      variable: prefixMatch[1],
      target: Number(prefixMatch[2]),
      direction,
    };
  }

  const suffixMatch = text.match(new RegExp(`^(.+?)\\s*,?\\s+([A-Za-z_]\\w*)\\s*(?:->|=>)\\s*${numberPattern}$`, "i"));
  if (suffixMatch) {
    return {
      expression: cleanLimitExpression(suffixMatch[1]),
      variable: suffixMatch[2],
      target: Number(suffixMatch[3]),
      direction,
    };
  }

  const target = readNamedNumber(text, ["target", "at", "approaches"], Number.NaN);
  if (Number.isFinite(target)) {
    const variableMatch = text.match(/\b(?:with respect to|wrt|for)\s+([A-Za-z_]\w*)\b/i);
    const variable = variableMatch ? variableMatch[1] : fallbackVariable;
    return {
      expression: cleanLimitExpression(
        text
          .replace(/\b(?:target|at|approaches)\s*=\s*[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi, "")
          .replace(/\b(?:with respect to|wrt|for)\s+[A-Za-z_]\w*\b/gi, ""),
      ),
      variable,
      target,
      direction,
    };
  }

  throw new Error("Use a limit such as limit (x^2 - 1)/(x - 1) as x approaches 1.");
}

function cleanLimitExpression(text) {
  return text
    .replace(/^f\s*\([A-Za-z_]\w*\)\s*=\s*/i, "")
    .replace(/^y\s*=\s*/i, "")
    .trim();
}

function formatTaylorPolynomial(terms, variable, center) {
  const pieces = [];
  for (const term of terms) {
    if (nearlyEqual(term.coefficient, 0)) {
      continue;
    }
    pieces.push(formatTaylorTerm(term.coefficient, term.order, variable, center, pieces.length === 0));
  }
  return pieces.length ? pieces.join("") : "0";
}

function formatTaylorTerm(coefficient, order, variable, center, first) {
  const sign = coefficient < 0 ? "-" : "+";
  const magnitude = Math.abs(coefficient);
  const variablePart = formatTaylorVariablePart(order, variable, center);
  const coefficientText = nearlyEqual(magnitude, 1) && variablePart ? "" : formatNumber(magnitude);
  const body = `${coefficientText}${variablePart}`;
  if (first) {
    return sign === "-" ? `-${body}` : body;
  }
  return ` ${sign} ${body}`;
}

function formatTaylorVariablePart(order, variable, center) {
  if (order === 0) {
    return "";
  }
  let base = variable;
  if (!nearlyEqual(center, 0)) {
    base = center > 0 ? `(${variable} - ${formatNumber(center)})` : `(${variable} + ${formatNumber(Math.abs(center))})`;
  }
  return order === 1 ? base : `${base}^${order}`;
}

function sampleFunction(expression, variable, xMin, xMax, count) {
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const x = xMin + ((xMax - xMin) * index) / (count - 1);
    const y = evaluateMath(expression, { [variable]: x });
    if (Number.isFinite(y)) {
      points.push({ x, y });
    }
  }
  return points;
}

function estimateLimit(expression, request) {
  const scale = Math.max(1, Math.abs(request.target));
  const distances = [1e-1, 1e-2, 1e-3, 1e-4, 1e-5, 1e-6].map((value) => value * scale);
  const rows = [];
  let leftValue = Number.NaN;
  let rightValue = Number.NaN;
  const leftSamples = [];
  const rightSamples = [];

  for (const distance of distances) {
    const leftX = request.target - distance;
    const rightX = request.target + distance;
    const left = request.direction === "right" ? Number.NaN : safeEvaluateMath(expression, { [request.variable]: leftX });
    const right = request.direction === "left" ? Number.NaN : safeEvaluateMath(expression, { [request.variable]: rightX });
    if (Number.isFinite(left)) {
      leftValue = left;
      leftSamples.push(left);
    }
    if (Number.isFinite(right)) {
      rightValue = right;
      rightSamples.push(right);
    }
    rows.push([
      formatNumber(distance),
      request.direction === "right" ? "" : formatNumber(leftX),
      Number.isFinite(left) ? formatNumber(left) : "not finite",
      request.direction === "left" ? "" : formatNumber(rightX),
      Number.isFinite(right) ? formatNumber(right) : "not finite",
    ]);
  }

  if (request.direction === "left") {
    if (!Number.isFinite(leftValue)) {
      throw new Error("Could not find finite left-hand samples for this limit.");
    }
    const unbounded = detectUnboundedLimit(leftSamples);
    if (unbounded) {
      return {
        value: unbounded.value,
        valueText: unbounded.text,
        table: {
          headers: ["Distance", `${request.variable} left`, "f(left)", `${request.variable} right`, "f(right)"],
          rows,
        },
      };
    }
    return {
      value: leftValue,
      table: {
        headers: ["Distance", `${request.variable} left`, "f(left)", `${request.variable} right`, "f(right)"],
        rows,
      },
    };
  }
  if (request.direction === "right") {
    if (!Number.isFinite(rightValue)) {
      throw new Error("Could not find finite right-hand samples for this limit.");
    }
    const unbounded = detectUnboundedLimit(rightSamples);
    if (unbounded) {
      return {
        value: unbounded.value,
        valueText: unbounded.text,
        table: {
          headers: ["Distance", `${request.variable} left`, "f(left)", `${request.variable} right`, "f(right)"],
          rows,
        },
      };
    }
    return {
      value: rightValue,
      table: {
        headers: ["Distance", `${request.variable} left`, "f(left)", `${request.variable} right`, "f(right)"],
        rows,
      },
    };
  }

  if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
    throw new Error("Could not find finite two-sided samples for this limit.");
  }
  const leftUnbounded = detectUnboundedLimit(leftSamples);
  const rightUnbounded = detectUnboundedLimit(rightSamples);
  if (leftUnbounded || rightUnbounded) {
    if (leftUnbounded && rightUnbounded && leftUnbounded.text === rightUnbounded.text) {
      return {
        value: leftUnbounded.value,
        valueText: leftUnbounded.text,
        table: {
          headers: ["Distance", `${request.variable} left`, "f(left)", `${request.variable} right`, "f(right)"],
          rows,
        },
      };
    }
    throw new Error("The two-sided limit does not appear to exist because the left and right estimates are unbounded in different ways.");
  }
  const tolerance = 1e-4 * Math.max(1, Math.abs(leftValue), Math.abs(rightValue));
  if (Math.abs(leftValue - rightValue) > tolerance) {
    throw new Error("The two-sided limit does not appear to exist because the left and right estimates differ.");
  }

  return {
    value: (leftValue + rightValue) / 2,
    table: {
      headers: ["Distance", `${request.variable} left`, "f(left)", `${request.variable} right`, "f(right)"],
      rows,
    },
  };
}

function detectUnboundedLimit(samples) {
  const finite = samples.filter(Number.isFinite);
  if (finite.length < 4) return null;
  const recent = finite.slice(-4);
  const signsAgree = recent.every((value) => value > 0) || recent.every((value) => value < 0);
  const magnitudes = recent.map(Math.abs);
  const grows = magnitudes.every((value, index) => index === 0 || value > magnitudes[index - 1] * 5);
  const large = magnitudes[magnitudes.length - 1] > 1e5;
  if (!signsAgree || !grows || !large) return null;
  const positive = recent[recent.length - 1] > 0;
  return {
    value: positive ? Infinity : -Infinity,
    text: positive ? "infinity" : "-infinity",
  };
}

function extractNumericalQuestion(statement) {
  const lower = statement.toLowerCase();
  const method = lower.includes("newton") ? "newton" : "bisection";
  let expression = statement
    .replace(/^(newton|bisection|numerical root|root of|find root of|solve numerically)\s+/i, "")
    .replace(/[?!.]+$/, "")
    .trim();

  const guessMatch = expression.match(/\bguess\s*=\s*([-+]?\d*\.?\d+)/i);
  const intervalMatch = expression.match(/\b(?:interval|between)\s*=?\s*([-+]?\d*\.?\d+)\s*,?\s+([-+]?\d*\.?\d+)/i);
  let guess = 1;
  let low = -10;
  let high = 10;

  if (guessMatch) {
    guess = Number(guessMatch[1]);
    expression = expression.replace(guessMatch[0], "").trim();
  }
  if (intervalMatch) {
    low = Number(intervalMatch[1]);
    high = Number(intervalMatch[2]);
    expression = expression.replace(intervalMatch[0], "").trim();
  }
  if (!Number.isFinite(guess) || !Number.isFinite(low) || !Number.isFinite(high) || low >= high) {
    throw new Error("Numerical solving needs a valid guess or interval.");
  }

  return {
    expression,
    variable: "x",
    method,
    guess,
    low,
    high,
  };
}

function numericFunctionFromExpression(parsed) {
  if (parsed.kind === "equation") {
    return (x) => evaluateMath(parsed.left, { x }) - evaluateMath(parsed.right, { x });
  }
  return (x) => evaluateMath(parsed, { x });
}

function evaluateMath(node, values = {}) {
  if (node.kind === "mathNumber") return node.value;
  if (node.kind === "mathSymbol") {
    if (node.name in values) return values[node.name];
    throw new Error(`Missing numeric value for ${node.name}.`);
  }
  if (node.kind === "mathUnary") return -evaluateMath(node.operand, values);
  if (node.kind === "mathFunction") return evaluateFunction(node.name, evaluateMath(node.argument, values));
  if (node.kind === "mathBinary") {
    const left = evaluateMath(node.left, values);
    const right = evaluateMath(node.right, values);
    return evaluateBinary(node.operator, left, right);
  }
  throw new Error(`Cannot evaluate node '${node.kind}'.`);
}

function safeEvaluateMath(node, values = {}) {
  try {
    const value = evaluateMath(node, values);
    return Number.isFinite(value) ? value : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

function newtonRoot(evaluator, initialGuess) {
  let x = initialGuess;
  for (let index = 0; index < 40; index += 1) {
    const y = evaluator(x);
    if (Math.abs(y) < 1e-9) return normalizeNumber(x);
    const derivative = numericDerivative(evaluator, x);
    if (nearlyEqual(derivative, 0)) {
      throw new Error("Newton's method hit a flat slope; try a different guess.");
    }
    x -= y / derivative;
    if (!Number.isFinite(x)) {
      throw new Error("Newton's method diverged; try bisection with an interval.");
    }
  }
  return normalizeNumber(x);
}

function numericDerivative(evaluator, x) {
  const h = 1e-5;
  return (evaluator(x + h) - evaluator(x - h)) / (2 * h);
}

function bisectionRoot(evaluator, lowStart, highStart) {
  let low = lowStart;
  let high = highStart;
  let lowValue = evaluator(low);
  let highValue = evaluator(high);
  if (lowValue * highValue > 0) {
    throw new Error("Bisection needs an interval where the function changes sign.");
  }
  for (let index = 0; index < 80; index += 1) {
    const mid = (low + high) / 2;
    const midValue = evaluator(mid);
    if (Math.abs(midValue) < 1e-9) return normalizeNumber(mid);
    if (lowValue * midValue < 0) {
      high = mid;
      highValue = midValue;
    } else {
      low = mid;
      lowValue = midValue;
    }
  }
  return normalizeNumber((low + high) / 2);
}

function descriptiveSummary(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const count = values.length;
  const valueMean = mean(values);
  const valueMedian = median(sorted);
  const lowerHalf = sorted.slice(0, Math.floor(count / 2));
  const upperHalf = sorted.slice(Math.ceil(count / 2));
  const populationVariance = values.reduce((sum, value) => sum + (value - valueMean) ** 2, 0) / count;
  const sampleVariance = count > 1
    ? values.reduce((sum, value) => sum + (value - valueMean) ** 2, 0) / (count - 1)
    : 0;

  return {
    count,
    mean: valueMean,
    median: valueMedian,
    modes: modes(values),
    range: sorted[count - 1] - sorted[0],
    q1: lowerHalf.length ? median(lowerHalf) : sorted[0],
    q3: upperHalf.length ? median(upperHalf) : sorted[count - 1],
    iqr: (upperHalf.length ? median(upperHalf) : sorted[count - 1]) -
      (lowerHalf.length ? median(lowerHalf) : sorted[0]),
    populationVariance,
    populationStdDev: Math.sqrt(populationVariance),
    sampleVariance,
    sampleStdDev: Math.sqrt(sampleVariance),
  };
}

function descriptiveAnswer(statement, summary) {
  const lower = statement.toLowerCase();
  if (lower.includes("median")) return `median = ${formatNumber(summary.median)}`;
  if (lower.includes("mode")) {
    const value = summary.modes.length ? summary.modes.map(formatNumber).join(", ") : "none";
    return `mode = ${value}`;
  }
  if (lower.includes("variance")) return `sample variance = ${formatNumber(summary.sampleVariance)}`;
  if (lower.includes("standard deviation") || lower.includes("std") || lower.includes("sd")) {
    return `sample sd = ${formatNumber(summary.sampleStdDev)}`;
  }
  if (lower.includes("mean") || lower.includes("average")) return `mean = ${formatNumber(summary.mean)}`;
  return `mean = ${formatNumber(summary.mean)}, median = ${formatNumber(summary.median)}, sample sd = ${formatNumber(summary.sampleStdDev)}`;
}

function parseNumbers(text) {
  return [...text.matchAll(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)].map((match) => Number(match[0]));
}

function rankValues(values) {
  const ranked = values.map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value);
  const ranks = Array(values.length);
  let tieCorrection = 0;

  for (let start = 0; start < ranked.length;) {
    let end = start + 1;
    while (end < ranked.length && nearlyEqual(ranked[end].value, ranked[start].value)) {
      end += 1;
    }

    const rank = (start + 1 + end) / 2;
    for (let index = start; index < end; index += 1) {
      ranks[ranked[index].index] = rank;
    }

    const tieSize = end - start;
    if (tieSize > 1) {
      tieCorrection += tieSize ** 3 - tieSize;
    }
    start = end;
  }

  return { ranks, tieCorrection };
}

function rankAbsoluteValues(values) {
  const ranked = values.map((value, index) => ({ value: Math.abs(value), index }))
    .sort((left, right) => left.value - right.value);
  const ranks = Array(values.length);
  let tieCorrection = 0;

  for (let start = 0; start < ranked.length;) {
    let end = start + 1;
    while (end < ranked.length && nearlyEqual(ranked[end].value, ranked[start].value)) {
      end += 1;
    }

    const rank = (start + 1 + end) / 2;
    for (let index = start; index < end; index += 1) {
      ranks[ranked[index].index] = rank;
    }

    const tieSize = end - start;
    if (tieSize > 1) {
      tieCorrection += tieSize ** 3 - tieSize;
    }
    start = end;
  }

  return { ranks, tieCorrection };
}

function parseHypothesisInput(text) {
  const numberPattern = "([-+]?\\d*\\.?\\d+(?:e[-+]?\\d+)?)";
  let dataText = text;
  let mu;

  const h0Match = dataText.match(new RegExp(`\\b(?:h0|h_0)\\s*:?\\s*(?:mu|mean)\\s*=\\s*${numberPattern}`, "i"));
  const namedMeanMatch = dataText.match(new RegExp(`\\b(?:mu|mean)\\s*=\\s*${numberPattern}`, "i"));
  const againstMatch = dataText.match(new RegExp(`\\bagainst\\s+${numberPattern}`, "i"));
  const phraseMatch = dataText.match(new RegExp(`\\b(?:less than|greater than|more than|under|over)\\s+${numberPattern}`, "i"));
  const selected = h0Match ?? namedMeanMatch ?? againstMatch ?? phraseMatch;

  if (selected) {
    mu = Number(selected[1]);
    dataText = dataText.replace(selected[0], "");
  }

  const alphaMatch = dataText.match(new RegExp(`\\balpha\\s*=\\s*${numberPattern}`, "i"));
  const alpha = alphaMatch ? Number(alphaMatch[1]) : 0.05;
  if (alphaMatch) {
    dataText = dataText.replace(alphaMatch[0], "");
  }

  if (!Number.isFinite(mu)) {
    throw new Error("Use t-test mean=10 data 8, 9, 11, 12.");
  }
  if (!(alpha > 0 && alpha < 1)) {
    throw new Error("Hypothesis test alpha must be between 0 and 1.");
  }

  const lower = text.toLowerCase();
  let alternative = "two-sided";
  if (/\b(less|below|under)\b/.test(lower) || /<\s*[-+]?\d/.test(lower)) {
    alternative = "less";
  } else if (/\b(greater|above|over|more)\b/.test(lower) || />\s*[-+]?\d/.test(lower)) {
    alternative = "greater";
  }

  dataText = dataText
    .replace(/\bt-?test\b/gi, "")
    .replace(/\bhypothesis\b/gi, "")
    .replace(/\btest\b/gi, "")
    .replace(/\bmean\b/gi, "")
    .replace(/\bmu\b/gi, "")
    .replace(/\bsample\b/gi, "")
    .replace(/\bdata\b/gi, "")
    .replace(/\bfor\b/gi, "")
    .replace(/\bagainst\b/gi, "")
    .replace(/\b(?:less|greater|than|more|under|over|above|below|two-sided|two sided)\b/gi, "");

  return {
    mu,
    alpha,
    alternative,
    values: parseNumbers(dataText),
  };
}

function parseTwoSampleInput(text) {
  const { alpha, cleaned } = extractAlpha(text);
  const alternative = parseAlternative(text);
  const labeledMatch = cleaned.match(
    /\b(?:group|sample|data)?\s*1\s*[:=]\s*([^;]+);\s*(?:group|sample|data)?\s*2\s*[:=]\s*([^;]+)/i,
  );
  if (labeledMatch) {
    return {
      alpha,
      alternative,
      left: parseNumbers(labeledMatch[1]),
      right: parseNumbers(labeledMatch[2]),
    };
  }

  const chunks = cleaned
    .replace(/\btwo-?sample\b/gi, "")
    .replace(/\bwelch\b/gi, "")
    .replace(/\bt-?test\b/gi, "")
    .replace(/\bindependent samples\b/gi, "")
    .split(";")
    .map((chunk) => parseNumbers(chunk))
    .filter((values) => values.length > 0);

  if (chunks.length >= 2) {
    return {
      alpha,
      alternative,
      left: chunks[0],
      right: chunks[1],
    };
  }

  throw new Error("Use two-sample t-test group1: 10, 12, 9; group2: 8, 7, 11.");
}

function parsePairedInput(text) {
  const { alpha, cleaned } = extractAlpha(text);
  const alternative = parseAlternative(text);
  const labeledMatch = cleaned.match(
    /\b(?:before|pre|first|left|group1|sample1)\s*[:=]\s*([^;]+);\s*(?:after|post|second|right|group2|sample2)\s*[:=]\s*([^;]+)/i,
  );
  if (labeledMatch) {
    return {
      alpha,
      alternative,
      left: parseNumbers(labeledMatch[1]),
      right: parseNumbers(labeledMatch[2]),
    };
  }

  const chunks = cleaned
    .replace(/\bpaired\b/gi, "")
    .replace(/\bmatched pairs\b/gi, "")
    .replace(/\bt-?test\b/gi, "")
    .split(";")
    .map((chunk) => parseNumbers(chunk))
    .filter((values) => values.length > 0);
  if (chunks.length >= 2) {
    return {
      alpha,
      alternative,
      left: chunks[0],
      right: chunks[1],
    };
  }

  throw new Error("Use paired t-test before: 10, 12, 9; after: 11, 14, 10.");
}

function parseAnovaInput(text) {
  const { alpha, cleaned } = extractAlpha(text);
  const groups = cleaned
    .replace(/\banova\b/gi, "")
    .replace(/\banalysis of variance\b/gi, "")
    .replace(/\bone-way\b/gi, "")
    .replace(/\bone way\b/gi, "")
    .split(";")
    .map((chunk) => chunk.trim().replace(/^[A-Za-z][A-Za-z0-9 _-]*\s*[:=]\s*/, ""))
    .map((chunk) => parseNumbers(chunk))
    .filter((values) => values.length > 0);

  if (groups.length < 2) {
    throw new Error("Use ANOVA group1: 8,9,10; group2: 12,13,14; group3: 9,11,10.");
  }
  return { alpha, groups };
}

function parseKruskalInput(text) {
  const { alpha, cleaned } = extractAlpha(text);
  const groups = cleaned
    .replace(/\bkruskal(?:-|\s*)wallis\b/gi, "")
    .replace(/\bkruskal\b/gi, "")
    .replace(/\bwallis\b/gi, "")
    .replace(/\brank(?:-|\s*)based\b/gi, "")
    .split(";")
    .map((chunk) => chunk.trim().replace(/^[A-Za-z][A-Za-z0-9 _-]*\s*[:=]\s*/, ""))
    .map((chunk) => parseNumbers(chunk))
    .filter((values) => values.length > 0);

  if (groups.length < 2) {
    throw new Error("Use Kruskal-Wallis group1: 8,9,10; group2: 12,13,14; group3: 9,11,10.");
  }
  return { alpha, groups };
}

function parseChiSquareInput(text) {
  const { alpha, cleaned } = extractAlpha(text);
  const observedMatch = cleaned.match(/\b(?:observed|obs)\s*[:=]?\s*([^;]+?)(?=\b(?:expected|exp)\b|$)/i);
  const expectedMatch = cleaned.match(/\b(?:expected|exp)\s*[:=]?\s*([^;]+)/i);
  if (observedMatch && expectedMatch) {
    return {
      alpha,
      observed: parseNumbers(observedMatch[1]),
      expected: parseNumbers(expectedMatch[1]),
    };
  }

  const chunks = cleaned
    .replace(/\bchi-?square\b/gi, "")
    .replace(/\bchisquare\b/gi, "")
    .replace(/\bgoodness(?:-|\s*)of(?:-|\s*)fit\b/gi, "")
    .split(";")
    .map((chunk) => parseNumbers(chunk))
    .filter((values) => values.length > 0);
  if (chunks.length >= 2) {
    return {
      alpha,
      observed: chunks[0],
      expected: chunks[1],
    };
  }

  throw new Error("Use chi-square observed 10, 20, 30 expected 15, 15, 30.");
}

function parseHypergeometricInput(text) {
  const numbers = parseNumbers(text);
  const population = readNamedNumber(text, ["population", "total", "size"], numbers[0]);
  const successes = readNamedNumber(text, ["successes", "good"], numbers[1]);
  const draws = readNamedNumber(text, ["draws", "sample", "selected"], numbers[2]);
  const k = readNamedNumber(text, ["k", "x", "observed"], numbers[3]);

  if (![population, successes, draws, k].every(Number.isInteger)) {
    throw new Error("Use hypergeometric population=50 successes=5 draws=10 k=2.");
  }
  if (population <= 1 || successes < 0 || successes > population || draws < 0 || draws > population) {
    throw new Error("Hypergeometric inputs need 0 <= successes <= population and 0 <= draws <= population.");
  }
  const minK = Math.max(0, draws - (population - successes));
  const maxK = Math.min(successes, draws);
  if (k < minK || k > maxK) {
    throw new Error(`Hypergeometric k must be between ${minK} and ${maxK} for these inputs.`);
  }

  return {
    population,
    successes,
    draws,
    k,
  };
}

function parseOneProportionInput(text, { needsNull }) {
  const { alpha, cleaned } = extractAlpha(text);
  const numbers = parseNumbers(cleaned);
  const successes = readNamedNumber(cleaned, ["successes", "success", "x", "count"], numbers[0]);
  const total = readNamedNumber(cleaned, ["n", "trials", "total", "sample"], numbers[1]);
  validateProportionCount(successes, total, "One-proportion statistics");

  const nullFallback = numbers.length >= 3 ? numbers[2] : Number.NaN;
  const nullProportion = readNamedNumber(cleaned, ["p0", "null", "hypothesized", "p"], nullFallback);
  if (needsNull && !(nullProportion >= 0 && nullProportion <= 1)) {
    throw new Error("One-proportion z tests need a null proportion, such as p0=0.5.");
  }

  return {
    successes,
    total,
    nullProportion,
    alpha,
    alternative: parseAlternative(text),
    level: parseConfidenceLevel(text, 0.95),
  };
}

function parseTwoProportionInput(text) {
  const { alpha, cleaned } = extractAlpha(text);
  const numbers = parseNumbers(cleaned);
  const leftSuccesses = readNamedNumber(cleaned, ["successes1", "success1", "x1", "count1"], numbers[0]);
  const leftTotal = readNamedNumber(cleaned, ["n1", "trials1", "total1", "sample1"], numbers[1]);
  const rightSuccesses = readNamedNumber(cleaned, ["successes2", "success2", "x2", "count2"], numbers[2]);
  const rightTotal = readNamedNumber(cleaned, ["n2", "trials2", "total2", "sample2"], numbers[3]);
  validateProportionCount(leftSuccesses, leftTotal, "Two-proportion z tests group 1");
  validateProportionCount(rightSuccesses, rightTotal, "Two-proportion z tests group 2");

  return {
    leftSuccesses,
    leftTotal,
    rightSuccesses,
    rightTotal,
    alpha,
    alternative: parseAlternative(text),
  };
}

function parseConfidenceLevel(text, fallback) {
  const named = readNamedNumber(text, ["confidence", "level"], Number.NaN);
  if (Number.isFinite(named)) {
    const level = named > 1 ? named / 100 : named;
    if (!(level > 0 && level < 1)) {
      throw new Error("Confidence level must be between 0 and 1, or between 0 and 100 percent.");
    }
    return level;
  }

  const phraseMatch = text.match(/\b([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*%?\s*(?:confidence|ci)\b/i);
  if (phraseMatch) {
    const raw = Number(phraseMatch[1]);
    const level = raw > 1 ? raw / 100 : raw;
    if (!(level > 0 && level < 1)) {
      throw new Error("Confidence level must be between 0 and 1, or between 0 and 100 percent.");
    }
    return level;
  }

  return fallback;
}

function validateProportionCount(successes, total, context) {
  if (!Number.isInteger(successes) || !Number.isInteger(total)) {
    throw new Error(`${context} need integer successes and sample size.`);
  }
  if (total <= 0 || successes < 0 || successes > total) {
    throw new Error(`${context} need 0 <= successes <= n and n > 0.`);
  }
}

function parseCombinatoricsInput(text) {
  const lower = text.toLowerCase();
  const numbers = parseNumbers(text);
  const operation = lower.includes("factorial") || /!\s*$/.test(text.trim())
    ? "factorial"
    : lower.includes("permutation") || lower.includes("permute") || lower.includes("npr") || lower.includes("arrangement")
      ? "permutation"
      : "combination";
  const n = readNamedNumber(text, ["n", "items", "total"], numbers[0]);
  const k = operation === "factorial"
    ? 0
    : readNamedNumber(text, ["k", "r", "select"], numbers[1]);

  if (!Number.isInteger(n) || n < 0) {
    throw new Error("Counting problems need a nonnegative integer n.");
  }
  if (n > 500) {
    throw new Error("Counting mode supports n up to 500 to keep exact integer output readable.");
  }
  if (operation !== "factorial" && (!Number.isInteger(k) || k < 0 || k > n)) {
    throw new Error("Combinations and permutations need integers with 0 <= k <= n.");
  }

  return { operation, n, k };
}

function extractAlpha(text) {
  const match = text.match(/\balpha\s*=\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i);
  const alpha = match ? Number(match[1]) : 0.05;
  if (!(alpha > 0 && alpha < 1)) {
    throw new Error("Alpha must be between 0 and 1.");
  }
  return {
    alpha,
    cleaned: match ? text.replace(match[0], "") : text,
  };
}

function parseAlternative(text) {
  const lower = text.toLowerCase();
  if (/\b(less|below|under)\b/.test(lower) || /<\s*[-+]?\d/.test(lower)) {
    return "less";
  }
  if (/\b(greater|above|over|more)\b/.test(lower) || />\s*[-+]?\d/.test(lower)) {
    return "greater";
  }
  return "two-sided";
}

function pValueForT(statistic, degreesFreedom, alternative) {
  const cdf = studentTCdf(statistic, degreesFreedom);
  if (alternative === "less") {
    return cdf;
  }
  if (alternative === "greater") {
    return 1 - cdf;
  }
  return Math.min(1, 2 * Math.min(cdf, 1 - cdf));
}

function pValueForNormal(statistic, alternative) {
  const cdf = normalCdf(statistic);
  if (alternative === "less") {
    return cdf;
  }
  if (alternative === "greater") {
    return 1 - cdf;
  }
  return Math.min(1, 2 * Math.min(cdf, 1 - cdf));
}

function proportionEffectSize(leftProportion, rightProportion) {
  return 2 * Math.asin(Math.sqrt(leftProportion)) - 2 * Math.asin(Math.sqrt(rightProportion));
}

function pooledSampleStdDev(leftSummary, rightSummary) {
  const degreesFreedom = leftSummary.count + rightSummary.count - 2;
  return Math.sqrt(
    ((leftSummary.count - 1) * leftSummary.sampleVariance +
      (rightSummary.count - 1) * rightSummary.sampleVariance) /
      degreesFreedom,
  );
}

function hedgesCorrection(degreesFreedom) {
  return degreesFreedom > 1 ? 1 - 3 / (4 * degreesFreedom - 1) : 1;
}

function pairwiseAnovaComparisons(groupSummaries, groups, msWithin, degreesFreedom) {
  const comparisons = [];
  const pairCount = (groups.length * (groups.length - 1)) / 2;
  for (let left = 0; left < groups.length; left += 1) {
    for (let right = left + 1; right < groups.length; right += 1) {
      const difference = groupSummaries[left].mean - groupSummaries[right].mean;
      const standardError = Math.sqrt(msWithin * (1 / groups[left].length + 1 / groups[right].length));
      const statistic = difference / standardError;
      const pValue = pValueForT(statistic, degreesFreedom, "two-sided");
      comparisons.push({
        label: `${left + 1} vs ${right + 1}`,
        statistic,
        adjustedP: bonferroniAdjust(pValue, pairCount),
        estimateLabel: "diff",
        estimate: difference,
      });
    }
  }
  return comparisons;
}

function pairwiseDunnComparisons(groups, groupRankSums, totalCount, tieCorrection) {
  const comparisons = [];
  const pairCount = (groups.length * (groups.length - 1)) / 2;
  const rankVariance = totalCount * (totalCount + 1) / 12 -
    tieCorrection / (12 * (totalCount - 1));
  for (let left = 0; left < groups.length; left += 1) {
    for (let right = left + 1; right < groups.length; right += 1) {
      const leftMeanRank = groupRankSums[left] / groups[left].length;
      const rightMeanRank = groupRankSums[right] / groups[right].length;
      const difference = leftMeanRank - rightMeanRank;
      const standardError = Math.sqrt(rankVariance * (1 / groups[left].length + 1 / groups[right].length));
      const statistic = difference / standardError;
      const pValue = pValueForNormal(statistic, "two-sided");
      comparisons.push({
        label: `${left + 1} vs ${right + 1}`,
        statistic,
        adjustedP: bonferroniAdjust(pValue, pairCount),
        estimateLabel: "rank diff",
        estimate: difference,
      });
    }
  }
  return comparisons;
}

function bonferroniAdjust(pValue, comparisonCount) {
  return Math.min(1, pValue * comparisonCount);
}

function formatPairwiseComparisons(comparisons) {
  return comparisons
    .map((comparison) =>
      `${comparison.label}: ${comparison.estimateLabel}=${formatNumber(comparison.estimate)}, p_adj=${formatNumber(comparison.adjustedP)}`,
    )
    .join("; ");
}

function studentTCdf(tStatistic, degreesFreedom) {
  if (!(degreesFreedom > 0)) {
    return Number.NaN;
  }
  if (nearlyEqual(tStatistic, 0)) {
    return 0.5;
  }

  const x = degreesFreedom / (degreesFreedom + tStatistic ** 2);
  const beta = regularizedBeta(x, degreesFreedom / 2, 0.5);
  return tStatistic > 0 ? 1 - beta / 2 : beta / 2;
}

function chiSquareRightTailApprox(statistic, degreesFreedom) {
  if (!(degreesFreedom > 0)) {
    return Number.NaN;
  }
  if (statistic <= 0) {
    return 1;
  }
  const z = ((statistic / degreesFreedom) ** (1 / 3) - (1 - 2 / (9 * degreesFreedom))) /
    Math.sqrt(2 / (9 * degreesFreedom));
  return Math.max(0, Math.min(1, 1 - normalCdf(z)));
}

function fRightTail(statistic, dfNumerator, dfDenominator) {
  if (!(statistic >= 0) || !(dfNumerator > 0) || !(dfDenominator > 0)) {
    return Number.NaN;
  }
  const x = (dfNumerator * statistic) / (dfNumerator * statistic + dfDenominator);
  return Math.max(0, Math.min(1, 1 - regularizedBeta(x, dfNumerator / 2, dfDenominator / 2)));
}

function regularizedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const logFront = logGamma(a + b) - logGamma(a) - logGamma(b) +
    a * Math.log(x) + b * Math.log(1 - x);
  const front = Math.exp(logFront);

  if (x < (a + 1) / (a + b + 2)) {
    return front * betaContinuedFraction(x, a, b) / a;
  }
  return 1 - front * betaContinuedFraction(1 - x, b, a) / b;
}

function betaContinuedFraction(x, a, b) {
  const maxIterations = 120;
  const tiny = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const m2 = 2 * iteration;
    let aa = (iteration * (b - iteration) * x) /
      ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;

    aa = -((a + iteration) * (qab + iteration) * x) /
      ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-10) {
      break;
    }
  }

  return h;
}

function logGamma(value) {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];

  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  }

  let x = 0.99999999999980993;
  const shifted = value - 1;
  for (let index = 0; index < coefficients.length; index += 1) {
    x += coefficients[index] / (shifted + index + 1);
  }
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x);
}

function parseConfidenceInput(text) {
  let level = 0.95;
  let dataText = text;

  const percentMatch = text.match(/\b(8[0-9]|9[0-9](?:\.\d+)?)\s*%?\s*(?:confidence|ci)\b/i);
  const equalsMatch = text.match(/\b(?:confidence|ci)\s*(?:level)?\s*=\s*(0?\.\d+|\d+(?:\.\d+)?)/i);
  if (percentMatch) {
    level = Number(percentMatch[1]) / 100;
    dataText = dataText.replace(percentMatch[0], "");
  } else if (equalsMatch) {
    const raw = Number(equalsMatch[1]);
    level = raw > 1 ? raw / 100 : raw;
    dataText = dataText.replace(equalsMatch[0], "");
  }

  dataText = dataText
    .replace(/\bconfidence\b/gi, "")
    .replace(/\binterval\b/gi, "")
    .replace(/\bci\b/gi, "")
    .replace(/\bfor\b/gi, "")
    .replace(/\bdata\b/gi, "");

  const values = parseNumbers(dataText);
  if (!(level > 0 && level < 1)) {
    throw new Error("Confidence level must be between 0 and 1.");
  }

  return { level, values };
}

function parseNumberList(text) {
  return parseNumbers(text);
}

function parsePairs(text) {
  return [...text.matchAll(/\(\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*,\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*\)/gi)]
    .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
}

function parseXYLists(text) {
  const match = text.match(/x\s*[:=]\s*([^;]+);\s*y\s*[:=]\s*([^;]+)/i);
  if (!match) return null;
  const x = parseNumberList(match[1]);
  const y = parseNumberList(match[2]);
  if (x.length !== y.length || x.length < 2) {
    throw new Error("x and y lists must have the same length and at least two values.");
  }
  return { x, y };
}

function zipPairs(xValues, yValues) {
  return xValues.map((x, index) => ({ x, y: yValues[index] }));
}

function parseNamedProbabilityParams(text) {
  const named = {};
  for (const [, key, value] of text.matchAll(/\b([npk])\s*=\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/gi)) {
    named[key.toLowerCase()] = Number(value);
  }

  if (named.n !== undefined && named.p !== undefined && named.k !== undefined) {
    return named;
  }

  const numbers = parseNumbers(text);
  if (numbers.length >= 3) {
    return {
      n: numbers[0],
      p: numbers[1],
      k: numbers[2],
    };
  }

  throw new Error("Use binomial n=10 p=0.5 k=3.");
}

function parsePoissonInput(text) {
  const numbers = parseNumbers(text);
  const lambda = readNamedNumber(text, ["lambda", "rate", "mean", "mu"], numbers[0]);
  const kFallback = numbers.length >= 2 ? numbers[1] : Number.NaN;
  const k = readNamedNumber(text, ["k", "x", "value"], kFallback);

  return {
    lambda,
    k: Number(k),
    tail: parseProbabilityTail(text),
  };
}

function parseGeometricInput(text) {
  const numbers = parseNumbers(text);
  const p = readNamedNumber(text, ["p", "probability", "prob"], numbers[0]);
  const kFallback = numbers.length >= 2 ? numbers[1] : Number.NaN;
  const k = readNamedNumber(text, ["k", "x", "value", "trial"], kFallback);

  return {
    p,
    k: Number(k),
    tail: parseProbabilityTail(text),
  };
}

function parseExponentialInput(text) {
  const numbers = parseNumbers(text);
  const namedRate = readNamedNumber(text, ["lambda", "rate"], Number.NaN);
  const meanValue = readNamedNumber(text, ["mean", "mu"], Number.NaN);
  const lambda = Number.isFinite(namedRate)
    ? namedRate
    : Number.isFinite(meanValue)
      ? 1 / meanValue
      : numbers[0];
  const xFallback = numbers.length >= 2 ? numbers[1] : Number.NaN;
  const x = readNamedNumber(text, ["x", "value", "t", "time"], xFallback);

  return {
    lambda,
    x,
    tail: parseProbabilityTail(text),
  };
}

function parseUniformInput(text) {
  const numbers = parseNumbers(text);
  const min = readNamedNumber(text, ["min", "minimum", "lower", "a"], numbers[0]);
  const max = readNamedNumber(text, ["max", "maximum", "upper", "b"], numbers[1]);
  const interval = parseBetweenInterval(text);
  const xFallback = numbers.length >= 3 ? numbers[2] : Number.NaN;
  const x = readNamedNumber(text, ["x", "value"], xFallback);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error("Uniform probability needs min and max, such as uniform min=2 max=10 x=5.");
  }
  if (!interval && !Number.isFinite(x)) {
    throw new Error("Uniform probability needs x or an interval, such as uniform min=2 max=10 between 4 and 7.");
  }

  return {
    min,
    max,
    x,
    interval,
    tail: parseProbabilityTail(text),
  };
}

function parseInverseNormalInput(text) {
  const numbers = parseNumbers(text);
  let probability = readNamedNumber(text, ["p", "probability", "area", "cdf", "percentile"], numbers[0]);
  if (probability > 1 && probability <= 100) {
    probability /= 100;
  }
  const meanValue = readNamedNumber(text, ["mean", "mu"], numbers.length >= 3 ? numbers[1] : 0);
  const sdValue = readNamedNumber(text, ["sd", "sigma", "std"], numbers.length >= 3 ? numbers[2] : 1);

  if (!(probability > 0 && probability < 1)) {
    throw new Error("Inverse normal needs a left-tail probability between 0 and 1.");
  }
  if (!(sdValue > 0)) {
    throw new Error("Inverse normal needs a positive standard deviation.");
  }

  return {
    probability,
    mean: meanValue,
    sd: sdValue,
  };
}

function parseProbabilityTail(text) {
  const lower = text.toLowerCase();
  if (lower.includes("at most") || lower.includes("<=") || lower.includes("no more than")) {
    return "at-most";
  }
  if (lower.includes("less than") || lower.includes("<")) {
    return "less";
  }
  if (lower.includes("at least") || lower.includes(">=")) {
    return "at-least";
  }
  if (lower.includes("greater than") || lower.includes("more than") || lower.includes(">")) {
    return "greater";
  }
  return "exact";
}

function parseBetweenInterval(text) {
  const match = text.match(/\bbetween\s+([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s+(?:and|to)\s+([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i);
  if (!match) {
    return null;
  }
  return {
    left: Number(match[1]),
    right: Number(match[2]),
  };
}

function parseDiscreteDistributionInput(text) {
  const valuesMatch = text.match(/\b(?:values|outcomes|x)\s*[:=]\s*([^;]+?)(?=\b(?:probabilities|probability|probs)\s*[:=]|$)/i);
  const probabilitiesMatch = text.match(/\b(?:probabilities|probability|probs)\s*[:=]\s*([^;]+)/i);
  let values;
  let probabilities;

  if (valuesMatch && probabilitiesMatch) {
    values = parseNumbers(valuesMatch[1]);
    probabilities = parseNumbers(probabilitiesMatch[1]);
  } else {
    const chunks = text
      .replace(/\bexpected\s+value\b/gi, "")
      .replace(/\bexpectation\b/gi, "")
      .replace(/\bdistribution\b/gi, "")
      .split(";")
      .map((chunk) => parseNumbers(chunk))
      .filter((chunkValues) => chunkValues.length > 0);
    if (chunks.length >= 2) {
      values = chunks[0];
      probabilities = chunks[1];
    }
  }

  if (!values || !probabilities || values.length === 0 || values.length !== probabilities.length) {
    throw new Error("Use expected value values: 0, 1, 2 probabilities: 0.2, 0.5, 0.3.");
  }
  if (!probabilities.every((probability) => probability >= 0 && probability <= 1)) {
    throw new Error("Discrete distribution probabilities must be between 0 and 1.");
  }

  const totalProbability = probabilities.reduce((sum, probability) => sum + probability, 0);
  if (Math.abs(totalProbability - 1) > 1e-6) {
    throw new Error("Discrete distribution probabilities must sum to 1.");
  }

  return {
    values,
    probabilities: probabilities.map((probability) => probability / totalProbability),
  };
}

function parseBayesInput(text) {
  const numbers = parseNumbers(text);
  const prior = readNamedNumber(text, ["prior", "base", "prevalence"], numbers[0]);
  const sensitivity = readNamedNumber(text, ["sensitivity", "sens", "tpr"], numbers[1]);
  const namedSpecificity = readNamedNumber(text, ["specificity", "spec", "tnr"], Number.NaN);
  const fallbackFalsePositive = Number.isFinite(namedSpecificity) ? 1 - namedSpecificity : numbers[2];
  const falsePositiveRate = readNamedNumber(text, ["fpr", "falsepositive", "false_positive"], fallbackFalsePositive);
  const specificity = Number.isFinite(namedSpecificity) ? namedSpecificity : 1 - falsePositiveRate;

  if (![prior, sensitivity, falsePositiveRate, specificity].every(Number.isFinite)) {
    throw new Error("Use bayes prior=0.01 sensitivity=0.99 specificity=0.95.");
  }
  if (![prior, sensitivity, falsePositiveRate, specificity].every((value) => value >= 0 && value <= 1)) {
    throw new Error("Bayes probabilities must be between 0 and 1.");
  }
  if (sensitivity * prior + falsePositiveRate * (1 - prior) <= 0) {
    throw new Error("Bayes theorem needs a positive probability of observing a positive result.");
  }

  return { prior, sensitivity, falsePositiveRate, specificity };
}

function poissonProbabilityLabel(tail, k) {
  if (tail === "at-most") return `P(X <= ${k})`;
  if (tail === "less") return `P(X < ${k})`;
  if (tail === "at-least") return `P(X >= ${k})`;
  if (tail === "greater") return `P(X > ${k})`;
  return `P(X = ${k})`;
}

function readNamedNumber(text, names, fallback) {
  for (const name of names) {
    const match = text.match(new RegExp(`\\b${name}\\s*=\\s*([-+]?\\d*\\.?\\d+(?:e[-+]?\\d+)?)`, "i"));
    if (match) {
      return Number(match[1]);
    }
  }
  return fallback;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(sortedValues) {
  const middle = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 1) {
    return sortedValues[middle];
  }
  return (sortedValues[middle - 1] + sortedValues[middle]) / 2;
}

function modes(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const maxCount = Math.max(...counts.values());
  if (maxCount <= 1) {
    return [];
  }

  return [...counts.entries()]
    .filter(([, count]) => count === maxCount)
    .map(([value]) => value)
    .sort((left, right) => left - right);
}

function binomialProbability(n, p, k) {
  return combination(n, k) * p ** k * (1 - p) ** (n - k);
}

function poissonProbability(lambda, k) {
  return Math.exp(-lambda) * lambda ** k / factorial(k);
}

function geometricProbability(p, k) {
  return (1 - p) ** (k - 1) * p;
}

function hypergeometricProbability(population, successes, draws, k) {
  return (
    combination(successes, k) *
    combination(population - successes, draws - k)
  ) / combination(population, draws);
}

function factorial(value) {
  let result = 1;
  for (let index = 2; index <= value; index += 1) {
    result *= index;
  }
  return result;
}

function factorialBigInt(value) {
  let result = 1n;
  for (let index = 2n; index <= BigInt(value); index += 1n) {
    result *= index;
  }
  return result;
}

function combination(n, k) {
  const limit = Math.min(k, n - k);
  let result = 1;
  for (let index = 1; index <= limit; index += 1) {
    result = (result * (n - limit + index)) / index;
  }
  return result;
}

function combinationBigInt(n, k) {
  const limit = Math.min(k, n - k);
  let result = 1n;
  for (let index = 1; index <= limit; index += 1) {
    result = (result * BigInt(n - limit + index)) / BigInt(index);
  }
  return result;
}

function permutationBigInt(n, k) {
  let result = 1n;
  for (let index = 0; index < k; index += 1) {
    result *= BigInt(n - index);
  }
  return result;
}

function sumRange(start, end, callback) {
  let total = 0;
  for (let value = start; value <= end; value += 1) {
    total += callback(value);
  }
  return total;
}

function clampProbability(value) {
  return Math.max(0, Math.min(1, value));
}

function zCriticalForLevel(level) {
  if (Math.abs(level - 0.9) < 0.001) return 1.644854;
  if (Math.abs(level - 0.95) < 0.001) return 1.959964;
  if (Math.abs(level - 0.99) < 0.001) return 2.575829;
  const tail = (1 + level) / 2;
  return inverseNormalCdf(tail);
}

function inverseNormalCdf(probability) {
  if (!(probability > 0 && probability < 1)) {
    throw new Error("Probability must be between 0 and 1.");
  }
  let low = -8;
  let high = 8;
  for (let index = 0; index < 80; index += 1) {
    const mid = (low + high) / 2;
    if (normalCdf(mid) < probability) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

function normalCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function erf(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const approximation = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * approximation;
}

function statsDatasetNode(values, children = [], label = "DATA") {
  return {
    kind: "statsDataset",
    label,
    values,
    children: children.length
      ? children
      : values.slice(0, 6).map((value) => statsMetricNode("VALUE", value)),
  };
}

function statsMetricNode(label, value) {
  return {
    kind: "statsMetric",
    label,
    value,
  };
}

function isDerivativeQuestion(lower) {
  return lower.includes("derivative") || lower.includes("differentiate") || /d\s*\/\s*d[a-z]\w*/i.test(lower);
}

function isTaylorQuestion(lower) {
  return lower.startsWith("taylor ") ||
    lower.startsWith("maclaurin ") ||
    lower.includes("taylor polynomial") ||
    lower.includes("taylor series") ||
    lower.includes("maclaurin polynomial") ||
    lower.includes("maclaurin series");
}

function isComplexQuestion(lower) {
  if (lower.includes("=")) {
    return false;
  }
  if (
    lower.startsWith("complex ") ||
    lower.startsWith("evaluate complex ") ||
    lower.startsWith("calculate complex ") ||
    lower.startsWith("compute complex ") ||
    lower.startsWith("simplify complex ")
  ) {
    return true;
  }
  return hasImaginaryUnit(lower) &&
    (looksLikeMathExpression(lower) || /[()]/.test(lower) || /^\s*-?\s*i\s*$/.test(lower));
}

function hasImaginaryUnit(text) {
  return /(^|[^A-Za-z_])(?:\d+(?:\.\d+)?)?i([^A-Za-z_]|$)/i.test(text);
}

function isMatrixQuestion(lower) {
  return lower.includes("matrix") ||
    lower.includes("determinant") ||
    lower.startsWith("det ") ||
    lower.includes(" det ") ||
    lower.startsWith("rref ") ||
    lower.includes("row reduce") ||
    lower.startsWith("rank ") ||
    lower.startsWith("eigen ") ||
    lower.includes("eigenvalue") ||
    lower.includes("eigenvector") ||
    lower.startsWith("nullspace ") ||
    lower.startsWith("null space ") ||
    lower.startsWith("kernel ") ||
    lower.includes("inverse [[") ||
    lower.includes("multiply [[") ||
    lower.includes("product [[");
}

function isGraphQuestion(lower) {
  return lower.startsWith("graph ") || lower.startsWith("plot ") || lower.startsWith("draw ");
}

function isLimitQuestion(lower) {
  return lower.startsWith("limit ") ||
    lower.startsWith("lim ") ||
    lower.includes(" as x approaches ") ||
    /\blim\s+[a-z]\w*\s*(?:->|=>)/i.test(lower);
}

function isIntegralQuestion(lower) {
  return lower.startsWith("integrate ") ||
    lower.startsWith("definite integral ") ||
    lower.startsWith("definite integral of ") ||
    lower.startsWith("integral of ") ||
    lower.startsWith("find the integral of ") ||
    lower.startsWith("antiderivative of ");
}

function isOptimizationQuestion(lower) {
  return lower.startsWith("maximize ") ||
    lower.startsWith("minimize ") ||
    lower.startsWith("optimize ") ||
    lower.startsWith("critical points of ") ||
    lower.startsWith("critical point of ") ||
    lower.startsWith("find critical points of ") ||
    lower.startsWith("find the maximum of ") ||
    lower.startsWith("find the minimum of ") ||
    lower.startsWith("find max of ") ||
    lower.startsWith("find min of ");
}

function isNumericalQuestion(lower) {
  return lower.startsWith("newton ") ||
    lower.startsWith("bisection ") ||
    lower.startsWith("numerical root ") ||
    lower.startsWith("root of ") ||
    lower.startsWith("find root of ") ||
    lower.startsWith("solve numerically ");
}

function isSystemQuestion(lower) {
  return lower.includes("system") || lower.includes("simultaneous equations");
}

function isStatisticsQuestion(lower) {
  return [
    "mean",
    "average",
    "median",
    "mode",
    "variance",
    "standard deviation",
    "std",
    "regression",
    "correlation",
    "binomial",
    "poisson",
    "geometric",
    "exponential",
    "uniform",
    "hypergeometric",
    "normal",
    "percentile",
    "quantile",
    "critical value",
    "z-score",
    "zscore",
    "expected value",
    "expectation",
    "probabilities",
    "outcomes",
    "bayes",
    "posterior",
    "prior",
    "sensitivity",
    "specificity",
    "proportion",
    "successes",
    "p0",
    "z-test",
    "z test",
    "probability",
    "statistics",
    "dataset",
    "hypothesis",
    "t-test",
    "t test",
    "test mean",
    "two-sample",
    "two sample",
    "welch",
    "chi-square",
    "chi square",
    "chisquare",
    "paired",
    "matched pairs",
    "anova",
    "analysis of variance",
    "mann-whitney",
    "mann whitney",
    "rank-sum",
    "rank sum",
    "wilcoxon",
    "signed-rank",
    "signed rank",
    "kruskal",
    "wallis",
  ].some((word) => lower.includes(word)) || parsePairs(lower).length >= 2;
}

function isLogicQuestion(question) {
  return /\b(and|or|not|xor|implies|iff)\b|->|<->|=>|&&|\|\|/i.test(question);
}

function isSimplifyQuestion(lower) {
  return lower.includes("simplify") || lower.includes("combine like terms");
}

function isFactorQuestion(lower) {
  return lower.startsWith("factor ") ||
    lower.startsWith("factorize ") ||
    lower.startsWith("factorise ") ||
    lower.startsWith("fully factor ") ||
    lower.startsWith("factor the ");
}

function isCombinatoricsQuestion(lower) {
  return lower.includes("choose") ||
    lower.includes("combination") ||
    lower.includes("permutation") ||
    lower.includes("permute") ||
    lower.includes("arrangement") ||
    lower.includes("ncr") ||
    lower.includes("npr") ||
    lower.includes("factorial") ||
    /^\s*\d+\s*!\s*$/.test(lower);
}

function isInequalityQuestion(question) {
  const withoutLogicArrows = question.replace(/<->|<=>|->|=>/g, "");
  return /<=|>=|<|>|\u2264|\u2265/.test(withoutLogicArrows);
}

function looksLikeMathExpression(question) {
  return /[a-zA-Z0-9)]\s*[\+\-\*\/\^]\s*[-a-zA-Z0-9(]/.test(question);
}

function extractDerivativeQuestion(question) {
  const dMatch = question.match(/d\s*\/\s*d([A-Za-z_]\w*)\s+(.+)/i);
  if (dMatch) {
    return {
      variable: dMatch[1],
      expression: dMatch[2].replace(/[?!.]+$/, "").trim(),
    };
  }

  const wordMatch = question.match(/(?:derivative of|differentiate)\s+(.+?)(?:\s+with respect to\s+([A-Za-z_]\w*))?[?!.]*$/i);
  if (wordMatch) {
    return {
      variable: wordMatch[2] ?? "x",
      expression: wordMatch[1].trim(),
    };
  }

  return {
    variable: "x",
    expression: cleanSimplifyQuestion(question),
  };
}

function extractTaylorQuestion(question, fallbackVariable) {
  let text = question
    .replace(/^(taylor|maclaurin)\s+(?:polynomial|series|expansion)?\s*/i, "")
    .replace(/^(find|compute|calculate)\s+(?:the\s+)?(?:taylor|maclaurin)\s+(?:polynomial|series|expansion)\s+(?:of\s+)?/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
  const lower = question.toLowerCase();
  let center = lower.includes("maclaurin") ? 0 : Number.NaN;
  let variable = fallbackVariable;
  let order = 5;

  const orderMatch = text.match(/\b(?:order|degree|through degree)\s*=?\s*(\d+)\b/i);
  if (orderMatch) {
    order = Number(orderMatch[1]);
    text = text.replace(orderMatch[0], "").trim();
  }

  const aroundMatch = text.match(/\b(?:around|center(?:ed)? at|about|at)\s+([A-Za-z_]\w*\s*=\s*)?([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\b/i);
  if (aroundMatch) {
    center = Number(aroundMatch[2]);
    if (aroundMatch[1]) {
      variable = aroundMatch[1].replace(/=/g, "").trim();
    }
    text = text.replace(aroundMatch[0], "").trim();
  }

  const variableMatch = text.match(/\b(?:with respect to|wrt|for)\s+([A-Za-z_]\w*)\b/i);
  if (variableMatch) {
    variable = variableMatch[1];
    text = text.replace(variableMatch[0], "").trim();
  }

  if (!Number.isFinite(center)) {
    center = 0;
  }
  if (!Number.isInteger(order) || order < 0 || order > 8) {
    throw new Error("Taylor mode supports integer degrees from 0 through 8.");
  }

  text = text
    .replace(/^of\s+/i, "")
    .replace(/^f\s*\([A-Za-z_]\w*\)\s*=\s*/i, "")
    .replace(/^y\s*=\s*/i, "")
    .trim();

  if (!text) {
    throw new Error("Use a Taylor request such as taylor sin(x) order=5.");
  }

  return {
    expression: text,
    variable,
    center,
    order,
  };
}

function cleanLogicQuestion(question) {
  return question
    .replace(/^(is|check|evaluate|determine)\s+/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
}

function cleanEquationQuestion(question) {
  return question
    .replace(/^(solve|find|calculate|compute)\s+/i, "")
    .replace(/\s+for\s+[A-Za-z_]\w*\s*$/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
}

function cleanSystemQuestion(question) {
  return question
    .replace(/^(solve|find|calculate|compute)\s+/i, "")
    .replace(/\bsystem\s*(?:of equations)?\s*:?\s*/i, "")
    .replace(/\bsimultaneous equations\s*:?\s*/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
}

function cleanSimplifyQuestion(question) {
  return question
    .replace(/^(simplify|combine like terms|calculate|compute|what is|find)\s+/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
}

function cleanComplexQuestion(question) {
  return question
    .replace(/[?!.]+$/, "")
    .replace(/^(evaluate|calculate|compute|simplify|what is)\s+(?:the\s+)?/i, "")
    .replace(/^complex\s+(?:number|expression|arithmetic)?\s*/i, "")
    .trim();
}

function cleanFactorQuestion(question) {
  return question
    .replace(/^(factorize|factorise|fully factor|factor)\s+(?:the\s+)?/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
}

function extractInequalityQuestion(question) {
  const cleaned = question
    .replace(/^(solve|find|calculate|compute)\s+/i, "")
    .replace(/^inequality\s*:?\s*/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
  const match = cleaned.match(/(<=|>=|<|>|\u2264|\u2265)/);
  if (!match) {
    throw new Error("Use an inequality such as x^2 - 5x + 6 > 0.");
  }

  const operator = match[1] === "\u2264" ? "<=" : match[1] === "\u2265" ? ">=" : match[1];
  const left = cleaned.slice(0, match.index).trim();
  const right = cleaned.slice(match.index + match[0].length).trim();
  if (!left || !right) {
    throw new Error("Inequality mode needs expressions on both sides of the comparison.");
  }

  return { left, operator, right };
}

function formatSigned(value) {
  if (value < 0) {
    return `- ${formatNumber(Math.abs(value))}`;
  }
  return `+ ${formatNumber(value)}`;
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

function evaluateComplex(node) {
  if (node.kind === "mathNumber") {
    return complex(node.value, 0);
  }
  if (node.kind === "mathSymbol") {
    if (node.name.toLowerCase() === "i") {
      return complex(0, 1);
    }
    throw new Error(`Complex mode only knows the imaginary unit i. '${node.name}' looks like a variable.`);
  }
  if (node.kind === "mathUnary") {
    return complexNeg(evaluateComplex(node.operand));
  }
  if (node.kind === "mathFunction") {
    return evaluateComplexFunction(node.name, evaluateComplex(node.argument));
  }
  if (node.kind === "mathBinary") {
    const left = evaluateComplex(node.left);
    const right = evaluateComplex(node.right);
    if (node.operator === "+") return complexAdd(left, right);
    if (node.operator === "-") return complexSub(left, right);
    if (node.operator === "*") return complexMul(left, right);
    if (node.operator === "/") return complexDiv(left, right);
    if (node.operator === "^") return complexPow(left, right);
    throw new Error(`Cannot evaluate complex operator '${node.operator}'.`);
  }
  throw new Error("Complex mode expects a math expression.");
}

function evaluateComplexFunction(name, value) {
  if (name === "sin") {
    return complex(Math.sin(value.re) * Math.cosh(value.im), Math.cos(value.re) * Math.sinh(value.im));
  }
  if (name === "cos") {
    return complex(Math.cos(value.re) * Math.cosh(value.im), -Math.sin(value.re) * Math.sinh(value.im));
  }
  if (name === "tan") {
    return complexDiv(evaluateComplexFunction("sin", value), evaluateComplexFunction("cos", value));
  }
  if (name === "exp") {
    const scale = Math.exp(value.re);
    return complex(scale * Math.cos(value.im), scale * Math.sin(value.im));
  }
  if (name === "ln") {
    if (nearlyEqual(complexAbs(value), 0)) {
      throw new Error("Complex logarithm is undefined at 0.");
    }
    return complex(Math.log(complexAbs(value)), Math.atan2(value.im, value.re));
  }
  if (name === "sqrt") {
    return complexSqrt(value);
  }
  throw new Error(`Complex mode does not support the function '${name}'.`);
}

function complex(re, im = 0) {
  if (!Number.isFinite(re) || !Number.isFinite(im)) {
    throw new Error("Complex evaluation produced a non-finite value.");
  }
  return {
    re: normalizeComplexPart(re),
    im: normalizeComplexPart(im),
  };
}

function normalizeComplexPart(value) {
  if (nearlyEqual(value, 0)) {
    return 0;
  }
  return Number(value.toFixed(10));
}

function complexAdd(left, right) {
  return complex(left.re + right.re, left.im + right.im);
}

function complexSub(left, right) {
  return complex(left.re - right.re, left.im - right.im);
}

function complexNeg(value) {
  return complex(-value.re, -value.im);
}

function complexMul(left, right) {
  return complex(
    left.re * right.re - left.im * right.im,
    left.re * right.im + left.im * right.re,
  );
}

function complexDiv(left, right) {
  const denominator = right.re ** 2 + right.im ** 2;
  if (nearlyEqual(denominator, 0)) {
    throw new Error("Division by zero is undefined for complex numbers.");
  }
  return complex(
    (left.re * right.re + left.im * right.im) / denominator,
    (left.im * right.re - left.re * right.im) / denominator,
  );
}

function complexPow(base, exponent) {
  if (nearlyEqual(exponent.im, 0) && Number.isInteger(exponent.re) && Math.abs(exponent.re) <= 32) {
    return complexIntegerPower(base, exponent.re);
  }
  if (nearlyEqual(complexAbs(base), 0)) {
    throw new Error("Complex powers with base 0 are only supported for integer exponents.");
  }
  return evaluateComplexFunction("exp", complexMul(exponent, evaluateComplexFunction("ln", base)));
}

function complexIntegerPower(base, exponent) {
  if (exponent === 0) {
    return complex(1, 0);
  }

  let power = Math.abs(exponent);
  let result = complex(1, 0);
  let factor = base;
  while (power > 0) {
    if (power % 2 === 1) {
      result = complexMul(result, factor);
    }
    factor = complexMul(factor, factor);
    power = Math.floor(power / 2);
  }

  return exponent < 0 ? complexDiv(complex(1, 0), result) : result;
}

function complexSqrt(value) {
  const radius = complexAbs(value);
  const real = Math.sqrt((radius + value.re) / 2);
  const sign = value.im < 0 ? -1 : 1;
  const imaginary = sign * Math.sqrt((radius - value.re) / 2);
  return complex(real, imaginary);
}

function complexAbs(value) {
  return Math.hypot(value.re, value.im);
}

function formatComplex(value) {
  const real = normalizeComplexPart(value.re);
  const imaginary = normalizeComplexPart(value.im);
  if (nearlyEqual(imaginary, 0)) {
    return formatNumber(real);
  }
  if (nearlyEqual(real, 0)) {
    return formatImaginary(imaginary);
  }
  const sign = imaginary < 0 ? "-" : "+";
  return `${formatNumber(real)} ${sign} ${formatImaginary(Math.abs(imaginary))}`;
}

function formatImaginary(value) {
  const magnitude = Math.abs(normalizeComplexPart(value));
  const text = nearlyEqual(magnitude, 1) ? "i" : `${formatNumber(magnitude)}i`;
  return value < 0 ? `-${text}` : text;
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

function linearPolynomialRow(poly, variables) {
  const coefficients = Object.fromEntries(variables.map((variable) => [variable, 0]));
  let constant = 0;

  for (const [key, coefficient] of poly.entries()) {
    if (!key) {
      constant += coefficient;
      continue;
    }

    const powers = powersFromKey(key);
    const entries = Object.entries(powers);
    if (entries.length !== 1 || entries[0][1] !== 1) {
      throw new Error("System solving currently supports linear equations only.");
    }

    const [variable] = entries[0];
    coefficients[variable] += coefficient;
  }

  return {
    coefficients: variables.map((variable) => normalizeNumber(coefficients[variable])),
    constant: normalizeNumber(-constant),
  };
}

function solveLinearSystem(matrix, constants) {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [...row, constants[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) {
        pivot = row;
      }
    }

    if (nearlyEqual(augmented[pivot][column], 0)) {
      throw new Error("The system has no unique solution.");
    }

    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const pivotValue = augmented[column][column];
    for (let col = column; col <= size; col += 1) {
      augmented[column][col] /= pivotValue;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let col = column; col <= size; col += 1) {
        augmented[row][col] -= factor * augmented[column][col];
      }
    }
  }

  return augmented.map((row) => normalizeNumber(row[size]));
}

function formatAugmentedMatrix(matrix, constants) {
  return matrix
    .map((row, index) => `[${row.map(formatNumber).join(", ")} | ${formatNumber(constants[index])}]`)
    .join("; ");
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

  const numericRoots = approximateRealPolynomialRoots(coefficients);
  return {
    answer: numericRoots.length
      ? numericRoots.map((root) => `${variable} ~= ${formatNumber(root)}`).join(", ")
      : "no real roots found",
    summary: numericRoots.length ? "numeric roots" : "no real roots found",
    steps: [
      {
        title: "Detect polynomial degree",
        expression: `degree ${degree}`,
        detail: "For degree three and higher, the browser solver switches to numerical approximation.",
      },
      {
        title: "Search for sign changes",
        expression: numericRoots.length
          ? numericRoots.map((root) => formatNumber(root)).join(", ")
          : "none found",
        detail: "The solver scans real-number intervals and refines roots with bisection.",
      },
    ],
  };
}

function factorPolynomialOverRationals(poly, variable) {
  const coefficients = trimPolynomialCoefficients(polynomialCoefficients(poly, variable));
  const degree = polynomialDegree(coefficients);
  if (degree === 0) {
    return {
      answer: formatNumber(coefficients[0] ?? 0),
      summary: "constant factor",
      roots: [],
      remaining: "constant",
      steps: [
        {
          title: "Check degree",
          expression: "degree 0",
          detail: "A constant polynomial has no variable factors.",
        },
      ],
    };
  }

  const content = polynomialContent(coefficients);
  let working = coefficients.map((coefficient) => normalizeNumber(coefficient / content));
  const roots = [];
  let denominatorProduct = 1;

  while (polynomialDegree(working) > 0) {
    const root = findRationalRoot(working);
    if (!root) {
      break;
    }
    roots.push(root);
    denominatorProduct *= root.denominator;
    working = syntheticDivide(working, root.value);
  }

  const residualCoefficients = denominatorProduct > 1
    ? working.map((coefficient) => normalizeNumber(coefficient / denominatorProduct))
    : working;
  const residualDegree = polynomialDegree(residualCoefficients);
  const rootFactors = roots.map((root) => formatLinearRootFactor(variable, root));
  const factors = [...rootFactors];
  let numericFactor = content;
  let remaining = "1";

  if (residualDegree === 0) {
    numericFactor = normalizeNumber(numericFactor * (residualCoefficients[0] ?? 1));
  } else {
    remaining = formatPolynomialFromCoefficients(residualCoefficients, variable);
    factors.push(formatParenthesizedFactor(remaining));
  }

  const answer = formatFactorProduct(numericFactor, factors);
  const summary = roots.length || !nearlyEqual(Math.abs(content), 1)
    ? "rational factorization"
    : "irreducible over rationals";

  return {
    answer,
    summary,
    roots,
    remaining,
    steps: [
      {
        title: "Detect polynomial degree",
        expression: `degree ${degree}`,
        detail: "Factoring starts from the one-variable polynomial degree.",
      },
      {
        title: "Extract numeric content",
        expression: `content = ${formatNumber(content)}`,
        detail: "A common numeric factor is separated before searching for roots.",
      },
      {
        title: "Search rational roots",
        expression: roots.length ? roots.map((root) => formatNumber(root.value)).join(", ") : "none found",
        detail: "The solver applies the rational root theorem and synthetic division.",
      },
      {
        title: roots.length ? "Build factor product" : "Check irreducibility",
        expression: answer,
        detail: roots.length
          ? "Each rational root r contributes a factor (x - r)."
          : "No rational roots were found, so the remaining polynomial is left as one factor.",
      },
    ],
  };
}

function trimPolynomialCoefficients(coefficients) {
  const trimmed = [...coefficients].map((coefficient) => normalizeNumber(coefficient ?? 0));
  while (trimmed.length > 1 && nearlyEqual(trimmed[trimmed.length - 1] ?? 0, 0)) {
    trimmed.pop();
  }
  return trimmed.length ? trimmed : [0];
}

function polynomialContent(coefficients) {
  const integerized = integerizeCoefficients(coefficients);
  if (!integerized) {
    return 1;
  }
  const nonzero = integerized.coefficients.filter((coefficient) => coefficient !== 0);
  if (nonzero.length === 0) {
    return 1;
  }
  const gcd = nonzero.map((coefficient) => Math.abs(coefficient)).reduce(gcdIntegers);
  const leading = integerized.coefficients[polynomialDegree(integerized.coefficients)];
  const sign = leading < 0 ? -1 : 1;
  return normalizeNumber((sign * gcd) / integerized.scale);
}

function integerizeCoefficients(coefficients) {
  for (let scale = 1; scale <= 1_000_000; scale *= 10) {
    const scaled = coefficients.map((coefficient) => Math.round((coefficient ?? 0) * scale));
    if (coefficients.every((coefficient, index) => nearlyEqual((coefficient ?? 0) * scale, scaled[index]))) {
      return { coefficients: scaled, scale };
    }
  }
  return null;
}

function findRationalRoot(coefficients) {
  const degree = polynomialDegree(coefficients);
  if (degree <= 0) {
    return null;
  }
  if (nearlyEqual(coefficients[0] ?? 0, 0)) {
    return { numerator: 0, denominator: 1, value: 0 };
  }

  const integerized = integerizeCoefficients(coefficients);
  if (!integerized) {
    return null;
  }

  const constant = Math.abs(integerized.coefficients[0] ?? 0);
  const leading = Math.abs(integerized.coefficients[degree] ?? 0);
  if (constant === 0 || leading === 0) {
    return null;
  }

  for (const candidate of rationalRootCandidates(constant, leading)) {
    if (nearlyEqual(evaluatePolynomialCoefficients(coefficients, candidate.value), 0)) {
      return candidate;
    }
  }
  return null;
}

function rationalRootCandidates(constant, leading) {
  const candidates = new Map();
  for (const numerator of integerDivisors(constant)) {
    for (const denominator of integerDivisors(leading)) {
      const divisor = gcdIntegers(numerator, denominator);
      const baseNumerator = numerator / divisor;
      const baseDenominator = denominator / divisor;
      for (const sign of [1, -1]) {
        const signedNumerator = sign * baseNumerator;
        const key = `${signedNumerator}/${baseDenominator}`;
        candidates.set(key, {
          numerator: signedNumerator,
          denominator: baseDenominator,
          value: signedNumerator / baseDenominator,
        });
      }
    }
  }
  return [...candidates.values()].sort((left, right) =>
    Math.abs(left.value) - Math.abs(right.value) || left.value - right.value,
  );
}

function integerDivisors(value) {
  const divisors = [];
  for (let candidate = 1; candidate <= Math.sqrt(value); candidate += 1) {
    if (value % candidate === 0) {
      divisors.push(candidate);
      if (candidate !== value / candidate) {
        divisors.push(value / candidate);
      }
    }
  }
  return divisors.sort((left, right) => left - right);
}

function gcdIntegers(left, right) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

function syntheticDivide(coefficients, root) {
  const degree = polynomialDegree(coefficients);
  const quotient = Array(degree).fill(0);
  quotient[degree - 1] = coefficients[degree];
  for (let index = degree - 2; index >= 0; index -= 1) {
    quotient[index] = coefficients[index + 1] + root * quotient[index + 1];
  }
  return trimPolynomialCoefficients(quotient.map(normalizeNumber));
}

function formatLinearRootFactor(variable, root) {
  if (root.numerator === 0) {
    return formatParenthesizedFactor(variable);
  }

  const coefficient = root.denominator === 1 ? variable : `${root.denominator}${variable}`;
  const constantText = formatNumber(Math.abs(root.numerator));
  const operator = root.numerator > 0 ? "-" : "+";
  return formatParenthesizedFactor(`${coefficient} ${operator} ${constantText}`);
}

function formatPolynomialFromCoefficients(coefficients, variable) {
  const poly = new Map();
  coefficients.forEach((coefficient, power) => {
    if (nearlyEqual(coefficient ?? 0, 0)) {
      return;
    }
    poly.set(power === 0 ? "" : monomialKey({ [variable]: power }), coefficient);
  });
  return formatPolynomial(cleanPolynomial(poly));
}

function formatParenthesizedFactor(text) {
  return `(${text})`;
}

function formatFactorProduct(coefficient, factors) {
  const normalized = normalizeNumber(coefficient);
  if (factors.length === 0) {
    return formatNumber(normalized);
  }
  if (nearlyEqual(normalized, 1)) {
    return factors.join("");
  }
  if (nearlyEqual(normalized, -1)) {
    return `-${factors.join("")}`;
  }
  return `${formatNumber(normalized)}${factors.join("")}`;
}

function solvePolynomialInequality(coefficients, operator, variable) {
  const degree = polynomialDegree(coefficients);
  if (degree === 0) {
    const constant = coefficients[0] ?? 0;
    const isTrue = compareWithOperator(constant, operator, 0);
    return {
      answer: isTrue ? "all real numbers" : "no solution",
      roots: [],
      table: {
        headers: ["Region", "Test value", "Polynomial", "Included"],
        rows: [["all real numbers", "any", formatNumber(constant), isTrue ? "yes" : "no"]],
      },
      steps: [
        {
          title: "Check constant inequality",
          expression: `${formatNumber(constant)} ${operator} 0`,
          detail: isTrue
            ? "The constant inequality is true for every real value."
            : "The constant inequality is false for every real value.",
        },
      ],
    };
  }

  const roots = realPolynomialRoots(coefficients);
  const includeEqual = operator.includes("=");
  const intervals = [];
  const signRows = [];
  const boundaries = [-Infinity, ...roots, Infinity];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const lower = boundaries[index];
    const upper = boundaries[index + 1];
    const testValue = chooseIntervalTestValue(lower, upper);
    const value = evaluatePolynomialCoefficients(coefficients, testValue);
    const included = compareWithOperator(value, operator, 0);
    const part = {
      type: "interval",
      lower,
      upper,
      lowerClosed: includeEqual && Number.isFinite(lower),
      upperClosed: includeEqual && Number.isFinite(upper),
    };
    signRows.push([
      formatIntervalPart(part),
      formatNumber(testValue),
      formatNumber(value),
      included ? "yes" : "no",
    ]);
    if (included) {
      intervals.push(part);
    }
  }

  if (includeEqual) {
    for (const root of roots) {
      if (nearlyEqual(evaluatePolynomialCoefficients(coefficients, root), 0) && !intervals.some((part) => intervalContainsRoot(part, root))) {
        intervals.push({ type: "point", value: root });
      }
    }
  }

  const sortedSolution = sortSolutionParts(intervals);
  const answer = formatInequalitySolution(variable, sortedSolution);

  return {
    answer,
    roots,
    table: {
      headers: ["Region", "Test value", "Polynomial", "Included"],
      rows: signRows,
    },
    steps: [
      {
        title: "Find critical points",
        expression: roots.length ? roots.map(formatNumber).join(", ") : "none",
        detail: "The sign of a polynomial can change only at real roots.",
      },
      {
        title: "Build sign chart",
        expression: signRows.map((row) => `${row[0]}: ${row[3]}`).join("; "),
        detail: "The solver tests one value in each interval between critical points.",
      },
      {
        title: "Write interval solution",
        expression: answer,
        detail: includeEqual ? "Boundary roots are included because the inequality allows equality." : "Boundary roots are excluded for a strict inequality.",
      },
    ],
  };
}

function realPolynomialRoots(coefficients) {
  const degree = polynomialDegree(coefficients);
  if (degree <= 0) {
    return [];
  }
  if (degree === 1) {
    return uniqueSortedNumbers([-(coefficients[0] ?? 0) / (coefficients[1] ?? 0)]).map(normalizeNumber);
  }
  if (degree === 2) {
    const c = coefficients[0] ?? 0;
    const b = coefficients[1] ?? 0;
    const a = coefficients[2] ?? 0;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < -EPSILON) {
      return [];
    }
    if (nearlyEqual(discriminant, 0)) {
      return uniqueSortedNumbers([-b / (2 * a)]).map(normalizeNumber);
    }
    const root = Math.sqrt(discriminant);
    return uniqueSortedNumbers([
      (-b - root) / (2 * a),
      (-b + root) / (2 * a),
    ]).map(normalizeNumber);
  }
  return approximateRealPolynomialRoots(coefficients);
}

function compareWithOperator(left, operator, right) {
  if (operator === "<") return left < right && !nearlyEqual(left, right);
  if (operator === "<=") return left < right || nearlyEqual(left, right);
  if (operator === ">") return left > right && !nearlyEqual(left, right);
  if (operator === ">=") return left > right || nearlyEqual(left, right);
  return false;
}

function chooseIntervalTestValue(lower, upper) {
  if (!Number.isFinite(lower) && !Number.isFinite(upper)) return 0;
  if (!Number.isFinite(lower)) return upper - 1;
  if (!Number.isFinite(upper)) return lower + 1;
  return (lower + upper) / 2;
}

function intervalContainsRoot(part, root) {
  if (part.type !== "interval") return false;
  if (part.lowerClosed && nearlyEqual(part.lower, root)) return true;
  if (part.upperClosed && nearlyEqual(part.upper, root)) return true;
  return part.lower < root && root < part.upper;
}

function sortSolutionParts(parts) {
  return [...parts].sort((left, right) => solutionPartStart(left) - solutionPartStart(right));
}

function solutionPartStart(part) {
  return part.type === "point" ? part.value : part.lower;
}

function formatInequalitySolution(variable, parts) {
  if (parts.length === 0) {
    return "no solution";
  }
  if (parts.length === 1) {
    const [part] = parts;
    if (part.type === "interval" && !Number.isFinite(part.lower) && !Number.isFinite(part.upper)) {
      return "all real numbers";
    }
  }
  return `${variable} in ${parts.map(formatIntervalPart).join(" U ")}`;
}

function formatIntervalPart(part) {
  if (part.type === "point") {
    return `{${formatNumber(part.value)}}`;
  }
  const leftBracket = part.lowerClosed ? "[" : "(";
  const rightBracket = part.upperClosed ? "]" : ")";
  const lower = Number.isFinite(part.lower) ? formatNumber(part.lower) : "-inf";
  const upper = Number.isFinite(part.upper) ? formatNumber(part.upper) : "inf";
  return `${leftBracket}${lower}, ${upper}${rightBracket}`;
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

function approximateRealPolynomialRoots(coefficients) {
  const roots = [];
  const min = -50;
  const max = 50;
  const step = 0.25;
  let previousX = min;
  let previousY = evaluatePolynomialCoefficients(coefficients, previousX);

  for (let x = min + step; x <= max; x += step) {
    const y = evaluatePolynomialCoefficients(coefficients, x);
    if (nearlyEqual(y, 0)) {
      roots.push(x);
    } else if (previousY * y < 0) {
      roots.push(bisectPolynomialRoot(coefficients, previousX, x));
    }
    previousX = x;
    previousY = y;
  }

  return uniqueSortedNumbers(roots.map((root) => normalizeNumber(root)));
}

function evaluatePolynomialCoefficients(coefficients, x) {
  return coefficients.reduce((sum, coefficient, power) => sum + (coefficient ?? 0) * x ** power, 0);
}

function bisectPolynomialRoot(coefficients, lowStart, highStart) {
  let low = lowStart;
  let high = highStart;
  let lowValue = evaluatePolynomialCoefficients(coefficients, low);

  for (let index = 0; index < 80; index += 1) {
    const mid = (low + high) / 2;
    const midValue = evaluatePolynomialCoefficients(coefficients, mid);
    if (nearlyEqual(midValue, 0)) {
      return mid;
    }
    if (lowValue * midValue < 0) {
      high = mid;
    } else {
      low = mid;
      lowValue = midValue;
    }
  }

  return (low + high) / 2;
}

function uniqueSortedNumbers(values) {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const unique = [];
  for (const value of sorted) {
    if (unique.every((existing) => Math.abs(existing - value) > 1e-5)) {
      unique.push(value);
    }
  }
  return unique;
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
  return [
    formatComplex(complex(real, imaginary)),
    formatComplex(complex(real, -imaginary)),
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
    "matrixOperation",
  ].includes(node.kind);
}

export function nodeChildren(node) {
  if (Array.isArray(node.children)) return node.children;
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
  if (node.kind === "mathInequality") return node.operator;
  if (node.kind === "statsDataset") return node.label ?? "DATA";
  if (node.kind === "statsMetric") return `${node.label}`;
  if (node.kind === "statsRegression") return "REG";
  if (node.kind === "statsDistribution") return node.label ?? "DIST";
  if (node.kind === "system") return "SYSTEM";
  if (node.kind === "matrixOperation") return node.label ?? "MATRIX";
  if (node.kind === "matrix") return node.label ?? "M";
  if (node.kind === "matrixRow") return node.label ?? "ROW";
  return "?";
}

export function nodeTone(node) {
  if (node.kind.startsWith("logic")) return "logic";
  if (node.kind.startsWith("stats")) return "statistics";
  if (node.kind.startsWith("matrix")) return "matrix";
  if (node.kind === "system") return "equation";
  if (node.kind === "mathNumber") return "number";
  if (node.kind === "mathSymbol") return "symbol";
  if (node.kind === "mathFunction") return "function";
  if (node.kind === "equation") return "equation";
  if (node.kind === "mathInequality") return "equation";
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
