# Mathematical Solver

Mathematical Solver is a browser-based symbolic math, statistics, and logic
workbench. It parses problems into expression trees or statistical models, then
uses those structures to evaluate logic, simplify algebra, solve equations,
compute derivatives, summarize datasets, run regression, compute probability,
work with matrices, graph functions, approximate roots numerically, solve
closed-form differential equations, and explain the work step by step.

The frontend currently supports:

- Universal Ask mode that routes common math questions to the right solver
- A natural-language parser that reads plain word problems ("what is the average
  of 4, 8, 15", "how many ways to choose 3 from 10", "probability of 3 heads in
  10 coin flips", "what is the derivative of x squared"), maps them to the
  matching problem type, and shows that detected type with the solution
- Multi-part question handling: a question that bundles several sub-questions
  ("(a) differentiate x^3 (b) integrate x^2 (c) mean of 2, 4, 6, 8", or numbered
  / line-separated parts) is split, each part is routed to its own engine, and
  the result lists a labeled problem type and answer per part
- A categorized example dropdown that lists the solvable problem types instead of
  a wall of buttons, keeping the interface compact
- Propositional logic evaluation, truth tables, DPLL SAT solving with unsat-core
  diagnostics, and semantic tableaux proof trees
- Karnaugh maps for two- to four-variable Boolean minimization with optional
  don't-care cells
- Reduced ordered binary decision diagrams for compact Boolean representations
- Fuzzy truth-value evaluation with min/max, product, Lukasiewicz, and
  interval-valued t-norms, plus independent and correlated probability
  truth-value evaluation, conditional-probability tables, and small binary
  Bayesian networks with evidence-conditioned queries for propositional
  statements
- Graphviz DOT export for parsed math and logic expression trees
- Boolean algebra simplification with identity, domination, complement,
  idempotent, absorption, consensus, De Morgan, double-negation, implication,
  XOR, and IFF rules
- Logic normal forms: NNF, CNF, and DNF conversion with truth-table
  equivalence checks
- Algebra simplification with constants, like terms, Pythagorean identities,
  reciprocal trig functions, cofunction identities, double-angle rules,
  power-reduction/half-angle rewrites, and
  angle-sum/product-to-sum/sum-to-product rules
- Rational-root polynomial factoring for quadratics, cubics, and higher-degree
  one-variable polynomials with rational roots
- Exact combinatorics for factorials, permutations, and combinations
- Number theory tools: gcd, lcm, prime factorization, modular powers,
  modular inverses, and Chinese remainder theorem systems
- One-variable polynomial inequalities with sign charts and interval notation
- Linear, quadratic, rational-root cubic/higher-degree, and biquadratic
  quartic equation solving, including exact radical roots and complex
  quadratic roots
- Complex-number arithmetic and elementary complex functions through Ask mode
- Numerical real-root approximation for higher-degree one-variable polynomials
- Systems of linear equations and Newton-style nonlinear systems through
  Universal Ask mode
- Matrix determinants, inverses, multiplication, row reduction, rank, row-space
  bases, column-space bases, null spaces, QR decomposition, reduced SVD,
  real and complex 2x2 eigenvalues/eigenvectors, nonsymmetric 3x3 real
  eigenvalues/eigenvectors, symmetric eigenvalue/eigenvector approximation for
  larger matrices, and dominant eigenpair approximation
- Least-squares solutions of overdetermined systems through the normal equations
  AᵀA x = Aᵀb, with the residual vector, residual norm, and an exact-fit check
- Vector geometry: dot products, cross products, magnitudes, angles,
  projections, and point distances
- Geometry formulas: circles, rectangles, triangles, Pythagorean theorem,
  coordinate distance, midpoint, and slope
- Sequences and series: arithmetic sequences, geometric sequences, infinite
  geometric sums, and finite sigma notation
- Series convergence tests that classify a general term with the nth-term,
  ratio, p-series comparison, and alternating-series tests, naming the deciding
  test and plotting the partial sums
- Polynomial derivatives with power, sum, difference, product, and quotient rules
- Multivariable calculus: partial derivatives, gradient vectors, and
  directional derivatives at a point
- Finite and one-sided numeric limits, including removable discontinuities
- Taylor and Maclaurin polynomial expansions for supported elementary functions
- Laplace transforms for constants, powers, exponentials, sine/cosine terms,
  sums, and scalar multiples
- Polynomial and elementary indefinite/definite integrals, including trig,
  exponential, logarithmic, square-root, reciprocal, and
  linear/quadratic partial-fraction forms with arctangent terms
- U-substitution for products that match an inner derivative times sine,
  cosine, tangent, exponential, or square-root functions
- Integration by parts for linear factors multiplied by exponential, sine, or
  cosine functions
- Polynomial critical points and local max/min classification
- Two-variable linear programming with feasible-vertex enumeration and
  constrained objective optimization
- Function graphing with sampled SVG plots and tangent-line overlays
- Curve intersections that bracket and bisect the roots of f(x) - g(x), report
  every crossing point, and plot both curves with the intersections marked
- Fourier series partial sums with numerically integrated sine/cosine
  coefficients and plotted approximations
- Differential equations: exponential growth/decay, Newton cooling, logistic
  growth, separable power ODEs, 2D linear ODE systems with phase-plane
  classification, and autonomous nonlinear phase-plane systems with numeric
  equilibria, nullclines, and RK4 trajectories
- Numerical ODE solvers: Euler's method and fourth-order Runge-Kutta for
  first-order differential equations
- Smart input assistance for incomplete math/statistics questions, including
  detected problem type, missing data requirements, and clickable examples
- Descriptive statistics: mean, median, mode, range, quartiles, variance, and standard deviation
- Linear regression/correlation for coordinate pairs, plus multiple linear
  regression with several predictor lists, residuals, coefficient standard
  errors, t tests, p-values, confidence intervals, R squared, and prediction
  intervals with fitted-line scatterplots in the demo output
- Pearson correlation tests with covariance terms, t p-values, R squared, and
  Fisher-z confidence intervals for linear association, plus a trend-line plot
- Spearman rank correlation with rank tables, t approximation, p-values, and
  monotonic-association decisions
- Kendall tau-b rank correlation with concordant/discordant pair counts,
  tie handling, normal-approximation p-values, and ordinal-association decisions
- Regression diagnostics with standardized residuals, leverage, Cook's
  distance, Durbin-Watson, Breusch-Pagan, residual Jarque-Bera checks, and
  diagnostic plots for actual-vs-fitted, residuals-vs-fitted, and influence
- Regression model comparison for polynomial families with SSE, adjusted R
  squared, AIC, AICc, BIC, leave-one-out, k-fold, and holdout validation
  RMSE/MAE, and comparison plots
- Nonlinear regression family comparison for linear, exponential,
  logarithmic, power-law, and logistic growth models with original-scale
  SSE/R squared, AIC/AICc/BIC, best-fit plots, and family criterion plots
- Custom nonlinear regression formulas with named parameters, starting
  values, optional parameter bounds, fitted/residual tables, approximate
  confidence intervals, requested prediction intervals, optimizer diagnostics,
  multi-start search, optimizer trace tables, custom-formula comparison,
  leave-one-out/k-fold/holdout validation, bootstrap model-selection
  uncertainty, model-averaged prediction interval visuals, and best-fit plots
- Ridge regression for regularized linear modeling with an unpenalized intercept,
  shrinkage penalty, objective value, fitted values, residuals, and prediction
- LASSO regression for sparse feature selection with standardized coordinate
  descent, active-predictor counts, L1 penalty, objective value, and prediction
- Bayesian linear regression with normal priors, known-sigma likelihoods,
  posterior coefficient intervals, mean-response intervals, and posterior
  predictive intervals
- Polynomial regression for nonlinear curve fitting with degree selection,
  residuals, R squared, and prediction
- Logistic regression for binary outcomes with fitted probabilities,
  classification accuracy, McFadden R squared, and probability prediction
- Gaussian Naive Bayes classification with class priors, feature likelihoods,
  posterior probabilities, training accuracy, and class prediction
- Linear discriminant analysis with class mean vectors, pooled covariance,
  discriminant scores, posterior-like probabilities, and class prediction
- Quadratic discriminant analysis with class-specific covariance matrices,
  log-determinant terms, curved decision boundaries, and class prediction
- Decision tree classification with Gini impurity splits, learned rule paths,
  training accuracy, max-depth/min-leaf controls, and class prediction
- Random forest classification with seeded bootstrap trees, feature subsampling,
  majority votes, out-of-bag accuracy, and class prediction
- ROC/AUC classifier evaluation with threshold sweeps, sensitivity,
  specificity, precision, accuracy, Youden's J, and confusion counts
- Poisson regression for count outcomes with log-link coefficients, fitted
  rates, likelihood deviance, pseudo R squared, and expected-count prediction
- Time-series AR(1), ARIMA(p,d,0), and Ljung-Box diagnostics with lag
  coefficients, differencing, residual error, autocorrelation tables, and
  multi-step predictions
- Exponential smoothing forecasts: simple (SES) and Holt's linear-trend (double)
  smoothing with optional or SSE-optimized smoothing weights, a fitted-value and
  error table, RMSE, and an observed/fitted/forecast overlay plot
- Multivariate statistics: covariance matrices, correlation matrices,
  one-way MANOVA with Wilks' lambda, Pillai trace, Lawley-Hotelling trace, and
  pairwise Hotelling T-squared follow-ups, and multi-variable principal
  component analysis with explained variance, component directions, and scores
- K-means clustering for coordinate points with deterministic centroid
  initialization, assignments, cluster sizes, and within-cluster SSE
- Confidence intervals, bootstrap percentile intervals, fixed-effect and
  DerSimonian-Laird random-effects meta-analysis with heterogeneity diagnostics,
  multiple-testing correction with Bonferroni, Holm, Benjamini-Hochberg FDR,
  and Benjamini-Yekutieli adjusted p-values,
  Jarque-Bera and Anderson-Darling normality tests,
  two-sample variance F tests and Levene equal-variance tests,
  one-sample/two-sample/paired t tests with Student t p-values,
  one-proportion/two-proportion z tests, proportion confidence intervals,
  permutation tests, two-sample Kolmogorov-Smirnov tests, ANCOVA with covariate-adjusted means, one-way MANOVA, one-way ANOVA, Welch ANOVA, repeated-measures ANOVA,
  two-way ANOVA with interaction, Mann-Whitney U with exact small-sample p-values when there are no ties,
  Wilcoxon signed-rank with exact
  small-sample p-values when absolute differences are untied,
  Kruskal-Wallis, chi-square goodness-of-fit, chi-square independence tests
  for contingency tables, Fisher exact tests for 2x2 tables, McNemar paired
  categorical tests, binomial
  probability, Poisson probability, normal probability, inverse-normal percentiles,
  Student t, chi-square, and F distribution probabilities/critical values, geometric
  probability, exponential probability, uniform probability, hypergeometric
  probability, shaded density plots for continuous reference distributions,
  discrete expected value/variance, Bayes theorem, and z-score calculations
- Distribution fitting for normal, Poisson, and exponential models via
  maximum likelihood, each with a chi-square goodness-of-fit test, a
  binned observed-vs-expected table, and an empirical-vs-fitted CDF plot
- Kaplan-Meier survival analysis, log-rank tests, and one-covariate Cox
  proportional hazards regression for right-censored data with risk sets,
  censoring counts, standard errors, median survival, survival curves,
  two-group survival comparisons, hazard ratios, and Wald p-values
- Markov chains: n-step state distributions and stationary distributions from
  row-stochastic transition matrices
- Bayesian normal-mean inference with normal-normal conjugate updates,
  posterior credible intervals, posterior-predictive intervals, and posterior
  tail probabilities
- Bayesian linear regression with posterior coefficient covariance, shrinkage
  from independent normal priors, and posterior predictive intervals
- Bayesian A/B conversion-rate testing with beta-binomial posteriors,
  posterior win probabilities, expected lift, and approximate lift intervals
- Bayesian beta-binomial proportion updates with posterior means, credible
  intervals, and posterior predictive probabilities
- Statistical power and sample-size planning for one-sample means,
  one-proportion z designs, and equal-size two-sample mean designs
- Effect sizes and follow-up comparisons, including Cohen's d/dz, Hedges g
  with approximate confidence intervals for t-test effect sizes, eta squared,
  omega squared, rank-biserial correlation, epsilon squared, Cohen's w,
  Bonferroni-adjusted ANOVA pairwise comparisons, and Dunn-style rank
  comparisons
- Newton, secant, and bisection numerical root solvers with iteration tables
  and root-finding graphs
- Fixed-point iteration for x = g(x) maps with a convergence/divergence verdict,
  delta-tracking iteration table, and a cobweb plot against the y = x diagonal
- Gradient-descent minimization of a one-variable function with a configurable
  learning rate, a per-step gradient table, divergence detection, and a descent
  path traced over the function plot
- Simpson's rule and trapezoidal-rule numerical integration
- Improper integrals with infinite bounds, evaluated as the limit of integrals
  over a growing interval with a convergence/divergence verdict, a geometric
  tail extrapolation, a slice-area table, and a partial-integral plot
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
- `simplify logic P and (not P)` applies the complement law and returns
  `false`.

The same idea works for algebra and calculus:

- `2x + 3x` becomes a tree with `+` at the root and multiplication below it.
- `sin(x)^2 + cos(x)^2` recognizes the Pythagorean identity and simplifies to
  `1`.
- `sin(2x)` applies a double-angle identity and rewrites to
  `2 * sin(x) * cos(x)`.
- `1/cos(x)` uses the reciprocal identity and simplifies to `sec(x)`.
- `sin(pi/2 - x)` uses a cofunction identity and simplifies to `cos(x)`.
- `sin(x)*cos(y)` uses a product-to-sum identity and rewrites to
  `0.5 * (sin(x + y) + sin(x - y))`.
- `power reduce sin(x)^2` and `half angle cos(x/2)` apply power-reduction
  and half-angle identities without changing the default simplification mode.
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
- `x^2 - 2 = 0` keeps irrational quadratic roots exact and returns
  `x = sqrt(2), x = -sqrt(2)`.
- `x^2 + 1 = 0` keeps the quadratic formula in the complex plane and returns
  `x = i, x = -i`.
- `x^3 - 6x^2 + 11x - 6 = 0` uses rational roots and synthetic division to
  return `x = 1, x = 2, x = 3`.
- `x^3 - x^2 - 2x + 2 = 0` finds the rational root, solves the remaining
  quadratic exactly, and returns `x = -sqrt(2), x = 1, x = sqrt(2)`.
- `x^4 - 5x^2 + 4 = 0` recognizes biquadratic form, substitutes
  `u = x^2`, and returns `x = -2, x = -1, x = 1, x = 2`.
- `integrate (2x + 3)/(x^2 + 3x + 2)` decomposes the rational function and
  returns `ln(abs(x + 1)) + ln(abs(x + 2)) + C`.
- `integrate 1/(x - 1)^2` handles a repeated linear factor and returns
  `-1/(x - 1) + C`.
- `integrate 1/(x^2 + 1)` recognizes an irreducible quadratic denominator
  and returns `atan(x) + C`.
- `integrate 2x*cos(x^2)` recognizes the inner derivative and returns
  `sin(x ^ 2) + C`.
- `integrate x*exp(x)` applies integration by parts and returns
  `(x - 1) * exp(x) + C`.
- `complex (3+4i)*(2-i)` evaluates the same math tree with complex pairs and
  returns `10 + 5i`.
- `cnf P -> (Q and R)` rewrites a propositional tree into
  `(not P or Q) and (not P or R)` and verifies equivalence.
- `sat (P or Q) and (not P or not Q)` converts to CNF clauses and runs DPLL
  with branching, unit propagation, and pure-literal assignments.
- `sat (P or Q) and not P and not Q and (R or S)` proves unsatisfiability
  and reports the smaller conflicting core `P or Q; not P; not Q`.
- `tableau P -> P` builds a semantic tableau by trying to make the statement
  false, then closes the countermodel branch to prove validity.
- `tableau satisfiable (P or Q) and not P` keeps open proof branches as
  concrete satisfying assignments.
- `kmap P or Q` lays out a Gray-code Karnaugh map, groups adjacent 1-cells,
  and returns the simplified sum-of-products form.
- `kmap P and not Q with don't cares m3` marks `m3` as an `X` cell, uses it
  to form a larger group, and simplifies the result to `P`.
- `bdd (P and Q) or (P and R)` builds a reduced ordered binary decision
  diagram with merged subgraphs, satisfying paths, and Graphviz DOT output.
- `fuzzy logic (P and Q) or not R with P=0.8 Q=0.6 R=0.3` evaluates a
  propositional tree with graded truth values instead of only true/false.
- `fuzzy product logic P or Q with P=0.8 Q=0.6` switches to the product
  t-norm and product s-norm, returning `fuzzy truth = 0.92`.
- `fuzzy logic P and Q with P=0.8 Q=0.6 tnorm=lukasiewicz` uses the
  Lukasiewicz t-norm and returns `fuzzy truth = 0.4`.
- `interval fuzzy logic P or Q with P=[0.2,0.5] Q=[0.4,0.7]` propagates
  uncertainty in graded truth values and returns
  `fuzzy truth interval = [0.4, 0.7]`.
- `probabilistic logic P or Q with P=0.2 Q=0.5` assumes independent variables
  and applies probability formulas for logical operators.
- `correlated probability logic P or Q with P=0.6 Q=0.5 joint(P,Q)=0.35`
  builds a two-event joint distribution and returns `probability = 0.75`
  without assuming independence.
- `correlated probability logic P and Q with P=0.6 Q=0.5 corr(P,Q)=0.5`
  converts a Bernoulli correlation into the implied joint probability.
- `conditional probability logic P or Q with P=0.6 cond(Q|P)=0.8 cond(Q|not P)=0.3`
  derives `P(Q)` from a two-row conditional-probability table and returns
  `probability = 0.72`.
- `bayesian network probability logic P or R with P=0.6 cond(Q|P)=0.8 cond(Q|not P)=0.3 cond(R|Q)=0.7 cond(R|not Q)=0.2`
  expands a three-event binary Bayesian network to its joint distribution and
  returns `probability = 0.74`.
- `bayesian network probability logic P given R with P=0.6 cond(Q|P)=0.8 cond(Q|not P)=0.3 cond(R|Q)=0.7 cond(R|not Q)=0.2`
  conditions the network on evidence and returns
  `conditional probability = 0.72`.
- `bayesian network probability logic R given P with P=0.6 Q=0.5 cond(R|P,Q)=0.95 cond(R|P,not Q)=0.7 cond(R|not P,Q)=0.4 cond(R|not P,not Q)=0.05`
  evaluates a multi-parent conditional probability table and returns
  `conditional probability = 0.825`.
- `dot tree x^2 + 2x + 1` exports the parsed expression tree as Graphviz DOT
  with node and edge tables.
- `solve system 2x + y = 5; x - y = 1` becomes an augmented matrix.
- `solve nonlinear system x^2 + y^2 = 25; x - y = 1 guess x=3 y=2`
  numerically solves a square nonlinear system with Newton iterations.
- `det [[1,2],[3,4]]` becomes a matrix-operation tree.
- `dot [1,2,3] [4,5,6]`, `angle between [1,0] [0,1]`, and
  `projection [3,4] onto [1,0]` evaluate vector-geometry trees.
- `circle radius=3`, `pythagorean a=3 b=4`, and
  `distance between (1,2) and (4,6)` evaluate geometry formula trees.
- `arithmetic sequence a1=3 d=5 n=10`, `geometric sequence a1=2 r=3 n=5`,
  and `sum k^2 from k=1 to 5` evaluate sequence and series trees.
- `converge sum 1/n^2` reports `converges` by p-series comparison, `converge 1/n`
  reports `diverges`, `converge 1/2^n` decides by the ratio test, and
  `converge (-1)^n/n` converges by the alternating-series test; each plots the
  running partial sums.
- `rref [[1,2,1],[2,4,2],[1,1,0]]` becomes a row-operation tree with rank and pivots.
- `row space [[1,2,1],[2,4,2],[1,1,0]]` and
  `column space [[1,2,1],[2,4,2],[1,1,0]]` return bases for the fundamental
  subspaces.
- `qr [[1,1],[1,0],[0,1]]` uses Gram-Schmidt to return `Q`, `R`, and `Q*R`.
- `svd [[3,1],[1,3]]` returns singular values plus `U`, `Sigma`, `V^T`, and reconstruction.
- `least squares [[1,1],[1,2],[1,3]] [1,2,2]` solves the normal equations and
  returns `x = [0.666667, 0.5]` with the residual vector and residual norm.
- `nullspace [[1,2,1],[2,4,2],[1,1,0]]` extracts a basis from the RREF free variables.
- `eigenvectors [[2,1],[1,2]]` solves the 2x2 characteristic polynomial and then
  finds each eigenspace.
- `eigenvectors [[0,-1],[1,0]]` returns complex eigenvectors for a 2x2
  rotation matrix.
- `eigenvalues [[4,1,0],[1,3,0],[0,0,2]]` approximates all eigenvalues of
  a larger symmetric matrix.
- `eigenvectors [[4,1,0],[1,3,0],[0,0,2]]` approximates orthonormal
  eigenvectors for a larger symmetric matrix.
- `eigenvectors [[5,1,0],[0,3,1],[0,0,1]]` solves the 3x3 characteristic
  cubic for real eigenvalues and estimates nonsymmetric eigendirections with
  residual checks.
- `dominant eigen [[4,1,0],[1,3,0],[0,0,2]]` uses power iteration to
  approximate the largest-magnitude eigenvalue and eigenvector.
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
- `graph tangent line x^2 at x=2 from 0 to 4` differentiates the function,
  finds the tangent slope, and overlays the line `y = 4x - 4`.
- `intersect x^2 and 2x + 1` solves `f(x) = g(x)` over the range, returning the
  crossings `(-0.414214, 0.171573)` and `(2.414214, 5.828427)` and plotting both
  curves with the points marked; `intersect y = x^2 and y = x + 6 from -5 to 5`
  and an explicit `from a to b` range are also accepted.
- `fourier series x from -pi to pi order=5` estimates Fourier coefficients
  and plots the fifth-order partial sum.
- `newton x^3 - x - 2 guess=1` follows tangent-line iterations toward a root
  and plots the function, iteration points, and Newton tangent steps.
- `secant x^2 - 2 guess=1 guess2=2` draws secant lines through the last two
  points to approximate a root without a derivative; a single `guess=` seeds
  the second point automatically, and `interval a b` can supply both starts.
- `fixed point cos(x) guess=0.5` iterates the map `x <- g(x)`, returns the fixed
  point `x ~= 0.739085`, and plots a cobweb path; the `x = g(x)` form (such as
  `fixed point x = (x + 2/x)/2 guess=1`) is also accepted.
- `gradient descent x^2 - 4x + 3 guess=0 rate=0.1` steps against the gradient to
  the minimum `x ~= 2, f = -1`, tracing the descent over the function plot;
  `rate=`/`guess=`/`iters=` tune the search and an unstable `rate=` is flagged.
- `bisection x^2 - 4 interval 0 3` tracks midpoint brackets and plots the
  root-finding iterations.
- `simpson integrate sin(x) from 0 to pi n=100` approximates a definite
  integral numerically and returns `integral ~= 2`.
- `improper integral 1/x^2 from 1 to infinity` returns `integral ~= 1`,
  `improper integral 1/x from 1 to infinity` reports `diverges`, and
  `improper integral 1/(1+x^2) from -infinity to infinity` recovers `~= 3.141593`.
- `ode dy/dt = 0.3y y0=2 t=5`, `newton cooling ambient=70 initial=100 k=0.2 t=10`,
  and `logistic r=0.4 K=100 y0=10 t=8` solve closed-form differential equations.
- `ode system dx/dt = y; dy/dt = -2*x - 3*y; x0=1 y0=0 t=1`
  evaluates a 2D linear system, classifies the phase portrait by eigenvalues,
  and samples direction-field vectors.
- `phase plane x' = x - x*y; y' = -y + x*y; x0=2 y0=1 t=1 steps=40`
  estimates nonlinear equilibria, local Jacobian classifications, nullcline
  samples, direction-field vectors, and an RK4 trajectory.
- `rk4 dy/dt = t + y y0=1 from t=0 to 1 h=0.25` approximates a first-order
  ODE with fourth-order Runge-Kutta.
- `regression for (1,2), (2,3), (3,5), (4,8); predict x=5` becomes a statistical model tree
  with coefficient standard errors, t tests, p-values, confidence intervals,
  mean-response intervals, prediction intervals, and a fitted-line scatterplot.
- `pearson correlation x: 1,2,3,4,5,6; y: 2,4,5,4,5,7` tests linear
  association with Pearson `r`, a t p-value, R squared, a Fisher-z interval,
  and a trend-line plot.
- `spearman correlation x: 1,2,3,4,5,6; y: 1,3,2,5,4,6` ranks both
  variables and tests monotonic association.
- `kendall correlation x: 1,2,2,3,4,5; y: 1,2,3,3,5,4` counts concordant,
  discordant, and tied pairs for a tau-b ordinal-association test.
- `quadratic regression degree=2 for (1,2), (2,5), (3,10), (4,17); predict x=5`
  fits a nonlinear polynomial curve and predicts `26`.
- `multiple regression y: 4,7,9,12,15; x1: 1,2,3,4,5; x2: 0,1,0,1,1`
  solves a least-squares model with multiple predictors.
- `regression diagnostics y: 2,3,5,8,13,21; x: 1,2,3,4,5,6` checks
  residual shape, autocorrelation, heteroscedasticity, leverage, influence,
  and graph-based diagnostic patterns.
- `compare regression models y: 2,3,5,8,13,21; x: 1,2,3,4,5,6 degrees=1,2,3 kfold=3 holdout=0.33`
  compares polynomial models with AIC/AICc/BIC plus leave-one-out, k-fold,
  and holdout validation error.
- `compare nonlinear regression models x: 1,2,3,4,5; y: 2,4,8,16,32 families=linear,exponential,logarithmic,power`
  compares transformed nonlinear model families on the original response
  scale and plots the best fitted curve.
- `compare nonlinear regression models x: 0,1,2,3,4,5,6,7,8; y: 1.8,4.7,11.9,26.9,50,73.1,88.1,95.3,98.2 families=linear,exponential,logistic`
  fits a three-parameter logistic growth curve with damped nonlinear least
  squares and compares it against simpler alternatives.
- `custom nonlinear regression formula=a*exp(b*x); x: 1,2,3,4,5; y: 2,4,8,16,32; params a=1,b=0.5; bounds a=0:10,b=0:2; multistart=3; predict x=6`
  fits a user-supplied formula with named parameters, optional bounds, and
  approximate parameter/prediction intervals plus optimizer trace tables.
- `compare custom nonlinear regression models formulas=a*exp(b*x) | c*x^d; x: 1,2,3,4,5,6; y: 2.1,3.9,8.2,15.7,32.4,63.5; params a=1,b=0.5,c=1,d=2; bounds a=0:10,b=0:2,c=0:10,d=0:4; multistart=3; kfold=3 holdout=0.33; bootstrap=60 seed=11; predict x=7`
  fits multiple custom formulas, ranks them by AICc/AIC/BIC, computes model
  weights, runs leave-one-out/k-fold/holdout validation, and bootstraps
  model-selection uncertainty plus model-averaged prediction intervals with
  visual diagnostics.
- `ridge regression lambda=1 y: 4,7,9,12,15; x1: 1,2,3,4,5; x2: 0,1,0,1,1`
  solves a regularized model that shrinks predictor coefficients.
- `lasso regression lambda=1 y: 4,7,9,12,15; x1: 1,2,3,4,5; x2: 0,1,0,1,1`
  solves a sparse model that can set weak predictor coefficients to zero.
- `bayesian linear regression y: 4,7,9,12,15; x: 1,2,3,4,5; priorMean=0 priorSd=10 sigma=1 predict x=6`
  updates normal coefficient priors and returns posterior prediction intervals.
- `logistic regression y: 0,0,1,0,1,1; x: 1,2,3,4,5,6; predict x=4.5`
  fits a binary-response model and returns a predicted probability.
- `naive bayes class: 0,0,0,1,1,1; x1: 1,2,1.5,5,6,5.5; x2: 1,1.2,0.8,5,5.5,4.8`
  trains a Gaussian classifier and reports posterior class probabilities.
- `lda class: 0,0,0,1,1,1; x1: 1,2,1.5,5,6,5.5; x2: 1,1.2,0.8,5,5.5,4.8; regularization=0.001 predict x1=5.2 x2=5`
  fits class means plus a pooled covariance matrix and predicts with discriminant scores.
- `qda class: 0,0,0,1,1,1; x1: 1,2,1.5,5,6,5.5; x2: 1,1.2,0.8,5,5.5,4.8; regularization=0.001 predict x1=5.2 x2=5`
  fits class-specific covariance matrices and predicts with quadratic discriminant scores.
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
- `arima(2,1,0) series: 10,13,15,18,22,27,31,38 forecast=3`
  differences the series, fits autoregressive lag terms, and reconstructs
  multi-step forecasts on the original scale.
- `ljung-box series: 10,12,13,15,16,18,21,22 lags=3` reports sample
  autocorrelations and a Ljung-Box Q test for serial dependence.
- `simple exponential smoothing 10 12 13 12 15 16 18 forecast=3` smooths the
  level with an SSE-optimized alpha (or a supplied `alpha=`) and forecasts a
  flat line, while `holt exponential smoothing 10 13 15 18 22 27 31 38
  forecast=4` adds a trend component and projects it forward (`alpha=`/`beta=`
  fix the weights).
- `covariance matrix x: 1,2,3,4; y: 2,3,5,8` returns a sample covariance
  matrix, and `correlation matrix ...` scales it to pairwise correlations.
- `pca x: 1,2,3,4,5; y: 2,3,5,8,13; z: 5,4,3,2,1` finds covariance
  eigenvectors, explained variance, cumulative variance, and PC scores.
- `k-means k=3 points (1,1), (1,2), (5,5), (6,5), (10,10), (10,11)`
  clusters coordinate data and reports centroids plus within-cluster SSE.
- `mann-whitney group1: 10,12,9; group2: 8,7,11` ranks combined samples
  and computes a nonparametric U test with exact p-values for small no-tie
  samples, rank-biserial effect size, and the Hodges-Lehmann location-shift
  estimate.
- `ANOVA group1: 8,9,10; group2: 12,13,14; group3: 9,11,10` reports F,
  p-value, eta squared, omega squared, and pairwise comparisons.
- `repeated measures anova baseline: 10,12,11,13; week1: 12,13,12,15; week2: 14,15,13,17`
  tests within-subject condition effects while removing subject baselines.
- `two-way anova y: 6,7,8,9,10,11,15,16; A: low,low,low,low,high,high,high,high; B: control,control,treatment,treatment,control,control,treatment,treatment`
  partitions a balanced factorial design into A, B, interaction, and error terms.
- `hypergeometric population=50 successes=5 draws=10 k=2` models sampling
  without replacement and returns `P(X = 2) = 0.20984`.
- `inverse normal p=0.975 mean=0 sd=1` inverts the normal CDF and returns
  `x = 1.959963`.
- `student t df=10 x=2 greater`, `chi-square distribution df=5 x=10 greater`,
  and `f distribution df1=5 df2=10 x=2 greater` evaluate right-tail
  probabilities, densities, shaded distribution plots, and matching critical
  values when a probability is supplied.
- `geometric p=0.25 k=3`, `exponential lambda=2 x=1`, and
  `uniform min=2 max=10 between 4 and 7` evaluate additional probability
  distribution trees.
- `fit normal to 10,11,11,12,12,12,12,13,13,13,13,14,14,14,14,15,15,15,16,16`
  fits `mu = 13.25, sigma = 1.681947` and reports the data are `consistent with a
  normal distribution`; `fit poisson to ...` and `fit exponential to ...` fit the
  matching models with their own goodness-of-fit tests.
- `two-proportion z-test successes1=56 n1=100 successes2=44 n2=100` compares
  two sample proportions and reports `z = 1.697056, p = 0.089686`.
- `chi-square independence [[30,10],[20,40]]` tests whether two categorical
  variables are associated and reports expected counts plus Cramer's V.
- `fisher exact [[1,9],[11,3]]` gives an exact 2x2 table p-value and odds ratio
  without relying on a large-sample chi-square approximation.
- `mcnemar [[20,5],[15,60]]` tests paired binary outcomes with an exact
  discordant-pair p-value and matched odds ratio.
- `permutation test group1: 10,12,9; group2: 8,7,11 resamples=2000 seed=5`
  shuffles group labels into a reproducible nonparametric p-value.
- `ks test group1: 1,2,3,4; group2: 3,4,5,6` compares two empirical CDFs
  and reports the maximum distribution gap.
- `kaplan-meier times: 5,6,6,8,10; events: 1,1,0,1,0` estimates a
  right-censored survival curve and reports median survival.
- `log-rank group1 times: 5,6,6,8,10 events: 1,1,0,1,0; group2 times: 4,6,7,9,12 events: 1,0,1,1,0`
  compares two right-censored survival curves with a chi-square p-value.
- `cox regression times: 5,6,6,8,10,12; events: 1,1,0,1,0,1; x: 0,1,0,1,1,0`
  fits a one-covariate proportional hazards model and reports a hazard ratio.
- `bootstrap mean data 10,12,14,16,18 resamples=1000 seed=7 confidence=95`
  builds a reproducible percentile bootstrap interval for the mean.
- `normality test data 10,12,13,15,30,31,32,33` runs a Jarque-Bera
  diagnostic from skewness and excess kurtosis, while
  `anderson-darling normality data 10,12,13,15,30,31,32,33` compares the
  ordered sample to a fitted normal CDF with tail-sensitive weighting.
- `variance test group1: 10,12,9,11; group2: 8,7,11,9` compares two sample
  variances with an F test, while `levene group1: ...; group2: ...; group3: ...`
  checks equal variances across several groups.
- `welch anova group1: 8,9,10; group2: 14,16,17; group3: 20,24,29` compares
  three or more means without assuming equal variances.
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
- Smart input hints when a question is incomplete or missing required data
- A clear answer area
- Expression-tree visualization
- Truth tables for logic mode
- Polynomial factoring through Ask mode
- Exact combinatorics through Ask mode
- DPLL SAT solving, unsat-core diagnostics, and logic normal forms through Ask mode
- Semantic tableaux / truth-tree proofs through Ask mode
- Karnaugh-map simplification with optional don't-care cells through Ask mode
- Reduced ordered BDDs through Ask mode
- Fuzzy t-norm, interval-valued, independent-probability, and
  correlated/conditional/Bayesian-network probability truth-value logic with
  evidence through Ask mode
- Graphviz DOT tree export through Ask mode
- Number theory and modular arithmetic through Ask mode
- Polynomial inequalities with interval answers through Ask mode
- Numeric limits through Ask mode
- Partial derivatives, gradients, and directional derivatives through Ask mode
- Taylor/Maclaurin approximations through Ask mode
- Complex arithmetic plus exact radical and complex quadratic roots through Ask mode
- Dataset summaries, confidence intervals, bootstrap intervals,
  regression/correlation, polynomial regression,
  Pearson correlation,
  Spearman rank correlation, Kendall tau-b correlation,
  multiple regression,
  coefficient inference for linear models,
  regression diagnostics with visual residual and influence plots,
  regression model comparison with LOOCV, k-fold, and holdout metrics,
  nonlinear regression family comparison including logistic growth,
  custom nonlinear regression formulas with prediction intervals, optimizer
  traces, formula comparison, cross-validation, bootstrap uncertainty graphs,
  and model averaging,
  ridge regression,
  LASSO regression,
  Bayesian linear regression,
  logistic regression,
  Gaussian Naive Bayes classification,
  linear discriminant analysis,
  quadratic discriminant analysis,
  decision tree classification,
  random forest classification,
  ROC/AUC classifier evaluation,
  Poisson regression,
  AR(1), ARIMA(p,d,0), and Ljung-Box time-series analysis,
  covariance/correlation matrices, multi-variable PCA, k-means clustering,
  binomial probability,
  Poisson probability, geometric probability, exponential probability, uniform
  probability, hypergeometric probability, normal probability, inverse-normal
  percentiles, Student t, chi-square, and F distribution probabilities and
  critical values with shaded density plots, z-scores, discrete expected value, Bayes theorem,
  Markov chains, Bayesian beta-binomial updates,
  Jarque-Bera and Anderson-Darling normality tests, equal-variance tests,
  one-sample/two-sample/paired t tests,
  one-proportion/two-proportion z tests,
  proportion confidence intervals, permutation tests, two-sample Kolmogorov-Smirnov tests, ANOVA, chi-square tests
  of goodness-of-fit and independence, Fisher exact tests, McNemar paired categorical tests,
  nonparametric rank tests including exact small-sample Mann-Whitney and
  Wilcoxon signed-rank p-values with Hodges-Lehmann shift estimates,
  Kaplan-Meier survival analysis, log-rank tests,
  Cox proportional hazards regression, power/sample-size analysis, effect sizes
  with approximate confidence intervals for t tests, and pairwise follow-up
  summaries in Stats mode
- Linear and nonlinear systems of equations, matrices with fundamental subspace
  bases, complex 2x2 eigenvectors, nonsymmetric 3x3 real eigenvectors,
  symmetric eigenvalue/eigenvector approximation, and dominant eigenpair approximation,
  polynomial/elementary integrals, optimization, linear programming,
  vector geometry, geometry formulas, sequences/series, graphing with tangent
  overlays, differential equations including nonlinear phase-plane systems,
  numerical roots with iteration graphs, numerical integration, and numerical ODEs
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
2. Add broader exact symbolic root output for irreducible cubics and
   non-rational quartic equations.
3. Add broader inverse-trig identities and verified branch/sign handling for
   half-angle rewrites.
4. Add broader substitution, broader integration by parts, and repeated
   irreducible quadratic partial fractions.
5. Add more exact rank-test variants and confidence intervals for additional effect sizes.
6. Add nonsymmetric eigenvector approximations beyond 3x3 and larger complex eigenvalue algorithms.
7. Add richer custom nonlinear residual diagnostics, parameter stability views,
   and bootstrap trace exports.
8. Add richer nonlinear phase-plane tools, including separatrix tracing,
   parameter sweeps, and styled direction-field arrows.
9. Add multi-step natural-language explanations for word problems.
10. Add exact symbolic roots for more higher-degree equations beyond rational-factor reductions.
11. Add more Boolean algebra simplification rules, including normal-form
   factoring and larger multi-clause reductions.
12. Extend SAT solving with watched literals, clause learning, and proof logs.
13. Generate formal proof steps for tautologies using natural deduction or
   sequent calculus.
14. Extend semantic tableaux with larger rendered proof trees and branch
   annotations for classroom-style derivations.
15. Add rendered Karnaugh-map group overlays.
16. Add one-click SVG or PNG rendering for exported Graphviz parse trees.
17. Add Boolean operations directly on BDDs, including apply, restrict, and
   variable reordering heuristics.
18. Generalize probabilistic logic to larger joint distributions and
   multi-parent Bayesian-network nodes.
