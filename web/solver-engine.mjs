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

export function analyzeStatistics(statement) {
  const lower = statement.toLowerCase();

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
    return analyzeNormalDistribution(statement);
  }

  if (lower.includes("binomial")) {
    return analyzeBinomial(statement);
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
  } else if (isIntegralQuestion(lower)) {
    routed = analyzeIntegral(question);
    routedLabel = "Integral";
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
  } else if (isStatisticsQuestion(lower)) {
    routed = analyzeStatistics(question);
    routedLabel = "Statistics";
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

  if (lower.includes("multiply") || lower.includes("product")) {
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

  const polynomial = polynomialFrom(simplifyNode(expression, steps));
  if (!polynomial) {
    throw new Error("Integral mode currently supports polynomial expressions.");
  }

  const integral = integratePolynomial(polynomial, request.variable);
  const answer = `${formatPolynomial(integral)} + C`;
  steps.push({
    title: "Apply power rule for integrals",
    expression: answer,
    detail: "Each x^n term becomes x^(n+1)/(n+1).",
  });

  return {
    mode: "integral",
    tree: expression,
    answer,
    summary: "indefinite integral",
    details: `with respect to ${request.variable}`,
    variables: mathVariables(expression),
    metrics: treeMetrics(expression),
    steps,
    artifacts: [
      ["Integrand", formatMath(expression)],
      ["Antiderivative", answer],
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
  const pValue = pValueForAlternative(tStatistic, alternative);
  const decision = pValue < alpha ? `reject H0 at alpha=${formatNumber(alpha)}` : `fail to reject H0 at alpha=${formatNumber(alpha)}`;

  return {
    mode: "statistics",
    tree: statsDatasetNode(values, [
      statsMetricNode("H0", mu),
      statsMetricNode("MEAN", summary.mean),
      statsMetricNode("T", tStatistic),
      statsMetricNode("P", pValue),
    ], "TEST"),
    answer: `t = ${formatNumber(tStatistic)}, p = ${formatNumber(pValue)}`,
    summary: "one-sample t test",
    details: `${alternative} alternative, normal tail approximation`,
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
        detail: "The browser demo uses the normal curve as a lightweight tail approximation.",
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
      ["t statistic", formatNumber(tStatistic)],
      ["p-value", formatNumber(pValue)],
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

function extractIntegralQuestion(statement, fallbackVariable) {
  let text = statement
    .replace(/^(integrate|integral of|find the integral of|antiderivative of)\s+/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
  let variable = fallbackVariable;

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

function pValueForAlternative(statistic, alternative) {
  if (alternative === "less") {
    return normalCdf(statistic);
  }
  if (alternative === "greater") {
    return 1 - normalCdf(statistic);
  }
  return Math.min(1, 2 * (1 - normalCdf(Math.abs(statistic))));
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

function combination(n, k) {
  const limit = Math.min(k, n - k);
  let result = 1;
  for (let index = 1; index <= limit; index += 1) {
    result = (result * (n - limit + index)) / index;
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

function isMatrixQuestion(lower) {
  return lower.includes("matrix") ||
    lower.includes("determinant") ||
    lower.startsWith("det ") ||
    lower.includes(" det ") ||
    lower.includes("inverse [[") ||
    lower.includes("multiply [[") ||
    lower.includes("product [[");
}

function isGraphQuestion(lower) {
  return lower.startsWith("graph ") || lower.startsWith("plot ") || lower.startsWith("draw ");
}

function isIntegralQuestion(lower) {
  return lower.startsWith("integrate ") ||
    lower.startsWith("integral of ") ||
    lower.startsWith("find the integral of ") ||
    lower.startsWith("antiderivative of ");
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
    "normal",
    "z-score",
    "zscore",
    "probability",
    "statistics",
    "dataset",
    "hypothesis",
    "t-test",
    "t test",
    "test mean",
  ].some((word) => lower.includes(word)) || parsePairs(lower).length >= 2;
}

function isLogicQuestion(question) {
  return /\b(and|or|not|xor|implies|iff)\b|->|<->|=>|&&|\|\|/i.test(question);
}

function isSimplifyQuestion(lower) {
  return lower.includes("simplify") || lower.includes("combine like terms");
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
