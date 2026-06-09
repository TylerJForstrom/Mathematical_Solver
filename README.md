# Mathematical Solver

Mathematical Solver is a browser-based symbolic math, statistics, and logic
workbench. It parses problems into expression trees or statistical models, then
uses those structures to evaluate logic, simplify algebra, solve equations,
compute derivatives, summarize datasets, run regression, compute probability,
work with matrices, graph functions, approximate roots numerically, solve
closed-form differential equations, and explain the work step by step.

The frontend currently supports:

- Universal Ask mode that routes common math questions to the right solver
- Propositional logic evaluation and truth tables
- Algebra simplification with constants and like terms
- Rational-root polynomial factoring for quadratics, cubics, and higher-degree
  one-variable polynomials with rational roots
- Exact combinatorics for factorials, permutations, and combinations
- Number theory tools: gcd, lcm, prime factorization, modular powers,
  modular inverses, and Chinese remainder theorem systems
- One-variable polynomial inequalities with sign charts and interval notation
- Linear and quadratic equation solving, including complex roots
- Complex-number arithmetic and elementary complex functions through Ask mode
- Numerical real-root approximation for higher-degree one-variable polynomials
- Systems of linear equations through Universal Ask mode
- Matrix determinants, inverses, multiplication, row reduction, rank, null spaces,
  QR decomposition, reduced SVD, and 2x2 eigenvalues/eigenvectors
- Vector geometry: dot products, cross products, magnitudes, angles,
  projections, and point distances
- Geometry formulas: circles, rectangles, triangles, Pythagorean theorem,
  coordinate distance, midpoint, and slope
- Sequences and series: arithmetic sequences, geometric sequences, infinite
  geometric sums, and finite sigma notation
- Polynomial derivatives with power, sum, difference, product, and quotient rules
- Multivariable calculus: partial derivatives, gradient vectors, and
  directional derivatives at a point
- Finite and one-sided numeric limits, including removable discontinuities
- Taylor and Maclaurin polynomial expansions for supported elementary functions
- Laplace transforms for constants, powers, exponentials, sine/cosine terms,
  sums, and scalar multiples
- Polynomial and elementary indefinite/definite integrals, including trig,
  exponential, logarithmic, square-root, and reciprocal forms
- Polynomial critical points and local max/min classification
- Two-variable linear programming with feasible-vertex enumeration and
  constrained objective optimization
- Function graphing with sampled SVG plots
- Fourier series partial sums with numerically integrated sine/cosine
  coefficients and plotted approximations
- Differential equations: exponential growth/decay, Newton cooling, logistic
  growth, and separable power ODEs
- Numerical ODE solvers: Euler's method and fourth-order Runge-Kutta for
  first-order differential equations
- Descriptive statistics: mean, median, mode, range, quartiles, variance, and standard deviation
- Linear regression/correlation for coordinate pairs, plus multiple linear
  regression with several predictor lists, residuals, coefficient standard
  errors, t tests, p-values, confidence intervals, R squared, and prediction
- Ridge regression for regularized linear modeling with an unpenalized intercept,
  shrinkage penalty, objective value, fitted values, residuals, and prediction
- LASSO regression for sparse feature selection with standardized coordinate
  descent, active-predictor counts, L1 penalty, objective value, and prediction
- Polynomial regression for nonlinear curve fitting with degree selection,
  residuals, R squared, and prediction
- Logistic regression for binary outcomes with fitted probabilities,
  classification accuracy, McFadden R squared, and probability prediction
- Gaussian Naive Bayes classification with class priors, feature likelihoods,
  posterior probabilities, training accuracy, and class prediction
- Decision tree classification with Gini impurity splits, learned rule paths,
  training accuracy, max-depth/min-leaf controls, and class prediction
- Random forest classification with seeded bootstrap trees, feature subsampling,
  majority votes, out-of-bag accuracy, and class prediction
- ROC/AUC classifier evaluation with threshold sweeps, sensitivity,
  specificity, precision, accuracy, Youden's J, and confusion counts
- Poisson regression for count outcomes with log-link coefficients, fitted
  rates, likelihood deviance, pseudo R squared, and expected-count prediction
- Time-series AR(1) forecasting with lag coefficients, autocorrelation,
  residual error, and multi-step predictions
- Multivariate statistics: covariance matrices, correlation matrices, and
  2D principal component analysis with explained variance and component directions
- K-means clustering for coordinate points with deterministic centroid
  initialization, assignments, cluster sizes, and within-cluster SSE
- Confidence intervals, bootstrap percentile intervals,
  one-sample/two-sample/paired t tests with Student t p-values,
  one-proportion/two-proportion z tests, proportion confidence intervals,
  permutation tests, one-way ANOVA, Mann-Whitney U, Wilcoxon signed-rank,
  Kruskal-Wallis, chi-square goodness-of-fit, binomial probability, Poisson
  probability, normal probability, inverse-normal percentiles, geometric
  probability, exponential probability, uniform probability, hypergeometric
  probability, discrete expected value/variance, Bayes theorem, and z-score
  calculations
- Kaplan-Meier survival analysis, log-rank tests, and one-covariate Cox
  proportional hazards regression for right-censored data with risk sets,
  censoring counts, standard errors, median survival, survival curves,
  two-group survival comparisons, hazard ratios, and Wald p-values
- Markov chains: n-step state distributions and stationary distributions from
  row-stochastic transition matrices
- Bayesian beta-binomial proportion updates with posterior means, credible
  intervals, and posterior predictive probabilities
- Statistical power and sample-size planning for one-sample means,
  one-proportion z designs, and equal-size two-sample mean designs
- Effect sizes and follow-up comparisons, including Cohen's d/dz, Hedges g,
  eta squared, omega squared, rank-biserial correlation, epsilon squared,
  Cohen's w, Bonferroni-adjusted ANOVA pairwise comparisons, and Dunn-style
  rank comparisons
- Newton and bisection numerical root solvers
- Simpson's rule and trapezoidal-rule numerical integration
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
- `factor x^3 - 6x^2 + 11x - 6` uses rational roots and synthetic division
  to produce `(x - 1)(x - 2)(x - 3)`.
- `10 choose 3` uses exact integer combinatorics and returns `C(10, 3) = 120`.
- `gcd 84 126` and `lcm 36 84` run integer divisibility algorithms.
- `prime factors of 84` returns `84 = 2^2 * 3 * 7`.
- `7^128 mod 13`, `mod inverse 3 mod 11`, and
  `crt x=2 mod 3; x=3 mod 5; x=2 mod 7` solve modular arithmetic problems.
- `solve x^2 - 5x + 6 > 0` finds critical points and returns
  `x in (-inf, 2) U (3, inf)`.
- `x^3` becomes a power node, so the derivative engine can apply the power rule.
- `partial derivative of x^2*y + y^3 with respect to y`,
  `gradient x^2 + x*y + y^2 at x=1 y=2`, and
  `directional derivative x^2 + x*y + y^2 at x=1 y=2 direction [3,4]`
  evaluate multivariable calculus trees.
- `x^2 - 5x + 6 = 0` becomes an equation node with left and right expression trees.
- `x^2 + 1 = 0` keeps the quadratic formula in the complex plane and returns
  `x = i, x = -i`.
- `complex (3+4i)*(2-i)` evaluates the same math tree with complex pairs and
  returns `10 + 5i`.
- `solve system 2x + y = 5; x - y = 1` becomes an augmented matrix.
- `det [[1,2],[3,4]]` becomes a matrix-operation tree.
- `dot [1,2,3] [4,5,6]`, `angle between [1,0] [0,1]`, and
  `projection [3,4] onto [1,0]` evaluate vector-geometry trees.
- `circle radius=3`, `pythagorean a=3 b=4`, and
  `distance between (1,2) and (4,6)` evaluate geometry formula trees.
- `arithmetic sequence a1=3 d=5 n=10`, `geometric sequence a1=2 r=3 n=5`,
  and `sum k^2 from k=1 to 5` evaluate sequence and series trees.
- `rref [[1,2,1],[2,4,2],[1,1,0]]` becomes a row-operation tree with rank and pivots.
- `qr [[1,1],[1,0],[0,1]]` uses Gram-Schmidt to return `Q`, `R`, and `Q*R`.
- `svd [[3,1],[1,3]]` returns singular values plus `U`, `Sigma`, `V^T`, and reconstruction.
- `nullspace [[1,2,1],[2,4,2],[1,1,0]]` extracts a basis from the RREF free variables.
- `eigenvectors [[2,1],[1,2]]` solves the 2x2 characteristic polynomial and then
  finds each eigenspace.
- `limit (x^2 - 1)/(x - 1) as x approaches 1` samples both sides of a
  removable discontinuity and returns `limit = 2`.
- `taylor sin(x) order=5` repeatedly differentiates and returns
  `x - 0.166667x^3 + 0.008333x^5`.
- `laplace transform of sin(t) + 2t` applies transform-table rules and
  linearity to return `1/(s^2 + 1) + 2/s^2`.
- `integrate x^2 from 0 to 3` builds an antiderivative tree and evaluates the bounds.
- `integrate sin(x)` uses a function node and returns `-cos(x) + C`.
- `integrate exp(x) from 0 to 1` evaluates an elementary definite integral.
- `maximize -x^2 + 4x + 1` differentiates, solves critical points, and classifies them.
- `linear programming maximize 3x + 2y subject to x + y <= 4; x <= 2; y <= 3; x >= 0; y >= 0`
  enumerates feasible vertices and returns the constrained optimum.
- `graph x^2 - 4 from -5 to 5` samples a function tree into plot points.
- `fourier series x from -pi to pi order=5` estimates Fourier coefficients
  and plots the fifth-order partial sum.
- `simpson integrate sin(x) from 0 to pi n=100` approximates a definite
  integral numerically and returns `integral ~= 2`.
- `ode dy/dt = 0.3y y0=2 t=5`, `newton cooling ambient=70 initial=100 k=0.2 t=10`,
  and `logistic r=0.4 K=100 y0=10 t=8` solve closed-form differential equations.
- `rk4 dy/dt = t + y y0=1 from t=0 to 1 h=0.25` approximates a first-order
  ODE with fourth-order Runge-Kutta.
- `regression for (1,2), (2,3), (3,5)` becomes a statistical model tree
  with coefficient standard errors, t tests, p-values, and confidence intervals.
- `quadratic regression degree=2 for (1,2), (2,5), (3,10), (4,17); predict x=5`
  fits a nonlinear polynomial curve and predicts `26`.
- `multiple regression y: 4,7,9,12,15; x1: 1,2,3,4,5; x2: 0,1,0,1,1`
  solves a least-squares model with multiple predictors.
- `ridge regression lambda=1 y: 4,7,9,12,15; x1: 1,2,3,4,5; x2: 0,1,0,1,1`
  solves a regularized model that shrinks predictor coefficients.
- `lasso regression lambda=1 y: 4,7,9,12,15; x1: 1,2,3,4,5; x2: 0,1,0,1,1`
  solves a sparse model that can set weak predictor coefficients to zero.
- `logistic regression y: 0,0,1,0,1,1; x: 1,2,3,4,5,6; predict x=4.5`
  fits a binary-response model and returns a predicted probability.
- `naive bayes class: 0,0,0,1,1,1; x1: 1,2,1.5,5,6,5.5; x2: 1,1.2,0.8,5,5.5,4.8`
  trains a Gaussian classifier and reports posterior class probabilities.
- `decision tree class: 0,0,0,1,1,1; x1: 1,2,1.5,5,6,5.5; x2: 1,1.2,0.8,5,5.5,4.8; maxDepth=2 predict x1=5.2 x2=5`
  learns Gini split rules and traces the prediction path to a class leaf.
- `random forest class: 0,0,0,1,1,1; x1: 1,2,1.5,5,6,5.5; x2: 1,1.2,0.8,5,5.5,4.8; trees=9 maxDepth=2 seed=7 predict x1=5.2 x2=5`
  trains seeded bootstrap trees, votes across them, and reports out-of-bag accuracy.
- `roc actual: 1,1,0,1,0,0; scores: 0.9,0.75,0.6,0.55,0.3,0.1`
  computes AUC and threshold-by-threshold classification metrics.
- `poisson regression y: 1,2,1,3,4,5; x: 0,1,2,3,4,5; predict x=6`
  fits a count-response GLM and predicts an expected count.
- `ar(1) series: 10,12,13,15,16,18 forecast=3` fits a lag-1
  autoregressive model and forecasts future values.
- `covariance matrix x: 1,2,3,4; y: 2,3,5,8` returns a sample covariance
  matrix, and `correlation matrix ...` scales it to pairwise correlations.
- `pca x: 1,2,3,4; y: 2,3,5,8` finds the covariance eigenvectors and reports
  the first principal component's explained variance.
- `k-means k=3 points (1,1), (1,2), (5,5), (6,5), (10,10), (10,11)`
  clusters coordinate data and reports centroids plus within-cluster SSE.
- `mann-whitney group1: 10,12,9; group2: 8,7,11` ranks combined samples
  and computes a nonparametric U test.
- `ANOVA group1: 8,9,10; group2: 12,13,14; group3: 9,11,10` reports F,
  p-value, eta squared, omega squared, and pairwise comparisons.
- `hypergeometric population=50 successes=5 draws=10 k=2` models sampling
  without replacement and returns `P(X = 2) = 0.20984`.
- `inverse normal p=0.975 mean=0 sd=1` inverts the normal CDF and returns
  `x = 1.959963`.
- `geometric p=0.25 k=3`, `exponential lambda=2 x=1`, and
  `uniform min=2 max=10 between 4 and 7` evaluate additional probability
  distribution trees.
- `two-proportion z-test successes1=56 n1=100 successes2=44 n2=100` compares
  two sample proportions and reports `z = 1.697056, p = 0.089686`.
- `permutation test group1: 10,12,9; group2: 8,7,11 resamples=2000 seed=5`
  shuffles group labels into a reproducible nonparametric p-value.
- `kaplan-meier times: 5,6,6,8,10; events: 1,1,0,1,0` estimates a
  right-censored survival curve and reports median survival.
- `log-rank group1 times: 5,6,6,8,10 events: 1,1,0,1,0; group2 times: 4,6,7,9,12 events: 1,0,1,1,0`
  compares two right-censored survival curves with a chi-square p-value.
- `cox regression times: 5,6,6,8,10,12; events: 1,1,0,1,0,1; x: 0,1,0,1,1,0`
  fits a one-covariate proportional hazards model and reports a hazard ratio.
- `bootstrap mean data 10,12,14,16,18 resamples=1000 seed=7 confidence=95`
  builds a reproducible percentile bootstrap interval for the mean.
- `power mean effect=0.5 n=64 alpha=0.05` estimates statistical power, while
  `sample size mean effect=0.5 power=0.8 alpha=0.05` finds a required sample size.
- `expected value values: 0,1,2 probabilities: 0.2,0.5,0.3` treats the
  inputs as a probability mass function and returns `E(X) = 1.1`.
- `bayes prior=0.01 sensitivity=0.99 specificity=0.95` updates the prior and
  returns `P(H | positive) = 0.166667`.
- `markov [[0.7,0.3],[0.2,0.8]] start [1,0] steps=3` computes an n-step
  distribution, and `stationary markov [[0.7,0.3],[0.2,0.8]]` solves the
  long-run stationary distribution.
- `beta posterior successes=12 n=20 alpha=2 beta=2 confidence=95` updates a
  beta prior into a posterior distribution and reports a credible interval.

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
- Polynomial factoring through Ask mode
- Exact combinatorics through Ask mode
- Number theory and modular arithmetic through Ask mode
- Polynomial inequalities with interval answers through Ask mode
- Numeric limits through Ask mode
- Partial derivatives, gradients, and directional derivatives through Ask mode
- Taylor/Maclaurin approximations through Ask mode
- Complex arithmetic and complex quadratic roots through Ask mode
- Dataset summaries, confidence intervals, bootstrap intervals,
  regression/correlation, polynomial regression,
  multiple regression,
  coefficient inference for linear models,
  ridge regression,
  LASSO regression,
  logistic regression,
  Gaussian Naive Bayes classification,
  decision tree classification,
  random forest classification,
  ROC/AUC classifier evaluation,
  Poisson regression,
  AR(1) time-series forecasting,
  covariance/correlation matrices, 2D PCA, k-means clustering,
  binomial probability,
  Poisson probability, geometric probability, exponential probability, uniform
  probability, hypergeometric probability, normal probability, inverse-normal
  percentiles, z-scores, discrete expected value, Bayes theorem,
  Markov chains, Bayesian beta-binomial updates,
  one-sample/two-sample/paired t tests, one-proportion/two-proportion z tests,
  proportion confidence intervals, permutation tests, ANOVA, chi-square tests,
  nonparametric rank tests, Kaplan-Meier survival analysis, log-rank tests,
  Cox proportional hazards regression, power/sample-size analysis, effect sizes,
  and pairwise follow-up summaries in Stats mode
- Systems of equations, matrices, polynomial/elementary integrals, optimization,
  linear programming,
  vector geometry, geometry formulas, sequences/series, graphing, differential
  equations, numerical roots, numerical integration, and numerical ODEs
  through Ask mode
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
4. Add substitution, integration by parts, and partial-fraction decomposition.
5. Add confidence intervals for effect sizes and exact small-sample rank-test p-values.
6. Add row-space bases, column-space bases, and larger-matrix eigenvalue approximation.
7. Add graphing for distributions, regression lines, tangent lines, and root-finding iterations.
8. Add systems of differential equations and phase-plane direction fields.
9. Add multi-step natural-language explanations for word problems.
10. Add exact symbolic roots for cubic and quartic equations when possible.
11. Convert logic statements to negation normal form, conjunctive normal form, and
   disjunctive normal form.
12. Add Boolean algebra simplification rules, such as idempotent laws,
   absorption laws, De Morgan's laws, and double-negation elimination.
13. Build a small SAT solver using the DPLL algorithm instead of checking every
   truth-table row.
14. Generate formal proof steps for tautologies using natural deduction or
   sequent calculus.
15. Add semantic tableaux, which are also tree-based, to prove whether a
   statement is satisfiable.
16. Add Karnaugh maps for statements with two to four variables.
17. Export expression trees to Graphviz DOT so the parse tree can be visualized.
18. Add binary decision diagrams to represent equivalent formulas compactly.
19. Add probability or fuzzy truth values so statements can evaluate beyond
    simple true/false logic.
