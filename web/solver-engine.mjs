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

export function analyzeMultivariable(statement) {
  const request = parseMultivariableInput(statement);
  const parsed = parseMath(request.expression);
  if (parsed.kind === "equation") {
    throw new Error("Multivariable calculus mode expects an expression, not an equation.");
  }

  const variables = request.variables.length ? request.variables : mathVariables(parsed);
  if (variables.length === 0) {
    throw new Error("Multivariable calculus needs at least one variable.");
  }

  const steps = [
    {
      title: "Parse multivariable expression",
      expression: formatMath(parsed),
      detail: `The solver treats ${variables.join(", ")} as active variables.`,
    },
  ];

  if (request.operation === "partial") {
    const derivative = symbolicDerivative(parsed, request.variable);
    const value = evaluateAtPointIfAvailable(derivative.node, request.point);
    const answer = Number.isFinite(value)
      ? `df/d${request.variable} = ${derivative.answer}; value = ${formatNumber(value)}`
      : `df/d${request.variable} = ${derivative.answer}`;
    steps.push({
      title: "Take partial derivative",
      expression: `df/d${request.variable} = ${derivative.answer}`,
      detail: "All other variables are held constant.",
    });
    if (Number.isFinite(value)) {
      steps.push({
        title: "Evaluate point",
        expression: `${formatPointAssignments(request.point)} => ${formatNumber(value)}`,
        detail: "The partial derivative tree is evaluated at the requested point.",
      });
    }

    return {
      mode: "multivariable",
      tree: parsed,
      answer,
      summary: "partial derivative",
      details: `with respect to ${request.variable}`,
      variables: mathVariables(parsed),
      metrics: treeMetrics(parsed),
      steps,
      artifacts: [
        ["Expression", formatMath(parsed)],
        [`df/d${request.variable}`, derivative.answer],
        ...(Number.isFinite(value) ? [["Value at point", formatNumber(value)]] : []),
      ],
      table: {
        headers: ["Variable", "Partial derivative", "Value"],
        rows: [[
          request.variable,
          derivative.answer,
          Number.isFinite(value) ? formatNumber(value) : "",
        ]],
      },
    };
  }

  const gradient = variables.map((variable) => ({
    variable,
    derivative: symbolicDerivative(parsed, variable),
  }));
  const gradientValues = gradient.map((entry) => evaluateAtPointIfAvailable(entry.derivative.node, request.point));
  const hasGradientPoint = gradientValues.every(Number.isFinite);
  steps.push({
    title: "Compute gradient",
    expression: gradient.map((entry) => `df/d${entry.variable} = ${entry.derivative.answer}`).join("; "),
    detail: "The gradient collects every first partial derivative into a vector.",
  });
  if (hasGradientPoint) {
    steps.push({
      title: "Evaluate gradient at point",
      expression: `${formatPointAssignments(request.point)} => ${formatVector(gradientValues)}`,
      detail: "Each partial derivative is evaluated at the same point.",
    });
  }

  if (request.operation === "directional") {
    if (!hasGradientPoint) {
      throw new Error("Directional derivatives need a full point, such as at x=1 y=2.");
    }
    if (!request.direction.length) {
      throw new Error("Directional derivatives need a direction vector, such as direction [3,4].");
    }
    assertSameVectorDimension(gradientValues, request.direction);
    const magnitude = vectorMagnitude(request.direction);
    if (nearlyEqual(magnitude, 0)) {
      throw new Error("Directional derivatives need a nonzero direction vector.");
    }
    const unitDirection = request.direction.map((value) => value / magnitude);
    const directional = dotProduct(gradientValues, unitDirection);
    steps.push({
      title: "Normalize direction",
      expression: `u = ${formatVector(unitDirection)}`,
      detail: "Directional derivatives use a unit direction vector.",
    });
    steps.push({
      title: "Dot gradient with direction",
      expression: `D_u f = ${formatNumber(directional)}`,
      detail: "The directional derivative is the dot product of the gradient and the unit direction.",
    });

    return {
      mode: "multivariable",
      tree: parsed,
      answer: `D_u f = ${formatNumber(directional)}`,
      summary: "directional derivative",
      details: `at ${formatPointAssignments(request.point)}`,
      variables: mathVariables(parsed),
      metrics: treeMetrics(parsed),
      steps,
      artifacts: [
        ["Expression", formatMath(parsed)],
        ["Gradient", formatVector(gradientValues)],
        ["Direction", formatVector(request.direction)],
        ["Unit direction", formatVector(unitDirection)],
        ["Directional derivative", formatNumber(directional)],
      ],
      table: {
        headers: ["Variable", "Partial", "Gradient value", "Unit direction"],
        rows: gradient.map((entry, index) => [
          entry.variable,
          entry.derivative.answer,
          formatNumber(gradientValues[index]),
          formatNumber(unitDirection[index]),
        ]),
      },
    };
  }

  const symbolicGradient = `[${gradient.map((entry) => entry.derivative.answer).join(", ")}]`;
  const answer = hasGradientPoint
    ? `grad f = ${formatVector(gradientValues)}`
    : `grad f = ${symbolicGradient}`;

  return {
    mode: "multivariable",
    tree: parsed,
    answer,
    summary: "gradient",
    details: hasGradientPoint ? `at ${formatPointAssignments(request.point)}` : "symbolic gradient vector",
    variables: mathVariables(parsed),
    metrics: treeMetrics(parsed),
    steps,
    artifacts: [
      ["Expression", formatMath(parsed)],
      ["Symbolic gradient", symbolicGradient],
      ...(hasGradientPoint ? [["Gradient at point", formatVector(gradientValues)]] : []),
    ],
    table: {
      headers: ["Variable", "Partial derivative", "Value"],
      rows: gradient.map((entry, index) => [
        entry.variable,
        entry.derivative.answer,
        Number.isFinite(gradientValues[index]) ? formatNumber(gradientValues[index]) : "",
      ]),
    },
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

export function analyzeLaplaceTransform(statement) {
  const request = extractLaplaceQuestion(statement);
  const expression = parseMath(request.expression);
  if (expression.kind === "equation") {
    throw new Error("Laplace transform mode expects a function expression, not an equation.");
  }

  const expressionVariables = mathVariables(expression).filter((name) => !isMathConstantName(name));
  if (!request.variable && expressionVariables.length === 1) {
    request.variable = expressionVariables[0];
  }
  if (!request.variable) {
    request.variable = "t";
  }
  if (expressionVariables.some((name) => name !== request.variable)) {
    throw new Error("Laplace transform mode supports one input variable at a time.");
  }

  const transform = laplaceTransformExpression(expression, request.variable, request.outputVariable);
  const tree = {
    kind: "mathLaplaceTransform",
    label: "LAPLACE",
    children: [
      expression,
      statsMetricNode("input", 0),
      statsMetricNode("output", 0),
    ],
  };

  return {
    mode: "calculus",
    tree,
    answer: `L{${formatMath(expression)}} = ${transform}`,
    summary: "Laplace transform",
    details: `Transform from ${request.variable}-domain to ${request.outputVariable}-domain`,
    variables: [request.variable, request.outputVariable],
    metrics: treeMetrics(tree),
    steps: [
      {
        title: "Parse time-domain function",
        expression: `f(${request.variable}) = ${formatMath(expression)}`,
        detail: "The input is parsed into the same expression tree used by the calculus solvers.",
      },
      {
        title: "Match transform table",
        expression: "constants, powers, exponentials, sine, cosine",
        detail: "Supported nodes are mapped to their standard Laplace transform formulas.",
      },
      {
        title: "Apply linearity",
        expression: `L{${formatMath(expression)}} = ${transform}`,
        detail: "Sums and scalar multiples are transformed term by term.",
      },
    ],
    artifacts: [
      ["Function", `f(${request.variable}) = ${formatMath(expression)}`],
      ["Transform variable", request.outputVariable],
      ["Laplace transform", transform],
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

export function analyzeNumberTheory(statement) {
  const request = parseNumberTheoryInput(statement);
  const steps = [
    {
      title: "Read number theory request",
      expression: request.expression,
      detail: "The solver identifies the integer operation and validates the inputs.",
    },
  ];
  let answer;
  let summary;
  let details;
  let artifacts;
  let table;
  let treeChildren;

  if (request.operation === "gcd") {
    const result = request.values.reduce((current, value) => gcdInt(current, value));
    answer = `gcd(${request.values.join(", ")}) = ${result}`;
    summary = "greatest common divisor";
    details = "Euclidean algorithm";
    artifacts = [
      ["Values", request.values.join(", ")],
      ["GCD", String(result)],
    ];
    table = {
      headers: ["Value", "Running gcd"],
      rows: runningNumberTheoryRows(request.values, gcdInt),
    };
    treeChildren = [
      ...request.values.map((value, index) => statsMetricNode(`n${index + 1}`, value)),
      statsMetricNode("gcd", result),
    ];
    steps.push({
      title: "Apply Euclidean algorithm",
      expression: answer,
      detail: "Repeated remainders reduce the inputs to their greatest shared factor.",
    });
  } else if (request.operation === "lcm") {
    const result = request.values.reduce((current, value) => lcmInt(current, value));
    answer = `lcm(${request.values.join(", ")}) = ${result}`;
    summary = "least common multiple";
    details = "GCD-based multiple";
    artifacts = [
      ["Values", request.values.join(", ")],
      ["LCM", String(result)],
    ];
    table = {
      headers: ["Value", "Running lcm"],
      rows: runningNumberTheoryRows(request.values, lcmInt),
    };
    treeChildren = [
      ...request.values.map((value, index) => statsMetricNode(`n${index + 1}`, value)),
      statsMetricNode("lcm", result),
    ];
    steps.push({
      title: "Use gcd relationship",
      expression: "lcm(a,b) = |ab| / gcd(a,b)",
      detail: "The solver folds the input list one pair at a time.",
    });
  } else if (request.operation === "prime-factorization") {
    const factors = primeFactorization(request.value);
    const factorText = formatPrimeFactorization(factors);
    answer = `${request.value} = ${factorText}`;
    summary = "prime factorization";
    details = "Trial division over integers";
    artifacts = [
      ["Value", String(request.value)],
      ["Prime factors", factorText],
    ];
    table = {
      headers: ["Prime", "Exponent"],
      rows: factors.map((factor) => [String(factor.prime), String(factor.exponent)]),
    };
    treeChildren = [
      statsMetricNode("n", request.value),
      ...factors.map((factor) => statsMetricNode(String(factor.prime), factor.exponent)),
    ];
    steps.push({
      title: "Divide by prime factors",
      expression: factorText,
      detail: "The solver tests increasing divisors and records prime exponents.",
    });
  } else if (request.operation === "modpow") {
    const result = modularPower(request.base, request.exponent, request.modulus);
    answer = `${request.base}^${request.exponent} mod ${request.modulus} = ${result}`;
    summary = "modular exponentiation";
    details = "Repeated squaring";
    artifacts = [
      ["Base", String(request.base)],
      ["Exponent", String(request.exponent)],
      ["Modulus", String(request.modulus)],
      ["Result", String(result)],
    ];
    treeChildren = [
      statsMetricNode("base", request.base),
      statsMetricNode("exp", request.exponent),
      statsMetricNode("mod", request.modulus),
      statsMetricNode("result", result),
    ];
    steps.push({
      title: "Reduce powers modulo n",
      expression: answer,
      detail: "Repeated squaring keeps the intermediate values small.",
    });
  } else if (request.operation === "modinverse") {
    const inverse = modularInverse(request.value, request.modulus);
    answer = inverse === null
      ? `${request.value} has no inverse mod ${request.modulus}`
      : `${request.value}^-1 mod ${request.modulus} = ${inverse}`;
    summary = inverse === null ? "no modular inverse" : "modular inverse";
    details = "Extended Euclidean algorithm";
    artifacts = [
      ["Value", String(request.value)],
      ["Modulus", String(request.modulus)],
      ["GCD", String(gcdInt(request.value, request.modulus))],
      ["Inverse", inverse === null ? "none" : String(inverse)],
    ];
    treeChildren = [
      statsMetricNode("a", request.value),
      statsMetricNode("mod", request.modulus),
      statsMetricNode("gcd", gcdInt(request.value, request.modulus)),
      statsMetricNode("inverse", inverse ?? 0),
    ];
    steps.push({
      title: "Run extended Euclidean algorithm",
      expression: answer,
      detail: inverse === null
        ? "An inverse exists only when the value and modulus are relatively prime."
        : "The Bezout coefficient is normalized into the modular inverse.",
    });
  } else {
    const result = solveChineseRemainder(request.congruences);
    answer = result
      ? `x = ${result.remainder} mod ${result.modulus}`
      : "no simultaneous solution";
    summary = result ? "Chinese remainder theorem" : "inconsistent congruences";
    details = "System of modular congruences";
    artifacts = [
      ["Congruences", request.congruences.map((item) => `x = ${item.remainder} mod ${item.modulus}`).join("; ")],
      ["Solution", answer],
    ];
    table = {
      headers: ["Remainder", "Modulus"],
      rows: request.congruences.map((item) => [String(item.remainder), String(item.modulus)]),
    };
    treeChildren = [
      ...request.congruences.map((item) => statsMetricNode(`mod ${item.modulus}`, item.remainder)),
      statsMetricNode("modulus", result?.modulus ?? 0),
    ];
    steps.push({
      title: "Combine congruences",
      expression: answer,
      detail: result
        ? "Congruences are merged pairwise with modular inverses."
        : "At least one pair of congruences conflicts modulo their shared divisor.",
    });
  }

  const tree = {
    kind: "statsDistribution",
    label: "NUMBER",
    children: treeChildren,
  };

  return {
    mode: "numberTheory",
    tree,
    answer,
    summary,
    details,
    variables: [],
    metrics: treeMetrics(tree),
    steps,
    table,
    artifacts,
  };
}

export function analyzeStatistics(statement) {
  const lower = statement.toLowerCase();

  if (isMarkovQuestion(lower)) {
    return analyzeMarkovChain(statement);
  }

  if (isBayesianProportionQuestion(lower)) {
    return analyzeBayesianProportion(statement);
  }

  if (isCoxQuestion(lower)) {
    return analyzeCoxRegression(statement);
  }

  if (isTimeSeriesQuestion(lower)) {
    return analyzeTimeSeries(statement);
  }

  if (isLogRankQuestion(lower)) {
    return analyzeLogRankTest(statement);
  }

  if (isSurvivalQuestion(lower)) {
    return analyzeKaplanMeier(statement);
  }

  if (lower.includes("permutation") || lower.includes("randomization test") || lower.includes("randomisation test")) {
    return analyzePermutationTest(statement);
  }

  if (lower.includes("bootstrap")) {
    return analyzeBootstrapInterval(statement);
  }

  if (
    lower.includes("power analysis") ||
    lower.includes("statistical power") ||
    lower.includes("sample size") ||
    lower.includes("required n") ||
    lower.includes("needed n") ||
    lower.startsWith("power ")
  ) {
    return analyzePowerAnalysis(statement);
  }

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

  if (isMultivariateStatsQuestion(lower, statement)) {
    return analyzeMultivariateStatistics(statement);
  }

  if (isKMeansQuestion(lower)) {
    return analyzeKMeansClustering(statement);
  }

  if (
    lower.includes("regression") ||
    lower.includes("correlation") ||
    parsePairs(statement).length >= 2 ||
    parseXYLists(statement)
  ) {
    if (isPolynomialRegressionQuestion(lower)) {
      return analyzePolynomialRegression(statement);
    }
    if (isLogisticRegressionQuestion(lower)) {
      return analyzeLogisticRegression(statement);
    }
    if (isMultipleRegressionQuestion(lower, statement)) {
      return analyzeMultipleRegression(statement);
    }
    return analyzeRegression(statement);
  }

  return analyzeDescriptiveStatistics(statement);
}

export function analyzeUniversal(question, values = {}) {
  const lower = question.toLowerCase();
  let routed;
  let routedLabel;

  if (isMarkovQuestion(lower)) {
    routed = analyzeMarkovChain(question);
    routedLabel = "Markov chain";
  } else if (isMultivariateStatsQuestion(lower, question)) {
    routed = analyzeStatistics(question);
    routedLabel = "Multivariate statistics";
  } else if (isMatrixQuestion(lower)) {
    routed = analyzeMatrix(question);
    routedLabel = "Matrix";
  } else if (isGeometryQuestion(lower)) {
    routed = analyzeGeometry(question);
    routedLabel = "Geometry";
  } else if (isVectorQuestion(lower)) {
    routed = analyzeVector(question);
    routedLabel = "Vector";
  } else if (isFourierQuestion(lower)) {
    routed = analyzeFourierSeries(question);
    routedLabel = "Fourier series";
  } else if (isGraphQuestion(lower)) {
    routed = analyzeGraph(question);
    routedLabel = "Graph";
  } else if (isLimitQuestion(lower)) {
    routed = analyzeLimit(question);
    routedLabel = "Limit";
  } else if (isNumericalIntegrationQuestion(lower)) {
    routed = analyzeNumerical(question);
    routedLabel = "Numerical integration";
  } else if (isIntegralQuestion(lower)) {
    routed = analyzeIntegral(question);
    routedLabel = "Integral";
  } else if (isOptimizationQuestion(lower)) {
    routed = analyzeOptimization(question);
    routedLabel = "Optimization";
  } else if (isDifferentialEquationQuestion(lower)) {
    routed = analyzeDifferentialEquation(question);
    routedLabel = "Differential equation";
  } else if (isNumericalQuestion(lower)) {
    routed = analyzeNumerical(question);
    routedLabel = "Numerical";
  } else if (isSystemQuestion(lower)) {
    routed = analyzeSystem(question);
    routedLabel = "System";
  } else if (isMultivariableQuestion(lower)) {
    routed = analyzeMultivariable(question);
    routedLabel = "Multivariable";
  } else if (isDerivativeQuestion(lower)) {
    const request = extractDerivativeQuestion(question);
    routed = analyzeDerivative(request.expression, request.variable);
    routedLabel = "Derivative";
  } else if (isTaylorQuestion(lower)) {
    routed = analyzeTaylor(question);
    routedLabel = "Taylor";
  } else if (isLaplaceQuestion(lower)) {
    routed = analyzeLaplaceTransform(question);
    routedLabel = "Laplace transform";
  } else if (isComplexQuestion(lower)) {
    routed = analyzeComplex(question);
    routedLabel = "Complex";
  } else if (isFactorQuestion(lower)) {
    routed = analyzeFactoring(question);
    routedLabel = "Factor";
  } else if (isCombinatoricsQuestion(lower)) {
    routed = analyzeCombinatorics(question);
    routedLabel = "Combinatorics";
  } else if (isNumberTheoryQuestion(lower)) {
    routed = analyzeNumberTheory(question);
    routedLabel = "Number theory";
  } else if (isSequenceQuestion(lower)) {
    routed = analyzeSequence(question);
    routedLabel = "Sequence";
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
  } else if (lower.includes("svd") || lower.includes("singular value")) {
    const result = singularValueDecomposition(matrices[0]);
    answer = `singular values = ${formatVector(result.singularValues)}`;
    summary = "singular value decomposition";
    artifacts = [
      ["Matrix", formatMatrix(matrices[0])],
      ["U", formatMatrix(result.u)],
      ["Sigma", formatMatrix(result.sigma)],
      ["V^T", formatMatrix(result.vTranspose)],
      ["Singular values", formatVector(result.singularValues)],
      ["U * Sigma * V^T", formatMatrix(result.product)],
    ];
    children = [matrixNode("A", matrices[0]), matrixNode("U", result.u), matrixNode("SIGMA", result.sigma), matrixNode("VT", result.vTranspose)];
    steps = [
      {
        title: "Read matrix",
        expression: matrixShape(matrices[0]),
        detail: "SVD rewrites a matrix as A = U Sigma V^T.",
      },
      {
        title: "Diagonalize A^T A",
        expression: `singular values = ${formatVector(result.singularValues)}`,
        detail: "Singular values are the square roots of the eigenvalues of A^T A.",
      },
      {
        title: "Build singular vectors",
        expression: `U = ${formatMatrix(result.u)}, V^T = ${formatMatrix(result.vTranspose)}`,
        detail: "Right singular vectors come from A^T A; left singular vectors are Av divided by each singular value.",
      },
      {
        title: "Verify reconstruction",
        expression: formatMatrix(result.product),
        detail: "Multiplying U Sigma V^T reconstructs the original matrix up to rounding.",
      },
    ];
  } else if (lower.includes("qr") || lower.includes("gram-schmidt") || lower.includes("gram schmidt")) {
    const result = qrDecomposition(matrices[0]);
    answer = `Q = ${formatMatrix(result.q)}; R = ${formatMatrix(result.r)}`;
    summary = "QR decomposition";
    artifacts = [
      ["Matrix", formatMatrix(matrices[0])],
      ["Q", formatMatrix(result.q)],
      ["R", formatMatrix(result.r)],
      ["Q * R", formatMatrix(result.product)],
    ];
    children = [matrixNode("A", matrices[0]), matrixNode("Q", result.q), matrixNode("R", result.r)];
    steps = [
      {
        title: "Read matrix columns",
        expression: matrixShape(matrices[0]),
        detail: "QR decomposition rewrites a matrix as A = QR.",
      },
      {
        title: "Orthonormalize columns",
        expression: formatMatrix(result.q),
        detail: "Gram-Schmidt subtracts projections, then normalizes each remaining column.",
      },
      {
        title: "Recover upper-triangular factors",
        expression: formatMatrix(result.r),
        detail: "R stores the projection lengths needed to reconstruct the original columns.",
      },
      {
        title: "Verify reconstruction",
        expression: formatMatrix(result.product),
        detail: "Multiplying Q by R returns the original matrix up to rounding.",
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

export function analyzeMarkovChain(statement) {
  const request = parseMarkovInput(statement);
  const transition = request.transition;
  const steps = [
    {
      title: "Read transition matrix",
      expression: formatMatrix(transition),
      detail: "A Markov chain uses a row-stochastic transition matrix.",
    },
    {
      title: "Validate probabilities",
      expression: transition.map((row) => `sum=${formatNumber(row.reduce((sum, value) => sum + value, 0))}`).join(", "),
      detail: "Each row must contain nonnegative probabilities that add to one.",
    },
  ];

  if (request.operation === "stationary") {
    const stationary = stationaryMarkovDistribution(transition);
    const tree = {
      kind: "statsDistribution",
      label: "MARKOV",
      children: [matrixNode("P", transition), vectorNode("pi", stationary)],
    };
    steps.push(
      {
        title: "Set stationarity equation",
        expression: "pi P = pi, sum(pi)=1",
        detail: "A stationary distribution is unchanged by one transition.",
      },
      {
        title: "Solve linear system",
        expression: `pi = ${formatVector(stationary)}`,
        detail: "The normalization equation replaces one dependent stationarity equation.",
      },
    );

    return {
      mode: "statistics",
      tree,
      answer: `stationary = ${formatVector(stationary)}`,
      summary: "Markov stationary distribution",
      details: "Long-run distribution for a finite Markov chain",
      variables: [],
      metrics: treeMetrics(tree),
      steps,
      artifacts: [
        ["Transition matrix", formatMatrix(transition)],
        ["Stationary distribution", formatVector(stationary)],
      ],
      table: {
        headers: ["State", "Stationary probability"],
        rows: stationary.map((value, index) => [`S${index + 1}`, formatNumber(value)]),
      },
    };
  }

  const power = matrixPower(transition, request.steps);
  const distribution = vectorTimesMatrix(request.start, power).map(normalizeNumber);
  const tree = {
    kind: "statsDistribution",
    label: "MARKOV",
    children: [matrixNode("P", transition), vectorNode("start", request.start), vectorNode("after", distribution)],
  };
  steps.push(
    {
      title: "Raise transition matrix",
      expression: `P^${request.steps} = ${formatMatrix(power)}`,
      detail: "Repeated transitions are computed by matrix powers.",
    },
    {
      title: "Apply starting distribution",
      expression: `${formatVector(request.start)} P^${request.steps} = ${formatVector(distribution)}`,
      detail: "The starting distribution is treated as a row vector.",
    },
  );

  return {
    mode: "statistics",
    tree,
    answer: `after ${request.steps} steps = ${formatVector(distribution)}`,
    summary: "Markov n-step distribution",
    details: "Finite Markov chain transition probabilities",
    variables: [],
    metrics: treeMetrics(tree),
    steps,
    artifacts: [
      ["Transition matrix", formatMatrix(transition)],
      ["Start distribution", formatVector(request.start)],
      ["Steps", formatNumber(request.steps)],
      [`P^${request.steps}`, formatMatrix(power)],
      ["Result distribution", formatVector(distribution)],
    ],
    table: {
      headers: ["State", "Start", `After ${request.steps} steps`],
      rows: distribution.map((value, index) => [
        `S${index + 1}`,
        formatNumber(request.start[index]),
        formatNumber(value),
      ]),
    },
  };
}

export function analyzeVector(statement) {
  const request = parseVectorInput(statement);
  const steps = [
    {
      title: "Read vector request",
      expression: request.vectors.map(formatVector).join(", "),
      detail: "The solver extracts vector literals and checks their dimensions.",
    },
  ];
  let answer;
  let summary;
  let details;
  let artifacts;
  let table;
  let treeChildren;

  if (request.operation === "magnitude") {
    const vector = request.vectors[0];
    const magnitude = vectorMagnitude(vector);
    answer = `|v| = ${formatNumber(magnitude)}`;
    summary = "vector magnitude";
    details = "Euclidean norm";
    artifacts = [
      ["Vector", formatVector(vector)],
      ["Magnitude", formatNumber(magnitude)],
    ];
    treeChildren = [vectorNode("v", vector), statsMetricNode("norm", magnitude)];
    steps.push({
      title: "Compute Euclidean norm",
      expression: `sqrt(sum v_i^2) = ${formatNumber(magnitude)}`,
      detail: "The magnitude is the square root of the sum of squared components.",
    });
  } else if (request.operation === "dot") {
    const [left, right] = request.vectors;
    assertSameVectorDimension(left, right);
    const result = dotProduct(left, right);
    answer = `dot = ${formatNumber(result)}`;
    summary = "dot product";
    details = "Component-wise product sum";
    artifacts = [
      ["u", formatVector(left)],
      ["v", formatVector(right)],
      ["Dot product", formatNumber(result)],
    ];
    table = vectorPairTable(left, right, (a, b) => a * b, "Product");
    treeChildren = [vectorNode("u", left), vectorNode("v", right), statsMetricNode("dot", result)];
    steps.push({
      title: "Sum component products",
      expression: left.map((value, index) => `${formatNumber(value)}*${formatNumber(right[index])}`).join(" + "),
      detail: `The dot product is ${formatNumber(result)}.`,
    });
  } else if (request.operation === "cross") {
    const [left, right] = request.vectors;
    if (left.length !== 3 || right.length !== 3) {
      throw new Error("Cross product requires two 3D vectors.");
    }
    const result = crossProduct(left, right);
    answer = `cross = ${formatVector(result)}`;
    summary = "cross product";
    details = "3D perpendicular vector";
    artifacts = [
      ["u", formatVector(left)],
      ["v", formatVector(right)],
      ["Cross product", formatVector(result)],
    ];
    treeChildren = [vectorNode("u", left), vectorNode("v", right), vectorNode("u x v", result)];
    steps.push({
      title: "Compute determinant components",
      expression: formatVector(result),
      detail: "The cross product returns a vector perpendicular to both 3D inputs.",
    });
  } else if (request.operation === "angle") {
    const [left, right] = request.vectors;
    assertSameVectorDimension(left, right);
    const dot = dotProduct(left, right);
    const leftMagnitude = vectorMagnitude(left);
    const rightMagnitude = vectorMagnitude(right);
    if (nearlyEqual(leftMagnitude, 0) || nearlyEqual(rightMagnitude, 0)) {
      throw new Error("Angle between vectors needs two nonzero vectors.");
    }
    const cosine = Math.max(-1, Math.min(1, dot / (leftMagnitude * rightMagnitude)));
    const radians = Math.acos(cosine);
    const degrees = radians * 180 / Math.PI;
    answer = `angle = ${formatNumber(degrees)} degrees`;
    summary = "vector angle";
    details = "Angle from dot product";
    artifacts = [
      ["Dot product", formatNumber(dot)],
      ["|u|", formatNumber(leftMagnitude)],
      ["|v|", formatNumber(rightMagnitude)],
      ["cos(theta)", formatNumber(cosine)],
      ["Radians", formatNumber(radians)],
      ["Degrees", formatNumber(degrees)],
    ];
    treeChildren = [
      vectorNode("u", left),
      vectorNode("v", right),
      statsMetricNode("angle", degrees),
    ];
    steps.push({
      title: "Use dot product identity",
      expression: "cos(theta) = (u dot v) / (|u||v|)",
      detail: `The angle is ${formatNumber(degrees)} degrees.`,
    });
  } else if (request.operation === "projection") {
    const [source, target] = request.vectors;
    assertSameVectorDimension(source, target);
    const denominator = dotProduct(target, target);
    if (nearlyEqual(denominator, 0)) {
      throw new Error("Projection target vector must be nonzero.");
    }
    const scalar = dotProduct(source, target) / denominator;
    const projection = target.map((value) => scalar * value);
    answer = `projection = ${formatVector(projection)}`;
    summary = "vector projection";
    details = "Projection of one vector onto another";
    artifacts = [
      ["source", formatVector(source)],
      ["onto", formatVector(target)],
      ["Scale", formatNumber(scalar)],
      ["Projection", formatVector(projection)],
    ];
    treeChildren = [
      vectorNode("source", source),
      vectorNode("onto", target),
      vectorNode("proj", projection),
    ];
    steps.push({
      title: "Scale the target vector",
      expression: `proj = ((u dot v)/(v dot v))v = ${formatVector(projection)}`,
      detail: "The result is the component of the source vector in the target direction.",
    });
  } else {
    const [left, right] = request.vectors;
    assertSameVectorDimension(left, right);
    const difference = left.map((value, index) => value - right[index]);
    const distance = vectorMagnitude(difference);
    answer = `distance = ${formatNumber(distance)}`;
    summary = "vector distance";
    details = "Euclidean distance between two points";
    artifacts = [
      ["first", formatVector(left)],
      ["second", formatVector(right)],
      ["Difference", formatVector(difference)],
      ["Distance", formatNumber(distance)],
    ];
    treeChildren = [
      vectorNode("p", left),
      vectorNode("q", right),
      vectorNode("p - q", difference),
      statsMetricNode("distance", distance),
    ];
    steps.push({
      title: "Measure difference vector",
      expression: `|p - q| = ${formatNumber(distance)}`,
      detail: "Distance is the magnitude of the component-wise difference.",
    });
  }

  const tree = {
    kind: "matrixOperation",
    label: "VECTOR",
    children: treeChildren,
  };

  return {
    mode: "vector",
    tree,
    answer,
    summary,
    details,
    variables: [],
    metrics: treeMetrics(tree),
    steps,
    table,
    artifacts,
  };
}

export function analyzeGeometry(statement) {
  const request = parseGeometryInput(statement);
  const steps = [
    {
      title: "Read geometry request",
      expression: request.expression,
      detail: "The solver identifies the shape or coordinate problem and extracts the measurements.",
    },
  ];
  let answer;
  let summary;
  let details;
  let artifacts;
  let table;
  let treeChildren;

  if (request.operation === "circle") {
    const area = Math.PI * request.radius ** 2;
    const circumference = 2 * Math.PI * request.radius;
    answer = request.metric === "circumference"
      ? `circumference = ${formatNumber(circumference)}`
      : request.metric === "area"
        ? `area = ${formatNumber(area)}`
        : `area = ${formatNumber(area)}, circumference = ${formatNumber(circumference)}`;
    summary = "circle geometry";
    details = "Circle area and circumference";
    artifacts = [
      ["Radius", formatNumber(request.radius)],
      ["Area", formatNumber(area)],
      ["Circumference", formatNumber(circumference)],
    ];
    treeChildren = [
      statsMetricNode("r", request.radius),
      statsMetricNode("area", area),
      statsMetricNode("circ", circumference),
    ];
    steps.push({
      title: "Apply circle formulas",
      expression: "A = pi*r^2, C = 2*pi*r",
      detail: "The radius determines both area and circumference.",
    });
  } else if (request.operation === "rectangle") {
    const area = request.length * request.width;
    const perimeter = 2 * (request.length + request.width);
    answer = request.metric === "perimeter"
      ? `perimeter = ${formatNumber(perimeter)}`
      : request.metric === "area"
        ? `area = ${formatNumber(area)}`
        : `area = ${formatNumber(area)}, perimeter = ${formatNumber(perimeter)}`;
    summary = "rectangle geometry";
    details = "Rectangle area and perimeter";
    artifacts = [
      ["Length", formatNumber(request.length)],
      ["Width", formatNumber(request.width)],
      ["Area", formatNumber(area)],
      ["Perimeter", formatNumber(perimeter)],
    ];
    treeChildren = [
      statsMetricNode("length", request.length),
      statsMetricNode("width", request.width),
      statsMetricNode("area", area),
      statsMetricNode("perimeter", perimeter),
    ];
    steps.push({
      title: "Apply rectangle formulas",
      expression: "A = length*width, P = 2(length+width)",
      detail: "Rectangle geometry combines the two side lengths.",
    });
  } else if (request.operation === "triangle-base-height") {
    const area = (request.base * request.height) / 2;
    answer = `area = ${formatNumber(area)}`;
    summary = "triangle area";
    details = "Triangle area from base and height";
    artifacts = [
      ["Base", formatNumber(request.base)],
      ["Height", formatNumber(request.height)],
      ["Area", formatNumber(area)],
    ];
    treeChildren = [
      statsMetricNode("base", request.base),
      statsMetricNode("height", request.height),
      statsMetricNode("area", area),
    ];
    steps.push({
      title: "Apply triangle area formula",
      expression: `A = bh/2 = ${formatNumber(area)}`,
      detail: "A triangle is half of the rectangle with the same base and height.",
    });
  } else if (request.operation === "triangle-sides") {
    const perimeter = request.a + request.b + request.c;
    const semiperimeter = perimeter / 2;
    const areaSquared = semiperimeter *
      (semiperimeter - request.a) *
      (semiperimeter - request.b) *
      (semiperimeter - request.c);
    if (!(areaSquared > 0)) {
      throw new Error("Triangle side lengths must satisfy the triangle inequality.");
    }
    const area = Math.sqrt(areaSquared);
    answer = `area = ${formatNumber(area)}, perimeter = ${formatNumber(perimeter)}`;
    summary = "triangle side geometry";
    details = "Heron's formula";
    artifacts = [
      ["Side a", formatNumber(request.a)],
      ["Side b", formatNumber(request.b)],
      ["Side c", formatNumber(request.c)],
      ["Perimeter", formatNumber(perimeter)],
      ["Area", formatNumber(area)],
    ];
    treeChildren = [
      statsMetricNode("a", request.a),
      statsMetricNode("b", request.b),
      statsMetricNode("c", request.c),
      statsMetricNode("area", area),
      statsMetricNode("perimeter", perimeter),
    ];
    steps.push({
      title: "Apply Heron's formula",
      expression: `A = sqrt(s(s-a)(s-b)(s-c)) = ${formatNumber(area)}`,
      detail: "The semiperimeter converts three side lengths into area.",
    });
  } else if (request.operation === "pythagorean") {
    const value = solvePythagorean(request);
    answer = `${request.missing} = ${formatNumber(value)}`;
    summary = "Pythagorean theorem";
    details = "Right-triangle side solving";
    artifacts = [
      ["a", Number.isFinite(request.a) ? formatNumber(request.a) : "unknown"],
      ["b", Number.isFinite(request.b) ? formatNumber(request.b) : "unknown"],
      ["c", Number.isFinite(request.c) ? formatNumber(request.c) : "unknown"],
      [request.missing, formatNumber(value)],
    ];
    treeChildren = [
      statsMetricNode("a", Number.isFinite(request.a) ? request.a : value),
      statsMetricNode("b", Number.isFinite(request.b) ? request.b : value),
      statsMetricNode("c", Number.isFinite(request.c) ? request.c : value),
    ];
    steps.push({
      title: "Apply Pythagorean theorem",
      expression: "a^2 + b^2 = c^2",
      detail: `The missing side is ${formatNumber(value)}.`,
    });
  } else {
    const left = request.points[0];
    const right = request.points[1];
    const dx = right.x - left.x;
    const dy = right.y - left.y;
    const distance = Math.hypot(dx, dy);
    const midpoint = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
    const slope = nearlyEqual(dx, 0) ? null : dy / dx;
    if (request.operation === "midpoint") {
      answer = `midpoint = (${formatNumber(midpoint.x)}, ${formatNumber(midpoint.y)})`;
      summary = "midpoint";
      details = "Coordinate midpoint";
    } else if (request.operation === "slope") {
      answer = slope === null ? "slope = undefined" : `slope = ${formatNumber(slope)}`;
      summary = "slope";
      details = "Coordinate line slope";
    } else {
      answer = `distance = ${formatNumber(distance)}`;
      summary = "coordinate distance";
      details = "Distance formula";
    }
    artifacts = [
      ["Point 1", `(${formatNumber(left.x)}, ${formatNumber(left.y)})`],
      ["Point 2", `(${formatNumber(right.x)}, ${formatNumber(right.y)})`],
      ["dx", formatNumber(dx)],
      ["dy", formatNumber(dy)],
      ["Distance", formatNumber(distance)],
      ["Midpoint", `(${formatNumber(midpoint.x)}, ${formatNumber(midpoint.y)})`],
      ["Slope", slope === null ? "undefined" : formatNumber(slope)],
    ];
    table = {
      headers: ["Point", "x", "y"],
      rows: [
        ["1", formatNumber(left.x), formatNumber(left.y)],
        ["2", formatNumber(right.x), formatNumber(right.y)],
      ],
    };
    treeChildren = [
      statsMetricNode("x1", left.x),
      statsMetricNode("y1", left.y),
      statsMetricNode("x2", right.x),
      statsMetricNode("y2", right.y),
      statsMetricNode("distance", distance),
    ];
    steps.push({
      title: "Compute coordinate changes",
      expression: `dx = ${formatNumber(dx)}, dy = ${formatNumber(dy)}`,
      detail: "Coordinate formulas compare the two points component by component.",
    });
  }

  const tree = {
    kind: "statsDistribution",
    label: "GEOMETRY",
    children: treeChildren,
  };

  return {
    mode: "geometry",
    tree,
    answer,
    summary,
    details,
    variables: [],
    metrics: treeMetrics(tree),
    steps,
    table,
    artifacts,
  };
}

export function analyzeSequence(statement) {
  const request = parseSequenceInput(statement);
  const steps = [
    {
      title: "Read sequence request",
      expression: request.expression,
      detail: "The solver identifies the series type and extracts the needed parameters.",
    },
  ];
  let answer;
  let summary;
  let details;
  let artifacts;
  let table;
  let treeChildren;

  if (request.operation === "arithmetic") {
    const term = request.a1 + (request.n - 1) * request.d;
    const sum = (request.n / 2) * (request.a1 + term);
    answer = `a_${request.n} = ${formatNumber(term)}, S_${request.n} = ${formatNumber(sum)}`;
    summary = "arithmetic sequence";
    details = "Linear sequence with constant difference";
    artifacts = [
      ["First term", formatNumber(request.a1)],
      ["Common difference", formatNumber(request.d)],
      ["n", formatNumber(request.n)],
      [`a_${request.n}`, formatNumber(term)],
      [`S_${request.n}`, formatNumber(sum)],
    ];
    table = sequenceTermTable(request.n, (index) => request.a1 + (index - 1) * request.d);
    treeChildren = [
      statsMetricNode("a1", request.a1),
      statsMetricNode("d", request.d),
      statsMetricNode("n", request.n),
      statsMetricNode("an", term),
      statsMetricNode("sum", sum),
    ];
    steps.push(
      {
        title: "Find nth term",
        expression: `a_n = a_1 + (n - 1)d = ${formatNumber(term)}`,
        detail: "Arithmetic sequences add the same difference each step.",
      },
      {
        title: "Find partial sum",
        expression: `S_n = n(a_1 + a_n)/2 = ${formatNumber(sum)}`,
        detail: "The partial sum averages the first and nth terms, then multiplies by n.",
      },
    );
  } else if (request.operation === "geometric") {
    const term = request.a1 * request.r ** (request.n - 1);
    const sum = nearlyEqual(request.r, 1)
      ? request.a1 * request.n
      : request.a1 * (1 - request.r ** request.n) / (1 - request.r);
    answer = `a_${request.n} = ${formatNumber(term)}, S_${request.n} = ${formatNumber(sum)}`;
    summary = "geometric sequence";
    details = "Exponential sequence with constant ratio";
    artifacts = [
      ["First term", formatNumber(request.a1)],
      ["Common ratio", formatNumber(request.r)],
      ["n", formatNumber(request.n)],
      [`a_${request.n}`, formatNumber(term)],
      [`S_${request.n}`, formatNumber(sum)],
    ];
    table = sequenceTermTable(request.n, (index) => request.a1 * request.r ** (index - 1));
    treeChildren = [
      statsMetricNode("a1", request.a1),
      statsMetricNode("r", request.r),
      statsMetricNode("n", request.n),
      statsMetricNode("an", term),
      statsMetricNode("sum", sum),
    ];
    steps.push(
      {
        title: "Find nth term",
        expression: `a_n = a_1 r^(n-1) = ${formatNumber(term)}`,
        detail: "Geometric sequences multiply by the same ratio each step.",
      },
      {
        title: "Find partial sum",
        expression: nearlyEqual(request.r, 1)
          ? `S_n = n*a_1 = ${formatNumber(sum)}`
          : `S_n = a_1(1-r^n)/(1-r) = ${formatNumber(sum)}`,
        detail: "The finite geometric sum collapses repeated powers of the ratio.",
      },
    );
  } else if (request.operation === "infinite-geometric") {
    const converges = Math.abs(request.r) < 1;
    const sum = converges ? request.a1 / (1 - request.r) : Number.NaN;
    answer = converges ? `S_inf = ${formatNumber(sum)}` : "series diverges";
    summary = converges ? "infinite geometric series" : "divergent geometric series";
    details = "Infinite geometric convergence test";
    artifacts = [
      ["First term", formatNumber(request.a1)],
      ["Common ratio", formatNumber(request.r)],
      ["Converges", converges ? "yes" : "no"],
      ["Sum", converges ? formatNumber(sum) : "none"],
    ];
    treeChildren = [
      statsMetricNode("a1", request.a1),
      statsMetricNode("r", request.r),
      statsMetricNode("sum", converges ? sum : 0),
    ];
    steps.push({
      title: "Check convergence",
      expression: `|r| = ${formatNumber(Math.abs(request.r))}`,
      detail: "An infinite geometric series converges only when the common ratio has magnitude less than one.",
    });
    if (converges) {
      steps.push({
        title: "Compute infinite sum",
        expression: `S_inf = a_1/(1-r) = ${formatNumber(sum)}`,
        detail: "The shrinking tail leaves a finite limit for the partial sums.",
      });
    }
  } else {
    const values = [];
    let total = 0;
    for (let index = request.start; index <= request.end; index += 1) {
      const value = safeEvaluateMath(request.parsed, { [request.variable]: index });
      if (!Number.isFinite(value)) {
        throw new Error(`The summand was not finite at ${request.variable}=${index}.`);
      }
      values.push({ index, value });
      total += value;
    }
    answer = `sum = ${formatNumber(total)}`;
    summary = "finite series";
    details = "Sigma notation over an integer range";
    artifacts = [
      ["Summand", formatMath(request.parsed)],
      ["Variable", request.variable],
      ["Start", formatNumber(request.start)],
      ["End", formatNumber(request.end)],
      ["Terms", formatNumber(values.length)],
      ["Sum", formatNumber(total)],
    ];
    table = {
      headers: [request.variable, "Term"],
      rows: values.slice(0, 50).map((row) => [formatNumber(row.index), formatNumber(row.value)]),
    };
    treeChildren = [
      statsMetricNode("start", request.start),
      statsMetricNode("end", request.end),
      statsMetricNode("terms", values.length),
      statsMetricNode("sum", total),
    ];
    steps.push(
      {
        title: "Evaluate summand",
        expression: formatMath(request.parsed),
        detail: "The expression tree is evaluated once for each integer in the range.",
      },
      {
        title: "Add terms",
        expression: `sum = ${formatNumber(total)}`,
        detail: "The finite series is the total of all evaluated terms.",
      },
    );
  }

  const tree = {
    kind: "statsDistribution",
    label: "SERIES",
    children: treeChildren,
  };

  return {
    mode: "sequence",
    tree,
    answer,
    summary,
    details,
    variables: [],
    metrics: treeMetrics(tree),
    steps,
    table,
    artifacts,
  };
}

export function analyzeOptimization(statement, variableHint = "x") {
  if (isLinearProgrammingQuestion(statement.toLowerCase())) {
    return analyzeLinearProgramming(statement);
  }

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

function analyzeLinearProgramming(statement) {
  const request = parseLinearProgrammingInput(statement);
  const vertices = feasibleLinearProgrammingVertices(request.constraints);
  if (vertices.length === 0) {
    throw new Error("No feasible vertices found for this linear program.");
  }
  if (isLinearProgramUnbounded(request.objective.coefficients, request.constraints, request.goal)) {
    throw new Error("This linear program appears unbounded in the requested objective direction.");
  }

  const evaluated = vertices.map((point) => ({
    point,
    value: normalizeNumber(request.objective.constant + dotProduct(request.objective.coefficients, point)),
  }));
  const optimum = evaluated.reduce((best, current) => {
    if (request.goal === "maximize") {
      return current.value > best.value + EPSILON ? current : best;
    }
    return current.value < best.value - EPSILON ? current : best;
  }, evaluated[0]);
  const objectiveText = formatLinearExpression(request.objective.coefficients, request.variables, request.objective.constant);
  const answer = `${request.goal === "maximize" ? "maximum" : "minimum"} = ${formatNumber(optimum.value)} at ${formatLinearProgramPoint(optimum.point, request.variables)}`;
  const tree = {
    kind: "statsDistribution",
    label: "LP",
    children: [
      vectorNode("objective", request.objective.coefficients),
      matrixNode("A", request.constraints.map((constraint) => constraint.coefficients)),
      vectorNode("b", request.constraints.map((constraint) => constraint.bound)),
      vectorNode("optimum", optimum.point),
    ],
  };

  return {
    mode: "optimization",
    tree,
    answer,
    summary: "linear programming",
    details: `${request.goal} a linear objective over ${request.constraints.length} constraints`,
    variables: request.variables,
    metrics: treeMetrics(tree),
    steps: [
      {
        title: "Read objective and constraints",
        expression: `${request.goal} ${objectiveText}`,
        detail: "A two-variable linear program optimizes a linear objective over linear inequalities.",
      },
      {
        title: "Normalize inequalities",
        expression: request.constraints.map(formatLinearConstraint).join("; "),
        detail: "Every constraint is rewritten as ax + by <= c.",
      },
      {
        title: "Enumerate feasible vertices",
        expression: vertices.map((point) => formatLinearProgramPoint(point, request.variables)).join("; "),
        detail: "For two variables, a bounded optimum occurs at a feasible intersection of constraint boundaries.",
      },
      {
        title: "Evaluate objective at vertices",
        expression: evaluated.map((row) => `${formatLinearProgramPoint(row.point, request.variables)} -> ${formatNumber(row.value)}`).join("; "),
        detail: "The best vertex gives the optimal objective value.",
      },
    ],
    table: {
      headers: [...request.variables, "Objective", "Selected"],
      rows: evaluated.map((row) => [
        formatNumber(row.point[0]),
        formatNumber(row.point[1]),
        formatNumber(row.value),
        row === optimum ? "yes" : "",
      ]),
    },
    artifacts: [
      ["Goal", request.goal],
      ["Objective", objectiveText],
      ["Constraints", request.constraints.map(formatLinearConstraint).join("; ")],
      ["Feasible vertices", vertices.map((point) => formatLinearProgramPoint(point, request.variables)).join("; ")],
      ["Optimum", answer],
    ],
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

export function analyzeFourierSeries(statement) {
  const request = extractFourierSeriesQuestion(statement);
  const expression = parseMath(request.expression);
  if (expression.kind === "equation") {
    throw new Error("Fourier series mode expects a function expression, not an equation.");
  }

  const expressionVariables = mathVariables(expression).filter((name) => !isMathConstantName(name));
  if (!request.variable && expressionVariables.length === 1) {
    request.variable = expressionVariables[0];
  }
  if (!request.variable) {
    request.variable = "x";
  }
  if (expressionVariables.some((name) => name !== request.variable)) {
    throw new Error("Fourier series mode supports one function variable at a time.");
  }

  const result = computeFourierSeries(request, expression);
  const seriesText = formatFourierPartialSum(request, result);
  const tree = {
    kind: "mathFourierSeries",
    label: "FOURIER",
    children: [
      expression,
      statsMetricNode("order", request.order),
      statsMetricNode("a0", result.a0),
      ...result.coefficients.slice(0, 4).flatMap((coefficient) => [
        statsMetricNode(`a${coefficient.n}`, coefficient.an),
        statsMetricNode(`b${coefficient.n}`, coefficient.bn),
      ]),
    ],
  };

  return {
    mode: "calculus",
    tree,
    answer: `S_${request.order}(${request.variable}) ~= ${seriesText}`,
    summary: "Fourier series",
    details: `Partial Fourier series on [${formatFourierNumber(request.lower)}, ${formatFourierNumber(request.upper)}]`,
    variables: [request.variable],
    metrics: treeMetrics(tree),
    steps: [
      {
        title: "Parse periodic interval",
        expression: `${formatMath(expression)} on [${formatFourierNumber(request.lower)}, ${formatFourierNumber(request.upper)}]`,
        detail: "The interval is centered so sine and cosine basis functions can be scaled to the requested period.",
      },
      {
        title: "Compute Fourier coefficients",
        expression: `a_n, b_n through order ${request.order}`,
        detail: "Each coefficient is a definite integral against a sine or cosine basis function.",
      },
      {
        title: "Assemble partial sum",
        expression: `S_${request.order}(${request.variable}) ~= ${seriesText}`,
        detail: "The partial sum combines the constant term, cosine coefficients, and sine coefficients.",
      },
    ],
    table: {
      headers: ["n", "a_n", "b_n"],
      rows: [
        ["0", formatNumber(result.a0), ""],
        ...result.coefficients.map((coefficient) => [
          String(coefficient.n),
          formatNumber(coefficient.an),
          formatNumber(coefficient.bn),
        ]),
      ],
    },
    artifacts: [
      ["Function", `f(${request.variable}) = ${formatMath(expression)}`],
      ["Interval", `[${formatFourierNumber(request.lower)}, ${formatFourierNumber(request.upper)}]`],
      ["Order", formatNumber(request.order)],
      ["Quadrature", `Simpson's rule, n=${formatNumber(request.subintervals)}`],
      ["Partial sum", `S_${request.order}(${request.variable}) ~= ${seriesText}`],
    ],
    graph: result.graph,
  };
}

export function analyzeNumerical(statement) {
  const request = extractNumericalQuestion(statement);
  const expression = parseMath(request.expression);
  if (request.kind === "integral") {
    return analyzeNumericalIntegration(request, expression);
  }

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

function analyzeNumericalIntegration(request, expression) {
  if (expression.kind === "equation") {
    throw new Error("Numerical integration expects an expression, not an equation.");
  }
  const evaluator = (x) => evaluateMath(expression, { [request.variable]: x });
  const result = approximateDefiniteIntegral(evaluator, request.lower, request.upper, request.subintervals, request.method);
  const methodName = request.method === "simpson" ? "Simpson's rule" : "trapezoidal rule";
  const tree = {
    kind: "mathNumericalIntegral",
    label: request.method.toUpperCase(),
    children: [
      expression,
      statsMetricNode("a", request.lower),
      statsMetricNode("b", request.upper),
      statsMetricNode("n", request.subintervals),
    ],
  };

  return {
    mode: "numerical",
    tree,
    answer: `integral ~= ${formatNumber(result.value)}`,
    summary: `${request.method} numerical integration`,
    details: `${methodName} with ${request.subintervals} subintervals`,
    variables: mathVariables(expression),
    metrics: treeMetrics(tree),
    steps: [
      {
        title: "Parse numerical integral",
        expression: `${formatMath(expression)} from ${formatNumber(request.lower)} to ${formatNumber(request.upper)}`,
        detail: "The integrand is evaluated numerically instead of finding an antiderivative.",
      },
      {
        title: "Partition interval",
        expression: `h = ${formatNumber(result.stepSize)}, n = ${request.subintervals}`,
        detail: "The interval is divided into equal-width subintervals.",
      },
      {
        title: `Apply ${methodName}`,
        expression: `integral ~= ${formatNumber(result.value)}`,
        detail: request.method === "simpson"
          ? "Simpson's rule combines endpoint, odd-index, and even-index samples with 1-4-2 weights."
          : "The trapezoidal rule averages neighboring function values over each subinterval.",
      },
    ],
    table: result.table,
    artifacts: [
      ["Method", methodName],
      ["Integrand", formatMath(expression)],
      ["Bounds", `[${formatNumber(request.lower)}, ${formatNumber(request.upper)}]`],
      ["Subintervals", formatNumber(request.subintervals)],
      ["Step size", formatNumber(result.stepSize)],
      ["Approximation", formatNumber(result.value)],
    ],
  };
}

export function analyzeDifferentialEquation(statement) {
  if (isNumericalOdeQuestion(statement.toLowerCase())) {
    return analyzeNumericalDifferentialEquation(statement);
  }

  const request = extractDifferentialEquation(statement);
  const steps = [
    {
      title: "Identify ODE model",
      expression: request.modelName,
      detail: "The solver matches the differential equation to a closed-form model.",
    },
  ];

  let value;
  let derivativeText;
  let solutionText;
  let summary;
  let details;
  const delta = request.target - request.initialTime;

  if (request.model === "logistic") {
    value = evaluateLogisticSolution(request, request.target);
    derivativeText = `${request.dependent}' = ${formatNumber(request.rate)}${request.dependent}(1 - ${request.dependent}/${formatNumber(request.capacity)})`;
    solutionText = `${request.dependent}(${request.variable}) = ${formatNumber(request.capacity)}/(1 + ${formatNumber(request.logisticA)}e^(-${formatNumber(request.rate)}${formatOdeShift(request.variable, request.initialTime)}))`;
    summary = "logistic ODE";
    details = "Closed-form logistic growth model";
    steps.push(
      {
        title: "Separate variables",
        expression: `d${request.dependent}/(${request.dependent}(1 - ${request.dependent}/${formatNumber(request.capacity)})) = ${formatNumber(request.rate)} d${request.variable}`,
        detail: "Logistic growth separates into a rational expression in the population.",
      },
      {
        title: "Apply initial condition",
        expression: `A = (K - ${request.dependent}_0)/${request.dependent}_0 = ${formatNumber(request.logisticA)}`,
        detail: "The initial value determines the constant in the logistic curve.",
      },
    );
  } else if (request.model === "cooling") {
    value = evaluateCoolingSolution(request, request.target);
    derivativeText = `${request.dependent}' = -${formatNumber(request.rate)}(${request.dependent} - ${formatNumber(request.ambient)})`;
    solutionText = `${request.dependent}(${request.variable}) = ${formatNumber(request.ambient)} + ${formatNumber(request.initialValue - request.ambient)}e^(-${formatNumber(request.rate)}${formatOdeShift(request.variable, request.initialTime)})`;
    summary = "Newton cooling";
    details = "Closed-form Newton's law of cooling model";
    steps.push(
      {
        title: "Measure distance from ambient",
        expression: `${request.dependent} - ${formatNumber(request.ambient)}`,
        detail: "Newton cooling says the temperature gap decays exponentially.",
      },
      {
        title: "Apply initial condition",
        expression: `${request.dependent}_0 - ambient = ${formatNumber(request.initialValue - request.ambient)}`,
        detail: "The initial temperature gap sets the coefficient of the exponential.",
      },
    );
  } else if (nearlyEqual(request.power, 1)) {
    value = evaluateExponentialOdeSolution(request, request.target);
    derivativeText = `${request.dependent}' = ${formatNumber(request.rate)}${request.dependent}`;
    solutionText = `${request.dependent}(${request.variable}) = ${formatNumber(request.initialValue)}e^(${formatNumber(request.rate)}${formatOdeShift(request.variable, request.initialTime)})`;
    summary = "exponential ODE";
    details = "Closed-form exponential growth or decay";
    steps.push(
      {
        title: "Separate variables",
        expression: `d${request.dependent}/${request.dependent} = ${formatNumber(request.rate)} d${request.variable}`,
        detail: "The rate of change is proportional to the current value.",
      },
      {
        title: "Integrate both sides",
        expression: `ln|${request.dependent}| = ${formatNumber(request.rate)}${formatOdeShift(request.variable, request.initialTime)} + C`,
        detail: "Exponentiating produces an exponential solution curve.",
      },
    );
  } else {
    value = evaluatePowerOdeSolution(request, request.target);
    derivativeText = `${request.dependent}' = ${formatNumber(request.rate)}${request.dependent}^${formatNumber(request.power)}`;
    solutionText = `${request.dependent}(${request.variable}) = (${formatNumber(request.initialPower)} + ${formatNumber((1 - request.power) * request.rate)}${formatOdeShift(request.variable, request.initialTime)})^${formatNumber(1 / (1 - request.power))}`;
    summary = "separable power ODE";
    details = "Closed-form separable differential equation";
    steps.push(
      {
        title: "Separate variables",
        expression: `${request.dependent}^(-${formatNumber(request.power)}) d${request.dependent} = ${formatNumber(request.rate)} d${request.variable}`,
        detail: "All dependent-variable terms move to one side.",
      },
      {
        title: "Integrate power rule",
        expression: `${request.dependent}^{${formatNumber(1 - request.power)}} = ${formatNumber(request.initialPower)} + ${formatNumber((1 - request.power) * request.rate)}${formatOdeShift(request.variable, request.initialTime)}`,
        detail: "The power rule gives a closed form when the power is not one.",
      },
    );
  }

  if (!Number.isFinite(value)) {
    throw new Error("The ODE solution is not finite at the requested input.");
  }

  steps.push(
    {
      title: "Write closed form",
      expression: solutionText,
      detail: "The closed form can now be evaluated at any input in the model domain.",
    },
    {
      title: "Evaluate target",
      expression: `${request.dependent}(${formatNumber(request.target)}) = ${formatNumber(value)}`,
      detail: `The target is ${formatNumber(delta)} units from the initial condition.`,
    },
  );

  const tableRows = sampleOdeSolution(request).map((row) => [
    formatNumber(row.input),
    formatNumber(row.value),
  ]);
  const tree = {
    kind: "statsDistribution",
    label: "ODE",
    children: [
      statsMetricNode("initial", request.initialValue),
      statsMetricNode("rate", request.rate),
      statsMetricNode("target", request.target),
      statsMetricNode("value", value),
    ],
  };

  return {
    mode: "ode",
    tree,
    answer: `${request.dependent}(${formatNumber(request.target)}) = ${formatNumber(value)}`,
    summary,
    details,
    variables: [request.variable, request.dependent],
    metrics: treeMetrics(tree),
    steps,
    artifacts: [
      ["Differential equation", derivativeText],
      ["Initial condition", `${request.dependent}(${formatNumber(request.initialTime)}) = ${formatNumber(request.initialValue)}`],
      ["Closed form", solutionText],
      ["Evaluation", `${request.dependent}(${formatNumber(request.target)}) = ${formatNumber(value)}`],
    ],
    table: {
      headers: [request.variable, request.dependent],
      rows: tableRows,
    },
  };
}

function analyzeNumericalDifferentialEquation(statement) {
  const request = extractNumericalDifferentialEquation(statement);
  const expression = parseMath(request.expression);
  if (expression.kind === "equation") {
    throw new Error("Numerical ODE mode expects a derivative expression, not an equation.");
  }
  const solution = solveNumericalOde(request, expression);
  const methodName = request.method === "rk4" ? "Runge-Kutta 4" : "Euler method";
  const finalRow = solution.rows[solution.rows.length - 1];
  const tree = {
    kind: "mathNumericalOde",
    label: request.method.toUpperCase(),
    children: [
      expression,
      statsMetricNode("t0", request.initialTime),
      statsMetricNode("y0", request.initialValue),
      statsMetricNode("target", request.target),
      statsMetricNode("h", solution.stepSize),
    ],
  };

  return {
    mode: "ode",
    tree,
    answer: `${request.dependent}(${formatNumber(request.target)}) ~= ${formatNumber(finalRow.y)}`,
    summary: request.method === "rk4" ? "RK4 numerical ODE" : "Euler numerical ODE",
    details: `${methodName} for first-order ODE`,
    variables: [request.variable, request.dependent],
    metrics: treeMetrics(tree),
    steps: [
      {
        title: "Parse first-order ODE",
        expression: `${request.dependent}' = ${formatMath(expression)}`,
        detail: "The right-hand side is evaluated as a function of the independent variable and current dependent value.",
      },
      {
        title: "Set initial condition and step",
        expression: `${request.dependent}(${formatNumber(request.initialTime)}) = ${formatNumber(request.initialValue)}, h = ${formatNumber(solution.stepSize)}`,
        detail: "The solver advances from the initial point to the target using equal-width steps.",
      },
      {
        title: `Apply ${methodName}`,
        expression: `${request.dependent}(${formatNumber(request.target)}) ~= ${formatNumber(finalRow.y)}`,
        detail: request.method === "rk4"
          ? "RK4 combines four slope estimates per step for a higher-accuracy update."
          : "Euler's method advances with the slope at the start of each step.",
      },
    ],
    table: {
      headers: ["Step", request.variable, request.dependent, "Slope"],
      rows: solution.rows.map((row) => row.step === "..."
        ? ["...", "...", "...", "..."]
        : [
            String(row.step),
            formatNumber(row.t),
            formatNumber(row.y),
            Number.isFinite(row.slope) ? formatNumber(row.slope) : "",
          ]),
    },
    artifacts: [
      ["Method", methodName],
      ["Equation", `${request.dependent}' = ${formatMath(expression)}`],
      ["Initial condition", `${request.dependent}(${formatNumber(request.initialTime)}) = ${formatNumber(request.initialValue)}`],
      ["Target", `${request.variable} = ${formatNumber(request.target)}`],
      ["Step size", formatNumber(solution.stepSize)],
      ["Steps", formatNumber(request.steps)],
      ["Approximation", `${request.dependent}(${formatNumber(request.target)}) ~= ${formatNumber(finalRow.y)}`],
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

function analyzeBootstrapInterval(statement) {
  const request = parseBootstrapInput(statement);
  const observed = bootstrapStatistic(request.values, request.statistic);
  const distribution = bootstrapDistribution(request.values, request.statistic, request.resamples, request.seed);
  const sorted = [...distribution].sort((left, right) => left - right);
  const alpha = 1 - request.level;
  const lower = percentileFromSorted(sorted, alpha / 2);
  const upper = percentileFromSorted(sorted, 1 - alpha / 2);
  const bootstrapMean = mean(distribution);
  const bootstrapMedian = median(sorted);
  const percent = formatNumber(request.level * 100);
  const statisticLabel = request.statistic === "median" ? "median" : "mean";

  return {
    mode: "statistics",
    tree: statsDatasetNode(request.values, [
      statsMetricNode("OBS", observed),
      statsMetricNode("LOW", lower),
      statsMetricNode("HIGH", upper),
    ], "BOOTSTRAP"),
    answer: `bootstrap ${percent}% CI for ${statisticLabel} = [${formatNumber(lower)}, ${formatNumber(upper)}]`,
    summary: "bootstrap confidence interval",
    details: `Percentile bootstrap for the sample ${statisticLabel}`,
    variables: [],
    metrics: treeMetrics(statsDatasetNode(request.values)),
    steps: [
      {
        title: "Read bootstrap request",
        expression: `${request.values.length} values, ${request.resamples} resamples`,
        detail: "Bootstrap inference resamples the observed data with replacement.",
      },
      {
        title: "Compute observed statistic",
        expression: `${statisticLabel} = ${formatNumber(observed)}`,
        detail: "The observed statistic is the center of the resampling problem.",
      },
      {
        title: "Build resampling distribution",
        expression: `${request.resamples} simulated ${statisticLabel}s`,
        detail: "A seeded pseudo-random generator makes the simulation reproducible.",
      },
      {
        title: "Read percentile interval",
        expression: `[${formatNumber(lower)}, ${formatNumber(upper)}]`,
        detail: "The interval uses the lower and upper bootstrap percentiles.",
      },
    ],
    table: {
      headers: ["Quantity", "Value"],
      rows: [
        ["Observed statistic", formatNumber(observed)],
        ["Bootstrap mean", formatNumber(bootstrapMean)],
        ["Bootstrap median", formatNumber(bootstrapMedian)],
        ["Lower percentile", formatNumber(lower)],
        ["Upper percentile", formatNumber(upper)],
      ],
    },
    artifacts: [
      ["Statistic", statisticLabel],
      ["Confidence level", `${percent}%`],
      ["Resamples", formatNumber(request.resamples)],
      ["Seed", formatNumber(request.seed)],
      ["Observed statistic", formatNumber(observed)],
      ["Lower bound", formatNumber(lower)],
      ["Upper bound", formatNumber(upper)],
    ],
  };
}

function analyzePermutationTest(statement) {
  const request = parsePermutationInput(statement);
  const observedDifference = permutationDifference(request.left, request.right, request.statistic);
  const distribution = permutationDistribution(request);
  const pValue = permutationPValue(distribution, observedDifference, request.alternative);
  const decision = pValue < request.alpha ? `reject H0 at alpha=${formatNumber(request.alpha)}` : `fail to reject H0 at alpha=${formatNumber(request.alpha)}`;
  const sorted = [...distribution].sort((left, right) => left - right);
  const lowerNull = percentileFromSorted(sorted, 0.025);
  const upperNull = percentileFromSorted(sorted, 0.975);
  const statisticLabel = request.statistic === "median" ? "median" : "mean";
  const leftStatistic = bootstrapStatistic(request.left, request.statistic);
  const rightStatistic = bootstrapStatistic(request.right, request.statistic);

  return {
    mode: "statistics",
    tree: statsDatasetNode([...request.left, ...request.right], [
      statsMetricNode("DIFF", observedDifference),
      statsMetricNode("P", pValue),
      statsMetricNode("N", request.resamples),
    ], "PERMUTE"),
    answer: `permutation p = ${formatNumber(pValue)}`,
    summary: "permutation test",
    details: `${request.alternative} randomization test for two-group ${statisticLabel} difference`,
    variables: [],
    metrics: treeMetrics(statsDatasetNode([...request.left, ...request.right])),
    steps: [
      {
        title: "Read two groups",
        expression: `n1 = ${request.left.length}, n2 = ${request.right.length}`,
        detail: "The solver compares two independent samples without assuming a parametric distribution.",
      },
      {
        title: "Compute observed difference",
        expression: `${statisticLabel}1 - ${statisticLabel}2 = ${formatNumber(observedDifference)}`,
        detail: "The observed group difference is the statistic being tested.",
      },
      {
        title: "Shuffle labels",
        expression: `${request.resamples} seeded permutations`,
        detail: "Under the null hypothesis, group labels are exchangeable, so shuffled labels build a null distribution.",
      },
      {
        title: "Count extreme permutations",
        expression: `p = ${formatNumber(pValue)}`,
        detail: "The p-value is the share of shuffled differences at least as extreme as the observed difference.",
      },
      {
        title: "Make decision",
        expression: decision,
        detail: "Small p-values suggest the group labels are not exchangeable under the null.",
      },
    ],
    table: {
      headers: ["Quantity", "Value"],
      rows: [
        [`Group 1 ${statisticLabel}`, formatNumber(leftStatistic)],
        [`Group 2 ${statisticLabel}`, formatNumber(rightStatistic)],
        ["Observed difference", formatNumber(observedDifference)],
        ["Null 2.5% percentile", formatNumber(lowerNull)],
        ["Null 97.5% percentile", formatNumber(upperNull)],
        ["p-value", formatNumber(pValue)],
      ],
    },
    artifacts: [
      ["Statistic", `${statisticLabel} difference`],
      ["Alternative", request.alternative],
      ["Resamples", formatNumber(request.resamples)],
      ["Seed", formatNumber(request.seed)],
      ["Observed difference", formatNumber(observedDifference)],
      ["p-value", formatNumber(pValue)],
      ["Decision", decision],
    ],
  };
}

function analyzeKaplanMeier(statement) {
  const request = parseKaplanMeierInput(statement);
  const result = kaplanMeierEstimate(request.times, request.events);
  const finalRow = result.rows[result.rows.length - 1];
  const medianText = Number.isFinite(result.medianSurvival)
    ? formatNumber(result.medianSurvival)
    : "not reached";

  return {
    mode: "statistics",
    tree: statsDatasetNode(request.times, [
      statsMetricNode("N", request.times.length),
      statsMetricNode("EVENTS", result.eventCount),
      statsMetricNode("MEDIAN", Number.isFinite(result.medianSurvival) ? result.medianSurvival : 0),
      statsMetricNode("SURV", finalRow?.survival ?? 1),
    ], "SURVIVAL"),
    answer: `median survival = ${medianText}`,
    summary: "Kaplan-Meier survival",
    details: "Right-censored survival curve estimate",
    variables: [],
    metrics: treeMetrics(statsDatasetNode(request.times)),
    steps: [
      {
        title: "Read survival data",
        expression: `${request.times.length} subjects, ${result.eventCount} events, ${result.censoredCount} censored`,
        detail: "Each record has a follow-up time and an event indicator where 1 means the event occurred.",
      },
      {
        title: "Build risk sets",
        expression: `${result.rows.length} distinct follow-up times`,
        detail: "At each time, the risk set counts subjects who have not yet had an event or censoring before that time.",
      },
      {
        title: "Multiply conditional survival",
        expression: "S(t) = product(1 - d_i / n_i)",
        detail: "Kaplan-Meier multiplies the conditional survival probability at each event time.",
      },
      {
        title: "Find median survival",
        expression: medianText,
        detail: "The median is the first time where estimated survival is at most 0.5.",
      },
    ],
    table: {
      headers: ["Time", "At risk", "Events", "Censored", "Survival", "Std error"],
      rows: result.rows.map((row) => [
        formatNumber(row.time),
        formatNumber(row.atRisk),
        formatNumber(row.events),
        formatNumber(row.censored),
        formatNumber(row.survival),
        formatNumber(row.standardError),
      ]),
    },
    artifacts: [
      ["Subjects", formatNumber(request.times.length)],
      ["Events", formatNumber(result.eventCount)],
      ["Censored", formatNumber(result.censoredCount)],
      ["Median survival", medianText],
      ["Final survival", formatNumber(finalRow?.survival ?? 1)],
      ["Final standard error", formatNumber(finalRow?.standardError ?? 0)],
    ],
    graph: result.graph,
  };
}

function analyzeLogRankTest(statement) {
  const request = parseLogRankInput(statement);
  const result = logRankTest(request);
  const decision = result.pValue < request.alpha
    ? `reject H0 at alpha=${formatNumber(request.alpha)}`
    : `fail to reject H0 at alpha=${formatNumber(request.alpha)}`;

  return {
    mode: "statistics",
    tree: statsDatasetNode([...request.leftTimes, ...request.rightTimes], [
      statsMetricNode("O1", result.observedLeft),
      statsMetricNode("E1", result.expectedLeft),
      statsMetricNode("X2", result.chiSquare),
      statsMetricNode("P", result.pValue),
    ], "LOG-RANK"),
    answer: `chi-square = ${formatNumber(result.chiSquare)}, p = ${formatNumber(result.pValue)}`,
    summary: "log-rank test",
    details: "Two-group survival curve comparison",
    variables: [],
    metrics: treeMetrics(statsDatasetNode([...request.leftTimes, ...request.rightTimes])),
    steps: [
      {
        title: "Read two survival groups",
        expression: `group1 n=${request.leftTimes.length}, group2 n=${request.rightTimes.length}`,
        detail: "Each group contributes follow-up times and event indicators.",
      },
      {
        title: "Build pooled event times",
        expression: `${result.rows.length} event times`,
        detail: "At each observed event time, the test compares observed group events to expected events under equal survival.",
      },
      {
        title: "Accumulate observed and expected events",
        expression: `O1 = ${formatNumber(result.observedLeft)}, E1 = ${formatNumber(result.expectedLeft)}`,
        detail: "Expected events are proportional to each group's risk-set size at that time.",
      },
      {
        title: "Compute chi-square statistic",
        expression: `X^2 = ${formatNumber(result.chiSquare)}`,
        detail: "The squared observed-minus-expected difference is scaled by the log-rank variance.",
      },
      {
        title: "Make decision",
        expression: decision,
        detail: "Small p-values suggest the survival curves differ.",
      },
    ],
    table: {
      headers: ["Time", "Risk 1", "Risk 2", "Events 1", "Events 2", "Expected 1"],
      rows: result.rows.map((row) => [
        formatNumber(row.time),
        formatNumber(row.riskLeft),
        formatNumber(row.riskRight),
        formatNumber(row.eventsLeft),
        formatNumber(row.eventsRight),
        formatNumber(row.expectedLeft),
      ]),
    },
    artifacts: [
      ["Observed group 1 events", formatNumber(result.observedLeft)],
      ["Expected group 1 events", formatNumber(result.expectedLeft)],
      ["Variance", formatNumber(result.variance)],
      ["chi-square", formatNumber(result.chiSquare)],
      ["p-value", formatNumber(result.pValue)],
      ["Decision", decision],
    ],
  };
}

function analyzeCoxRegression(statement) {
  const request = parseCoxInput(statement);
  const result = coxProportionalHazards(request);
  const decision = result.pValue < request.alpha
    ? `reject H0 at alpha=${formatNumber(request.alpha)}`
    : `fail to reject H0 at alpha=${formatNumber(request.alpha)}`;

  return {
    mode: "statistics",
    tree: statsDatasetNode(request.times, [
      statsMetricNode("BETA", result.beta),
      statsMetricNode("HR", result.hazardRatio),
      statsMetricNode("Z", result.zStatistic),
      statsMetricNode("P", result.pValue),
    ], "COX"),
    answer: `hazard ratio = ${formatNumber(result.hazardRatio)}, p = ${formatNumber(result.pValue)}`,
    summary: "Cox proportional hazards",
    details: "One-covariate Cox survival regression",
    variables: ["x"],
    metrics: treeMetrics(statsDatasetNode(request.times)),
    steps: [
      {
        title: "Read survival regression data",
        expression: `${request.times.length} subjects, ${result.eventCount} events`,
        detail: "Cox regression models event hazard using follow-up times, event indicators, and a covariate.",
      },
      {
        title: "Build partial likelihood",
        expression: "L(beta) from event risk sets",
        detail: "Each event compares the event subject's covariate against the covariates in its risk set.",
      },
      {
        title: "Solve score equation",
        expression: `beta = ${formatNumber(result.beta)}`,
        detail: "Newton iteration maximizes the Cox partial likelihood.",
      },
      {
        title: "Convert to hazard ratio",
        expression: `exp(beta) = ${formatNumber(result.hazardRatio)}`,
        detail: "The hazard ratio is the multiplicative change in hazard for a one-unit covariate increase.",
      },
      {
        title: "Run Wald test",
        expression: `z = ${formatNumber(result.zStatistic)}, p = ${formatNumber(result.pValue)}`,
        detail: "The Wald test compares the fitted coefficient to zero.",
      },
    ],
    table: {
      headers: ["Time", "Events", "Risk set", "Event x sum", "Expected x sum"],
      rows: result.rows.map((row) => [
        formatNumber(row.time),
        formatNumber(row.events),
        formatNumber(row.riskSet),
        formatNumber(row.eventCovariateSum),
        formatNumber(row.expectedCovariateSum),
      ]),
    },
    artifacts: [
      ["Coefficient beta", formatNumber(result.beta)],
      ["Standard error", formatNumber(result.standardError)],
      ["Hazard ratio", formatNumber(result.hazardRatio)],
      ["z statistic", formatNumber(result.zStatistic)],
      ["p-value", formatNumber(result.pValue)],
      ["Log partial likelihood", formatNumber(result.logLikelihood)],
      ["Iterations", formatNumber(result.iterations)],
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

function analyzeTimeSeries(statement) {
  const request = parseTimeSeriesInput(statement);
  const result = fitAr1TimeSeries(request.values, request.forecastSteps);
  const lastForecast = result.forecasts[result.forecasts.length - 1];

  return {
    mode: "statistics",
    tree: statsDatasetNode(request.values, [
      statsMetricNode("PHI", result.phi),
      statsMetricNode("A", result.intercept),
      statsMetricNode("R2", result.rSquared),
      statsMetricNode("FORECAST", lastForecast.value),
    ], "AR(1)"),
    answer: `${request.forecastSteps}-step forecast = ${formatNumber(lastForecast.value)}`,
    summary: "AR(1) time-series forecast",
    details: "Autoregressive model with lag-1 dependence",
    variables: [],
    metrics: treeMetrics(statsDatasetNode(request.values)),
    steps: [
      {
        title: "Build lagged pairs",
        expression: `${request.values.length - 1} pairs: y_t on y_(t-1)`,
        detail: "AR(1) fits the current value as a linear function of the previous value.",
      },
      {
        title: "Estimate autoregressive model",
        expression: `y_t = ${formatNumber(result.intercept)} + ${formatNumber(result.phi)}y_(t-1)`,
        detail: "Least squares estimates the intercept and lag coefficient.",
      },
      {
        title: "Measure fit",
        expression: `R^2 = ${formatNumber(result.rSquared)}, lag-1 r = ${formatNumber(result.lagCorrelation)}`,
        detail: "The lag-1 correlation and R squared describe serial dependence.",
      },
      {
        title: "Forecast forward",
        expression: `${request.forecastSteps}-step forecast = ${formatNumber(lastForecast.value)}`,
        detail: "Each forecast becomes the previous value for the next step.",
      },
    ],
    table: {
      headers: ["Step", "Forecast"],
      rows: result.forecasts.map((forecast) => [
        formatNumber(forecast.step),
        formatNumber(forecast.value),
      ]),
    },
    artifacts: [
      ["Intercept", formatNumber(result.intercept)],
      ["Lag coefficient phi", formatNumber(result.phi)],
      ["Lag-1 correlation", formatNumber(result.lagCorrelation)],
      ["R squared", formatNumber(result.rSquared)],
      ["Residual SSE", formatNumber(result.sse)],
      ["Innovation SD", formatNumber(result.innovationSd)],
      ["Last observed value", formatNumber(request.values.at(-1))],
      [`${request.forecastSteps}-step forecast`, formatNumber(lastForecast.value)],
    ],
  };
}

function fitAr1TimeSeries(values, forecastSteps) {
  const lagged = values.slice(0, -1);
  const current = values.slice(1);
  const meanLag = mean(lagged);
  const meanCurrent = mean(current);
  const sxx = lagged.reduce((sum, value) => sum + (value - meanLag) ** 2, 0);
  const syy = current.reduce((sum, value) => sum + (value - meanCurrent) ** 2, 0);
  const sxy = lagged.reduce(
    (sum, value, index) => sum + (value - meanLag) * (current[index] - meanCurrent),
    0,
  );

  if (nearlyEqual(sxx, 0) || nearlyEqual(syy, 0)) {
    throw new Error("AR(1) needs variation in both lagged and current values.");
  }

  const phi = sxy / sxx;
  const intercept = meanCurrent - phi * meanLag;
  const fitted = lagged.map((value) => intercept + phi * value);
  const residuals = current.map((value, index) => value - fitted[index]);
  const sse = residuals.reduce((sum, value) => sum + value ** 2, 0);
  const rSquared = 1 - sse / syy;
  const lagCorrelation = sxy / Math.sqrt(sxx * syy);
  const innovationSd = Math.sqrt(sse / Math.max(1, current.length - 2));
  const forecasts = [];
  let previous = values.at(-1);

  for (let step = 1; step <= forecastSteps; step += 1) {
    previous = intercept + phi * previous;
    forecasts.push({
      step,
      value: normalizeNumber(previous),
    });
  }

  return {
    intercept: normalizeNumber(intercept),
    phi: normalizeNumber(phi),
    fitted: fitted.map(normalizeNumber),
    residuals: residuals.map(normalizeNumber),
    sse: normalizeNumber(sse),
    rSquared: normalizeNumber(rSquared),
    lagCorrelation: normalizeNumber(lagCorrelation),
    innovationSd: normalizeNumber(innovationSd),
    forecasts,
  };
}

function analyzePolynomialRegression(statement) {
  const request = parsePolynomialRegressionInput(statement);
  const design = request.x.map((x) =>
    Array.from({ length: request.degree + 1 }, (_, power) => x ** power),
  );
  const transposed = transposeMatrix(design);
  const normalMatrix = multiplyMatrices(transposed, design);
  const normalVector = multiplyMatrixVector(transposed, request.y);
  const coefficients = solveLinearSystem(normalMatrix, normalVector).map(normalizeNumber);
  const fitted = design.map((row) => normalizeNumber(dotProduct(row, coefficients)));
  const residuals = request.y.map((value, index) => normalizeNumber(value - fitted[index]));
  const meanY = mean(request.y);
  const sse = residuals.reduce((sum, value) => sum + value ** 2, 0);
  const tss = request.y.reduce((sum, value) => sum + (value - meanY) ** 2, 0);
  const rSquared = nearlyEqual(tss, 0) ? 1 : 1 - sse / tss;
  const equation = formatPolynomialRegressionEquation(coefficients, "x");
  const prediction = Number.isFinite(request.prediction)
    ? evaluatePolynomialRegression(coefficients, request.prediction)
    : Number.NaN;
  const hasPrediction = Number.isFinite(prediction);
  const tree = {
    kind: "statsRegression",
    label: "POLY",
    children: [
      statsDatasetNode(request.x, [], "X"),
      statsDatasetNode(request.y, [], "Y"),
      statsMetricNode("degree", request.degree),
      statsMetricNode("R2", rSquared),
    ],
  };

  return {
    mode: "statistics",
    tree,
    answer: hasPrediction
      ? `${equation}; prediction = ${formatNumber(prediction)}`
      : equation,
    summary: "polynomial regression",
    details: `${request.x.length} observations, degree ${request.degree}`,
    variables: [],
    metrics: treeMetrics(tree),
    steps: [
      {
        title: "Read paired data and degree",
        expression: `degree = ${request.degree}, points = ${request.x.map((x, index) => `(${formatNumber(x)}, ${formatNumber(request.y[index])})`).join(", ")}`,
        detail: "Polynomial regression fits a nonlinear curve to paired data.",
      },
      {
        title: "Build polynomial design matrix",
        expression: `${request.x.length} x ${request.degree + 1}`,
        detail: "Each row contains powers 1, x, x^2, and so on up to the requested degree.",
      },
      {
        title: "Solve least-squares system",
        expression: equation,
        detail: "The coefficients solve the normal equations for the smallest squared residuals.",
      },
      {
        title: "Measure curve fit",
        expression: `R^2 = ${formatNumber(rSquared)}, SSE = ${formatNumber(sse)}`,
        detail: "R squared compares the fitted curve against using only the mean response.",
      },
      ...(hasPrediction
        ? [{
            title: "Predict new response",
            expression: `prediction = ${formatNumber(prediction)}`,
            detail: "The new x value is evaluated through the fitted polynomial.",
          }]
        : []),
    ],
    table: {
      headers: ["Obs", "x", "Actual", "Fitted", "Residual"],
      rows: request.y.map((value, index) => [
        String(index + 1),
        formatNumber(request.x[index]),
        formatNumber(value),
        formatNumber(fitted[index]),
        formatNumber(residuals[index]),
      ]),
    },
    artifacts: [
      ["Equation", equation],
      ["Degree", formatNumber(request.degree)],
      ...coefficients.map((coefficient, index) => [`Coefficient x^${index}`, formatNumber(coefficient)]),
      ["SSE", formatNumber(sse)],
      ["R squared", formatNumber(rSquared)],
      ...(hasPrediction ? [["Prediction", formatNumber(prediction)]] : []),
    ],
  };
}

function analyzeMultipleRegression(statement) {
  const request = parseMultipleRegressionInput(statement);
  const design = request.y.map((_, row) => [
    1,
    ...request.predictors.map((predictor) => predictor.values[row]),
  ]);
  const transposed = transposeMatrix(design);
  const normalMatrix = multiplyMatrices(transposed, design);
  const normalVector = multiplyMatrixVector(transposed, request.y);
  const coefficients = solveLinearSystem(normalMatrix, normalVector);
  const fitted = design.map((row) => dotProduct(row, coefficients));
  const residuals = request.y.map((value, index) => value - fitted[index]);
  const meanY = mean(request.y);
  const sse = residuals.reduce((sum, value) => sum + value ** 2, 0);
  const tss = request.y.reduce((sum, value) => sum + (value - meanY) ** 2, 0);
  const rSquared = nearlyEqual(tss, 0) ? 1 : 1 - sse / tss;
  const predictorCount = request.predictors.length;
  const degreesFreedom = request.y.length - predictorCount - 1;
  const adjustedRSquared = degreesFreedom > 0
    ? 1 - (1 - rSquared) * (request.y.length - 1) / degreesFreedom
    : Number.NaN;
  const residualStdError = degreesFreedom > 0 ? Math.sqrt(sse / degreesFreedom) : Number.NaN;
  const equation = formatMultipleRegressionEquation(coefficients, request.predictors.map((predictor) => predictor.name));
  const hasPrediction = request.prediction.every(Number.isFinite);
  const prediction = hasPrediction
    ? dotProduct([1, ...request.prediction], coefficients)
    : Number.NaN;
  const tree = {
    kind: "statsRegression",
    children: [
      statsDatasetNode(request.y, [], "Y"),
      ...request.predictors.map((predictor) => statsDatasetNode(predictor.values, [], predictor.name)),
      statsMetricNode("R2", rSquared),
    ],
  };

  return {
    mode: "statistics",
    tree,
    answer: hasPrediction
      ? `${equation}; prediction = ${formatNumber(prediction)}`
      : equation,
    summary: "multiple linear regression",
    details: `${request.y.length} observations, ${predictorCount} predictors`,
    variables: [],
    metrics: treeMetrics(tree),
    steps: [
      {
        title: "Read response and predictors",
        expression: `n = ${request.y.length}, predictors = ${request.predictors.map((predictor) => predictor.name).join(", ")}`,
        detail: "Multiple regression models one response using several predictor columns.",
      },
      {
        title: "Build design matrix",
        expression: `${request.y.length} x ${predictorCount + 1}`,
        detail: "The first design column is the intercept; the remaining columns are predictors.",
      },
      {
        title: "Solve normal equations",
        expression: equation,
        detail: "Least squares solves (X'X)b = X'y for the coefficient vector.",
      },
      {
        title: "Measure fit",
        expression: `R^2 = ${formatNumber(rSquared)}, SSE = ${formatNumber(sse)}`,
        detail: "R squared measures how much response variation the model explains.",
      },
      ...(hasPrediction
        ? [{
            title: "Predict new response",
            expression: `prediction = ${formatNumber(prediction)}`,
            detail: "The new predictor values are plugged into the fitted linear model.",
          }]
        : []),
    ],
    table: {
      headers: ["Obs", "Actual", "Fitted", "Residual"],
      rows: request.y.map((value, index) => [
        String(index + 1),
        formatNumber(value),
        formatNumber(fitted[index]),
        formatNumber(residuals[index]),
      ]),
    },
    artifacts: [
      ["Equation", equation],
      ["Intercept", formatNumber(coefficients[0])],
      ...request.predictors.map((predictor, index) => [`Coefficient ${predictor.name}`, formatNumber(coefficients[index + 1])]),
      ["SSE", formatNumber(sse)],
      ["R squared", formatNumber(rSquared)],
      ["Adjusted R squared", Number.isFinite(adjustedRSquared) ? formatNumber(adjustedRSquared) : "undefined"],
      ["Residual standard error", Number.isFinite(residualStdError) ? formatNumber(residualStdError) : "undefined"],
      ...(hasPrediction ? [["Prediction", formatNumber(prediction)]] : []),
    ],
  };
}

function analyzeLogisticRegression(statement) {
  const request = parseLogisticRegressionInput(statement);
  const design = request.y.map((_, row) => [
    1,
    ...request.predictors.map((predictor) => predictor.values[row]),
  ]);
  const fit = fitLogisticRegression(design, request.y);
  const probabilities = fit.probabilities;
  const predictedClasses = probabilities.map((probability) => (probability >= 0.5 ? 1 : 0));
  const correct = predictedClasses.filter((value, index) => value === request.y[index]).length;
  const accuracy = correct / request.y.length;
  const nullProbability = mean(request.y);
  const nullLogLikelihood = request.y.reduce((sum, value) => {
    const probability = clampLogLikelihoodProbability(value === 1 ? nullProbability : 1 - nullProbability);
    return sum + Math.log(probability);
  }, 0);
  const deviance = -2 * fit.logLikelihood;
  const mcfaddenR2 = nullLogLikelihood < 0 ? 1 - fit.logLikelihood / nullLogLikelihood : Number.NaN;
  const equation = formatLogisticRegressionEquation(fit.coefficients, request.predictors.map((predictor) => predictor.name));
  const hasPrediction = request.prediction.every(Number.isFinite);
  const predictedProbability = hasPrediction
    ? logisticSigmoid(dotProduct([1, ...request.prediction], fit.coefficients))
    : Number.NaN;
  const tree = {
    kind: "statsRegression",
    label: "LOGISTIC",
    children: [
      statsDatasetNode(request.y, [], "Y"),
      ...request.predictors.map((predictor) => statsDatasetNode(predictor.values, [], predictor.name)),
      statsMetricNode("LL", fit.logLikelihood),
      statsMetricNode("ACC", accuracy),
    ],
  };

  return {
    mode: "statistics",
    tree,
    answer: hasPrediction
      ? `${equation}; P(y=1) = ${formatNumber(predictedProbability)}`
      : equation,
    summary: "logistic regression",
    details: `${request.y.length} observations, ${request.predictors.length} predictors`,
    variables: [],
    metrics: treeMetrics(tree),
    steps: [
      {
        title: "Read binary response and predictors",
        expression: `n = ${request.y.length}, predictors = ${request.predictors.map((predictor) => predictor.name).join(", ")}`,
        detail: "Logistic regression models a 0/1 response with probabilities instead of direct numeric predictions.",
      },
      {
        title: "Build logit model",
        expression: "logit(p) = b0 + b1x1 + ...",
        detail: "The logit link converts probabilities into a linear predictor.",
      },
      {
        title: "Fit by Newton iterations",
        expression: `${fit.iterations} iterations, ${fit.converged ? "converged" : "stopped"}`,
        detail: "Each iteration updates the coefficient vector using the likelihood gradient and information matrix.",
      },
      {
        title: "Measure classification fit",
        expression: `log likelihood = ${formatNumber(fit.logLikelihood)}, accuracy = ${formatNumber(accuracy)}`,
        detail: "The fitted probabilities are converted into classes using a 0.5 threshold.",
      },
      ...(hasPrediction
        ? [{
            title: "Predict probability",
            expression: `P(y=1) = ${formatNumber(predictedProbability)}`,
            detail: "The requested predictor values are plugged into the fitted logit model.",
          }]
        : []),
    ],
    table: {
      headers: ["Obs", "Actual", "P(y=1)", "Predicted"],
      rows: request.y.map((value, index) => [
        String(index + 1),
        formatNumber(value),
        formatNumber(probabilities[index]),
        formatNumber(predictedClasses[index]),
      ]),
    },
    artifacts: [
      ["Equation", equation],
      ["Intercept", formatNumber(fit.coefficients[0])],
      ...request.predictors.map((predictor, index) => [`Coefficient ${predictor.name}`, formatNumber(fit.coefficients[index + 1])]),
      ["Log likelihood", formatNumber(fit.logLikelihood)],
      ["Deviance", formatNumber(deviance)],
      ["McFadden R squared", Number.isFinite(mcfaddenR2) ? formatNumber(mcfaddenR2) : "undefined"],
      ["Accuracy", formatNumber(accuracy)],
      ["Converged", fit.converged ? "yes" : "no"],
      ...(hasPrediction ? [["Predicted probability", formatNumber(predictedProbability)]] : []),
    ],
  };
}

function analyzeMultivariateStatistics(statement) {
  const lower = statement.toLowerCase();
  const dataset = parseMultivariateStatsInput(statement);
  const columns = dataset.columns.map((column) => column.values);
  const covariance = covarianceMatrixFromColumns(columns);
  const wantsPca = lower.includes("pca") || lower.includes("principal component");
  const wantsCorrelation = lower.includes("correlation");
  const correlation = covariance.every((row, index) => row[index] > EPSILON)
    ? correlationMatrixFromCovariance(covariance)
    : null;
  if (wantsCorrelation && !correlation) {
    throw new Error("Correlation matrix needs every variable to have nonzero sample variance.");
  }
  const tree = {
    kind: "statsDistribution",
    label: wantsPca ? "PCA" : wantsCorrelation ? "CORR" : "COV",
    children: [
      ...dataset.columns.map((column) => statsDatasetNode(column.values, [], column.name)),
      matrixNode("COV", covariance),
      ...(correlation && wantsCorrelation ? [matrixNode("R", correlation)] : []),
    ],
  };

  if (wantsPca) {
    if (dataset.columns.length !== 2) {
      throw new Error("PCA currently supports exactly two variables, such as pca x: ...; y: ....");
    }
    const components = principalComponents2d(covariance);
    const pcTree = {
      ...tree,
      children: [
        ...tree.children,
        ...components.map((component, index) => vectorNode(`PC${index + 1}`, component.vector)),
      ],
    };

    return {
      mode: "statistics",
      tree: pcTree,
      answer: `PC1 variance = ${formatNumber(components[0].eigenvalue)}, explained = ${formatNumber(components[0].explained * 100)}%; direction = ${formatVector(components[0].vector)}`,
      summary: "principal component analysis",
      details: `${dataset.n} observations, 2 variables`,
      variables: [],
      metrics: treeMetrics(pcTree),
      steps: [
        {
          title: "Read variables",
          expression: dataset.columns.map((column) => `${column.name}: ${column.values.map(formatNumber).join(", ")}`).join("; "),
          detail: "PCA treats each labeled list as one variable measured on the same observations.",
        },
        {
          title: "Center variables",
          expression: dataset.columns.map((column) => `${column.name}bar = ${formatNumber(column.mean)}`).join(", "),
          detail: "Subtracting each mean makes the covariance matrix measure shared variation.",
        },
        {
          title: "Build covariance matrix",
          expression: formatMatrix(covariance),
          detail: "Sample covariance uses denominator n - 1.",
        },
        {
          title: "Find principal components",
          expression: `lambda1 = ${formatNumber(components[0].eigenvalue)}, lambda2 = ${formatNumber(components[1].eigenvalue)}`,
          detail: "The eigenvectors of the covariance matrix are the principal component directions.",
        },
      ],
      table: multivariateObservationTable(dataset),
      artifacts: [
        ["Variables", dataset.columns.map((column) => column.name).join(", ")],
        ["Observations", formatNumber(dataset.n)],
        ["Covariance matrix", formatMatrix(covariance)],
        ["Correlation matrix", correlation ? formatMatrix(correlation) : "undefined"],
        ["PC1 eigenvalue", formatNumber(components[0].eigenvalue)],
        ["PC1 explained variance", `${formatNumber(components[0].explained * 100)}%`],
        ["PC1 direction", formatVector(components[0].vector)],
        ["PC2 eigenvalue", formatNumber(components[1].eigenvalue)],
        ["PC2 explained variance", `${formatNumber(components[1].explained * 100)}%`],
        ["PC2 direction", formatVector(components[1].vector)],
      ],
    };
  }

  const matrix = wantsCorrelation ? correlation : covariance;
  const label = wantsCorrelation ? "correlation matrix" : "covariance matrix";
  return {
    mode: "statistics",
    tree: {
      ...tree,
      children: correlation && !wantsCorrelation ? [...tree.children, matrixNode("R", correlation)] : tree.children,
    },
    answer: `${label} = ${formatMatrix(matrix)}`,
    summary: label,
    details: `${dataset.n} observations, ${dataset.columns.length} variables`,
    variables: [],
    metrics: treeMetrics(tree),
    steps: [
      {
        title: "Read variables",
        expression: dataset.columns.map((column) => `${column.name}: ${column.values.map(formatNumber).join(", ")}`).join("; "),
        detail: "Each labeled list must have the same number of observations.",
      },
      {
        title: "Center variables",
        expression: dataset.columns.map((column) => `${column.name}bar = ${formatNumber(column.mean)}`).join(", "),
        detail: "Covariance and correlation compare deviations from each variable mean.",
      },
      {
        title: "Compute covariance",
        expression: formatMatrix(covariance),
        detail: "The covariance matrix stores every pairwise sample covariance.",
      },
      {
        title: "Scale to correlation",
        expression: correlation ? formatMatrix(correlation) : "undefined",
        detail: correlation
          ? "Correlation divides covariance by the product of the two sample standard deviations."
          : "A constant variable has zero sample standard deviation, so correlation is undefined.",
      },
    ],
    table: multivariateObservationTable(dataset),
    artifacts: [
      ["Variables", dataset.columns.map((column) => column.name).join(", ")],
      ["Observations", formatNumber(dataset.n)],
      ["Covariance matrix", formatMatrix(covariance)],
      ["Correlation matrix", correlation ? formatMatrix(correlation) : "undefined"],
    ],
  };
}

function analyzeKMeansClustering(statement) {
  const request = parseKMeansInput(statement);
  const result = fitKMeans(request.points, request.k);
  const tree = {
    kind: "statsDistribution",
    label: "KMEANS",
    children: [
      matrixNode("POINTS", request.points),
      matrixNode("CENTROIDS", result.centroids),
      statsMetricNode("SSE", result.sse),
    ],
  };

  return {
    mode: "statistics",
    tree,
    answer: `centroids = ${formatMatrix(result.centroids)}; SSE = ${formatNumber(result.sse)}`,
    summary: "k-means clustering",
    details: `${request.points.length} points, ${request.k} clusters`,
    variables: [],
    metrics: treeMetrics(tree),
    steps: [
      {
        title: "Read points and cluster count",
        expression: `k = ${request.k}, points = ${request.points.map(formatVector).join(", ")}`,
        detail: "K-means groups points by distance to cluster centroids.",
      },
      {
        title: "Initialize centroids",
        expression: formatMatrix(result.initialCentroids),
        detail: "The solver uses deterministic farthest-first initialization so the same input gives the same clusters.",
      },
      {
        title: "Alternate assignment and update",
        expression: `${result.iterations} iterations, ${result.converged ? "converged" : "stopped"}`,
        detail: "Each iteration assigns points to the closest centroid, then replaces each centroid with its cluster mean.",
      },
      {
        title: "Compute within-cluster SSE",
        expression: `SSE = ${formatNumber(result.sse)}`,
        detail: "SSE sums squared distances from each point to its assigned centroid.",
      },
    ],
    table: {
      headers: ["Point", "Cluster", "Squared distance"],
      rows: request.points.map((point, index) => [
        formatVector(point),
        String(result.assignments[index] + 1),
        formatNumber(squaredDistance(point, result.centroids[result.assignments[index]])),
      ]),
    },
    artifacts: [
      ["Clusters", formatNumber(request.k)],
      ["Iterations", formatNumber(result.iterations)],
      ["Converged", result.converged ? "yes" : "no"],
      ["Centroids", formatMatrix(result.centroids)],
      ["Cluster sizes", result.sizes.map(formatNumber).join(", ")],
      ["Within-cluster SSE", formatNumber(result.sse)],
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

function analyzeBayesianProportion(statement) {
  const request = parseBayesianProportionInput(statement);
  const posteriorAlpha = request.priorAlpha + request.successes;
  const posteriorBeta = request.priorBeta + request.trials - request.successes;
  const posteriorMean = posteriorAlpha / (posteriorAlpha + posteriorBeta);
  const posteriorMode = posteriorAlpha > 1 && posteriorBeta > 1
    ? (posteriorAlpha - 1) / (posteriorAlpha + posteriorBeta - 2)
    : Number.NaN;
  const lowerTail = (1 - request.level) / 2;
  const upperTail = 1 - lowerTail;
  const lower = inverseBetaCdf(lowerTail, posteriorAlpha, posteriorBeta);
  const upper = inverseBetaCdf(upperTail, posteriorAlpha, posteriorBeta);
  const percent = formatNumber(request.level * 100);
  const predictive = request.futureTrials > 0 && Number.isInteger(request.futureSuccesses)
    ? betaBinomialProbability(request.futureTrials, request.futureSuccesses, posteriorAlpha, posteriorBeta)
    : Number.NaN;
  const predictiveLabel = Number.isFinite(predictive)
    ? `P(X = ${request.futureSuccesses} of ${request.futureTrials})`
    : "";
  const tree = {
    kind: "statsDistribution",
    label: "BETA",
    children: [
      statsMetricNode("prior a", request.priorAlpha),
      statsMetricNode("prior b", request.priorBeta),
      statsMetricNode("post a", posteriorAlpha),
      statsMetricNode("post b", posteriorBeta),
    ],
  };

  return {
    mode: "statistics",
    tree,
    answer: `posterior Beta(${formatNumber(posteriorAlpha)}, ${formatNumber(posteriorBeta)}), mean = ${formatNumber(posteriorMean)}`,
    summary: "Bayesian proportion posterior",
    details: "Beta-binomial conjugate update",
    variables: [],
    metrics: treeMetrics(tree),
    steps: [
      {
        title: "Read prior and data",
        expression: `Beta(${formatNumber(request.priorAlpha)}, ${formatNumber(request.priorBeta)}), successes=${formatNumber(request.successes)}, n=${formatNumber(request.trials)}`,
        detail: "A beta prior is conjugate to binomial success-count data.",
      },
      {
        title: "Update posterior parameters",
        expression: `alpha'=${formatNumber(posteriorAlpha)}, beta'=${formatNumber(posteriorBeta)}`,
        detail: "Successes add to alpha; failures add to beta.",
      },
      {
        title: "Summarize posterior",
        expression: `mean=${formatNumber(posteriorMean)}, ${percent}% credible interval=[${formatNumber(lower)}, ${formatNumber(upper)}]`,
        detail: "The credible interval uses the beta posterior quantiles.",
      },
      ...(Number.isFinite(predictive)
        ? [{
            title: "Predict future successes",
            expression: `${predictiveLabel} = ${formatNumber(predictive)}`,
            detail: "The beta-binomial predictive distribution averages over posterior uncertainty.",
          }]
        : []),
    ],
    table: {
      headers: ["Quantity", "Value"],
      rows: [
        ["Prior alpha", formatNumber(request.priorAlpha)],
        ["Prior beta", formatNumber(request.priorBeta)],
        ["Successes", formatNumber(request.successes)],
        ["Failures", formatNumber(request.trials - request.successes)],
        ["Posterior alpha", formatNumber(posteriorAlpha)],
        ["Posterior beta", formatNumber(posteriorBeta)],
        ["Posterior mean", formatNumber(posteriorMean)],
        ["Posterior mode", Number.isFinite(posteriorMode) ? formatNumber(posteriorMode) : "undefined"],
        [`${percent}% credible interval`, `[${formatNumber(lower)}, ${formatNumber(upper)}]`],
        ...(Number.isFinite(predictive) ? [[predictiveLabel, formatNumber(predictive)]] : []),
      ],
    },
    artifacts: [
      ["Prior", `Beta(${formatNumber(request.priorAlpha)}, ${formatNumber(request.priorBeta)})`],
      ["Data", `${formatNumber(request.successes)} successes, ${formatNumber(request.trials - request.successes)} failures`],
      ["Posterior", `Beta(${formatNumber(posteriorAlpha)}, ${formatNumber(posteriorBeta)})`],
      ["Posterior mean", formatNumber(posteriorMean)],
      ["Posterior mode", Number.isFinite(posteriorMode) ? formatNumber(posteriorMode) : "undefined"],
      [`${percent}% credible interval`, `[${formatNumber(lower)}, ${formatNumber(upper)}]`],
      ...(Number.isFinite(predictive) ? [[predictiveLabel, formatNumber(predictive)]] : []),
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

function analyzePowerAnalysis(statement) {
  const request = parsePowerAnalysisInput(statement);
  const sampleSizeMode = request.mode === "sample-size";
  const sampleSize = sampleSizeMode
    ? solvePowerSampleSize(request)
    : request.n;
  const achievedPower = powerForDesign({ ...request, n: sampleSize });
  const critical = criticalValueForPower(request.alpha, request.alternative);
  const answer = sampleSizeMode
    ? formatPowerSampleSizeAnswer(request, sampleSize, achievedPower)
    : `power = ${formatNumber(achievedPower)}`;
  const tree = {
    kind: "statsDistribution",
    label: "POWER",
    children: [
      statsMetricNode("effect", request.effect),
      statsMetricNode("alpha", request.alpha),
      statsMetricNode("n", sampleSize),
      statsMetricNode("power", achievedPower),
    ],
  };

  return {
    mode: "statistics",
    tree,
    answer,
    summary: sampleSizeMode ? "sample size analysis" : "statistical power",
    details: `${request.modelLabel}, ${request.alternative} alternative`,
    variables: [],
    metrics: treeMetrics(tree),
    steps: [
      {
        title: "Choose design model",
        expression: request.modelLabel,
        detail: "Power analysis uses the planned effect size, alpha level, and test direction.",
      },
      {
        title: "Set rejection cutoff",
        expression: `z critical = ${formatNumber(critical)}`,
        detail: "The critical value is the normal cutoff implied by alpha and the alternative.",
      },
      sampleSizeMode
        ? {
            title: "Search sample size",
            expression: `${formatPowerSampleUnit(request)} = ${formatNumber(sampleSize)}`,
            detail: "The solver increases the planned sample size until predicted power reaches the target.",
          }
        : {
            title: "Use planned sample size",
            expression: `${formatPowerSampleUnit(request)} = ${formatNumber(sampleSize)}`,
            detail: "The planned sample size determines the distribution shift under the alternative.",
          },
      {
        title: "Compute power",
        expression: `power = ${formatNumber(achievedPower)}`,
        detail: "Power is the probability of rejecting the null when the specified alternative is true.",
      },
    ],
    table: {
      headers: ["Quantity", "Value"],
      rows: [
        ["Model", request.modelLabel],
        ["Alternative", request.alternative],
        ["Effect size", formatNumber(request.effect)],
        ["Alpha", formatNumber(request.alpha)],
        [formatPowerSampleUnit(request), formatNumber(sampleSize)],
        ["Power", formatNumber(achievedPower)],
      ],
    },
    artifacts: powerAnalysisArtifacts(request, sampleSize, achievedPower, critical),
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

function parseMarkovInput(text) {
  const transition = extractMatrices(text)[0];
  if (!transition) {
    throw new Error("Markov chain questions need a transition matrix, such as markov [[0.7,0.3],[0.2,0.8]].");
  }
  validateMarkovTransition(transition);

  const lower = text.toLowerCase();
  if (lower.includes("stationary") || lower.includes("steady state") || lower.includes("long-run") || lower.includes("long run")) {
    return {
      operation: "stationary",
      transition,
      steps: 0,
      start: [],
    };
  }

  const start = extractMarkovStartVector(text);
  if (start.length !== transition.length) {
    throw new Error(`Markov start distribution needs ${transition.length} probabilities.`);
  }
  validateProbabilityVector(start, "Markov start distribution");
  const steps = readMarkovSteps(text);

  return {
    operation: "distribution",
    transition,
    start,
    steps,
  };
}

function validateMarkovTransition(matrix) {
  if (matrix.length !== matrix[0].length) {
    throw new Error("Markov transition matrices must be square.");
  }
  for (const row of matrix) {
    if (row.some((value) => value < -EPSILON || value > 1 + EPSILON)) {
      throw new Error("Markov transition probabilities must be between 0 and 1.");
    }
    const total = row.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 1) > 1e-6) {
      throw new Error("Each Markov transition row must add to 1.");
    }
  }
}

function extractMarkovStartVector(text) {
  const direct = text.match(/\b(?:start|initial|distribution)\s*=?\s*(\[[^\]]+\])/i);
  if (direct) {
    return parseVectorLiteral(direct[1]);
  }
  const withoutMatrices = removeMatrixLiterals(text);
  const vectors = extractVectors(withoutMatrices);
  if (vectors.length > 0) {
    return vectors[0];
  }
  throw new Error("Markov n-step questions need a start distribution, such as start [1,0].");
}

function removeMatrixLiterals(text) {
  let result = "";
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "[" && text[index + 1] === "[") {
      let depth = 0;
      for (; index < text.length; index += 1) {
        if (text[index] === "[") depth += 1;
        if (text[index] === "]") depth -= 1;
        if (depth === 0) break;
      }
      result += " ";
    } else {
      result += text[index];
    }
  }
  return result;
}

function validateProbabilityVector(vector, context) {
  if (vector.some((value) => value < -EPSILON || value > 1 + EPSILON)) {
    throw new Error(`${context} probabilities must be between 0 and 1.`);
  }
  const total = vector.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 1e-6) {
    throw new Error(`${context} must add to 1.`);
  }
}

function readMarkovSteps(text) {
  const match = text.match(/\b(?:steps?|n|t|after)\s*=?\s*(\d+)\b/i);
  const steps = match ? Number(match[1]) : 1;
  if (!Number.isSafeInteger(steps) || steps < 0 || steps > 1000) {
    throw new Error("Markov steps must be an integer from 0 through 1000.");
  }
  return steps;
}

function parseVectorInput(text) {
  const vectors = extractVectors(text);
  const lower = text.toLowerCase();
  let operation;
  if (lower.startsWith("magnitude") || lower.startsWith("norm") || lower.startsWith("length")) {
    operation = "magnitude";
  } else if (lower.startsWith("cross") || lower.includes("cross product")) {
    operation = "cross";
  } else if (lower.startsWith("angle") || lower.includes("angle between")) {
    operation = "angle";
  } else if (lower.startsWith("projection") || lower.includes("project ")) {
    operation = "projection";
  } else if (lower.startsWith("distance") || lower.includes("distance between")) {
    operation = "distance";
  } else {
    operation = "dot";
  }

  const expected = operation === "magnitude" ? 1 : 2;
  if (vectors.length < expected) {
    throw new Error(`${operation} needs ${expected} vector${expected === 1 ? "" : "s"}, such as dot [1,2] [3,4].`);
  }

  return {
    operation,
    vectors: vectors.slice(0, expected),
  };
}

function extractVectors(text) {
  const vectors = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "[" || text[index + 1] === "[") {
      continue;
    }
    const start = index;
    let depth = 0;
    for (; index < text.length; index += 1) {
      if (text[index] === "[") depth += 1;
      if (text[index] === "]") depth -= 1;
      if (depth === 0) {
        vectors.push(parseVectorLiteral(text.slice(start, index + 1)));
        break;
      }
    }
  }
  return vectors;
}

function parseVectorLiteral(literal) {
  let vector;
  try {
    vector = JSON.parse(literal);
  } catch {
    throw new Error(`Invalid vector notation '${literal}'. Use [1,2,3].`);
  }
  if (!Array.isArray(vector) || vector.length === 0 || vector.some((value) => !Number.isFinite(Number(value)))) {
    throw new Error("Vector entries must be numbers.");
  }
  return vector.map(Number);
}

function parseGeometryInput(text) {
  const lower = text.toLowerCase();
  if (lower.includes("circle") || lower.startsWith("circumference")) {
    const numbers = parseNumbers(text);
    const radius = readNamedNumber(text, ["radius", "r"], numbers[0]);
    if (!(radius > 0)) {
      throw new Error("Circle geometry needs a positive radius.");
    }
    return {
      operation: "circle",
      radius,
      metric: lower.includes("circumference") ? "circumference" : lower.includes("area") ? "area" : "both",
      expression: `circle radius=${formatNumber(radius)}`,
    };
  }

  if (lower.includes("rectangle")) {
    const numbers = parseNumbers(text);
    const length = readNamedNumber(text, ["length", "l"], numbers[0]);
    const width = readNamedNumber(text, ["width", "w"], numbers[1]);
    if (!(length > 0) || !(width > 0)) {
      throw new Error("Rectangle geometry needs positive length and width.");
    }
    return {
      operation: "rectangle",
      length,
      width,
      metric: lower.includes("perimeter") ? "perimeter" : lower.includes("area") ? "area" : "both",
      expression: `rectangle length=${formatNumber(length)}, width=${formatNumber(width)}`,
    };
  }

  if (lower.includes("pythagorean") || lower.includes("hypotenuse")) {
    const numbers = parseNumbers(text);
    const a = readNamedNumber(text, ["a", "leg1"], numbers[0]);
    const b = readNamedNumber(text, ["b", "leg2"], numbers[1]);
    const c = readNamedNumber(text, ["c", "hypotenuse"], Number.NaN);
    const known = [a, b, c].filter(Number.isFinite).length;
    if (known !== 2) {
      throw new Error("Pythagorean solving needs exactly two of a, b, and c.");
    }
    const missing = Number.isFinite(a) ? Number.isFinite(b) ? "c" : "b" : "a";
    return {
      operation: "pythagorean",
      a,
      b,
      c,
      missing,
      expression: `a=${Number.isFinite(a) ? formatNumber(a) : "?"}, b=${Number.isFinite(b) ? formatNumber(b) : "?"}, c=${Number.isFinite(c) ? formatNumber(c) : "?"}`,
    };
  }

  if (lower.includes("triangle")) {
    const numbers = parseNumbers(text);
    const base = readNamedNumber(text, ["base"], Number.NaN);
    const height = readNamedNumber(text, ["height", "h"], Number.NaN);
    if (Number.isFinite(base) && Number.isFinite(height)) {
      if (!(base > 0) || !(height > 0)) {
        throw new Error("Triangle base and height must be positive.");
      }
      return {
        operation: "triangle-base-height",
        base,
        height,
        expression: `triangle base=${formatNumber(base)}, height=${formatNumber(height)}`,
      };
    }
    const a = readNamedNumber(text, ["a", "side1"], numbers[0]);
    const b = readNamedNumber(text, ["b", "side2"], numbers[1]);
    const c = readNamedNumber(text, ["c", "side3"], numbers[2]);
    if (!(a > 0) || !(b > 0) || !(c > 0)) {
      throw new Error("Triangle side geometry needs three positive side lengths.");
    }
    return {
      operation: "triangle-sides",
      a,
      b,
      c,
      expression: `triangle sides ${formatNumber(a)}, ${formatNumber(b)}, ${formatNumber(c)}`,
    };
  }

  const points = parsePairs(text);
  if (points.length < 2) {
    throw new Error("Coordinate geometry needs two points, such as distance between (1,2) and (4,6).");
  }
  return {
    operation: lower.includes("midpoint") ? "midpoint" : lower.includes("slope") ? "slope" : "distance",
    points: points.slice(0, 2),
    expression: `(${formatNumber(points[0].x)}, ${formatNumber(points[0].y)}) to (${formatNumber(points[1].x)}, ${formatNumber(points[1].y)})`,
  };
}

function solvePythagorean(request) {
  if (request.missing === "c") {
    return Math.sqrt(request.a ** 2 + request.b ** 2);
  }
  if (request.missing === "a") {
    if (request.c <= request.b) {
      throw new Error("Hypotenuse must be longer than each leg.");
    }
    return Math.sqrt(request.c ** 2 - request.b ** 2);
  }
  if (request.c <= request.a) {
    throw new Error("Hypotenuse must be longer than each leg.");
  }
  return Math.sqrt(request.c ** 2 - request.a ** 2);
}

function parseSequenceInput(text) {
  const lower = text.toLowerCase();
  if (lower.includes("arithmetic")) {
    const numbers = parseSequenceNumbers(text);
    const a1 = readNamedNumber(text, ["a1", "a_1", "first", "start", "a"], numbers[0]);
    const d = readNamedNumber(text, ["d", "difference", "diff"], numbers[1]);
    const n = readNamedNumber(text, ["n", "term", "terms"], numbers[2]);
    validateSequenceParams([a1, d, n], "Arithmetic sequence needs a1, d, and n.");
    validatePositiveInteger(n, "Arithmetic sequence n");
    return {
      operation: "arithmetic",
      a1,
      d,
      n,
      expression: `a1=${formatNumber(a1)}, d=${formatNumber(d)}, n=${formatNumber(n)}`,
    };
  }

  if (lower.includes("geometric")) {
    const numbers = parseSequenceNumbers(text);
    const a1 = readNamedNumber(text, ["a1", "a_1", "first", "start", "a"], numbers[0]);
    const r = readNamedNumber(text, ["r", "ratio"], numbers[1]);
    validateSequenceParams([a1, r], "Geometric sequence needs a1 and r.");
    if (lower.includes("infinite")) {
      return {
        operation: "infinite-geometric",
        a1,
        r,
        expression: `a1=${formatNumber(a1)}, r=${formatNumber(r)}`,
      };
    }
    const n = readNamedNumber(text, ["n", "term", "terms"], numbers[2]);
    validateSequenceParams([n], "Finite geometric sequence needs n.");
    validatePositiveInteger(n, "Geometric sequence n");
    return {
      operation: "geometric",
      a1,
      r,
      n,
      expression: `a1=${formatNumber(a1)}, r=${formatNumber(r)}, n=${formatNumber(n)}`,
    };
  }

  return parseFiniteSeriesInput(text);
}

function parseFiniteSeriesInput(text) {
  const cleaned = text.replace(/[?!.]+$/, "").trim();
  let expression;
  let variable;
  let start;
  let end;
  const boundsFirst = cleaned.match(/^(?:sum|sigma|summation|series)\s+([A-Za-z_]\w*)\s*=\s*(-?\d+)\s+to\s+(-?\d+)\s+(?:of\s+)?(.+)$/i);
  const expressionFirst = cleaned.match(/^(?:sum|sigma|summation|series)\s+(?:of\s+)?(.+?)\s+from\s+([A-Za-z_]\w*)\s*=\s*(-?\d+)\s+to\s+(-?\d+)$/i);

  if (boundsFirst) {
    [, variable, start, end, expression] = boundsFirst;
  } else if (expressionFirst) {
    [, expression, variable, start, end] = expressionFirst;
  } else {
    throw new Error("Use a finite sum such as sum k^2 from k=1 to 5.");
  }

  start = Number(start);
  end = Number(end);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end) {
    throw new Error("Finite sums need integer bounds with start <= end.");
  }
  if (end - start > 10000) {
    throw new Error("Finite sums support at most 10001 evaluated terms.");
  }

  const parsed = parseMath(expression.trim());
  if (parsed.kind === "equation") {
    throw new Error("Finite sums need an expression, not an equation.");
  }

  return {
    operation: "finite-series",
    variable,
    start,
    end,
    parsed,
    expression: `${formatMath(parsed)}, ${variable}=${start}..${end}`,
  };
}

function parseSequenceNumbers(text) {
  return parseNumbers(text.replace(/\b[A-Za-z_]\w*\s*=/g, ""));
}

function validateSequenceParams(values, message) {
  if (!values.every(Number.isFinite)) {
    throw new Error(message);
  }
}

function validatePositiveInteger(value, context) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${context} must be a positive integer.`);
  }
}

function sequenceTermTable(n, termAt) {
  const count = Math.min(n, 25);
  return {
    headers: ["n", "a_n"],
    rows: Array.from({ length: count }, (_, index) => {
      const termNumber = index + 1;
      return [formatNumber(termNumber), formatNumber(termAt(termNumber))];
    }),
  };
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

function vectorNode(label, vector) {
  return {
    kind: "matrixRow",
    label,
    children: vector.map((value) => statsMetricNode("VALUE", value)),
  };
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

function assertSameVectorDimension(left, right) {
  if (left.length !== right.length) {
    throw new Error("Vector operations need vectors with the same dimension.");
  }
}

function dotProduct(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function crossProduct(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function vectorMagnitude(vector) {
  return Math.sqrt(dotProduct(vector, vector));
}

function vectorPairTable(left, right, combiner, label) {
  return {
    headers: ["Index", "u", "v", label],
    rows: left.map((value, index) => [
      String(index + 1),
      formatNumber(value),
      formatNumber(right[index]),
      formatNumber(combiner(value, right[index])),
    ]),
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

function transposeMatrix(matrix) {
  return matrix[0].map((_, column) => matrix.map((row) => row[column]));
}

function multiplyMatrixVector(matrix, vector) {
  if (matrix[0].length !== vector.length) {
    throw new Error("Matrix-vector multiplication dimensions do not match.");
  }
  return matrix.map((row) => dotProduct(row, vector));
}

function qrDecomposition(matrix) {
  const rowCount = matrix.length;
  const columnCount = matrix[0].length;
  if (rowCount < columnCount) {
    throw new Error("QR decomposition needs at least as many rows as columns.");
  }

  const columns = transposeMatrix(matrix);
  const qColumns = [];
  const r = Array.from({ length: columnCount }, () => Array(columnCount).fill(0));

  for (let column = 0; column < columnCount; column += 1) {
    let vector = [...columns[column]];
    for (let prior = 0; prior < column; prior += 1) {
      const projectionLength = dotProduct(qColumns[prior], columns[column]);
      r[prior][column] = normalizeNumber(projectionLength);
      vector = vector.map((value, index) => value - projectionLength * qColumns[prior][index]);
    }

    const norm = vectorMagnitude(vector);
    if (norm <= EPSILON) {
      throw new Error("QR decomposition needs linearly independent columns.");
    }
    r[column][column] = normalizeNumber(norm);
    qColumns.push(vector.map((value) => normalizeNumber(value / norm)));
  }

  const q = transposeMatrix(qColumns).map((row) => row.map(normalizeNumber));
  const normalizedR = r.map((row) => row.map(normalizeNumber));
  return {
    q,
    r: normalizedR,
    product: multiplyMatrices(q, normalizedR).map((row) => row.map(normalizeNumber)),
  };
}

function singularValueDecomposition(matrix) {
  const rowCount = matrix.length;
  const columnCount = matrix[0].length;
  if (columnCount < 1 || columnCount > 2 || rowCount < columnCount) {
    throw new Error("SVD currently supports full-rank matrices with one or two columns and rows >= columns.");
  }

  const transposed = transposeMatrix(matrix);
  const gram = multiplyMatrices(transposed, matrix).map((row) => row.map(normalizeNumber));
  const eigen = symmetricEigenDecompositionUpTo2x2(gram);
  const singularValues = eigen.values.map((value) => normalizeNumber(Math.sqrt(Math.max(0, value))));
  if (singularValues.some((value) => value <= EPSILON)) {
    throw new Error("SVD currently needs full column rank.");
  }

  const v = transposeMatrix(eigen.vectors).map((row) => row.map(normalizeNumber));
  const uColumns = eigen.vectors.map((vector, index) =>
    multiplyMatrixVector(matrix, vector).map((value) => normalizeNumber(value / singularValues[index])),
  );
  const u = transposeMatrix(uColumns).map((row) => row.map(normalizeNumber));
  const sigma = singularValues.map((value, row) =>
    singularValues.map((_, column) => (row === column ? value : 0)),
  );
  const vTranspose = transposeMatrix(v).map((row) => row.map(normalizeNumber));
  const product = multiplyMatrices(multiplyMatrices(u, sigma), vTranspose).map((row) => row.map(normalizeNumber));

  return {
    u,
    sigma,
    vTranspose,
    singularValues,
    product,
  };
}

function symmetricEigenDecompositionUpTo2x2(matrix) {
  if (matrix.length === 1 && matrix[0].length === 1) {
    return {
      values: [normalizeNumber(matrix[0][0])],
      vectors: [[1]],
    };
  }
  if (matrix.length !== 2 || matrix[0].length !== 2) {
    throw new Error("SVD currently supports one-column or two-column matrices.");
  }

  const a = matrix[0][0];
  const b = matrix[0][1];
  const d = matrix[1][1];
  const trace = a + d;
  const spread = Math.sqrt((a - d) ** 2 + 4 * b ** 2);
  const values = [
    normalizeNumber((trace + spread) / 2),
    normalizeNumber((trace - spread) / 2),
  ];
  const vectors = nearlyEqual(b, 0)
    ? (a >= d ? [[1, 0], [0, 1]] : [[0, 1], [1, 0]])
    : values.map((lambda) => normalizeUnitVector([b, lambda - a]));

  return {
    values,
    vectors,
  };
}

function fitLogisticRegression(design, yValues) {
  const parameterCount = design[0].length;
  let coefficients = Array(parameterCount).fill(0);
  let converged = false;
  let iterations = 0;
  let probabilities = design.map(() => 0.5);
  const ridge = 1e-6;

  for (let iteration = 0; iteration < 60; iteration += 1) {
    probabilities = design.map((row) => logisticSigmoid(dotProduct(row, coefficients)));
    const gradient = Array(parameterCount).fill(0);
    const information = Array.from({ length: parameterCount }, () => Array(parameterCount).fill(0));

    for (let rowIndex = 0; rowIndex < design.length; rowIndex += 1) {
      const row = design[rowIndex];
      const probability = probabilities[rowIndex];
      const residual = yValues[rowIndex] - probability;
      const weight = probability * (1 - probability);

      for (let left = 0; left < parameterCount; left += 1) {
        gradient[left] += row[left] * residual;
        for (let right = 0; right < parameterCount; right += 1) {
          information[left][right] += row[left] * row[right] * weight;
        }
      }
    }

    for (let index = 0; index < parameterCount; index += 1) {
      information[index][index] += ridge;
    }

    const delta = solveLinearSystem(information, gradient);
    coefficients = coefficients.map((coefficient, index) => normalizeNumber(coefficient + delta[index]));
    iterations = iteration + 1;

    if (Math.max(...delta.map(Math.abs)) < 1e-7) {
      converged = true;
      break;
    }
  }

  probabilities = design.map((row) => logisticSigmoid(dotProduct(row, coefficients)));
  const logLikelihood = yValues.reduce((sum, value, index) => {
    const probability = clampLogLikelihoodProbability(probabilities[index]);
    return sum + (value === 1 ? Math.log(probability) : Math.log(1 - probability));
  }, 0);

  return {
    coefficients,
    probabilities: probabilities.map(normalizeNumber),
    logLikelihood: normalizeNumber(logLikelihood),
    iterations,
    converged,
  };
}

function logisticSigmoid(value) {
  if (value >= 0) {
    return 1 / (1 + Math.exp(-value));
  }
  const scaled = Math.exp(value);
  return scaled / (1 + scaled);
}

function clampLogLikelihoodProbability(value) {
  return Math.min(1 - 1e-12, Math.max(1e-12, value));
}

function fitKMeans(points, k) {
  const initialCentroids = initializeKMeansCentroids(points, k);
  let centroids = initialCentroids.map((point) => [...point]);
  let assignments = Array(points.length).fill(-1);
  let converged = false;
  let iterations = 0;

  for (let iteration = 0; iteration < 100; iteration += 1) {
    const nextAssignments = points.map((point) => nearestCentroidIndex(point, centroids));
    const nextCentroids = centroids.map((centroid, cluster) => {
      const members = points.filter((_, index) => nextAssignments[index] === cluster);
      return members.length ? meanPoint(members) : centroid;
    });

    iterations = iteration + 1;
    if (
      nextAssignments.every((assignment, index) => assignment === assignments[index]) &&
      nextCentroids.every((centroid, index) => squaredDistance(centroid, centroids[index]) < EPSILON)
    ) {
      assignments = nextAssignments;
      centroids = nextCentroids;
      converged = true;
      break;
    }

    assignments = nextAssignments;
    centroids = nextCentroids;
  }

  const normalizedCentroids = centroids.map((centroid) => centroid.map(normalizeNumber));
  const sse = points.reduce(
    (sum, point, index) => sum + squaredDistance(point, normalizedCentroids[assignments[index]]),
    0,
  );
  const sizes = normalizedCentroids.map((_, cluster) =>
    assignments.filter((assignment) => assignment === cluster).length,
  );

  return {
    initialCentroids,
    centroids: normalizedCentroids,
    assignments,
    sizes,
    sse: normalizeNumber(sse),
    iterations,
    converged,
  };
}

function initializeKMeansCentroids(points, k) {
  const centroids = [[...points[0]]];
  while (centroids.length < k) {
    let nextPoint = points[0];
    let bestDistance = -Infinity;
    for (const point of points) {
      const distance = Math.min(...centroids.map((centroid) => squaredDistance(point, centroid)));
      if (distance > bestDistance + EPSILON) {
        bestDistance = distance;
        nextPoint = point;
      }
    }
    centroids.push([...nextPoint]);
  }
  return centroids;
}

function nearestCentroidIndex(point, centroids) {
  let bestIndex = 0;
  let bestDistance = squaredDistance(point, centroids[0]);
  for (let index = 1; index < centroids.length; index += 1) {
    const distance = squaredDistance(point, centroids[index]);
    if (distance < bestDistance - EPSILON) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function squaredDistance(left, right) {
  return left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0);
}

function meanPoint(points) {
  const dimension = points[0].length;
  return Array.from({ length: dimension }, (_, column) =>
    normalizeNumber(points.reduce((sum, point) => sum + point[column], 0) / points.length),
  );
}

function feasibleLinearProgrammingVertices(constraints) {
  const vertices = [];
  for (let left = 0; left < constraints.length; left += 1) {
    for (let right = left + 1; right < constraints.length; right += 1) {
      const point = intersectLinearConstraints(constraints[left], constraints[right]);
      if (point && isLinearProgramPointFeasible(point, constraints)) {
        vertices.push(point.map(normalizeNumber));
      }
    }
  }
  return uniquePoints2d(vertices);
}

function intersectLinearConstraints(left, right) {
  const [a1, b1] = left.coefficients;
  const [a2, b2] = right.coefficients;
  const determinantValue = a1 * b2 - a2 * b1;
  if (nearlyEqual(determinantValue, 0)) {
    return null;
  }
  return [
    (left.bound * b2 - right.bound * b1) / determinantValue,
    (a1 * right.bound - a2 * left.bound) / determinantValue,
  ];
}

function isLinearProgramPointFeasible(point, constraints) {
  return constraints.every((constraint) =>
    dotProduct(constraint.coefficients, point) <= constraint.bound + 1e-7,
  );
}

function uniquePoints2d(points) {
  const unique = [];
  for (const point of points) {
    if (!unique.some((existing) => squaredDistance(existing, point) < 1e-10)) {
      unique.push(point);
    }
  }
  return unique.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
}

function isLinearProgramUnbounded(objectiveCoefficients, constraints, goal) {
  const directionObjective = goal === "maximize"
    ? objectiveCoefficients
    : objectiveCoefficients.map((value) => -value);
  if (vectorMagnitude(directionObjective) <= EPSILON) {
    return false;
  }
  const candidateDirections = [
    directionObjective,
    directionObjective.map((value) => -value),
    ...constraints.flatMap((constraint) => {
      const [a, b] = constraint.coefficients;
      return [[b, -a], [-b, a]];
    }),
  ];
  return candidateDirections.some((direction) =>
    vectorMagnitude(direction) > EPSILON &&
    dotProduct(directionObjective, direction) > EPSILON &&
    constraints.every((constraint) => dotProduct(constraint.coefficients, direction) <= EPSILON),
  );
}

function covarianceMatrixFromColumns(columns) {
  const means = columns.map(mean);
  const n = columns[0].length;
  return columns.map((left, row) =>
    columns.map((right, column) =>
      normalizeNumber(left.reduce(
        (sum, value, index) => sum + (value - means[row]) * (right[index] - means[column]),
        0,
      ) / (n - 1)),
    ),
  );
}

function correlationMatrixFromCovariance(covariance) {
  return covariance.map((row, rowIndex) =>
    row.map((value, columnIndex) => {
      if (rowIndex === columnIndex) return 1;
      const scale = Math.sqrt(covariance[rowIndex][rowIndex] * covariance[columnIndex][columnIndex]);
      if (scale <= EPSILON) {
        throw new Error("Correlation matrix needs every variable to have nonzero sample variance.");
      }
      return normalizeNumber(value / scale);
    }),
  );
}

function principalComponents2d(covariance) {
  const a = covariance[0][0];
  const b = covariance[0][1];
  const d = covariance[1][1];
  const totalVariance = a + d;
  if (totalVariance <= EPSILON) {
    throw new Error("PCA needs data with positive total variance.");
  }

  const spread = Math.sqrt((a - d) ** 2 + 4 * b ** 2);
  const eigenvalues = [
    normalizeNumber((totalVariance + spread) / 2),
    normalizeNumber((totalVariance - spread) / 2),
  ];
  const vectors = nearlyEqual(b, 0)
    ? (a >= d ? [[1, 0], [0, 1]] : [[0, 1], [1, 0]])
    : eigenvalues.map((lambda) => normalizeUnitVector([b, lambda - a]));

  return eigenvalues.map((eigenvalue, index) => ({
    eigenvalue,
    vector: vectors[index],
    explained: normalizeNumber(eigenvalue / totalVariance),
  }));
}

function normalizeUnitVector(vector) {
  const magnitude = vectorMagnitude(vector);
  if (magnitude <= EPSILON) {
    return vector.map(normalizeNumber);
  }
  const unit = vector.map((value) => value / magnitude);
  const firstNonzero = unit.find((value) => !nearlyEqual(value, 0));
  const oriented = firstNonzero !== undefined && firstNonzero < 0
    ? unit.map((value) => -value)
    : unit;
  return oriented.map(normalizeNumber);
}

function identityMatrix(size) {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => (row === column ? 1 : 0)),
  );
}

function matrixPower(matrix, exponent) {
  let result = identityMatrix(matrix.length);
  let factor = matrix;
  let power = exponent;
  while (power > 0) {
    if (power % 2 === 1) {
      result = multiplyMatrices(result, factor);
    }
    factor = multiplyMatrices(factor, factor);
    power = Math.floor(power / 2);
  }
  return result.map((row) => row.map(normalizeNumber));
}

function vectorTimesMatrix(vector, matrix) {
  if (vector.length !== matrix.length) {
    throw new Error("Vector length must match matrix rows.");
  }
  return matrix[0].map((_, column) =>
    vector.reduce((sum, value, row) => sum + value * matrix[row][column], 0),
  );
}

function stationaryMarkovDistribution(matrix) {
  const size = matrix.length;
  const system = [];
  const constants = [];
  for (let column = 0; column < size - 1; column += 1) {
    system.push(matrix.map((_, row) => matrix[row][column] - (row === column ? 1 : 0)));
    constants.push(0);
  }
  system.push(Array(size).fill(1));
  constants.push(1);
  return solveLinearSystem(system, constants).map(normalizeNumber);
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

function parseLinearProgrammingInput(statement) {
  const variables = ["x", "y"];
  const cleaned = statement.replace(/[?!.]+$/, "").trim();
  const lower = cleaned.toLowerCase();
  const goal = lower.includes("minimize") || lower.includes("minimum") || /\bmin\b/.test(lower)
    ? "minimize"
    : "maximize";
  const split = cleaned.match(/\b(subject to|constraints?)\b/i);
  if (!split) {
    throw new Error("Linear programming needs constraints after 'subject to'.");
  }

  let objectiveText = cleaned.slice(0, split.index).trim()
    .replace(/^(?:linear programming|linear program|lp)\s*/i, "")
    .replace(/^(?:maximize|max|minimize|min|minimum|maximum)\s*/i, "")
    .replace(/^objective\s*/i, "")
    .trim();
  const constraintsText = cleaned.slice((split.index ?? 0) + split[0].length).trim();
  if (objectiveText.includes("=")) {
    objectiveText = objectiveText.slice(objectiveText.indexOf("=") + 1).trim();
  }
  if (!objectiveText) {
    throw new Error("Linear programming needs an objective expression.");
  }

  const objective = parseLinearExpressionCoefficients(objectiveText, variables);
  const constraints = constraintsText
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => parseLinearProgrammingConstraint(part, variables));
  if (constraints.length < 2) {
    throw new Error("Linear programming needs at least two constraints.");
  }

  return {
    goal,
    variables,
    objective,
    constraints,
  };
}

function parseLinearProgrammingConstraint(text, variables) {
  const match = text.match(/^(.+?)(<=|>=|<|>|=)(.+)$/);
  if (!match) {
    throw new Error("Use linear constraints such as x + y <= 4.");
  }
  const left = parseLinearExpressionCoefficients(match[1].trim(), variables);
  const right = parseLinearExpressionCoefficients(match[3].trim(), variables);
  const coefficients = left.coefficients.map((value, index) => value - right.coefficients[index]);
  const constant = left.constant - right.constant;
  const operator = match[2];

  if (operator === "<=" || operator === "<" || operator === "=") {
    return {
      coefficients: coefficients.map(normalizeNumber),
      bound: normalizeNumber(-constant),
      source: text,
    };
  }

  return {
    coefficients: coefficients.map((value) => normalizeNumber(-value)),
    bound: normalizeNumber(constant),
    source: text,
  };
}

function parseLinearExpressionCoefficients(text, variables) {
  const parsed = parseMath(text);
  const expression = parsed.kind === "equation" ? parsed.right : parsed;
  const polynomial = polynomialFrom(expression);
  if (!polynomial) {
    throw new Error("Linear programming expressions must be linear polynomials.");
  }

  const coefficients = Object.fromEntries(variables.map((variable) => [variable, 0]));
  let constant = 0;
  for (const [key, coefficient] of polynomial.entries()) {
    if (!key) {
      constant += coefficient;
      continue;
    }
    const powers = powersFromKey(key);
    const entries = Object.entries(powers);
    if (entries.length !== 1 || entries[0][1] !== 1 || !variables.includes(entries[0][0])) {
      throw new Error("Linear programming currently supports linear expressions in x and y.");
    }
    coefficients[entries[0][0]] += coefficient;
  }

  return {
    coefficients: variables.map((variable) => normalizeNumber(coefficients[variable])),
    constant: normalizeNumber(constant),
  };
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

function extractFourierSeriesQuestion(statement) {
  let text = statement
    .replace(/^(?:fourier(?:\s+series)?|fourier expansion|series expansion)\s*/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
  let order = 5;
  let subintervals = 400;
  let variable = "";

  const samplesMatch = text.match(/\b(?:samples|subintervals|quadrature)\s*=?\s*(\d+)\b/i);
  if (samplesMatch) {
    subintervals = Number(samplesMatch[1]);
    text = text.replace(samplesMatch[0], "").trim();
  }

  const orderMatch = text.match(/\b(?:order|degree|terms|n)\s*=?\s*(\d+)\b/i);
  if (orderMatch) {
    order = Number(orderMatch[1]);
    text = text.replace(orderMatch[0], "").trim();
  }

  const variableMatch = text.match(/\b(?:with respect to|wrt|variable)\s*=?\s*([A-Za-z_]\w*)\b/i);
  if (variableMatch) {
    variable = variableMatch[1];
    text = text.replace(variableMatch[0], "").trim();
  }

  let lower = -Math.PI;
  let upper = Math.PI;
  const boundsMatch = text.match(/\bfrom\s+(.+?)\s+(?:to|,)\s+(.+)$/i);
  if (boundsMatch) {
    lower = evaluateBoundExpression(boundsMatch[1]);
    upper = evaluateBoundExpression(boundsMatch[2]);
    text = text.slice(0, boundsMatch.index).trim();
  }

  text = text
    .replace(/^f\s*\([A-Za-z_]\w*\)\s*=\s*/i, "")
    .replace(/^y\s*=\s*/i, "")
    .trim();

  if (!text) {
    throw new Error("Fourier series needs a function, such as fourier series x from -pi to pi order=5.");
  }
  if (!Number.isSafeInteger(order) || order < 1 || order > 50) {
    throw new Error("Fourier series order must be an integer from 1 to 50.");
  }
  if (!Number.isSafeInteger(subintervals) || subintervals < 2 || subintervals > 100000 || subintervals % 2 !== 0) {
    throw new Error("Fourier series Simpson quadrature needs an even sample count from 2 to 100000.");
  }
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower >= upper) {
    throw new Error("Fourier series needs finite bounds with lower < upper.");
  }

  return {
    expression: text,
    variable,
    lower,
    upper,
    order,
    subintervals,
  };
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

function laplaceTransformExpression(node, variable, outputVariable) {
  const constant = constantMathValue(node, variable);
  if (Number.isFinite(constant)) {
    return formatLaplaceFraction(constant, outputVariable);
  }

  if (node.kind === "mathSymbol") {
    if (node.name === variable) {
      return formatLaplacePowerTerm(1, outputVariable);
    }
    throw new Error(`Unsupported Laplace symbol '${node.name}'.`);
  }

  if (node.kind === "mathUnary") {
    return scaleLaplaceText(-1, laplaceTransformExpression(node.operand, variable, outputVariable));
  }

  if (node.kind === "mathBinary") {
    if (node.operator === "+" || node.operator === "-") {
      return combineLaplaceText(
        laplaceTransformExpression(node.left, variable, outputVariable),
        node.operator,
        laplaceTransformExpression(node.right, variable, outputVariable),
      );
    }

    if (node.operator === "*") {
      const leftConstant = constantMathValue(node.left, variable);
      if (Number.isFinite(leftConstant)) {
        return scaleLaplaceText(leftConstant, laplaceTransformExpression(node.right, variable, outputVariable));
      }
      const rightConstant = constantMathValue(node.right, variable);
      if (Number.isFinite(rightConstant)) {
        return scaleLaplaceText(rightConstant, laplaceTransformExpression(node.left, variable, outputVariable));
      }
    }

    if (node.operator === "/") {
      const denominator = constantMathValue(node.right, variable);
      if (Number.isFinite(denominator) && !nearlyEqual(denominator, 0)) {
        return scaleLaplaceText(1 / denominator, laplaceTransformExpression(node.left, variable, outputVariable));
      }
    }

    if (node.operator === "^" && node.left.kind === "mathSymbol" && node.left.name === variable) {
      const power = constantMathValue(node.right, variable);
      if (Number.isInteger(power) && power >= 0 && power <= 20) {
        return formatLaplacePowerTerm(power, outputVariable);
      }
    }
  }

  if (node.kind === "mathFunction") {
    const coefficient = coefficientOfLaplaceVariable(node.argument, variable);
    if (Number.isFinite(coefficient)) {
      if (node.name === "exp") {
        return formatLaplaceExponential(coefficient, outputVariable);
      }
      if (node.name === "sin") {
        return formatLaplaceSine(coefficient, outputVariable);
      }
      if (node.name === "cos") {
        return formatLaplaceCosine(coefficient, outputVariable);
      }
    }
  }

  throw new Error("Laplace transform supports constants, powers of the input variable, exp(at), sin(at), cos(at), sums, and scalar multiples.");
}

function constantMathValue(node, variable) {
  const variables = mathVariables(node).filter((name) => !isMathConstantName(name));
  if (variables.length > 0 || variables.includes(variable)) {
    return Number.NaN;
  }
  return evaluateMath(node);
}

function coefficientOfLaplaceVariable(node, variable) {
  if (node.kind === "mathSymbol" && node.name === variable) {
    return 1;
  }
  if (node.kind === "mathUnary") {
    const coefficient = coefficientOfLaplaceVariable(node.operand, variable);
    return Number.isFinite(coefficient) ? -coefficient : Number.NaN;
  }
  if (node.kind === "mathBinary") {
    if (node.operator === "*") {
      const leftConstant = constantMathValue(node.left, variable);
      const rightCoefficient = coefficientOfLaplaceVariable(node.right, variable);
      if (Number.isFinite(leftConstant) && Number.isFinite(rightCoefficient)) {
        return leftConstant * rightCoefficient;
      }
      const rightConstant = constantMathValue(node.right, variable);
      const leftCoefficient = coefficientOfLaplaceVariable(node.left, variable);
      if (Number.isFinite(rightConstant) && Number.isFinite(leftCoefficient)) {
        return rightConstant * leftCoefficient;
      }
    }
    if (node.operator === "/") {
      const denominator = constantMathValue(node.right, variable);
      const numerator = coefficientOfLaplaceVariable(node.left, variable);
      if (Number.isFinite(denominator) && !nearlyEqual(denominator, 0) && Number.isFinite(numerator)) {
        return numerator / denominator;
      }
    }
  }
  return Number.NaN;
}

function formatLaplacePowerTerm(power, outputVariable) {
  return formatLaplaceFraction(factorial(power), formatLaplacePower(outputVariable, power + 1));
}

function formatLaplaceExponential(coefficient, outputVariable) {
  return formatLaplaceFraction(1, formatLaplaceShift(outputVariable, coefficient));
}

function formatLaplaceSine(coefficient, outputVariable) {
  if (nearlyEqual(coefficient, 0)) {
    return "0";
  }
  return formatLaplaceFraction(coefficient, formatLaplaceQuadratic(outputVariable, coefficient));
}

function formatLaplaceCosine(coefficient, outputVariable) {
  if (nearlyEqual(coefficient, 0)) {
    return formatLaplaceFraction(1, outputVariable);
  }
  return `${outputVariable}/${wrapLaplaceDenominator(formatLaplaceQuadratic(outputVariable, coefficient))}`;
}

function formatLaplaceFraction(numerator, denominator) {
  const normalized = normalizeNumber(numerator);
  if (nearlyEqual(normalized, 0)) {
    return "0";
  }
  const denominatorText = wrapLaplaceDenominator(denominator);
  if (nearlyEqual(normalized, 1)) {
    return `1/${denominatorText}`;
  }
  if (nearlyEqual(normalized, -1)) {
    return `-1/${denominatorText}`;
  }
  return `${formatNumber(normalized)}/${denominatorText}`;
}

function formatLaplacePower(outputVariable, power) {
  return power === 1 ? outputVariable : `${outputVariable}^${power}`;
}

function formatLaplaceShift(outputVariable, coefficient) {
  if (nearlyEqual(coefficient, 0)) {
    return outputVariable;
  }
  const magnitude = Math.abs(coefficient);
  return coefficient > 0
    ? `${outputVariable} - ${formatNumber(magnitude)}`
    : `${outputVariable} + ${formatNumber(magnitude)}`;
}

function formatLaplaceQuadratic(outputVariable, coefficient) {
  return `${outputVariable}^2 + ${formatNumber(coefficient * coefficient)}`;
}

function wrapLaplaceDenominator(denominator) {
  return /\s/.test(denominator) ? `(${denominator})` : denominator;
}

function scaleLaplaceText(coefficient, text) {
  const normalized = normalizeNumber(coefficient);
  if (nearlyEqual(normalized, 0) || text === "0") {
    return "0";
  }
  if (nearlyEqual(normalized, 1)) {
    return text;
  }
  if (text.startsWith("1/")) {
    return `${formatNumber(normalized)}/${text.slice(2)}`;
  }
  if (nearlyEqual(normalized, -1)) {
    return negateLaplaceText(text);
  }
  return `${formatNumber(normalized)}${wrapLaplaceTerm(text)}`;
}

function combineLaplaceText(left, operator, right) {
  if (left === "0") {
    return operator === "-" ? negateLaplaceText(right) : right;
  }
  if (right === "0") {
    return left;
  }
  if (operator === "+") {
    return right.startsWith("-") ? `${left} - ${right.slice(1)}` : `${left} + ${right}`;
  }
  return right.startsWith("-") ? `${left} + ${right.slice(1)}` : `${left} - ${right}`;
}

function negateLaplaceText(text) {
  if (text.startsWith("-")) {
    return text.slice(1);
  }
  return text.startsWith("1/") ? `-${text}` : `-${wrapLaplaceTerm(text)}`;
}

function wrapLaplaceTerm(text) {
  return / [+-] /.test(text) ? `(${text})` : text;
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

function computeFourierSeries(request, expression) {
  const halfPeriod = (request.upper - request.lower) / 2;
  const center = (request.lower + request.upper) / 2;
  const evaluator = (x) => {
    const value = evaluateMath(expression, { [request.variable]: x });
    if (!Number.isFinite(value)) {
      throw new Error("The Fourier integrand is not finite at a quadrature sample point.");
    }
    return value;
  };
  const integrate = (fn) =>
    approximateDefiniteIntegral(fn, request.lower, request.upper, request.subintervals, "simpson").value;
  const angle = (n, x) => (n * Math.PI * (x - center)) / halfPeriod;
  const a0 = normalizeNumber(integrate((x) => evaluator(x)) / halfPeriod);
  const coefficients = [];

  for (let n = 1; n <= request.order; n += 1) {
    const an = normalizeNumber(integrate((x) => evaluator(x) * Math.cos(angle(n, x))) / halfPeriod);
    const bn = normalizeNumber(integrate((x) => evaluator(x) * Math.sin(angle(n, x))) / halfPeriod);
    coefficients.push({ n, an, bn });
  }

  const partialSum = (x) => {
    let value = a0 / 2;
    for (const coefficient of coefficients) {
      value += coefficient.an * Math.cos(angle(coefficient.n, x));
      value += coefficient.bn * Math.sin(angle(coefficient.n, x));
    }
    return normalizeNumber(value);
  };
  const points = [];
  for (let index = 0; index < 121; index += 1) {
    const x = request.lower + ((request.upper - request.lower) * index) / 120;
    const y = partialSum(x);
    if (Number.isFinite(y)) {
      points.push({ x, y });
    }
  }
  if (points.length < 2) {
    throw new Error("Could not sample enough finite Fourier approximation points.");
  }

  const yValues = points.map((point) => point.y);
  return {
    a0,
    coefficients,
    center,
    halfPeriod,
    graph: {
      expression: `S_${request.order}(${request.variable})`,
      points,
      xMin: request.lower,
      xMax: request.upper,
      yMin: Math.min(...yValues),
      yMax: Math.max(...yValues),
    },
  };
}

function formatFourierPartialSum(request, result) {
  const pieces = [];
  pushFourierTerm(pieces, result.a0 / 2, "");
  for (const coefficient of result.coefficients) {
    const angle = formatFourierAngle(coefficient.n, request.variable, result.center, result.halfPeriod);
    pushFourierTerm(pieces, coefficient.an, `cos(${angle})`);
    pushFourierTerm(pieces, coefficient.bn, `sin(${angle})`);
  }
  return pieces.length ? pieces.join("") : "0";
}

function pushFourierTerm(pieces, coefficient, basis) {
  if (nearlyEqual(coefficient, 0)) {
    return;
  }
  const sign = coefficient < 0 ? "-" : "+";
  const magnitude = Math.abs(coefficient);
  const coefficientText = basis && Math.abs(magnitude - 1) < 1e-6 ? "" : formatNumber(magnitude);
  const body = `${coefficientText}${basis}`;
  if (pieces.length === 0) {
    pieces.push(sign === "-" ? `-${body}` : body);
  } else {
    pieces.push(` ${sign} ${body}`);
  }
}

function formatFourierAngle(n, variable, center, halfPeriod) {
  const shifted = formatFourierShift(variable, center);
  if (nearlyEqual(halfPeriod, Math.PI)) {
    if (n === 1) {
      return shifted;
    }
    return shifted === variable ? `${n}${variable}` : `${n}${shifted}`;
  }
  const multiplier = n === 1 ? "pi" : `${n}pi`;
  return `${multiplier}*${shifted}/${formatFourierNumber(halfPeriod)}`;
}

function formatFourierShift(variable, center) {
  if (nearlyEqual(center, 0)) {
    return variable;
  }
  return center > 0
    ? `(${variable} - ${formatFourierNumber(center)})`
    : `(${variable} + ${formatFourierNumber(Math.abs(center))})`;
}

function formatFourierNumber(value) {
  if (nearlyEqual(value, 0)) {
    return "0";
  }
  const ratio = value / Math.PI;
  const rounded = Math.round(ratio);
  if (rounded !== 0 && Math.abs(rounded) <= 12 && nearlyEqual(ratio, rounded)) {
    if (rounded === 1) return "pi";
    if (rounded === -1) return "-pi";
    return `${rounded}pi`;
  }
  return formatNumber(value);
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
  if (isNumericalIntegrationQuestion(lower)) {
    return extractNumericalIntegrationQuestion(statement);
  }

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

function extractNumericalIntegrationQuestion(statement) {
  const lower = statement.toLowerCase();
  const method = lower.includes("trapezoid") || lower.includes("trapezoidal")
    ? "trapezoid"
    : "simpson";
  let expression = statement
    .replace(/^(simpson(?:'s)?(?:\s+rule)?|trapezoidal(?:\s+rule)?|trapezoid(?:al)?(?:\s+rule)?|numerical integral|approximate integral)\s*/i, "")
    .replace(/^integrate\s+/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
  let variable = "x";
  let subintervals = method === "simpson" ? 100 : 100;

  const subintervalMatch = expression.match(/\b(?:n|steps|subintervals)\s*=?\s*(\d+)\b/i);
  if (subintervalMatch) {
    subintervals = Number(subintervalMatch[1]);
    expression = expression.replace(subintervalMatch[0], "").trim();
  }

  const respectMatch = expression.match(/\b(?:with respect to|wrt)\s+([A-Za-z_]\w*)/i);
  const dxMatch = expression.match(/\bd([A-Za-z_]\w*)\b/i);
  if (respectMatch) {
    variable = respectMatch[1];
    expression = expression.replace(respectMatch[0], "").trim();
  } else if (dxMatch) {
    variable = dxMatch[1];
    expression = expression.replace(dxMatch[0], "").trim();
  }

  const boundsMatch = expression.match(/\b(?:from|between)\s+(.+?)\s+(?:to|,)\s+(.+)$/i);
  if (!boundsMatch) {
    throw new Error("Numerical integration needs bounds, such as simpson integrate sin(x) from 0 to pi n=100.");
  }
  const lowerBound = evaluateBoundExpression(boundsMatch[1]);
  const upperBound = evaluateBoundExpression(boundsMatch[2]);
  expression = expression.slice(0, boundsMatch.index).trim();

  if (!expression) {
    throw new Error("Numerical integration needs an integrand expression.");
  }
  if (!Number.isSafeInteger(subintervals) || subintervals < 1 || subintervals > 100000) {
    throw new Error("Numerical integration needs n between 1 and 100000.");
  }
  if (method === "simpson" && subintervals % 2 !== 0) {
    throw new Error("Simpson's rule needs an even number of subintervals.");
  }
  if (!Number.isFinite(lowerBound) || !Number.isFinite(upperBound) || nearlyEqual(lowerBound, upperBound)) {
    throw new Error("Numerical integration needs two finite, distinct bounds.");
  }

  return {
    kind: "integral",
    expression,
    variable,
    method,
    lower: lowerBound,
    upper: upperBound,
    subintervals,
  };
}

function evaluateBoundExpression(text) {
  const value = evaluateMath(parseMath(text.trim()));
  if (!Number.isFinite(value)) {
    throw new Error("Numerical integration bounds must be finite.");
  }
  return value;
}

function extractDifferentialEquation(statement) {
  const text = statement
    .replace(/^(solve\s+)?(?:ode|differential equation)\s+/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
  const lower = text.toLowerCase();
  const initial = readOdeInitialCondition(text);
  const variable = readOdeVariable(text);
  const target = readOdeTarget(text, variable, initial.time);
  const dependent = lower.includes("temperature") || lower.includes("cooling") ? "T" : "y";

  if (lower.includes("newton cooling") || lower.includes("newton's cooling") || lower.includes("cooling")) {
    const ambient = readOdeNumber(text, ["ambient", "room", "environment"], Number.NaN);
    const initialValue = readOdeNumber(text, ["initial", "start", "temperature", "temp", "y0"], initial.value);
    const rate = readOdeNumber(text, ["k", "rate"], Number.NaN);
    if (!Number.isFinite(ambient) || !Number.isFinite(initialValue) || !Number.isFinite(rate) || rate < 0) {
      throw new Error("Newton cooling needs ambient, initial, k, and a target time, such as newton cooling ambient=70 initial=100 k=0.2 t=10.");
    }
    return {
      model: "cooling",
      modelName: "Newton's law of cooling",
      variable,
      dependent,
      initialTime: initial.time,
      initialValue,
      target,
      rate,
      ambient,
    };
  }

  if (lower.includes("logistic")) {
    const capacity = readOdeCapacity(text);
    const rate = readOdeNumber(text, ["r", "rate", "growth"], Number.NaN);
    const initialValue = readOdeNumber(text, ["y0", "initial", "start", "population"], initial.value);
    if (!Number.isFinite(capacity) || !Number.isFinite(rate) || !Number.isFinite(initialValue)) {
      throw new Error("Logistic ODE needs r, K/capacity, y0, and a target, such as logistic r=0.4 K=100 y0=10 t=8.");
    }
    if (capacity <= 0 || initialValue <= 0) {
      throw new Error("Logistic ODE needs positive carrying capacity and initial value.");
    }
    return {
      model: "logistic",
      modelName: "logistic growth",
      variable,
      dependent,
      initialTime: initial.time,
      initialValue,
      target,
      rate,
      capacity,
      logisticA: (capacity - initialValue) / initialValue,
    };
  }

  const equation = readOdeEquation(text);
  const rate = readOdeNumber(text, ["k", "rate"], equation.rate);
  const power = readOdeNumber(text, ["power", "p"], equation.power);
  const initialValue = readOdeNumber(text, ["y0", "initial", "start"], initial.value);
  if (!Number.isFinite(rate) || !Number.isFinite(power) || !Number.isFinite(initialValue)) {
    throw new Error("ODE mode needs a rate, initial value, and target, such as ode dy/dt = 0.3y y0=2 t=5.");
  }
  if (nearlyEqual(initialValue, 0) && !nearlyEqual(power, 1)) {
    throw new Error("Power ODEs need a nonzero initial value.");
  }

  return {
    model: "power",
    modelName: nearlyEqual(power, 1) ? "exponential growth/decay" : "separable power equation",
    variable,
    dependent,
    initialTime: initial.time,
    initialValue,
    target,
    rate,
    power,
    initialPower: initialValue ** (1 - power),
  };
}

function extractNumericalDifferentialEquation(statement) {
  const method = statement.toLowerCase().includes("euler") ? "euler" : "rk4";
  let text = statement
    .replace(/^(?:rk4|runge-kutta(?:\s+4)?|runge kutta(?:\s+4)?|euler(?:\s+method)?)\s+/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
  const derivativeMatch = text.match(/(?:d([A-Za-z_]\w*)\s*\/\s*d([A-Za-z_]\w*)|([A-Za-z_]\w*)\s*'|([A-Za-z_]\w*)prime)\s*=\s*(.+)$/i);
  if (!derivativeMatch) {
    throw new Error("Numerical ODE mode needs a first-order equation, such as rk4 y' = t + y y0=1 from t=0 to 1 h=0.25.");
  }

  const dependent = derivativeMatch[1] ?? derivativeMatch[3] ?? derivativeMatch[4] ?? "y";
  let variable = derivativeMatch[2] ?? "t";
  let expression = derivativeMatch[5].trim();

  const y0Match = expression.match(/\b(?:y0|initial|start)\s*=\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i);
  if (!y0Match) {
    throw new Error("Numerical ODE mode needs an initial value, such as y0=1.");
  }
  const initialValue = Number(y0Match[1]);
  expression = expression.replace(y0Match[0], "").trim();

  const rangeMatch = expression.match(/\bfrom\s+(?:([A-Za-z_]\w*)\s*=\s*)?(.+?)\s+to\s+(.+?)(?=\s+\b(?:h|step|n)\s*=|$)/i);
  if (!rangeMatch) {
    throw new Error("Numerical ODE mode needs a range, such as from t=0 to 1.");
  }
  if (rangeMatch[1]) {
    variable = rangeMatch[1];
  }
  const initialTime = evaluateBoundExpression(rangeMatch[2]);
  const target = evaluateBoundExpression(rangeMatch[3]);
  expression = expression.replace(rangeMatch[0], "").trim();

  const stepMatch = expression.match(/\b(?:h|step)\s*=\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i);
  const countMatch = expression.match(/\bn\s*=\s*(\d+)\b/i);
  let steps;
  let stepSize;
  if (stepMatch) {
    stepSize = Number(stepMatch[1]);
    expression = expression.replace(stepMatch[0], "").trim();
  }
  if (countMatch) {
    steps = Number(countMatch[1]);
    expression = expression.replace(countMatch[0], "").trim();
  }
  if (Number.isFinite(stepSize)) {
    if (!(stepSize > 0)) {
      throw new Error("Numerical ODE step size must be positive.");
    }
    steps = Math.round(Math.abs((target - initialTime) / stepSize));
    const impliedStep = Math.abs((target - initialTime) / steps);
    if (!Number.isFinite(impliedStep) || Math.abs(impliedStep - stepSize) > 1e-7) {
      throw new Error("Numerical ODE step size must divide the requested interval.");
    }
  } else if (!Number.isFinite(steps)) {
    steps = 10;
  }

  if (!Number.isSafeInteger(steps) || steps < 1 || steps > 10000) {
    throw new Error("Numerical ODE mode needs n between 1 and 10000.");
  }
  if (!Number.isFinite(initialValue) || !Number.isFinite(initialTime) || !Number.isFinite(target) || nearlyEqual(initialTime, target)) {
    throw new Error("Numerical ODE mode needs finite, distinct start and target values.");
  }
  if (!expression) {
    throw new Error("Numerical ODE mode needs a derivative expression.");
  }

  return {
    method,
    expression,
    variable,
    dependent,
    initialTime,
    initialValue,
    target,
    steps,
  };
}

function readOdeEquation(text) {
  const match = text.match(/(?:dy\s*\/\s*d[A-Za-z_]\w*|y\s*'|yprime)\s*=\s*([+-]?\s*(?:\d*\.?\d+(?:e[-+]?\d+)?)?)\s*\*?\s*y(?:\s*\^\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?))?/i);
  if (!match) {
    return { rate: Number.NaN, power: 1 };
  }
  return {
    rate: parseOdeCoefficient(match[1]),
    power: match[2] === undefined ? 1 : Number(match[2]),
  };
}

function parseOdeCoefficient(text) {
  const cleaned = text.replace(/\s+/g, "");
  if (cleaned === "" || cleaned === "+") return 1;
  if (cleaned === "-") return -1;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : Number.NaN;
}

function readOdeInitialCondition(text) {
  const match = text.match(/\b[Ty]\s*\(\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*\)\s*=\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i);
  if (match) {
    return {
      time: Number(match[1]),
      value: Number(match[2]),
    };
  }
  return {
    time: readOdeNumber(text, ["t0", "x0"], 0),
    value: readOdeNumber(text, ["y0", "initial", "start"], Number.NaN),
  };
}

function readOdeVariable(text) {
  const match = text.match(/dy\s*\/\s*d([A-Za-z_]\w*)/i);
  if (match) {
    return match[1];
  }
  if (/\bx\s*=/.test(text)) {
    return "x";
  }
  return "t";
}

function readOdeTarget(text, variable, initialTime) {
  const target = readOdeNumber(text, [variable, "time", "target", "at"], Number.NaN);
  if (Number.isFinite(target)) {
    return target;
  }
  const atMatch = text.match(/\bat\s+[A-Za-z_]\w*\s*=\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i) ??
    text.match(/\bat\s+([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i);
  if (atMatch) {
    return Number(atMatch[1]);
  }
  return initialTime + 1;
}

function readOdeCapacity(text) {
  const capacity = readOdeNumber(text, ["capacity", "carrying", "carrying capacity"], Number.NaN);
  if (Number.isFinite(capacity)) {
    return capacity;
  }
  const match = text.match(/\bK\s*=\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/);
  return match ? Number(match[1]) : Number.NaN;
}

function readOdeNumber(text, names, fallback) {
  const numberPattern = "([-+]?\\d*\\.?\\d+(?:e[-+]?\\d+)?)";
  for (const name of names) {
    const escaped = name
      .trim()
      .split(/\s+/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s+");
    const match = text.match(new RegExp(`\\b${escaped}\\s*=\\s*${numberPattern}`, "i"));
    if (match) {
      return Number(match[1]);
    }
  }
  return fallback;
}

function evaluateExponentialOdeSolution(request, input) {
  return request.initialValue * Math.exp(request.rate * (input - request.initialTime));
}

function evaluatePowerOdeSolution(request, input) {
  const base = request.initialPower + (1 - request.power) * request.rate * (input - request.initialTime);
  const exponent = 1 / (1 - request.power);
  if (base < 0 && !Number.isInteger(exponent)) {
    return Number.NaN;
  }
  return base ** exponent;
}

function evaluateLogisticSolution(request, input) {
  return request.capacity / (1 + request.logisticA * Math.exp(-request.rate * (input - request.initialTime)));
}

function evaluateCoolingSolution(request, input) {
  return request.ambient + (request.initialValue - request.ambient) * Math.exp(-request.rate * (input - request.initialTime));
}

function sampleOdeSolution(request) {
  const evaluator = request.model === "logistic"
    ? evaluateLogisticSolution
    : request.model === "cooling"
      ? evaluateCoolingSolution
      : nearlyEqual(request.power, 1)
        ? evaluateExponentialOdeSolution
        : evaluatePowerOdeSolution;
  if (nearlyEqual(request.target, request.initialTime)) {
    return [{ input: request.target, value: evaluator(request, request.target) }];
  }
  const rows = [];
  for (let index = 0; index <= 4; index += 1) {
    const input = request.initialTime + ((request.target - request.initialTime) * index) / 4;
    const value = evaluator(request, input);
    if (Number.isFinite(value)) {
      rows.push({ input, value });
    }
  }
  return rows;
}

function formatOdeShift(variable, initialTime) {
  if (nearlyEqual(initialTime, 0)) {
    return variable;
  }
  return initialTime > 0
    ? `(${variable} - ${formatNumber(initialTime)})`
    : `(${variable} + ${formatNumber(Math.abs(initialTime))})`;
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
    if (node.name.toLowerCase() === "pi") return Math.PI;
    if (node.name.toLowerCase() === "e") return Math.E;
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

function isMathConstantName(name) {
  const lower = name.toLowerCase();
  return lower === "pi" || lower === "e";
}

function safeEvaluateMath(node, values = {}) {
  try {
    const value = evaluateMath(node, values);
    return Number.isFinite(value) ? value : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

function approximateDefiniteIntegral(evaluator, lower, upper, subintervals, method) {
  const stepSize = (upper - lower) / subintervals;
  const samples = [];
  let weightedSum = 0;

  for (let index = 0; index <= subintervals; index += 1) {
    const x = lower + index * stepSize;
    const y = evaluator(x);
    if (!Number.isFinite(y)) {
      throw new Error("The integrand is not finite at a quadrature sample point.");
    }
    let weight;
    if (method === "simpson") {
      weight = index === 0 || index === subintervals ? 1 : index % 2 === 1 ? 4 : 2;
    } else {
      weight = index === 0 || index === subintervals ? 0.5 : 1;
    }
    weightedSum += weight * y;
    if (index <= 8 || index === subintervals) {
      samples.push([String(index), formatNumber(x), formatNumber(y), formatNumber(weight)]);
    } else if (index === 9) {
      samples.push(["...", "...", "...", "..."]);
    }
  }

  const value = method === "simpson"
    ? (stepSize / 3) * weightedSum
    : stepSize * weightedSum;
  return {
    value: normalizeNumber(value),
    stepSize: normalizeNumber(stepSize),
    table: {
      headers: ["i", "x", "f(x)", "weight"],
      rows: samples,
    },
  };
}

function solveNumericalOde(request, expression) {
  const stepSize = (request.target - request.initialTime) / request.steps;
  const evaluator = (t, y) => {
    const value = evaluateMath(expression, {
      [request.variable]: t,
      [request.dependent]: y,
    });
    if (!Number.isFinite(value)) {
      throw new Error("The ODE derivative is not finite at a step point.");
    }
    return value;
  };
  const rows = [{
    step: 0,
    t: normalizeNumber(request.initialTime),
    y: normalizeNumber(request.initialValue),
    slope: Number.NaN,
  }];
  let t = request.initialTime;
  let y = request.initialValue;

  for (let step = 1; step <= request.steps; step += 1) {
    const slope = evaluator(t, y);
    if (request.method === "rk4") {
      const k1 = slope;
      const k2 = evaluator(t + stepSize / 2, y + (stepSize * k1) / 2);
      const k3 = evaluator(t + stepSize / 2, y + (stepSize * k2) / 2);
      const k4 = evaluator(t + stepSize, y + stepSize * k3);
      y += (stepSize / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    } else {
      y += stepSize * slope;
    }
    t += stepSize;
    if (!Number.isFinite(y)) {
      throw new Error("The numerical ODE solution became non-finite.");
    }
    if (step <= 20 || step === request.steps) {
      rows.push({
        step,
        t: normalizeNumber(t),
        y: normalizeNumber(y),
        slope: normalizeNumber(slope),
      });
    } else if (step === 21) {
      rows.push({ step: "...", t: Number.NaN, y: Number.NaN, slope: Number.NaN });
    }
  }

  return {
    stepSize: normalizeNumber(stepSize),
    rows,
  };
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

function bootstrapDistribution(values, statistic, resamples, seed) {
  const random = seededRandom(seed);
  const distribution = [];
  for (let index = 0; index < resamples; index += 1) {
    const sample = [];
    for (let draw = 0; draw < values.length; draw += 1) {
      sample.push(values[Math.floor(random() * values.length)]);
    }
    distribution.push(bootstrapStatistic(sample, statistic));
  }
  return distribution;
}

function permutationDistribution(request) {
  const random = seededRandom(request.seed);
  const combined = [...request.left, ...request.right];
  const leftSize = request.left.length;
  const distribution = [];
  for (let index = 0; index < request.resamples; index += 1) {
    const shuffled = shuffleCopy(combined, random);
    distribution.push(permutationDifference(
      shuffled.slice(0, leftSize),
      shuffled.slice(leftSize),
      request.statistic,
    ));
  }
  return distribution;
}

function permutationDifference(left, right, statistic) {
  return normalizeNumber(bootstrapStatistic(left, statistic) - bootstrapStatistic(right, statistic));
}

function permutationPValue(distribution, observedDifference, alternative) {
  const extreme = distribution.filter((value) => {
    if (alternative === "less") {
      return value <= observedDifference + EPSILON;
    }
    if (alternative === "greater") {
      return value >= observedDifference - EPSILON;
    }
    return Math.abs(value) >= Math.abs(observedDifference) - EPSILON;
  }).length;
  return normalizeNumber((extreme + 1) / (distribution.length + 1));
}

function shuffleCopy(values, random) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function kaplanMeierEstimate(times, events) {
  const uniqueTimes = [...new Set(times)].sort((left, right) => left - right);
  let survival = 1;
  let greenwoodSum = 0;
  let medianSurvival = Number.NaN;
  const rows = [];

  for (const time of uniqueTimes) {
    const atRisk = times.filter((value) => value >= time).length;
    const eventCount = times.reduce((count, value, index) =>
      nearlyEqual(value, time) && events[index] === 1 ? count + 1 : count, 0);
    const censoredCount = times.reduce((count, value, index) =>
      nearlyEqual(value, time) && events[index] === 0 ? count + 1 : count, 0);

    if (eventCount > 0) {
      survival *= 1 - eventCount / atRisk;
      if (atRisk > eventCount) {
        greenwoodSum += eventCount / (atRisk * (atRisk - eventCount));
      }
      if (!Number.isFinite(medianSurvival) && survival <= 0.5) {
        medianSurvival = time;
      }
    }

    rows.push({
      time: normalizeNumber(time),
      atRisk,
      events: eventCount,
      censored: censoredCount,
      survival: normalizeNumber(survival),
      standardError: normalizeNumber(survival <= 0 ? 0 : survival * Math.sqrt(greenwoodSum)),
    });
  }

  const eventCount = events.filter((event) => event === 1).length;
  const yValues = rows.map((row) => row.survival);
  return {
    rows,
    eventCount,
    censoredCount: events.length - eventCount,
    medianSurvival,
    graph: {
      expression: "Kaplan-Meier S(t)",
      points: [{ x: 0, y: 1 }, ...rows.map((row) => ({ x: row.time, y: row.survival }))],
      xMin: 0,
      xMax: Math.max(...times),
      yMin: Math.min(0, ...yValues),
      yMax: 1,
    },
  };
}

function logRankTest(request) {
  const eventTimes = [...new Set([
    ...request.leftTimes.filter((time, index) => request.leftEvents[index] === 1),
    ...request.rightTimes.filter((time, index) => request.rightEvents[index] === 1),
  ])].sort((left, right) => left - right);
  let observedLeft = 0;
  let expectedLeft = 0;
  let variance = 0;
  const rows = [];

  for (const time of eventTimes) {
    const riskLeft = request.leftTimes.filter((value) => value >= time).length;
    const riskRight = request.rightTimes.filter((value) => value >= time).length;
    const eventsLeft = request.leftTimes.reduce((count, value, index) =>
      nearlyEqual(value, time) && request.leftEvents[index] === 1 ? count + 1 : count, 0);
    const eventsRight = request.rightTimes.reduce((count, value, index) =>
      nearlyEqual(value, time) && request.rightEvents[index] === 1 ? count + 1 : count, 0);
    const totalRisk = riskLeft + riskRight;
    const totalEvents = eventsLeft + eventsRight;
    if (totalRisk <= 0 || totalEvents <= 0) {
      continue;
    }

    const expected = (totalEvents * riskLeft) / totalRisk;
    const varianceTerm = totalRisk > 1
      ? (riskLeft * riskRight * totalEvents * (totalRisk - totalEvents)) / (totalRisk ** 2 * (totalRisk - 1))
      : 0;
    observedLeft += eventsLeft;
    expectedLeft += expected;
    variance += varianceTerm;
    rows.push({
      time: normalizeNumber(time),
      riskLeft,
      riskRight,
      eventsLeft,
      eventsRight,
      expectedLeft: normalizeNumber(expected),
    });
  }

  if (!(variance > 0)) {
    throw new Error("Log-rank test needs at least one comparable event with positive variance.");
  }
  const chiSquare = normalizeNumber((observedLeft - expectedLeft) ** 2 / variance);
  return {
    rows,
    observedLeft: normalizeNumber(observedLeft),
    expectedLeft: normalizeNumber(expectedLeft),
    variance: normalizeNumber(variance),
    chiSquare,
    pValue: normalizeNumber(chiSquareRightTailApprox(chiSquare, 1)),
  };
}

function coxProportionalHazards(request) {
  let beta = 0;
  let iterations = 0;
  let state = coxScoreInformation(request, beta);
  for (; iterations < 50; iterations += 1) {
    if (!(state.information > EPSILON)) {
      throw new Error("Cox regression information matrix is singular for these data.");
    }
    const step = state.score / state.information;
    beta += Math.max(-1, Math.min(1, step));
    if (!Number.isFinite(beta)) {
      throw new Error("Cox regression failed to converge.");
    }
    state = coxScoreInformation(request, beta);
    if (Math.abs(step) < 1e-9) {
      break;
    }
  }
  if (iterations >= 50) {
    throw new Error("Cox regression did not converge for these data.");
  }

  const standardError = Math.sqrt(1 / state.information);
  const zStatistic = beta / standardError;
  return {
    beta: normalizeNumber(beta),
    standardError: normalizeNumber(standardError),
    hazardRatio: normalizeNumber(Math.exp(beta)),
    zStatistic: normalizeNumber(zStatistic),
    pValue: normalizeNumber(pValueForNormal(zStatistic, "two-sided")),
    logLikelihood: normalizeNumber(state.logLikelihood),
    rows: coxRiskRows(request, beta),
    eventCount: request.events.filter((event) => event === 1).length,
    iterations: iterations + 1,
  };
}

function coxScoreInformation(request, beta) {
  const eventTimes = coxEventTimes(request);
  let score = 0;
  let information = 0;
  let logLikelihood = 0;

  for (const time of eventTimes) {
    const eventIndices = request.times
      .map((value, index) => ({ value, index }))
      .filter(({ value, index }) => nearlyEqual(value, time) && request.events[index] === 1)
      .map(({ index }) => index);
    const riskIndices = request.times
      .map((value, index) => ({ value, index }))
      .filter(({ value }) => value >= time)
      .map(({ index }) => index);
    const eventCovariateSum = eventIndices.reduce((sum, index) => sum + request.covariate[index], 0);
    const riskSums = coxRiskSums(request, riskIndices, beta);
    if (!(riskSums.s0 > 0)) {
      throw new Error("Cox regression encountered an empty risk set.");
    }
    const eventsAtTime = eventIndices.length;
    const expected = riskSums.s1 / riskSums.s0;
    const variance = riskSums.s2 / riskSums.s0 - expected ** 2;
    logLikelihood += beta * eventCovariateSum - eventsAtTime * Math.log(riskSums.s0);
    score += eventCovariateSum - eventsAtTime * expected;
    information += eventsAtTime * variance;
  }

  return { score, information, logLikelihood };
}

function coxRiskRows(request, beta) {
  return coxEventTimes(request).map((time) => {
    const eventIndices = request.times
      .map((value, index) => ({ value, index }))
      .filter(({ value, index }) => nearlyEqual(value, time) && request.events[index] === 1)
      .map(({ index }) => index);
    const riskIndices = request.times
      .map((value, index) => ({ value, index }))
      .filter(({ value }) => value >= time)
      .map(({ index }) => index);
    const riskSums = coxRiskSums(request, riskIndices, beta);
    return {
      time: normalizeNumber(time),
      events: eventIndices.length,
      riskSet: riskIndices.length,
      eventCovariateSum: normalizeNumber(eventIndices.reduce((sum, index) => sum + request.covariate[index], 0)),
      expectedCovariateSum: normalizeNumber(eventIndices.length * (riskSums.s1 / riskSums.s0)),
    };
  });
}

function coxRiskSums(request, indices, beta) {
  return indices.reduce((sums, index) => {
    const weight = Math.exp(beta * request.covariate[index]);
    return {
      s0: sums.s0 + weight,
      s1: sums.s1 + weight * request.covariate[index],
      s2: sums.s2 + weight * request.covariate[index] ** 2,
    };
  }, { s0: 0, s1: 0, s2: 0 });
}

function coxEventTimes(request) {
  return [...new Set(request.times.filter((time, index) => request.events[index] === 1))]
    .sort((left, right) => left - right);
}

function bootstrapStatistic(values, statistic) {
  if (statistic === "median") {
    return median([...values].sort((left, right) => left - right));
  }
  return mean(values);
}

function percentileFromSorted(sortedValues, probability) {
  if (sortedValues.length === 0) {
    throw new Error("Percentiles need at least one value.");
  }
  const clamped = Math.max(0, Math.min(1, probability));
  const index = clamped * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return normalizeNumber(sortedValues[lower]);
  }
  const weight = index - lower;
  return normalizeNumber(sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight);
}

function seededRandom(seed) {
  let state = Math.trunc(seed) % 2147483647;
  if (state <= 0) {
    state += 2147483646;
  }
  return () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };
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

function parseBootstrapInput(text) {
  const lower = text.toLowerCase();
  let dataText = text;
  let statistic = lower.includes("median") ? "median" : "mean";
  let resamples = 2000;
  let seed = 12345;

  const statisticMatch = dataText.match(/\b(?:stat|statistic)\s*=\s*(mean|median)\b/i);
  if (statisticMatch) {
    statistic = statisticMatch[1].toLowerCase();
    dataText = dataText.replace(statisticMatch[0], "");
  }

  const resamplesMatch = dataText.match(/\b(?:resamples|samples|iterations|reps|b)\s*=\s*(\d+)\b/i);
  if (resamplesMatch) {
    resamples = Number(resamplesMatch[1]);
    dataText = dataText.replace(resamplesMatch[0], "");
  }

  const seedMatch = dataText.match(/\bseed\s*=\s*(\d+)\b/i);
  if (seedMatch) {
    seed = Number(seedMatch[1]);
    dataText = dataText.replace(seedMatch[0], "");
  }

  const level = parseConfidenceLevel(dataText.replace(/\bbootstrap\b/gi, ""), 0.95);
  dataText = dataText
    .replace(/\b(?:confidence|ci)\s*(?:level)?\s*=\s*(0?\.\d+|\d+(?:\.\d+)?)/gi, "")
    .replace(/\b[-+]?\d*\.?\d+(?:e[-+]?\d+)?\s*%?\s*(?:bootstrap\s+)?(?:confidence|ci)\b/gi, "")
    .replace(/\bbootstrap\b/gi, "")
    .replace(/\bconfidence\b/gi, "")
    .replace(/\binterval\b/gi, "")
    .replace(/\bpercentile\b/gi, "")
    .replace(/\bci\b/gi, "")
    .replace(/\bfor\b/gi, "")
    .replace(/\bof\b/gi, "")
    .replace(/\bdata\b/gi, "")
    .replace(/\bmean\b/gi, "")
    .replace(/\bmedian\b/gi, "");

  const values = parseNumbers(dataText);
  if (values.length < 2) {
    throw new Error("Bootstrap intervals need at least two data values.");
  }
  if (!Number.isSafeInteger(resamples) || resamples < 50 || resamples > 50000) {
    throw new Error("Bootstrap resamples must be an integer from 50 to 50000.");
  }
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new Error("Bootstrap seed must be a nonnegative integer.");
  }

  return { values, statistic, level, resamples, seed };
}

function parsePermutationInput(text) {
  let cleaned = text;
  let statistic = text.toLowerCase().includes("median") ? "median" : "mean";
  let resamples = 5000;
  let seed = 12345;

  const statisticMatch = cleaned.match(/\b(?:stat|statistic)\s*=\s*(mean|median)\b/i);
  if (statisticMatch) {
    statistic = statisticMatch[1].toLowerCase();
    cleaned = cleaned.replace(statisticMatch[0], "");
  }

  const resamplesMatch = cleaned.match(/\b(?:resamples|samples|iterations|reps|b)\s*=\s*(\d+)\b/i);
  if (resamplesMatch) {
    resamples = Number(resamplesMatch[1]);
    cleaned = cleaned.replace(resamplesMatch[0], "");
  }

  const seedMatch = cleaned.match(/\bseed\s*=\s*(\d+)\b/i);
  if (seedMatch) {
    seed = Number(seedMatch[1]);
    cleaned = cleaned.replace(seedMatch[0], "");
  }

  cleaned = cleaned
    .replace(/\bpermutation\b/gi, "")
    .replace(/\brandomi[sz]ation\b/gi, "")
    .replace(/\btest\b/gi, "")
    .replace(/\bshuffle\b/gi, "")
    .replace(/\bmean\b/gi, "")
    .replace(/\bmedian\b/gi, "");

  const parsed = parseTwoSampleInput(cleaned);
  if (parsed.left.length < 2 || parsed.right.length < 2) {
    throw new Error("Permutation tests need at least two values in each group.");
  }
  if (!Number.isSafeInteger(resamples) || resamples < 50 || resamples > 100000) {
    throw new Error("Permutation test resamples must be an integer from 50 to 100000.");
  }
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new Error("Permutation test seed must be a nonnegative integer.");
  }

  return {
    ...parsed,
    statistic,
    resamples,
    seed,
  };
}

function parseKaplanMeierInput(text) {
  const timesMatch = text.match(/\b(?:times?|durations?|follow-?up)\s*[:=]\s*([^;]+)/i);
  const eventsMatch = text.match(/\b(?:events?|status|statuses|event indicators?)\s*[:=]\s*([^;]+)/i);
  if (!timesMatch || !eventsMatch) {
    throw new Error("Kaplan-Meier needs times and events, such as kaplan-meier times: 5,6,6,8,10; events: 1,1,0,1,0.");
  }

  const times = parseNumbers(timesMatch[1]);
  const events = parseNumbers(eventsMatch[1]);
  if (times.length < 2 || events.length < 2 || times.length !== events.length) {
    throw new Error("Kaplan-Meier times and events must have the same length with at least two observations.");
  }
  if (times.some((time) => !Number.isFinite(time) || time <= 0)) {
    throw new Error("Kaplan-Meier follow-up times must be finite positive numbers.");
  }
  if (events.some((event) => !(event === 0 || event === 1))) {
    throw new Error("Kaplan-Meier event indicators must be 1 for event or 0 for censored.");
  }
  if (events.every((event) => event === 0)) {
    throw new Error("Kaplan-Meier needs at least one observed event.");
  }

  return { times, events };
}

function parseLogRankInput(text) {
  const cleaned = text
    .replace(/\blog-?rank\b/gi, "")
    .replace(/\bsurvival\b/gi, "")
    .replace(/\btest\b/gi, "");
  const alpha = readNamedNumber(text, ["alpha"], 0.05);
  if (!(alpha > 0 && alpha < 1)) {
    throw new Error("Log-rank alpha must be between 0 and 1.");
  }

  const groupPattern = /(?:group|sample)\s*([12])\s*(?::|=)?\s*times?\s*[:=]\s*([^;]+?)\s+events?\s*[:=]\s*([^;]+)/gi;
  const groups = {};
  for (const match of cleaned.matchAll(groupPattern)) {
    groups[match[1]] = {
      times: parseNumbers(match[2]),
      events: parseNumbers(match[3]),
    };
  }

  if (!groups[1] || !groups[2]) {
    const chunks = cleaned.split(";").map((chunk) => chunk.trim()).filter(Boolean);
    if (chunks.length >= 2) {
      for (let index = 0; index < 2; index += 1) {
        const timesMatch = chunks[index].match(/\btimes?\s*[:=]\s*([^;]+?)(?=\s+events?\b|$)/i);
        const eventsMatch = chunks[index].match(/\bevents?\s*[:=]\s*([^;]+)/i);
        if (timesMatch && eventsMatch) {
          groups[String(index + 1)] = {
            times: parseNumbers(timesMatch[1]),
            events: parseNumbers(eventsMatch[1]),
          };
        }
      }
    }
  }

  if (!groups[1] || !groups[2]) {
    throw new Error("Log-rank needs group1 times/events and group2 times/events.");
  }
  validateSurvivalGroup(groups[1].times, groups[1].events, "Log-rank group 1");
  validateSurvivalGroup(groups[2].times, groups[2].events, "Log-rank group 2");

  return {
    leftTimes: groups[1].times,
    leftEvents: groups[1].events,
    rightTimes: groups[2].times,
    rightEvents: groups[2].events,
    alpha,
  };
}

function parseCoxInput(text) {
  const timesMatch = text.match(/\b(?:times?|durations?|follow-?up)\s*[:=]\s*([^;]+)/i);
  const eventsMatch = text.match(/\b(?:events?|status|statuses|event indicators?)\s*[:=]\s*([^;]+)/i);
  const covariateMatch = text.match(/\b(?:x|covariate|predictor|exposure)\s*[:=]\s*([^;]+)/i);
  const alpha = readNamedNumber(text, ["alpha"], 0.05);
  if (!(alpha > 0 && alpha < 1)) {
    throw new Error("Cox regression alpha must be between 0 and 1.");
  }
  if (!timesMatch || !eventsMatch || !covariateMatch) {
    throw new Error("Cox regression needs times, events, and x lists.");
  }

  const times = parseNumbers(timesMatch[1]);
  const events = parseNumbers(eventsMatch[1]);
  const covariate = parseNumbers(covariateMatch[1]);
  validateSurvivalGroup(times, events, "Cox regression");
  if (covariate.length !== times.length || covariate.some((value) => !Number.isFinite(value))) {
    throw new Error("Cox regression covariate x must have the same length as times and events.");
  }
  if (events.every((event) => event === 0)) {
    throw new Error("Cox regression needs at least one observed event.");
  }
  if (new Set(covariate.map((value) => normalizeNumber(value))).size < 2) {
    throw new Error("Cox regression covariate x needs variation.");
  }

  return {
    times,
    events,
    covariate,
    alpha,
  };
}

function validateSurvivalGroup(times, events, context) {
  if (times.length < 2 || events.length < 2 || times.length !== events.length) {
    throw new Error(`${context} needs matching times and event indicators with at least two observations.`);
  }
  if (times.some((time) => !Number.isFinite(time) || time <= 0)) {
    throw new Error(`${context} follow-up times must be finite positive numbers.`);
  }
  if (events.some((event) => !(event === 0 || event === 1))) {
    throw new Error(`${context} event indicators must be 1 for event or 0 for censored.`);
  }
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

function parseNumberTheoryInput(text) {
  const lower = text.toLowerCase();
  if (lower.includes("chinese remainder") || lower.startsWith("crt ") || lower.includes("congruence system")) {
    const congruences = parseCongruences(text);
    if (congruences.length < 2) {
      throw new Error("CRT needs at least two congruences, such as crt x=2 mod 3; x=3 mod 5.");
    }
    return {
      operation: "crt",
      congruences,
      expression: congruences.map((item) => `x = ${item.remainder} mod ${item.modulus}`).join("; "),
    };
  }

  if (lower.includes("mod inverse") || lower.includes("modular inverse")) {
    const numbers = parseNumbers(text);
    const value = readNamedInteger(text, ["value", "a", "base"], numbers[0], "Modular inverse value");
    const modulus = readNamedInteger(text, ["mod", "modulus", "m"], numbers[1], "Modular inverse modulus");
    validateModulus(modulus);
    return {
      operation: "modinverse",
      value,
      modulus,
      expression: `${value} inverse mod ${modulus}`,
    };
  }

  if (
    lower.includes("modpow") ||
    lower.includes("powmod") ||
    lower.includes("modular exponent") ||
    /\b\d+\s*\^\s*\d+\s+mod\s+\d+\b/i.test(lower)
  ) {
    const numbers = parseNumbers(text);
    const base = readNamedInteger(text, ["base", "a"], numbers[0], "Modular exponentiation base");
    const exponent = readNamedInteger(text, ["exp", "exponent", "power"], numbers[1], "Modular exponentiation exponent");
    const modulus = readNamedInteger(text, ["mod", "modulus", "m"], numbers[2], "Modular exponentiation modulus");
    if (exponent < 0) {
      throw new Error("Modular exponentiation needs a nonnegative exponent.");
    }
    validateModulus(modulus);
    return {
      operation: "modpow",
      base,
      exponent,
      modulus,
      expression: `${base}^${exponent} mod ${modulus}`,
    };
  }

  if (lower.startsWith("gcd ") || lower.includes("greatest common divisor")) {
    const values = parseIntegerValues(text, "GCD");
    if (values.length < 2) {
      throw new Error("GCD needs at least two integers.");
    }
    return {
      operation: "gcd",
      values,
      expression: `gcd(${values.join(", ")})`,
    };
  }

  if (lower.startsWith("lcm ") || lower.includes("least common multiple")) {
    const values = parseIntegerValues(text, "LCM");
    if (values.length < 2) {
      throw new Error("LCM needs at least two integers.");
    }
    return {
      operation: "lcm",
      values,
      expression: `lcm(${values.join(", ")})`,
    };
  }

  const numbers = parseNumbers(text);
  const value = readNamedInteger(text, ["n", "value"], numbers[0], "Prime factorization value");
  if (value < 2) {
    throw new Error("Prime factorization needs an integer greater than 1.");
  }
  return {
    operation: "prime-factorization",
    value,
    expression: `factor ${value}`,
  };
}

function parseIntegerValues(text, context) {
  const values = parseNumbers(text);
  if (values.some((value) => !Number.isSafeInteger(value))) {
    throw new Error(`${context} needs safe integer inputs.`);
  }
  return values;
}

function readNamedInteger(text, names, fallback, context) {
  const value = readNamedNumber(text, names, fallback);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${context} must be a safe integer.`);
  }
  return value;
}

function validateModulus(modulus) {
  if (!Number.isSafeInteger(modulus) || modulus <= 1) {
    throw new Error("Modular arithmetic needs an integer modulus greater than 1.");
  }
}

function parseCongruences(text) {
  const congruences = [];
  for (const match of text.matchAll(/(?:x\s*(?:=|\u2261|congruent\s+to)\s*)?([-+]?\d+)\s*(?:mod|modulo)\s*(\d+)/gi)) {
    const remainder = Number(match[1]);
    const modulus = Number(match[2]);
    validateModulus(modulus);
    congruences.push({
      remainder: modNormalize(remainder, modulus),
      modulus,
    });
  }
  return congruences;
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

function parsePowerAnalysisInput(text) {
  const lower = text.toLowerCase();
  const { alpha, cleaned } = extractAlpha(text);
  const mode = lower.includes("sample size") || lower.includes("required n") || lower.includes("needed n")
    ? "sample-size"
    : "power";
  const alternative = parseAlternative(text);
  const model = lower.includes("proportion")
    ? "one-proportion"
    : lower.includes("two-sample") || lower.includes("two sample") || lower.includes("two-group") || lower.includes("two group")
      ? "two-sample-mean"
      : "one-sample-mean";
  const targetPower = readPowerNamedNumber(cleaned, ["power", "target power", "target"], Number.NaN);
  const n = readPowerNamedNumber(cleaned, ["n", "sample", "sample size", "per group", "n per group"], Number.NaN);
  const request = {
    mode,
    model,
    alpha,
    alternative,
    targetPower,
    n,
  };

  if (model === "one-proportion") {
    const p0 = readPowerNamedNumber(cleaned, ["p0", "null", "baseline"], Number.NaN);
    const p1 = readPowerNamedNumber(cleaned, ["p1", "alt", "alternative"], Number.NaN);
    if (!(p0 > 0 && p0 < 1) || !(p1 > 0 && p1 < 1) || nearlyEqual(p0, p1)) {
      throw new Error("Proportion power needs p0 and p1 between 0 and 1, such as power proportion p0=0.5 p1=0.6 n=200.");
    }
    return validatePowerRequest({
      ...request,
      p0,
      p1,
      effect: p1 - p0,
      modelLabel: "one-proportion z design",
    });
  }

  const effect = readPowerEffect(cleaned, model);
  if (!(Math.abs(effect) > EPSILON)) {
    throw new Error("Power analysis needs a nonzero effect size, such as effect=0.5.");
  }
  return validatePowerRequest({
    ...request,
    effect,
    modelLabel: model === "two-sample-mean" ? "two-sample mean z design" : "one-sample mean z design",
  });
}

function readPowerEffect(text, model) {
  const explicit = readPowerNamedNumber(text, ["effect", "effect size", "d", "cohens d", "cohen d"], Number.NaN);
  if (Number.isFinite(explicit)) {
    return explicit;
  }

  const sd = readPowerNamedNumber(text, ["sd", "sigma", "std"], Number.NaN);
  if (!(sd > 0)) {
    return Number.NaN;
  }

  if (model === "two-sample-mean") {
    const mean1 = readPowerNamedNumber(text, ["mean1", "mu1", "m1"], Number.NaN);
    const mean2 = readPowerNamedNumber(text, ["mean2", "mu2", "m2"], Number.NaN);
    return Number.isFinite(mean1) && Number.isFinite(mean2) ? (mean1 - mean2) / sd : Number.NaN;
  }

  const meanValue = readPowerNamedNumber(text, ["mean", "mu1", "alt", "alternative"], Number.NaN);
  const nullMean = readPowerNamedNumber(text, ["mu", "mu0", "null"], Number.NaN);
  return Number.isFinite(meanValue) && Number.isFinite(nullMean) ? (meanValue - nullMean) / sd : Number.NaN;
}

function validatePowerRequest(request) {
  if (request.mode === "sample-size") {
    if (!(request.targetPower > 0 && request.targetPower < 1)) {
      throw new Error("Sample-size analysis needs target power between 0 and 1, such as power=0.8.");
    }
  } else if (!Number.isInteger(request.n) || request.n < 2) {
    throw new Error("Power analysis needs an integer sample size n >= 2.");
  }
  return request;
}

function powerForDesign(request) {
  if (request.model === "one-proportion") {
    return oneProportionDesignPower(request.p0, request.p1, request.n, request.alpha, request.alternative);
  }

  const signedEffect = signedEffectForAlternative(request.effect, request.alternative);
  const shift = request.model === "two-sample-mean"
    ? signedEffect * Math.sqrt(request.n / 2)
    : signedEffect * Math.sqrt(request.n);
  return shiftedNormalPower(shift, 1, request.alpha, request.alternative);
}

function oneProportionDesignPower(p0, p1, n, alpha, alternative) {
  const nullStandardError = Math.sqrt((p0 * (1 - p0)) / n);
  const altStandardError = Math.sqrt((p1 * (1 - p1)) / n);
  const meanShift = (p1 - p0) / nullStandardError;
  const scale = altStandardError / nullStandardError;
  return shiftedNormalPower(meanShift, scale, alpha, alternative);
}

function shiftedNormalPower(meanShift, scale, alpha, alternative) {
  const critical = criticalValueForPower(alpha, alternative);
  if (alternative === "greater") {
    return clampProbability(1 - normalCdf((critical - meanShift) / scale));
  }
  if (alternative === "less") {
    return clampProbability(normalCdf((-critical - meanShift) / scale));
  }
  return clampProbability(
    normalCdf((-critical - meanShift) / scale) +
      (1 - normalCdf((critical - meanShift) / scale)),
  );
}

function solvePowerSampleSize(request) {
  let low = 2;
  let high = 2;
  while (powerForDesign({ ...request, n: high }) < request.targetPower) {
    high *= 2;
    if (high > 1000000) {
      throw new Error("Required sample size is above 1,000,000 for this design.");
    }
  }
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (powerForDesign({ ...request, n: mid }) >= request.targetPower) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low;
}

function criticalValueForPower(alpha, alternative) {
  return alternative === "two-sided"
    ? inverseNormalCdf(1 - alpha / 2)
    : inverseNormalCdf(1 - alpha);
}

function signedEffectForAlternative(effect, alternative) {
  if (alternative === "less") {
    return -Math.abs(effect);
  }
  if (alternative === "greater") {
    return Math.abs(effect);
  }
  return Math.abs(effect);
}

function formatPowerSampleSizeAnswer(request, sampleSize, achievedPower) {
  const unit = formatPowerSampleUnit(request);
  return `${unit} = ${formatNumber(sampleSize)} for power ~= ${formatNumber(achievedPower)}`;
}

function formatPowerSampleUnit(request) {
  return request.model === "two-sample-mean" ? "n per group" : "n";
}

function powerAnalysisArtifacts(request, sampleSize, achievedPower, critical) {
  const artifacts = [
    ["Model", request.modelLabel],
    ["Alternative", request.alternative],
    ["Alpha", formatNumber(request.alpha)],
    ["z critical", formatNumber(critical)],
    [formatPowerSampleUnit(request), formatNumber(sampleSize)],
    ["Power", formatNumber(achievedPower)],
  ];
  if (request.mode === "sample-size") {
    artifacts.splice(5, 0, ["Target power", formatNumber(request.targetPower)]);
  }
  if (request.model === "one-proportion") {
    artifacts.splice(2, 0, ["Null proportion", formatNumber(request.p0)], ["Alternative proportion", formatNumber(request.p1)]);
  } else {
    artifacts.splice(2, 0, ["Effect size", formatNumber(request.effect)]);
  }
  return artifacts;
}

function readPowerNamedNumber(text, names, fallback) {
  const numberPattern = "([-+]?\\d*\\.?\\d+(?:e[-+]?\\d+)?)";
  for (const name of names) {
    const escaped = name
      .trim()
      .split(/\s+/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[\\s_-]+");
    const match = text.match(new RegExp(`\\b${escaped}\\s*=\\s*${numberPattern}`, "i"));
    if (match) {
      return Number(match[1]);
    }
  }
  return fallback;
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

function inverseBetaCdf(probability, alpha, beta) {
  if (!(probability > 0 && probability < 1)) {
    throw new Error("Beta quantile probability must be between 0 and 1.");
  }
  let low = 0;
  let high = 1;
  for (let index = 0; index < 90; index += 1) {
    const mid = (low + high) / 2;
    if (regularizedBeta(mid, alpha, beta) < probability) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

function betaBinomialProbability(trials, successes, alpha, beta) {
  if (!Number.isInteger(trials) || !Number.isInteger(successes) || successes < 0 || successes > trials) {
    throw new Error("Beta-binomial probability needs integer successes with 0 <= k <= n.");
  }
  const logProbability = Math.log(combination(trials, successes)) +
    logBeta(successes + alpha, trials - successes + beta) -
    logBeta(alpha, beta);
  return Math.exp(logProbability);
}

function logBeta(alpha, beta) {
  return logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta);
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

function parseMultivariateStatsInput(text) {
  const columns = [];
  const seen = new Set();

  for (const match of text.matchAll(/\b([A-Za-z_]\w*)\s*[:=]\s*([^;]+)/g)) {
    const name = match[1];
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    const values = parseNumberList(match[2]);
    if (values.length >= 2) {
      columns.push({ name, values });
      seen.add(key);
    }
  }

  if (columns.length >= 2) {
    return buildMultivariateDataset(columns);
  }

  const pairs = parsePairs(text);
  if (pairs.length >= 2) {
    return buildMultivariateDataset([
      { name: "x", values: pairs.map((pair) => pair.x) },
      { name: "y", values: pairs.map((pair) => pair.y) },
    ]);
  }

  throw new Error("Use labeled lists such as pca x: 1,2,3; y: 2,4,6.");
}

function parseTimeSeriesInput(text) {
  let cleaned = text;
  let forecastSteps = 1;
  const forecastMatch = cleaned.match(/\b(?:forecast|steps|horizon|ahead)\s*=?\s*(\d+)\b/i);

  if (forecastMatch) {
    forecastSteps = Number(forecastMatch[1]);
    cleaned = cleaned.replace(forecastMatch[0], "");
  }

  cleaned = cleaned
    .replace(/\bar\s*\(?\s*1\s*\)?/gi, "")
    .replace(/\bautoregressive\b/gi, "")
    .replace(/\btime(?:-|\s*)series\b/gi, "")
    .replace(/\bseries\b/gi, "")
    .replace(/\bdata\b/gi, "");

  const values = parseNumbers(cleaned);
  if (values.length < 4) {
    throw new Error("AR(1) forecasting needs at least four time-series values.");
  }
  if (!Number.isSafeInteger(forecastSteps) || forecastSteps < 1 || forecastSteps > 100) {
    throw new Error("AR(1) forecast steps must be an integer from 1 to 100.");
  }

  return { values, forecastSteps };
}

function buildMultivariateDataset(columns) {
  if (columns.length < 2) {
    throw new Error("Multivariate statistics need at least two variables.");
  }
  const n = columns[0].values.length;
  if (n < 2) {
    throw new Error("Each variable needs at least two observations.");
  }
  for (const column of columns) {
    if (column.values.length !== n) {
      throw new Error("All multivariate lists must have the same length.");
    }
  }
  return {
    n,
    columns: columns.map((column) => ({
      ...column,
      mean: mean(column.values),
    })),
  };
}

function multivariateObservationTable(dataset) {
  return {
    headers: ["Obs", ...dataset.columns.map((column) => column.name)],
    rows: Array.from({ length: dataset.n }, (_, rowIndex) => [
      String(rowIndex + 1),
      ...dataset.columns.map((column) => formatNumber(column.values[rowIndex])),
    ]),
  };
}

function parsePolynomialRegressionInput(text) {
  const parsedLists = parseXYLists(text);
  const pairs = parsedLists ? zipPairs(parsedLists.x, parsedLists.y) : parsePairs(text);
  if (pairs.length < 3) {
    throw new Error("Polynomial regression needs at least three points, such as quadratic regression degree=2 for (1,2), (2,5), (3,10).");
  }

  const degree = readPolynomialRegressionDegree(text);
  if (!Number.isSafeInteger(degree) || degree < 1 || degree > 5) {
    throw new Error("Polynomial regression supports integer degree values from 1 through 5.");
  }
  if (pairs.length <= degree) {
    throw new Error("Polynomial regression needs more observations than polynomial coefficients.");
  }
  const distinctX = new Set(pairs.map((pair) => formatNumber(pair.x)));
  if (distinctX.size <= degree) {
    throw new Error("Polynomial regression needs at least degree + 1 distinct x values.");
  }

  return {
    degree,
    x: pairs.map((pair) => pair.x),
    y: pairs.map((pair) => pair.y),
    prediction: parsePolynomialRegressionPrediction(text),
  };
}

function readPolynomialRegressionDegree(text) {
  const explicit = readNamedNumber(text, ["degree", "deg"], Number.NaN);
  if (Number.isFinite(explicit)) {
    return explicit;
  }
  const orderMatch = text.match(/\b(?:order|power)\s+(\d+)\b/i);
  if (orderMatch) {
    return Number(orderMatch[1]);
  }
  const lower = text.toLowerCase();
  if (lower.includes("quadratic")) return 2;
  if (lower.includes("cubic")) return 3;
  if (lower.includes("quartic")) return 4;
  if (lower.includes("quintic")) return 5;
  return 2;
}

function parsePolynomialRegressionPrediction(text) {
  const match = text.match(/\bpredict\b(.+)$/i);
  if (!match) {
    return Number.NaN;
  }
  const named = readNamedNumber(match[1], ["x"], Number.NaN);
  if (Number.isFinite(named)) {
    return named;
  }
  const numbers = parseNumbers(match[1]);
  return numbers.length ? numbers[0] : Number.NaN;
}

function parseKMeansInput(text) {
  const points = parsePairs(text).map((point) => [point.x, point.y]);
  if (points.length < 2) {
    throw new Error("K-means needs coordinate points, such as k-means k=2 (1,1), (2,1), (8,8).");
  }

  let k = readNamedNumber(text, ["k", "clusters"], Number.NaN);
  const clusterMatch = text.match(/\b(\d+)\s+clusters?\b/i);
  if (!Number.isFinite(k) && clusterMatch) {
    k = Number(clusterMatch[1]);
  }
  if (!Number.isSafeInteger(k) || k < 1 || k > points.length) {
    throw new Error("K-means needs an integer k between 1 and the number of points.");
  }

  const distinct = new Set(points.map((point) => point.map(formatNumber).join(",")));
  if (distinct.size < k) {
    throw new Error("K-means needs at least k distinct points.");
  }

  return {
    k,
    points,
  };
}

function parseLogisticRegressionInput(text) {
  const lists = new Map();
  const listText = text.replace(/\bpredict\b.*$/i, "");
  for (const match of listText.matchAll(/\b([A-Za-z_]\w*)\s*[:=]\s*([^;]+)/g)) {
    const label = match[1];
    const values = parseNumberList(match[2]);
    if (values.length > 1) {
      lists.set(label.toLowerCase(), { name: label, values });
    }
  }

  const responseEntry = lists.get("y") ??
    lists.get("response") ??
    lists.get("outcome") ??
    lists.get("class") ??
    lists.get("label");
  if (!responseEntry) {
    throw new Error("Logistic regression needs a binary response list, such as y: 0, 1, 0, 1.");
  }

  const predictors = [...lists.entries()]
    .filter(([key]) => key !== responseEntry.name.toLowerCase())
    .filter(([key]) => /^x\d*$/i.test(key) || /^predictor\d+$/i.test(key))
    .sort(([left], [right]) => naturalLabelNumber(left) - naturalLabelNumber(right))
    .map(([, value]) => value);

  if (predictors.length < 1) {
    throw new Error("Logistic regression needs at least one predictor list, such as x: 1, 2, 3.");
  }
  for (const predictor of predictors) {
    if (predictor.values.length !== responseEntry.values.length) {
      throw new Error("All logistic-regression lists must have the same length.");
    }
  }
  if (responseEntry.values.length <= predictors.length + 1) {
    throw new Error("Logistic regression needs more observations than model coefficients.");
  }
  if (!responseEntry.values.every((value) => value === 0 || value === 1)) {
    throw new Error("Logistic regression response values must be 0 or 1.");
  }
  if (!responseEntry.values.some((value) => value === 0) || !responseEntry.values.some((value) => value === 1)) {
    throw new Error("Logistic regression needs both 0 and 1 response classes.");
  }

  const prediction = parseLogisticRegressionPrediction(text, predictors.map((predictor) => predictor.name));
  return {
    y: responseEntry.values,
    predictors,
    prediction,
  };
}

function parseLogisticRegressionPrediction(text, predictorNames) {
  const match = text.match(/\bpredict\b(.+)$/i);
  if (!match) {
    return predictorNames.map(() => Number.NaN);
  }
  const namedPrediction = predictorNames.map((name) => readNamedNumber(match[1], [name], Number.NaN));
  if (namedPrediction.every(Number.isFinite)) {
    return namedPrediction;
  }
  const numbers = parseNumbers(match[1]);
  if (numbers.length === predictorNames.length) {
    return numbers;
  }
  return namedPrediction;
}

function parseMultipleRegressionInput(text) {
  const lists = new Map();
  const listText = text.replace(/\bpredict\b.*$/i, "");
  for (const match of listText.matchAll(/\b([A-Za-z_]\w*)\s*[:=]\s*([^;]+)/g)) {
    const label = match[1];
    const values = parseNumberList(match[2]);
    if (values.length > 1) {
      lists.set(label.toLowerCase(), { name: label, values });
    }
  }

  const responseEntry = lists.get("y") ?? lists.get("response") ?? lists.get("outcome");
  if (!responseEntry) {
    throw new Error("Multiple regression needs a response list, such as y: 4, 7, 9.");
  }

  const predictors = [...lists.entries()]
    .filter(([key]) => /^x\d+$/i.test(key) || /^predictor\d+$/i.test(key))
    .sort(([left], [right]) => naturalLabelNumber(left) - naturalLabelNumber(right))
    .map(([, value]) => value);

  if (predictors.length < 2) {
    throw new Error("Multiple regression needs at least two predictor lists, such as x1: ...; x2: ....");
  }
  for (const predictor of predictors) {
    if (predictor.values.length !== responseEntry.values.length) {
      throw new Error("All multiple-regression lists must have the same length.");
    }
  }
  if (responseEntry.values.length <= predictors.length) {
    throw new Error("Multiple regression needs more observations than predictors.");
  }

  const prediction = parseMultipleRegressionPrediction(text, predictors.map((predictor) => predictor.name));
  return {
    y: responseEntry.values,
    predictors,
    prediction,
  };
}

function parseMultipleRegressionPrediction(text, predictorNames) {
  const match = text.match(/\bpredict\b(.+)$/i);
  if (!match) {
    return predictorNames.map(() => Number.NaN);
  }
  return predictorNames.map((name) => readNamedNumber(match[1], [name], Number.NaN));
}

function naturalLabelNumber(label) {
  const match = label.match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function zipPairs(xValues, yValues) {
  return xValues.map((x, index) => ({ x, y: yValues[index] }));
}

function formatMultipleRegressionEquation(coefficients, predictorNames) {
  let expression = `y = ${formatNumber(coefficients[0])}`;
  for (let index = 0; index < predictorNames.length; index += 1) {
    expression += ` ${formatSignedTerm(coefficients[index + 1], predictorNames[index])}`;
  }
  return expression;
}

function formatPolynomialRegressionEquation(coefficients, variable) {
  let expression = `y = ${formatNumber(coefficients[0])}`;
  for (let power = 1; power < coefficients.length; power += 1) {
    const coefficient = normalizeNumber(coefficients[power]);
    if (nearlyEqual(coefficient, 0)) continue;
    const sign = coefficient < 0 ? "-" : "+";
    const magnitude = Math.abs(coefficient);
    const coefficientText = nearlyEqual(magnitude, 1) ? "" : formatNumber(magnitude);
    const variableText = power === 1 ? variable : `${variable}^${power}`;
    expression += ` ${sign} ${coefficientText}${variableText}`;
  }
  return expression;
}

function evaluatePolynomialRegression(coefficients, x) {
  return normalizeNumber(coefficients.reduce((sum, coefficient, power) => sum + coefficient * x ** power, 0));
}

function formatLogisticRegressionEquation(coefficients, predictorNames) {
  let expression = `logit(p) = ${formatNumber(coefficients[0])}`;
  for (let index = 0; index < predictorNames.length; index += 1) {
    expression += ` ${formatSignedTerm(coefficients[index + 1], predictorNames[index])}`;
  }
  return expression;
}

function formatLinearExpression(coefficients, variables, constant = 0) {
  const terms = [];
  for (let index = 0; index < variables.length; index += 1) {
    const coefficient = normalizeNumber(coefficients[index]);
    if (nearlyEqual(coefficient, 0)) continue;
    const magnitude = Math.abs(coefficient);
    const coefficientText = nearlyEqual(magnitude, 1) ? "" : formatNumber(magnitude);
    const term = `${coefficientText}${variables[index]}`;
    if (terms.length === 0) {
      terms.push(coefficient < 0 ? `-${term}` : term);
    } else {
      terms.push(`${coefficient < 0 ? "-" : "+"} ${term}`);
    }
  }
  const normalizedConstant = normalizeNumber(constant);
  if (!nearlyEqual(normalizedConstant, 0) || terms.length === 0) {
    if (terms.length === 0) {
      terms.push(formatNumber(normalizedConstant));
    } else {
      terms.push(`${normalizedConstant < 0 ? "-" : "+"} ${formatNumber(Math.abs(normalizedConstant))}`);
    }
  }
  return terms.join(" ");
}

function formatLinearConstraint(constraint) {
  return `${formatLinearExpression(constraint.coefficients, ["x", "y"])} <= ${formatNumber(constraint.bound)}`;
}

function formatLinearProgramPoint(point, variables) {
  return variables.map((variable, index) => `${variable}=${formatNumber(point[index])}`).join(", ");
}

function formatSignedTerm(coefficient, variable) {
  const sign = coefficient < 0 ? "-" : "+";
  return `${sign} ${formatNumber(Math.abs(coefficient))}${variable}`;
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

function parseBayesianProportionInput(text) {
  const successes = readNamedNumber(text, ["successes", "success", "x", "count"], Number.NaN);
  const trials = readNamedNumber(text, ["n", "trials", "total", "sample"], Number.NaN);
  const priorAlpha = readNamedNumber(text, ["alpha", "priorAlpha", "a"], 1);
  const priorBeta = readNamedNumber(text, ["beta", "priorBeta", "b"], 1);
  const level = parseCredibleLevel(text, 0.95);
  const futureTrials = readNamedNumber(text, ["future", "futureN", "m", "predict"], Number.NaN);
  const futureSuccesses = readNamedNumber(text, ["k", "futureSuccesses", "futureX"], Number.NaN);

  validateProportionCount(successes, trials, "Bayesian proportion update");
  if (!(priorAlpha > 0) || !(priorBeta > 0)) {
    throw new Error("Beta prior parameters alpha and beta must be positive.");
  }
  if (!(level > 0 && level < 1)) {
    throw new Error("Credible interval level must be between 0 and 1.");
  }
  if (Number.isFinite(futureTrials) || Number.isFinite(futureSuccesses)) {
    if (!Number.isInteger(futureTrials) || !Number.isInteger(futureSuccesses) || futureTrials < 0 || futureSuccesses < 0 || futureSuccesses > futureTrials) {
      throw new Error("Posterior predictive inputs need integers with 0 <= k <= future.");
    }
  }

  return {
    successes,
    trials,
    priorAlpha,
    priorBeta,
    level,
    futureTrials,
    futureSuccesses,
  };
}

function parseCredibleLevel(text, fallback) {
  const intervalMatch = text.match(/\b(?:credible|credibility|confidence)\s+interval\s*=\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i);
  if (intervalMatch) {
    const raw = Number(intervalMatch[1]);
    const level = raw > 1 ? raw / 100 : raw;
    if (!(level > 0 && level < 1)) {
      throw new Error("Credible interval level must be between 0 and 1, or between 0 and 100 percent.");
    }
    return level;
  }

  const named = readNamedNumber(text, ["confidence", "credible", "credibility", "level"], Number.NaN);
  if (Number.isFinite(named)) {
    const level = named > 1 ? named / 100 : named;
    if (!(level > 0 && level < 1)) {
      throw new Error("Credible interval level must be between 0 and 1, or between 0 and 100 percent.");
    }
    return level;
  }

  const phraseMatch = text.match(/\b([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*%?\s*(?:credible|credibility|confidence|ci)\b/i);
  if (phraseMatch) {
    const raw = Number(phraseMatch[1]);
    const level = raw > 1 ? raw / 100 : raw;
    if (!(level > 0 && level < 1)) {
      throw new Error("Credible interval level must be between 0 and 1, or between 0 and 100 percent.");
    }
    return level;
  }

  return fallback;
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

function gcdInt(left, right) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function lcmInt(left, right) {
  if (left === 0 || right === 0) {
    return 0;
  }
  return Math.abs((left / gcdInt(left, right)) * right);
}

function extendedGcd(left, right) {
  let oldR = left;
  let r = right;
  let oldS = 1;
  let s = 0;
  let oldT = 0;
  let t = 1;

  while (r !== 0) {
    const quotient = Math.trunc(oldR / r);
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
    [oldT, t] = [t, oldT - quotient * t];
  }

  return {
    gcd: Math.abs(oldR),
    x: oldS,
    y: oldT,
  };
}

function modularInverse(value, modulus) {
  const normalized = modNormalize(value, modulus);
  const result = extendedGcd(normalized, modulus);
  if (result.gcd !== 1) {
    return null;
  }
  return modNormalize(result.x, modulus);
}

function modularPower(base, exponent, modulus) {
  let result = 1n;
  let factor = BigInt(modNormalize(base, modulus));
  let power = BigInt(exponent);
  const mod = BigInt(modulus);

  while (power > 0n) {
    if (power % 2n === 1n) {
      result = (result * factor) % mod;
    }
    factor = (factor * factor) % mod;
    power /= 2n;
  }

  return Number(result);
}

function primeFactorization(value) {
  let remaining = value;
  const factors = [];
  for (let divisor = 2; divisor * divisor <= remaining; divisor += divisor === 2 ? 1 : 2) {
    if (remaining % divisor !== 0) {
      continue;
    }
    let exponent = 0;
    while (remaining % divisor === 0) {
      remaining /= divisor;
      exponent += 1;
    }
    factors.push({ prime: divisor, exponent });
  }
  if (remaining > 1) {
    factors.push({ prime: remaining, exponent: 1 });
  }
  return factors;
}

function solveChineseRemainder(congruences) {
  let remainder = congruences[0].remainder;
  let modulus = congruences[0].modulus;

  for (const next of congruences.slice(1)) {
    const divisor = gcdInt(modulus, next.modulus);
    const difference = next.remainder - remainder;
    if (difference % divisor !== 0) {
      return null;
    }

    const leftModulus = modulus / divisor;
    const rightModulus = next.modulus / divisor;
    const inverse = modularInverse(leftModulus, rightModulus);
    if (inverse === null) {
      return null;
    }
    const multiplier = modNormalize((difference / divisor) * inverse, rightModulus);
    remainder = modNormalize(remainder + modulus * multiplier, modulus * rightModulus);
    modulus *= rightModulus;
  }

  return { remainder, modulus };
}

function modNormalize(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function formatPrimeFactorization(factors) {
  return factors
    .map((factor) => factor.exponent === 1 ? String(factor.prime) : `${factor.prime}^${factor.exponent}`)
    .join(" * ");
}

function runningNumberTheoryRows(values, combiner) {
  let current = Math.abs(values[0]);
  return values.map((value, index) => {
    if (index > 0) {
      current = combiner(current, value);
    }
    return [String(value), String(current)];
  });
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

function isMarkovQuestion(lower) {
  return lower.includes("markov") ||
    lower.includes("transition matrix") ||
    lower.includes("stationary distribution") ||
    lower.includes("steady state");
}

function isBayesianProportionQuestion(lower) {
  return lower.includes("beta posterior") ||
    lower.includes("beta-binomial") ||
    lower.includes("beta binomial") ||
    lower.includes("bayesian proportion") ||
    (lower.includes("posterior") && lower.includes("success"));
}

function isMultipleRegressionQuestion(lower, statement) {
  return lower.includes("multiple regression") ||
    lower.includes("multivariate regression") ||
    /\bx1\s*[:=].*;\s*x2\s*[:=]/is.test(statement);
}

function isPolynomialRegressionQuestion(lower) {
  return lower.includes("polynomial regression") ||
    lower.includes("quadratic regression") ||
    lower.includes("cubic regression") ||
    lower.includes("quartic regression") ||
    lower.includes("curve fit") ||
    lower.includes("curve fitting");
}

function isLogisticRegressionQuestion(lower) {
  return lower.includes("logistic regression") ||
    lower.includes("binary regression") ||
    lower.includes("logit regression");
}

function isMultivariateStatsQuestion(lower, statement = lower) {
  return lower.includes("pca") ||
    lower.includes("principal component") ||
    lower.includes("covariance") ||
    lower.includes("correlation matrix") ||
    /\bcorr(?:elation)?\s+matrix\b/i.test(statement);
}

function isKMeansQuestion(lower) {
  return lower.includes("k-means") ||
    lower.includes("k means") ||
    lower.includes("kmeans") ||
    lower.includes("clustering") ||
    lower.includes("cluster points");
}

function isSurvivalQuestion(lower) {
  return lower.includes("kaplan") ||
    lower.includes("survival analysis") ||
    lower.includes("survival curve") ||
    lower.includes("survival times") ||
    lower.includes("censored");
}

function isLogRankQuestion(lower) {
  return lower.includes("log-rank") ||
    lower.includes("logrank") ||
    lower.includes("log rank");
}

function isCoxQuestion(lower) {
  return lower.includes("cox regression") ||
    lower.includes("cox proportional") ||
    lower.includes("proportional hazards") ||
    lower.startsWith("cox ");
}

function isTimeSeriesQuestion(lower) {
  return lower.includes("ar(1)") ||
    lower.includes("ar1") ||
    lower.includes("autoregressive") ||
    lower.includes("time series") ||
    lower.includes("time-series") ||
    lower.includes("forecast");
}

function isMultivariableQuestion(lower) {
  return lower.includes("partial derivative") ||
    lower.startsWith("partial ") ||
    lower.includes("gradient") ||
    lower.includes("directional derivative");
}

function isTaylorQuestion(lower) {
  return lower.startsWith("taylor ") ||
    lower.startsWith("maclaurin ") ||
    lower.includes("taylor polynomial") ||
    lower.includes("taylor series") ||
    lower.includes("maclaurin polynomial") ||
    lower.includes("maclaurin series");
}

function isLaplaceQuestion(lower) {
  return lower.startsWith("laplace ") ||
    lower.startsWith("laplace transform ") ||
    lower.includes("laplace transform");
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
    lower.startsWith("svd ") ||
    lower.includes("singular value") ||
    lower.startsWith("qr ") ||
    lower.includes("qr decomposition") ||
    lower.includes("gram-schmidt") ||
    lower.includes("gram schmidt") ||
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

function isVectorQuestion(lower) {
  return lower.startsWith("dot ") ||
    lower.includes("dot product") ||
    lower.startsWith("cross ") ||
    lower.includes("cross product") ||
    lower.startsWith("angle ") ||
    lower.includes("angle between") ||
    lower.startsWith("projection ") ||
    lower.includes("project ") ||
    lower.startsWith("distance ") ||
    lower.includes("distance between") ||
    lower.startsWith("magnitude ") ||
    lower.startsWith("norm ") ||
    lower.startsWith("length of vector") ||
    lower.includes(" vector projection");
}

function isGeometryQuestion(lower) {
  return lower.includes("pythagorean") ||
    lower.includes("hypotenuse") ||
    lower.includes("circle") ||
    lower.includes("rectangle") ||
    lower.includes("triangle") ||
    lower.startsWith("area ") ||
    lower.startsWith("perimeter ") ||
    lower.startsWith("circumference ") ||
    lower.startsWith("midpoint ") ||
    lower.includes("midpoint between") ||
    lower.startsWith("slope ") ||
    lower.includes("slope between") ||
    /distance\s+between\s*\(/i.test(lower);
}

function isSequenceQuestion(lower) {
  return lower.includes("arithmetic sequence") ||
    lower.includes("arithmetic series") ||
    lower.includes("geometric sequence") ||
    lower.includes("geometric series") ||
    lower.startsWith("sum ") ||
    lower.startsWith("sigma ") ||
    lower.startsWith("summation ") ||
    lower.startsWith("series ");
}

function isGraphQuestion(lower) {
  return lower.startsWith("graph ") || lower.startsWith("plot ") || lower.startsWith("draw ");
}

function isFourierQuestion(lower) {
  return lower.startsWith("fourier ") ||
    lower.startsWith("fourier series ") ||
    lower.startsWith("fourier expansion ") ||
    lower.startsWith("series expansion ");
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
  return isLinearProgrammingQuestion(lower) ||
    lower.startsWith("maximize ") ||
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

function isLinearProgrammingQuestion(lower) {
  return lower.includes("linear programming") ||
    lower.includes("linear program") ||
    lower.startsWith("lp ") ||
    ((lower.startsWith("maximize ") || lower.startsWith("minimize ")) && lower.includes("subject to"));
}

function isDifferentialEquationQuestion(lower) {
  return isNumericalOdeQuestion(lower) ||
    lower.startsWith("ode ") ||
    lower.startsWith("solve ode ") ||
    lower.includes("differential equation") ||
    lower.includes("dy/d") ||
    lower.includes("y'") ||
    lower.includes("newton cooling") ||
    lower.includes("newton's cooling") ||
    (lower.includes("logistic") && (lower.includes("y0") || lower.includes("carrying") || lower.includes("capacity")));
}

function isNumericalOdeQuestion(lower) {
  return lower.startsWith("rk4 ") ||
    lower.startsWith("runge-kutta ") ||
    lower.startsWith("runge kutta ") ||
    lower.startsWith("euler ") ||
    lower.includes("euler method");
}

function isNumericalQuestion(lower) {
  return isNumericalIntegrationQuestion(lower) ||
    lower.startsWith("newton ") ||
    lower.startsWith("bisection ") ||
    lower.startsWith("numerical root ") ||
    lower.startsWith("root of ") ||
    lower.startsWith("find root of ") ||
    lower.startsWith("solve numerically ");
}

function isNumericalIntegrationQuestion(lower) {
  return lower.startsWith("simpson ") ||
    lower.startsWith("simpson's ") ||
    lower.startsWith("trapezoid ") ||
    lower.startsWith("trapezoidal ") ||
    lower.startsWith("numerical integral ") ||
    lower.startsWith("approximate integral ") ||
    ((lower.includes("simpson") || lower.includes("trapezoid")) && lower.includes("integrate"));
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
    "bootstrap",
    "permutation",
    "randomization test",
    "randomisation test",
    "kaplan",
    "survival analysis",
    "survival curve",
    "survival times",
    "censored",
    "log-rank",
    "logrank",
    "log rank",
    "cox regression",
    "cox proportional",
    "proportional hazards",
    "ar(1)",
    "ar1",
    "autoregressive",
    "time series",
    "time-series",
    "forecast",
    "regression",
    "correlation",
    "covariance",
    "pca",
    "principal component",
    "polynomial regression",
    "quadratic regression",
    "cubic regression",
    "curve fit",
    "curve fitting",
    "logistic regression",
    "binary regression",
    "logit regression",
    "k-means",
    "k means",
    "kmeans",
    "clustering",
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
    "beta posterior",
    "beta-binomial",
    "beta binomial",
    "bayesian proportion",
    "credible interval",
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
    "statistical power",
    "power analysis",
    "sample size",
    "required n",
    "needed n",
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
  if ((lower.includes("permutation") && lower.includes("test")) ||
      lower.includes("randomization test") ||
      lower.includes("randomisation test")) {
    return false;
  }
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

function isNumberTheoryQuestion(lower) {
  return lower.startsWith("gcd ") ||
    lower.includes("greatest common divisor") ||
    lower.startsWith("lcm ") ||
    lower.includes("least common multiple") ||
    lower.includes("prime factor") ||
    lower.includes("integer factorization") ||
    lower.includes("mod inverse") ||
    lower.includes("modular inverse") ||
    lower.includes("modpow") ||
    lower.includes("powmod") ||
    lower.includes("modular exponent") ||
    lower.includes("chinese remainder") ||
    lower.startsWith("crt ") ||
    lower.includes("congruence system") ||
    /\b\d+\s*\^\s*\d+\s+mod\s+\d+\b/i.test(lower);
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

function parseMultivariableInput(statement) {
  let text = statement
    .replace(/^(?:find|compute|calculate)\s+(?:the\s+)?/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
  const lower = text.toLowerCase();
  const operation = lower.includes("directional derivative")
    ? "directional"
    : lower.includes("gradient")
      ? "gradient"
      : "partial";
  let variable = "x";

  const directPartialMatch = text.match(/^partial\s+(?!derivative\b)([A-Za-z_]\w*)\s+of\s+(.+)$/i);
  if (directPartialMatch) {
    variable = directPartialMatch[1];
    text = directPartialMatch[2];
  } else {
    const variableMatch = text.match(/\b(?:with respect to|wrt|for)\s+([A-Za-z_]\w*)\b/i) ??
      text.match(/\bd\s*\/\s*d([A-Za-z_]\w*)\b/i);
    if (variableMatch) {
      variable = variableMatch[1];
    }
  }

  const direction = operation === "directional" ? (extractVectors(text)[0] ?? []) : [];
  const point = parsePointAssignments(text);
  const expression = cleanMultivariableExpression(text);
  if (!expression) {
    throw new Error("Use a multivariable expression, such as gradient x^2 + x*y + y^2 at x=1 y=2.");
  }

  return {
    operation,
    expression,
    variable,
    point,
    direction,
    variables: Object.keys(point).sort(),
  };
}

function cleanMultivariableExpression(text) {
  return text
    .replace(/^partial\s+derivative\s+(?:of\s+)?/i, "")
    .replace(/^gradient\s+(?:of\s+)?/i, "")
    .replace(/^directional\s+derivative\s+(?:of\s+)?/i, "")
    .replace(/\b(?:with respect to|wrt|for)\s+[A-Za-z_]\w*\b/gi, "")
    .replace(/\bd\s*\/\s*d[A-Za-z_]\w*\b/gi, "")
    .replace(/\bdirection(?:al)?(?:\s+vector)?\s*\[[^\]]+\]/gi, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\bat\b.*$/i, "")
    .replace(/\bpoint\b.*$/i, "")
    .replace(/\b[A-Za-z_]\w*\s*=\s*[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi, "")
    .replace(/^of\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePointAssignments(text) {
  const point = {};
  const pointMatch = text.match(/\b(?:at|point)\b(.+)$/i);
  const segment = pointMatch ? pointMatch[1] : text;
  for (const match of segment.matchAll(/\b([A-Za-z_]\w*)\s*=\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/gi)) {
    point[match[1]] = Number(match[2]);
  }
  return point;
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

function extractLaplaceQuestion(question) {
  let text = question
    .replace(/^(find|compute|calculate)\s+(?:the\s+)?/i, "")
    .replace(/^laplace\s+(?:transform\s+)?(?:of\s+)?/i, "")
    .replace(/^transform\s+laplace\s+(?:of\s+)?/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
  let variable = "";
  let outputVariable = "s";

  const outputMatch = text.match(/\b(?:to|into|output)\s+([A-Za-z_]\w*)\b/i);
  if (outputMatch) {
    outputVariable = outputMatch[1];
    text = text.replace(outputMatch[0], "").trim();
  }

  const variableMatch = text.match(/\b(?:with respect to|wrt|for)\s+([A-Za-z_]\w*)\b/i);
  if (variableMatch) {
    variable = variableMatch[1];
    text = text.replace(variableMatch[0], "").trim();
  }

  text = text
    .replace(/^of\s+/i, "")
    .replace(/^f\s*\([A-Za-z_]\w*\)\s*=\s*/i, "")
    .replace(/^y\s*=\s*/i, "")
    .trim();

  if (!text) {
    throw new Error("Laplace transform needs a function, such as laplace transform of sin(t) + 2t.");
  }

  return {
    expression: text,
    variable,
    outputVariable,
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

function symbolicDerivative(parsed, variable) {
  const derivativeSteps = [];
  const derivative = differentiate(parsed, variable, derivativeSteps);
  const simplified = simplifyNode(derivative, derivativeSteps);
  const polynomial = polynomialFrom(simplified);
  const isZeroPolynomial = polynomial && polynomial.size === 1 && nearlyEqual(polynomial.get("") ?? Number.NaN, 0);
  const finalTree = polynomial ? (isZeroPolynomial ? mathNumber(0) : polynomialToNode(polynomial)) : simplified;
  return {
    node: finalTree,
    answer: polynomial ? formatPolynomial(polynomial) : formatMath(finalTree),
  };
}

function evaluateAtPointIfAvailable(node, point) {
  const variables = mathVariables(node);
  if (variables.length === 0) {
    return safeEvaluateMath(node, {});
  }
  if (variables.some((variable) => !Number.isFinite(point[variable]))) {
    return Number.NaN;
  }
  return safeEvaluateMath(node, point);
}

function formatPointAssignments(point) {
  return Object.entries(point)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${formatNumber(value)}`)
    .join(", ");
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
    "mathFourierSeries",
    "mathLaplaceTransform",
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
