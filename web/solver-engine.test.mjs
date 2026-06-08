import assert from "node:assert/strict";

import {
  analyzeDerivative,
  analyzeEquation,
  analyzeGraph,
  analyzeIntegral,
  analyzeLogic,
  analyzeMatrix,
  analyzeNumerical,
  analyzeOptimization,
  analyzeSimplification,
  analyzeStatistics,
  analyzeSystem,
  analyzeUniversal,
} from "./solver-engine.mjs";

function runTest(name, callback) {
  callback();
  console.log(`ok - ${name}`);
}

function artifactValue(result, label) {
  return result.artifacts.find(([key]) => key === label)?.[1];
}

runTest("logic mode classifies tautologies", () => {
  const result = analyzeLogic("P or not P", { P: true });

  assert.equal(result.summary, "tautology");
  assert.equal(result.answer, "true");
});

runTest("simplify mode combines like terms", () => {
  const result = analyzeSimplification("2x + 3x - 4 + 10");

  assert.equal(result.answer, "5x + 6");
});

runTest("equation mode solves quadratics", () => {
  const result = analyzeEquation("x^2 - 5x + 6 = 0", "x");

  assert.equal(result.summary, "quadratic solution");
  assert.equal(result.answer, "x = 3, x = 2");
});

runTest("equation mode solves linear equations", () => {
  const result = analyzeEquation("2x + 5 = 17", "x");

  assert.equal(result.answer, "x = 6");
});

runTest("derivative mode applies the power rule and simplifies", () => {
  const result = analyzeDerivative("x^3 + 2x^2 - 7x + 4", "x");

  assert.equal(result.answer, "3x^2 + 4x - 7");
});

runTest("derivative mode supports product rule", () => {
  const result = analyzeDerivative("x(x + 1)", "x");

  assert.equal(result.answer, "2x + 1");
});

runTest("statistics mode computes descriptive summaries", () => {
  const result = analyzeStatistics("mean of 2, 4, 4, 5, 9");

  assert.equal(result.summary, "descriptive statistics");
  assert.equal(result.answer, "mean = 4.8");
});

runTest("statistics mode computes linear regression", () => {
  const result = analyzeStatistics("regression for (1,2), (2,3), (3,5)");

  assert.equal(result.summary, "linear regression");
  assert.equal(result.answer, "y = 1.5x + 0.333333");
});

runTest("statistics mode computes binomial probability", () => {
  const result = analyzeStatistics("binomial n=10 p=0.5 k=3");

  assert.equal(result.summary, "binomial probability");
  assert.equal(result.answer, "P(X = 3) = 0.117188");
});

runTest("statistics mode computes normal probabilities", () => {
  const result = analyzeStatistics("normal mean=0 sd=1 x=1.96");

  assert.equal(result.summary, "normal probability");
  assert.equal(result.answer, "P(X <= 1.96) = 0.975002");
});

runTest("statistics mode computes z-scores", () => {
  const result = analyzeStatistics("zscore value=85 mean=70 sd=10");

  assert.equal(result.summary, "z-score");
  assert.equal(result.answer, "z = 1.5");
});

runTest("statistics mode computes confidence intervals", () => {
  const result = analyzeStatistics("95 confidence interval for 10, 12, 14, 16, 18");

  assert.equal(result.summary, "confidence interval");
  assert.equal(result.answer, "95% CI = [11.228192, 16.771808]");
});

runTest("statistics mode computes one-sample tests", () => {
  const result = analyzeStatistics("t-test mean=10 data 8, 9, 11, 12, 10");

  assert.equal(result.summary, "one-sample t test");
  assert.equal(result.answer, "t = 0, p = 1");
  assert.equal(artifactValue(result, "Cohen's d"), "0");
});

runTest("statistics mode computes two-sample tests", () => {
  const result = analyzeStatistics("two-sample t-test group1: 10, 12, 9; group2: 8, 7, 11");

  assert.equal(result.summary, "two-sample t test");
  assert.equal(result.answer, "t = 1.118034, p = 0.331352");
  assert.equal(artifactValue(result, "Hedges g"), "0.730297");
});

runTest("statistics mode computes chi-square goodness-of-fit", () => {
  const result = analyzeStatistics("chi-square observed 10, 20, 30 expected 15, 15, 30");

  assert.equal(result.summary, "chi-square goodness-of-fit");
  assert.equal(result.answer, "chi-square = 3.333333, p = 0.186672");
  assert.equal(artifactValue(result, "Cohen's w"), "0.235702");
});

runTest("statistics mode computes paired t-tests", () => {
  const result = analyzeStatistics("paired t-test before: 10, 12, 9; after: 11, 14, 10");

  assert.equal(result.summary, "paired t test");
  assert.equal(result.answer, "t = 4, p = 0.057191");
  assert.equal(artifactValue(result, "Cohen's dz"), "2.309401");
});

runTest("statistics mode computes one-way ANOVA", () => {
  const result = analyzeStatistics("ANOVA group1: 8, 9, 10; group2: 12, 13, 14; group3: 9, 11, 10");

  assert.equal(result.summary, "one-way ANOVA");
  assert.equal(result.answer, "F = 13, p = 0.006592");
  assert.equal(artifactValue(result, "Eta squared"), "0.8125");
  assert.equal(artifactValue(result, "Pairwise comparisons"), "1 vs 2: diff=-4, p_adj=0.008141; 1 vs 3: diff=-1, p_adj=0.799709; 2 vs 3: diff=3, p_adj=0.031205");
});

runTest("statistics mode computes Poisson probabilities", () => {
  const result = analyzeStatistics("poisson lambda=3 at most k=2");

  assert.equal(result.summary, "Poisson probability");
  assert.equal(result.answer, "P(X <= 2) = 0.42319");
});

runTest("statistics mode computes Mann-Whitney U tests", () => {
  const result = analyzeStatistics("mann-whitney group1: 10, 12, 9; group2: 8, 7, 11");

  assert.equal(result.summary, "Mann-Whitney U test");
  assert.equal(result.answer, "U = 2, p = 0.275234");
  assert.equal(artifactValue(result, "Rank-biserial r"), "0.555556");
});

runTest("statistics mode computes Wilcoxon signed-rank tests", () => {
  const result = analyzeStatistics("wilcoxon signed-rank before: 10, 12, 9, 11; after: 11, 14, 10, 13");

  assert.equal(result.summary, "Wilcoxon signed-rank test");
  assert.equal(result.answer, "W = 0, p = 0.063318");
  assert.equal(artifactValue(result, "Matched rank-biserial r"), "1");
});

runTest("statistics mode computes Kruskal-Wallis tests", () => {
  const result = analyzeStatistics("kruskal-wallis group1: 8,9,10; group2: 12,13,14; group3: 9,11,10");

  assert.equal(result.summary, "Kruskal-Wallis test");
  assert.equal(result.answer, "H = 6.056497, p = 0.047103");
  assert.equal(artifactValue(result, "Epsilon squared"), "0.676083");
  assert.equal(artifactValue(result, "Pairwise comparisons"), "1 vs 2: rank diff=-5.333333, p_adj=0.048482; 1 vs 3: rank diff=-1.666667, p_adj=1; 2 vs 3: rank diff=3.666667, p_adj=0.294613");
});

runTest("system solver handles two-variable systems", () => {
  const result = analyzeSystem("2x + y = 5; x - y = 1");

  assert.equal(result.summary, "linear system");
  assert.equal(result.answer, "x = 2, y = 1");
});

runTest("matrix mode computes determinants", () => {
  const result = analyzeMatrix("det [[1,2],[3,4]]");

  assert.equal(result.summary, "determinant");
  assert.equal(result.answer, "det = -2");
});

runTest("matrix mode multiplies matrices", () => {
  const result = analyzeMatrix("multiply [[1,2],[3,4]] [[5,6],[7,8]]");

  assert.equal(result.summary, "matrix multiplication");
  assert.equal(result.answer, "[[19, 22], [43, 50]]");
});

runTest("matrix mode computes inverses", () => {
  const result = analyzeMatrix("inverse [[1,2],[3,4]]");

  assert.equal(result.summary, "matrix inverse");
  assert.equal(result.answer, "[[-2, 1], [1.5, -0.5]]");
});

runTest("matrix mode row reduces matrices", () => {
  const result = analyzeMatrix("rref [[1,2,1],[2,4,2],[1,1,0]]");

  assert.equal(result.summary, "row-reduced echelon form");
  assert.equal(result.answer, "[[1, 0, -1], [0, 1, 1], [0, 0, 0]]");
});

runTest("matrix mode computes rank", () => {
  const result = analyzeMatrix("rank [[1,2],[2,4]]");

  assert.equal(result.summary, "matrix rank");
  assert.equal(result.answer, "rank = 1");
});

runTest("matrix mode computes 2x2 eigenvalues", () => {
  const result = analyzeMatrix("eigen [[2,1],[1,2]]");

  assert.equal(result.summary, "2x2 eigenvalues");
  assert.equal(result.answer, "lambda = 3, 1");
});

runTest("matrix mode computes null-space bases", () => {
  const result = analyzeMatrix("nullspace [[1,2,1],[2,4,2],[1,1,0]]");

  assert.equal(result.summary, "matrix null space");
  assert.equal(result.answer, "basis = [[1, -1, 1]]");
});

runTest("matrix mode computes 2x2 eigenvectors", () => {
  const result = analyzeMatrix("eigenvectors [[2,1],[1,2]]");

  assert.equal(result.summary, "2x2 eigenvectors");
  assert.equal(result.answer, "lambda 3: [[1, 1]]; lambda 1: [[1, -1]]");
});

runTest("integral mode applies polynomial power rules", () => {
  const result = analyzeIntegral("integrate x^2 + 3x");

  assert.equal(result.summary, "indefinite integral");
  assert.equal(result.answer, "0.333333x^3 + 1.5x^2 + C");
});

runTest("integral mode evaluates definite integrals", () => {
  const result = analyzeIntegral("integrate x^2 from 0 to 3");

  assert.equal(result.summary, "definite integral");
  assert.equal(result.answer, "integral = 9");
});

runTest("integral mode handles elementary trig antiderivatives", () => {
  const result = analyzeIntegral("integrate sin(x)");

  assert.equal(result.summary, "indefinite integral");
  assert.equal(result.answer, "-cos(x) + C");
});

runTest("integral mode handles scalar multiples of elementary functions", () => {
  const result = analyzeIntegral("integrate 2sin(x) + 3cos(x)");

  assert.equal(result.summary, "indefinite integral");
  assert.equal(result.answer, "-2cos(x) + 3sin(x) + C");
});

runTest("integral mode evaluates elementary definite integrals", () => {
  const result = analyzeIntegral("integrate exp(x) from 0 to 1");

  assert.equal(result.summary, "definite integral");
  assert.equal(result.answer, "integral = 1.718282");
});

runTest("integral mode handles reciprocal antiderivatives", () => {
  const result = analyzeIntegral("integrate 1/x");

  assert.equal(result.summary, "indefinite integral");
  assert.equal(result.answer, "ln(abs(x)) + C");
});

runTest("integral mode handles logarithmic and square-root antiderivatives", () => {
  assert.equal(analyzeIntegral("integrate ln(x)").answer, "xln(abs(x)) - x + C");
  assert.equal(analyzeIntegral("integrate sqrt(x)").answer, "0.666667x^(3/2) + C");
});

runTest("optimization mode finds polynomial critical points", () => {
  const result = analyzeOptimization("maximize -x^2 + 4x + 1");

  assert.equal(result.summary, "critical points");
  assert.equal(result.answer, "local max at x = 2, f(x) = 5");
});

runTest("graph mode samples functions", () => {
  const result = analyzeGraph("graph x^2 - 4 from -2 to 2");

  assert.equal(result.summary, "function graph");
  assert.equal(result.graph.points.length, 121);
});

runTest("numerical mode runs Newton's method", () => {
  const result = analyzeNumerical("newton x^3 - x - 2 guess=1");

  assert.equal(result.summary, "Newton root");
  assert.equal(result.answer, "x ~= 1.52138");
});

runTest("numerical mode runs bisection", () => {
  const result = analyzeNumerical("bisection x^2 - 4 interval 0 3");

  assert.equal(result.summary, "bisection root");
  assert.equal(result.answer, "x ~= 2");
});

runTest("equation mode approximates higher-degree real roots", () => {
  const result = analyzeEquation("x^3 - x - 2 = 0", "x");

  assert.equal(result.summary, "numeric roots");
  assert.equal(result.answer, "x ~= 1.52138");
});

runTest("universal mode routes statistics questions", () => {
  const result = analyzeUniversal("what is the median of 1, 7, 9?");

  assert.equal(result.summary, "descriptive statistics");
  assert.equal(result.answer, "median = 7");
});

runTest("universal mode routes derivative questions", () => {
  const result = analyzeUniversal("differentiate x^3");

  assert.equal(result.summary, "derivative");
  assert.equal(result.answer, "3x^2");
});

runTest("universal mode routes systems", () => {
  const result = analyzeUniversal("solve system 2x + y = 5; x - y = 1");

  assert.equal(result.summary, "linear system");
  assert.equal(result.answer, "x = 2, y = 1");
});

runTest("universal mode routes advanced solvers", () => {
  assert.equal(analyzeUniversal("det [[1,2],[3,4]]").summary, "determinant");
  assert.equal(analyzeUniversal("integrate x^2").summary, "indefinite integral");
  assert.equal(analyzeUniversal("integrate x^2 from 0 to 3").summary, "definite integral");
  assert.equal(analyzeUniversal("integrate sin(x)").answer, "-cos(x) + C");
  assert.equal(analyzeUniversal("maximize -x^2 + 4x + 1").summary, "critical points");
  assert.equal(analyzeUniversal("graph x^2 from -1 to 1").summary, "function graph");
  assert.equal(analyzeUniversal("newton x^3 - x - 2 guess=1").summary, "Newton root");
  assert.equal(analyzeUniversal("chi-square observed 10,20,30 expected 15,15,30").summary, "chi-square goodness-of-fit");
  assert.equal(analyzeUniversal("paired t-test before: 10,12,9; after: 11,14,10").summary, "paired t test");
  assert.equal(analyzeUniversal("ANOVA group1: 8,9,10; group2: 12,13,14; group3: 9,11,10").summary, "one-way ANOVA");
  assert.equal(analyzeUniversal("poisson lambda=3 k=2").summary, "Poisson probability");
  assert.equal(analyzeUniversal("mann-whitney group1: 10,12,9; group2: 8,7,11").summary, "Mann-Whitney U test");
  assert.equal(analyzeUniversal("wilcoxon signed-rank before: 10,12,9,11; after: 11,14,10,13").summary, "Wilcoxon signed-rank test");
  assert.equal(analyzeUniversal("kruskal-wallis group1: 8,9,10; group2: 12,13,14; group3: 9,11,10").summary, "Kruskal-Wallis test");
  assert.equal(analyzeUniversal("rank [[1,2],[2,4]]").summary, "matrix rank");
  assert.equal(analyzeUniversal("eigen [[2,1],[1,2]]").summary, "2x2 eigenvalues");
  assert.equal(analyzeUniversal("nullspace [[1,2,1],[2,4,2],[1,1,0]]").summary, "matrix null space");
  assert.equal(analyzeUniversal("eigenvectors [[2,1],[1,2]]").summary, "2x2 eigenvectors");
});
