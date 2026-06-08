# Mathematical Solver

Mathematical Solver is a browser-based symbolic math, statistics, and logic
workbench. It parses problems into expression trees or statistical models, then
uses those structures to evaluate logic, simplify algebra, solve equations,
compute derivatives, summarize datasets, run regression, compute probability,
work with matrices, graph functions, approximate roots numerically, and explain
the work step by step.

The frontend currently supports:

- Universal Ask mode that routes common math questions to the right solver
- Propositional logic evaluation and truth tables
- Algebra simplification with constants and like terms
- Linear and quadratic equation solving
- Numerical real-root approximation for higher-degree one-variable polynomials
- Systems of linear equations through Universal Ask mode
- Matrix determinants, inverses, and multiplication
- Polynomial derivatives with power, sum, difference, product, and quotient rules
- Polynomial indefinite and definite integrals
- Polynomial critical points and local max/min classification
- Function graphing with sampled SVG plots
- Descriptive statistics: mean, median, mode, range, quartiles, variance, and standard deviation
- Linear regression and correlation for coordinate pairs
- Confidence intervals, one-sample and two-sample t tests, chi-square goodness-of-fit,
  binomial probability, normal probability, and z-score calculations
- Newton and bisection numerical root solvers
- Expression-tree visualization for every mode
- Step-by-step explanations for the transformations being applied

The Python command line solver supports propositional logic:

- Variables such as `P`, `Q`, `rain`, or `is_prime`
- Constants: `true`, `false`
- Negation: `not P`, `!P`, `~P`
- Conjunction: `P and Q`, `P & Q`, `P && Q`
- Disjunction: `P or Q`, `P | Q`, `P || Q`
- Exclusive or: `P xor Q`, `P ^ Q`
- Implication: `P -> Q`, `P => Q`, `P implies Q`
- Biconditional: `P <-> Q`, `P <=> Q`, `P iff Q`
- Parentheses for grouping

## Why Trees?

A statement like:

```text
(P and Q) -> R
```

becomes this expression tree:

```text
`-- IMPLIES
    |-- AND
    |   |-- P
    |   `-- Q
    `-- R
```

Each node evaluates itself recursively:

- A variable looks up its assigned truth value.
- `AND` asks whether both child expressions are true.
- `OR` asks whether at least one child expression is true.
- `IMPLIES` is false only when the left side is true and the right side is false.

The same idea works for algebra and calculus:

- `2x + 3x` becomes a tree with `+` at the root and multiplication below it.
- `x^3` becomes a power node, so the derivative engine can apply the power rule.
- `x^2 - 5x + 6 = 0` becomes an equation node with left and right expression trees.
- `solve system 2x + y = 5; x - y = 1` becomes an augmented matrix.
- `det [[1,2],[3,4]]` becomes a matrix-operation tree.
- `integrate x^2 from 0 to 3` builds an antiderivative tree and evaluates the bounds.
- `maximize -x^2 + 4x + 1` differentiates, solves critical points, and classifies them.
- `graph x^2 - 4 from -5 to 5` samples a function tree into plot points.
- `regression for (1,2), (2,3), (3,5)` becomes a statistical model tree.

## Run It

From the project folder:

```powershell
python -m logic_solver "(P and Q) -> R" --values P=true Q=false R=false --tree
```

Print a full truth table:

```powershell
python -m logic_solver "P -> Q" --table
```

Classify a statement:

```powershell
python -m logic_solver "P or not P" --classify
```

Compare two statements for logical equivalence:

```powershell
python -m logic_solver "P -> Q" --compare "not P or Q"
```

Show tree complexity metrics:

```powershell
python -m logic_solver "(P and Q) -> (R or not S)" --metrics --tree
```

## Frontend Demo

The repo includes a static browser demo in `web/`.

Open this file in a browser:

```text
web/index.html
```

The demo includes:

- Six simple modes: Ask, Equation, Simplify, Derivative, Stats, and Logic
- A single problem input with example buttons
- A clear answer area
- Expression-tree visualization
- Truth tables for logic mode
- Dataset summaries, confidence intervals, regression/correlation, binomial probability,
  normal probability, z-scores, one-sample/two-sample t tests, and chi-square tests in Stats mode
- Systems of equations, matrices, integrals, optimization, graphing, and numerical roots through Ask mode
- Step-by-step explanation cards
- Tree complexity metrics

Because the frontend is static HTML, CSS, and JavaScript, it can be hosted on
GitHub Pages without a backend.

## Run Tests

```powershell
python -m unittest discover -s tests
```

Run the browser engine checks:

```powershell
node web/solver-engine.test.mjs
```

## Mathematical Upgrade Ideas

These are good ways to make the project more impressive mathematically:

1. Add a formal problem-router grammar for more natural-language questions.
2. Add exact radical output for quadratic equations with irrational roots.
3. Add trigonometric simplification identities.
4. Add more symbolic integration rules for trig, exponential, and logarithmic functions.
5. Add ANOVA, paired t-tests, and exact t-distribution p-values.
6. Add eigenvalues, eigenvectors, row reduction, and matrix rank.
7. Add graphing for distributions, regression lines, tangent lines, and root-finding iterations.
8. Add multi-step natural-language explanations for word problems.
9. Add exact symbolic roots for cubic and quartic equations when possible.
10. Convert logic statements to negation normal form, conjunctive normal form, and
   disjunctive normal form.
11. Add Boolean algebra simplification rules, such as idempotent laws,
   absorption laws, De Morgan's laws, and double-negation elimination.
12. Build a small SAT solver using the DPLL algorithm instead of checking every
   truth-table row.
13. Generate formal proof steps for tautologies using natural deduction or
   sequent calculus.
14. Add semantic tableaux, which are also tree-based, to prove whether a
   statement is satisfiable.
15. Add Karnaugh maps for statements with two to four variables.
16. Export expression trees to Graphviz DOT so the parse tree can be visualized.
17. Add binary decision diagrams to represent equivalent formulas compactly.
18. Add probability or fuzzy truth values so statements can evaluate beyond
    simple true/false logic.
