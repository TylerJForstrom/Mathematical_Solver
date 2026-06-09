import assert from "node:assert/strict";

import {
  analyzeComplex,
  analyzeCombinatorics,
  analyzeDerivative,
  analyzeEquation,
  analyzeFactoring,
  analyzeGraph,
  analyzeInequality,
  analyzeIntegral,
  analyzeLimit,
  analyzeLogic,
  analyzeMatrix,
  analyzeNumerical,
  analyzeNumberTheory,
  analyzeOptimization,
  analyzeSimplification,
  analyzeStatistics,
  analyzeSystem,
  analyzeTaylor,
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

runTest("factoring mode factors quadratics over rationals", () => {
  const result = analyzeFactoring("factor x^2 - 5x + 6");

  assert.equal(result.summary, "rational factorization");
  assert.equal(result.answer, "(x - 2)(x - 3)");
});

runTest("factoring mode handles leading coefficients", () => {
  const result = analyzeFactoring("factor 2x^2 + 7x + 3");

  assert.equal(result.summary, "rational factorization");
  assert.equal(result.answer, "(2x + 1)(x + 3)");
});

runTest("factoring mode handles cubic rational roots", () => {
  const result = analyzeFactoring("factor x^3 - 6x^2 + 11x - 6");

  assert.equal(result.summary, "rational factorization");
  assert.equal(result.answer, "(x - 1)(x - 2)(x - 3)");
});

runTest("factoring mode leaves irreducible factors", () => {
  const result = analyzeFactoring("factor x^4 - 1");

  assert.equal(result.summary, "rational factorization");
  assert.equal(result.answer, "(x + 1)(x - 1)(x^2 + 1)");
});

runTest("combinatorics mode computes exact counts", () => {
  assert.equal(analyzeCombinatorics("10 choose 3").answer, "C(10, 3) = 120");
  assert.equal(analyzeCombinatorics("permutation n=10 k=3").answer, "P(10, 3) = 720");
  assert.equal(analyzeCombinatorics("6!").answer, "6! = 720");
});

runTest("number theory mode computes integer operations", () => {
  assert.equal(analyzeNumberTheory("gcd 84 126").answer, "gcd(84, 126) = 42");
  assert.equal(analyzeNumberTheory("lcm 36 84").answer, "lcm(36, 84) = 252");
  assert.equal(analyzeNumberTheory("prime factors of 84").answer, "84 = 2^2 * 3 * 7");
  assert.equal(analyzeNumberTheory("7^128 mod 13").answer, "7^128 mod 13 = 3");
  assert.equal(analyzeNumberTheory("mod inverse 3 mod 11").answer, "3^-1 mod 11 = 4");
  assert.equal(analyzeNumberTheory("crt x=2 mod 3; x=3 mod 5; x=2 mod 7").answer, "x = 23 mod 105");
});

runTest("inequality mode solves strict quadratic inequalities", () => {
  const result = analyzeInequality("solve x^2 - 5x + 6 > 0");

  assert.equal(result.summary, "polynomial inequality");
  assert.equal(result.answer, "x in (-inf, 2) U (3, inf)");
});

runTest("inequality mode solves inclusive quadratic inequalities", () => {
  const result = analyzeInequality("solve x^2 - 5x + 6 <= 0");

  assert.equal(result.summary, "polynomial inequality");
  assert.equal(result.answer, "x in [2, 3]");
});

runTest("inequality mode handles singleton and empty solutions", () => {
  assert.equal(analyzeInequality("solve x^2 <= 0").answer, "x in {0}");
  assert.equal(analyzeInequality("solve x^2 + 1 < 0").answer, "no solution");
});

runTest("inequality mode solves linear inequalities", () => {
  const result = analyzeInequality("solve 2x + 5 >= 17");

  assert.equal(result.summary, "polynomial inequality");
  assert.equal(result.answer, "x in [6, inf)");
});

runTest("equation mode solves quadratics", () => {
  const result = analyzeEquation("x^2 - 5x + 6 = 0", "x");

  assert.equal(result.summary, "quadratic solution");
  assert.equal(result.answer, "x = 3, x = 2");
});

runTest("equation mode reports complex quadratic roots", () => {
  assert.equal(analyzeEquation("x^2 + 1 = 0", "x").answer, "x = i, x = -i");
  assert.equal(analyzeEquation("x^2 + 2x + 5 = 0", "x").answer, "x = -1 + 2i, x = -1 - 2i");
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

runTest("taylor mode builds Maclaurin polynomials", () => {
  assert.equal(analyzeTaylor("taylor sin(x) order=5").answer, "x - 0.166667x^3 + 0.008333x^5");
  assert.equal(analyzeTaylor("maclaurin exp(x) degree=4").answer, "1 + x + 0.5x^2 + 0.166667x^3 + 0.041667x^4");
});

runTest("taylor mode expands around nonzero centers", () => {
  assert.equal(analyzeTaylor("taylor ln(x) around 1 order=3").answer, "(x - 1) - 0.5(x - 1)^2 + 0.333333(x - 1)^3");
});

runTest("complex mode evaluates arithmetic and functions", () => {
  assert.equal(analyzeComplex("complex (3+4i)*(2-i)").answer, "10 + 5i");
  assert.equal(analyzeComplex("complex (3+4i)/(1-2i)").answer, "-1 + 2i");
  assert.equal(analyzeComplex("complex sqrt(-1)").answer, "i");
  assert.equal(analyzeComplex("complex (1+i)^2").answer, "2i");
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

runTest("statistics mode computes inverse normal percentiles", () => {
  const result = analyzeStatistics("inverse normal p=0.975 mean=0 sd=1");

  assert.equal(result.summary, "inverse normal");
  assert.equal(result.answer, "x = 1.959963");
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

runTest("statistics mode computes one-proportion confidence intervals", () => {
  const result = analyzeStatistics("proportion ci successes=42 n=100 confidence=95");

  assert.equal(result.summary, "one-proportion confidence interval");
  assert.equal(result.answer, "95% CI for p = [0.323264, 0.516736]");
  assert.equal(artifactValue(result, "Sample proportion"), "0.42");
});

runTest("statistics mode computes one-sample tests", () => {
  const result = analyzeStatistics("t-test mean=10 data 8, 9, 11, 12, 10");

  assert.equal(result.summary, "one-sample t test");
  assert.equal(result.answer, "t = 0, p = 1");
  assert.equal(artifactValue(result, "Cohen's d"), "0");
});

runTest("statistics mode computes one-proportion z tests", () => {
  const result = analyzeStatistics("one-proportion z-test successes=56 n=100 p0=0.5");

  assert.equal(result.summary, "one-proportion z test");
  assert.equal(result.answer, "z = 1.2, p = 0.230139");
  assert.equal(artifactValue(result, "Cohen's h"), "0.12029");
});

runTest("statistics mode computes two-proportion z tests", () => {
  const result = analyzeStatistics("two-proportion z-test successes1=56 n1=100 successes2=44 n2=100");

  assert.equal(result.summary, "two-proportion z test");
  assert.equal(result.answer, "z = 1.697056, p = 0.089686");
  assert.equal(artifactValue(result, "95% CI for difference"), "[-0.017589, 0.257589]");
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

runTest("statistics mode computes more probability distributions", () => {
  assert.equal(analyzeStatistics("geometric p=0.25 k=3").answer, "P(X = 3) = 0.140625");
  assert.equal(analyzeStatistics("exponential lambda=2 x=1").answer, "P(X <= 1) = 0.864665");
  assert.equal(analyzeStatistics("uniform min=2 max=10 between 4 and 7").answer, "P(4 <= X <= 7) = 0.375");
});

runTest("statistics mode computes hypergeometric probabilities", () => {
  const result = analyzeStatistics("hypergeometric population=50 successes=5 draws=10 k=2");

  assert.equal(result.summary, "hypergeometric probability");
  assert.equal(result.answer, "P(X = 2) = 0.20984");
  assert.equal(artifactValue(result, "Expected value"), "1");
});

runTest("statistics mode computes discrete expected value", () => {
  const result = analyzeStatistics("expected value values: 0, 1, 2 probabilities: 0.2, 0.5, 0.3");

  assert.equal(result.summary, "discrete expected value");
  assert.equal(result.answer, "E(X) = 1.1, Var(X) = 0.49");
  assert.equal(artifactValue(result, "Standard deviation"), "0.7");
});

runTest("statistics mode applies Bayes theorem", () => {
  const result = analyzeStatistics("bayes prior=0.01 sensitivity=0.99 specificity=0.95");

  assert.equal(result.summary, "Bayes theorem");
  assert.equal(result.answer, "P(H | positive) = 0.166667");
  assert.equal(artifactValue(result, "False positive rate"), "0.05");
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

runTest("limit mode evaluates direct and removable limits", () => {
  assert.equal(analyzeLimit("limit x^2 + 3x as x approaches 2").answer, "limit = 10");
  assert.equal(analyzeLimit("limit (x^2 - 1)/(x - 1) as x approaches 1").answer, "limit = 2");
});

runTest("limit mode estimates trigonometric and one-sided limits", () => {
  assert.equal(analyzeLimit("lim x->0 sin(x)/x").answer, "limit = 1");
  assert.equal(analyzeLimit("limit 1/x as x approaches 0 from right").answer, "limit = infinity");
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
  assert.equal(analyzeUniversal("factor x^2 - 5x + 6").answer, "(x - 2)(x - 3)");
  assert.equal(analyzeUniversal("10 choose 3").answer, "C(10, 3) = 120");
  assert.equal(analyzeUniversal("gcd 84 126").answer, "gcd(84, 126) = 42");
  assert.equal(analyzeUniversal("mod inverse 3 mod 11").summary, "modular inverse");
  assert.equal(analyzeUniversal("crt x=2 mod 3; x=3 mod 5; x=2 mod 7").summary, "Chinese remainder theorem");
  assert.equal(analyzeUniversal("solve x^2 - 5x + 6 > 0").answer, "x in (-inf, 2) U (3, inf)");
  assert.equal(analyzeUniversal("integrate x^2").summary, "indefinite integral");
  assert.equal(analyzeUniversal("integrate x^2 from 0 to 3").summary, "definite integral");
  assert.equal(analyzeUniversal("integrate sin(x)").answer, "-cos(x) + C");
  assert.equal(analyzeUniversal("limit (x^2 - 1)/(x - 1) as x approaches 1").answer, "limit = 2");
  assert.equal(analyzeUniversal("taylor sin(x) order=5").summary, "Maclaurin polynomial");
  assert.equal(analyzeUniversal("complex (3+4i)*(2-i)").answer, "10 + 5i");
  assert.equal(analyzeUniversal("maximize -x^2 + 4x + 1").summary, "critical points");
  assert.equal(analyzeUniversal("graph x^2 from -1 to 1").summary, "function graph");
  assert.equal(analyzeUniversal("newton x^3 - x - 2 guess=1").summary, "Newton root");
  assert.equal(analyzeUniversal("proportion ci successes=42 n=100 confidence=95").summary, "one-proportion confidence interval");
  assert.equal(analyzeUniversal("one-proportion z-test successes=56 n=100 p0=0.5").summary, "one-proportion z test");
  assert.equal(analyzeUniversal("two-proportion z-test successes1=56 n1=100 successes2=44 n2=100").summary, "two-proportion z test");
  assert.equal(analyzeUniversal("chi-square observed 10,20,30 expected 15,15,30").summary, "chi-square goodness-of-fit");
  assert.equal(analyzeUniversal("paired t-test before: 10,12,9; after: 11,14,10").summary, "paired t test");
  assert.equal(analyzeUniversal("ANOVA group1: 8,9,10; group2: 12,13,14; group3: 9,11,10").summary, "one-way ANOVA");
  assert.equal(analyzeUniversal("poisson lambda=3 k=2").summary, "Poisson probability");
  assert.equal(analyzeUniversal("geometric p=0.25 k=3").summary, "geometric probability");
  assert.equal(analyzeUniversal("exponential lambda=2 x=1").summary, "exponential probability");
  assert.equal(analyzeUniversal("uniform min=2 max=10 between 4 and 7").summary, "uniform probability");
  assert.equal(analyzeUniversal("inverse normal p=0.975 mean=0 sd=1").summary, "inverse normal");
  assert.equal(analyzeUniversal("hypergeometric population=50 successes=5 draws=10 k=2").summary, "hypergeometric probability");
  assert.equal(analyzeUniversal("expected value values: 0, 1, 2 probabilities: 0.2, 0.5, 0.3").summary, "discrete expected value");
  assert.equal(analyzeUniversal("bayes prior=0.01 sensitivity=0.99 specificity=0.95").summary, "Bayes theorem");
  assert.equal(analyzeUniversal("mann-whitney group1: 10,12,9; group2: 8,7,11").summary, "Mann-Whitney U test");
  assert.equal(analyzeUniversal("wilcoxon signed-rank before: 10,12,9,11; after: 11,14,10,13").summary, "Wilcoxon signed-rank test");
  assert.equal(analyzeUniversal("kruskal-wallis group1: 8,9,10; group2: 12,13,14; group3: 9,11,10").summary, "Kruskal-Wallis test");
  assert.equal(analyzeUniversal("rank [[1,2],[2,4]]").summary, "matrix rank");
  assert.equal(analyzeUniversal("eigen [[2,1],[1,2]]").summary, "2x2 eigenvalues");
  assert.equal(analyzeUniversal("nullspace [[1,2,1],[2,4,2],[1,1,0]]").summary, "matrix null space");
  assert.equal(analyzeUniversal("eigenvectors [[2,1],[1,2]]").summary, "2x2 eigenvectors");
});
