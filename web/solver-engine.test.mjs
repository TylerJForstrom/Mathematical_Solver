import assert from "node:assert/strict";

import {
  analyzeComplex,
  analyzeCombinatorics,
  analyzeDerivative,
  analyzeDifferentialEquation,
  analyzeEquation,
  analyzeFactoring,
  analyzeFourierSeries,
  analyzeGeometry,
  analyzeGraph,
  analyzeInequality,
  analyzeIntegral,
  analyzeLaplaceTransform,
  analyzeLimit,
  analyzeLogic,
  analyzeMatrix,
  analyzeMarkovChain,
  analyzeMultivariable,
  analyzeNumerical,
  analyzeNumberTheory,
  analyzeOptimization,
  analyzeSequence,
  analyzeSimplification,
  analyzeStatistics,
  analyzeSystem,
  analyzeTaylor,
  analyzeUniversal,
  analyzeVector,
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

runTest("vector mode computes vector geometry", () => {
  assert.equal(analyzeVector("dot [1,2,3] [4,5,6]").answer, "dot = 32");
  assert.equal(analyzeVector("cross [1,2,3] [4,5,6]").answer, "cross = [-3, 6, -3]");
  assert.equal(analyzeVector("magnitude [3,4]").answer, "|v| = 5");
  assert.equal(analyzeVector("angle between [1,0] [0,1]").answer, "angle = 90 degrees");
  assert.equal(analyzeVector("projection [3,4] onto [1,0]").answer, "projection = [3, 0]");
  assert.equal(analyzeVector("distance [1,2] [4,6]").answer, "distance = 5");
});

runTest("sequence mode computes sequences and series", () => {
  assert.equal(analyzeSequence("arithmetic sequence a1=3 d=5 n=10").answer, "a_10 = 48, S_10 = 255");
  assert.equal(analyzeSequence("geometric sequence a1=2 r=3 n=5").answer, "a_5 = 162, S_5 = 242");
  assert.equal(analyzeSequence("infinite geometric series a1=5 r=0.2").answer, "S_inf = 6.25");
  assert.equal(analyzeSequence("sum k^2 from k=1 to 5").answer, "sum = 55");
  assert.equal(analyzeSequence("sum k=1 to 4 of 2k + 1").answer, "sum = 24");
});

runTest("geometry mode computes formulas and coordinate geometry", () => {
  assert.equal(analyzeGeometry("circle radius=3").answer, "area = 28.274334, circumference = 18.849556");
  assert.equal(analyzeGeometry("rectangle length=5 width=8").answer, "area = 40, perimeter = 26");
  assert.equal(analyzeGeometry("triangle base=10 height=6").answer, "area = 30");
  assert.equal(analyzeGeometry("triangle sides 3 4 5").answer, "area = 6, perimeter = 12");
  assert.equal(analyzeGeometry("pythagorean a=3 b=4").answer, "c = 5");
  assert.equal(analyzeGeometry("distance between (1,2) and (4,6)").answer, "distance = 5");
  assert.equal(analyzeGeometry("midpoint (1,2) (5,8)").answer, "midpoint = (3, 5)");
  assert.equal(analyzeGeometry("slope between (1,2) and (4,6)").answer, "slope = 1.333333");
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

runTest("multivariable mode computes partials, gradients, and directional derivatives", () => {
  const partial = analyzeMultivariable("partial derivative of x^2*y + y^3 with respect to y");
  const partialAtPoint = analyzeMultivariable("partial derivative of x^2*y + y^3 with respect to y at x=2 y=3");
  const gradient = analyzeMultivariable("gradient x^2 + x*y + y^2 at x=1 y=2");
  const directional = analyzeMultivariable("directional derivative x^2 + x*y + y^2 at x=1 y=2 direction [3,4]");

  assert.equal(partial.summary, "partial derivative");
  assert.equal(partial.answer, "df/dy = x^2 + 3y^2");
  assert.equal(partialAtPoint.answer, "df/dy = x^2 + 3y^2; value = 31");
  assert.equal(gradient.summary, "gradient");
  assert.equal(gradient.answer, "grad f = [4, 5]");
  assert.equal(directional.summary, "directional derivative");
  assert.equal(directional.answer, "D_u f = 6.4");
});

runTest("taylor mode builds Maclaurin polynomials", () => {
  assert.equal(analyzeTaylor("taylor sin(x) order=5").answer, "x - 0.166667x^3 + 0.008333x^5");
  assert.equal(analyzeTaylor("maclaurin exp(x) degree=4").answer, "1 + x + 0.5x^2 + 0.166667x^3 + 0.041667x^4");
});

runTest("taylor mode expands around nonzero centers", () => {
  assert.equal(analyzeTaylor("taylor ln(x) around 1 order=3").answer, "(x - 1) - 0.5(x - 1)^2 + 0.333333(x - 1)^3");
});

runTest("laplace mode applies transform table and linearity", () => {
  const result = analyzeLaplaceTransform("laplace transform of sin(t) + 2t");
  const shifted = analyzeLaplaceTransform("laplace transform of exp(3t) + cos(2t)");

  assert.equal(result.summary, "Laplace transform");
  assert.equal(result.answer, "L{sin(t) + 2 * t} = 1/(s^2 + 1) + 2/s^2");
  assert.equal(artifactValue(result, "Laplace transform"), "1/(s^2 + 1) + 2/s^2");
  assert.equal(shifted.answer, "L{exp(3 * t) + cos(2 * t)} = 1/(s - 3) + s/(s^2 + 4)");
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
  assert.equal(artifactValue(result, "Slope SE"), "0.288675");
  assert.equal(artifactValue(result, "Slope p"), "0.121038");
  assert.equal(artifactValue(result, "Slope 95% CI"), "[-2.167965, 5.167965]");
  assert.deepEqual(result.table.rows[1], ["2", "3", "3.333333", "-0.333333"]);
});

runTest("statistics mode computes polynomial regression", () => {
  const result = analyzeStatistics("quadratic regression degree=2 for (1,2), (2,5), (3,10), (4,17); predict x=5");

  assert.equal(result.summary, "polynomial regression");
  assert.equal(result.answer, "y = 1 + x^2; prediction = 26");
  assert.equal(artifactValue(result, "R squared"), "1");
  assert.deepEqual(result.table.rows[3], ["4", "4", "17", "17", "0"]);
});

runTest("statistics mode computes multiple linear regression", () => {
  const result = analyzeStatistics("multiple regression y: 4, 7, 9, 12, 15; x1: 1, 2, 3, 4, 5; x2: 0, 1, 0, 1, 1; predict x1=6 x2=0");

  assert.equal(result.summary, "multiple linear regression");
  assert.equal(result.answer, "y = 1.3 + 2.6x1 + 0.5x2; prediction = 16.9");
  assert.equal(artifactValue(result, "R squared"), "0.998634");
  assert.equal(artifactValue(result, "x1 SE"), "0.086603");
  assert.equal(artifactValue(result, "x1 p"), "0.001108");
  assert.equal(artifactValue(result, "x2 95% CI"), "[-0.575663, 1.575663]");
});

runTest("statistics mode computes ridge regression", () => {
  const result = analyzeStatistics("ridge regression lambda=1 y: 4, 7, 9, 12, 15; x1: 1, 2, 3, 4, 5; x2: 0, 1, 0, 1, 1; predict x1=6 x2=0");

  assert.equal(result.summary, "ridge regression");
  assert.equal(result.answer, "y = 2.009901 + 2.366337x1 + 0.485149x2; prediction = 16.207921");
  assert.equal(artifactValue(result, "Lambda"), "1");
  assert.equal(artifactValue(result, "Ridge objective"), "6.49505");
  assert.deepEqual(result.table.rows[4], ["5", "15", "14.326733", "0.673267"]);
});

runTest("statistics mode computes LASSO regression", () => {
  const result = analyzeStatistics("lasso regression lambda=1 y: 4, 7, 9, 12, 15; x1: 1, 2, 3, 4, 5; x2: 0, 1, 0, 1, 1; predict x1=6 x2=0");

  assert.equal(result.summary, "LASSO regression");
  assert.equal(result.answer, "y = 2.248683 + 2.383772x1 + 0x2; prediction = 16.551317");
  assert.equal(artifactValue(result, "Coefficient x2"), "0");
  assert.equal(artifactValue(result, "Active predictors"), "1");
  assert.equal(artifactValue(result, "LASSO objective"), "8.18815");
  assert.deepEqual(result.table.rows[4], ["5", "15", "14.167544", "0.832456"]);
});

runTest("statistics mode computes logistic regression", () => {
  const result = analyzeStatistics("logistic regression y: 0,0,1,0,1,1; x: 1,2,3,4,5,6; predict x=4.5");

  assert.equal(result.summary, "logistic regression");
  assert.equal(result.answer, "logit(p) = -4.249097 + 1.214028x; P(y=1) = 0.771011");
  assert.equal(artifactValue(result, "McFadden R squared"), "0.40417");
  assert.equal(artifactValue(result, "Predicted probability"), "0.771011");
});

runTest("statistics mode computes Gaussian Naive Bayes classifiers", () => {
  const result = analyzeStatistics("naive bayes class: 0, 0, 0, 1, 1, 1; x1: 1, 2, 1.5, 5, 6, 5.5; x2: 1, 1.2, 0.8, 5, 5.5, 4.8; predict x1=3.1 x2=2.6");

  assert.equal(result.summary, "Gaussian Naive Bayes");
  assert.equal(result.answer, "predicted class = 1");
  assert.equal(artifactValue(result, "Posterior class 0"), "0.27444");
  assert.equal(artifactValue(result, "Posterior class 1"), "0.72556");
  assert.equal(artifactValue(result, "Class 1 x2 mean"), "5.1");
  assert.deepEqual(result.table.rows[0], ["1", "0", "0", "1"]);
});

runTest("statistics mode computes linear discriminant analysis classifiers", () => {
  const result = analyzeStatistics("lda class: 0, 0, 0, 1, 1, 1; x1: 1, 2, 1.5, 5, 6, 5.5; x2: 1, 1.2, 0.8, 5, 5.5, 4.8; regularization=0.001 predict x1=5.2 x2=5");

  assert.equal(result.summary, "linear discriminant analysis");
  assert.equal(result.answer, "predicted class = 1 (posterior = 1)");
  assert.equal(artifactValue(result, "Pooled covariance"), "[[0.25, 0.0875], [0.0875, 0.085]]");
  assert.equal(artifactValue(result, "Mean class 1"), "[5.5, 5.1]");
  assert.equal(artifactValue(result, "Discriminant weights class 0"), "[2.979235, 8.596708]");
  assert.equal(artifactValue(result, "Score gap"), "93.265852");
  assert.deepEqual(result.table.rows[5], ["6", "1", "1", "1", "83.197832"]);
});

runTest("statistics mode computes decision tree classifiers", () => {
  const result = analyzeStatistics("decision tree class: 0, 0, 0, 1, 1, 1; x1: 1, 2, 1.5, 5, 6, 5.5; x2: 1, 1.2, 0.8, 5, 5.5, 4.8; maxDepth=2 predict x1=5.2 x2=5");

  assert.equal(result.summary, "decision tree classifier");
  assert.equal(result.answer, "predicted class = 1");
  assert.equal(artifactValue(result, "Root split"), "x1 <= 3.5");
  assert.equal(artifactValue(result, "Training accuracy"), "1");
  assert.equal(artifactValue(result, "Rule 2"), "x1 > 3.5 => class 1 (1:3)");
  assert.equal(artifactValue(result, "Prediction path"), "x1 > 3.5 -> leaf 1");
  assert.deepEqual(result.table.rows[5], ["6", "1", "1", "3"]);
});

runTest("statistics mode computes random forest classifiers", () => {
  const result = analyzeStatistics("random forest class: 0, 0, 0, 1, 1, 1; x1: 1, 2, 1.5, 5, 6, 5.5; x2: 1, 1.2, 0.8, 5, 5.5, 4.8; trees=9 maxDepth=2 seed=7 predict x1=5.2 x2=5");

  assert.equal(result.summary, "random forest classifier");
  assert.equal(result.answer, "predicted class = 1 (vote confidence = 1)");
  assert.equal(artifactValue(result, "Trees"), "9");
  assert.equal(artifactValue(result, "Mtry"), "1");
  assert.equal(artifactValue(result, "OOB accuracy"), "1");
  assert.equal(artifactValue(result, "Prediction votes"), "1:9");
  assert.equal(artifactValue(result, "Tree 3 root"), "x2 <= 2.9; depth 1; nodes 3");
  assert.deepEqual(result.table.rows[0], ["1", "0", "0", "1", "0"]);
});

runTest("statistics mode computes ROC AUC analysis", () => {
  const result = analyzeStatistics("roc actual: 1, 1, 0, 1, 0, 0; scores: 0.9, 0.75, 0.6, 0.55, 0.3, 0.1");

  assert.equal(result.summary, "ROC/AUC analysis");
  assert.equal(result.answer, "AUC = 0.888889, best threshold = 0.75");
  assert.equal(artifactValue(result, "Best Youden J"), "0.666667");
  assert.equal(artifactValue(result, "True positives"), "2");
  assert.equal(artifactValue(result, "False positives"), "0");
  assert.deepEqual(result.table.rows[1], ["0.75", "0.666667", "0", "1", "1", "0.833333", "0.666667"]);
});

runTest("statistics mode computes Poisson regression", () => {
  const result = analyzeStatistics("poisson regression y: 1, 2, 1, 3, 4, 5; x: 0, 1, 2, 3, 4, 5; predict x=6");

  assert.equal(result.summary, "Poisson regression");
  assert.equal(result.answer, "log(lambda) = 0.041683 + 0.318303x; expected count = 7.039251");
  assert.equal(artifactValue(result, "Coefficient x"), "0.318303");
  assert.equal(artifactValue(result, "Deviance"), "0.838403");
  assert.deepEqual(result.table.rows[5], ["6", "5", "5.120226", "-0.120226"]);
});

runTest("statistics mode computes AR(1) time-series forecasts", () => {
  const result = analyzeStatistics("ar(1) series: 10, 12, 13, 15, 16, 18 forecast=3");

  assert.equal(result.summary, "AR(1) time-series forecast");
  assert.equal(result.answer, "3-step forecast = 22.30573");
  assert.equal(artifactValue(result, "Lag coefficient phi"), "0.973684");
  assert.equal(artifactValue(result, "Innovation SD"), "0.628281");
  assert.deepEqual(result.table.rows[2], ["3", "22.30573"]);
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

runTest("statistics mode computes bootstrap confidence intervals", () => {
  const meanResult = analyzeStatistics("bootstrap mean data 10, 12, 14, 16, 18 resamples=1000 seed=7 confidence=95");
  const medianResult = analyzeStatistics("bootstrap median data 1, 2, 4, 8, 16 resamples=1000 seed=7 confidence=90");

  assert.equal(meanResult.summary, "bootstrap confidence interval");
  assert.equal(meanResult.answer, "bootstrap 95% CI for mean = [11.6, 16.4]");
  assert.equal(artifactValue(meanResult, "Observed statistic"), "14");
  assert.equal(medianResult.answer, "bootstrap 90% CI for median = [1, 8]");
});

runTest("statistics mode computes permutation tests", () => {
  const meanResult = analyzeStatistics("permutation test group1: 10, 12, 9; group2: 8, 7, 11 resamples=2000 seed=5");
  const medianResult = analyzeStatistics("permutation median test group1: 1, 2, 3, 4; group2: 4, 5, 6, 7 resamples=2000 seed=5");

  assert.equal(meanResult.summary, "permutation test");
  assert.equal(meanResult.answer, "permutation p = 0.37931");
  assert.equal(artifactValue(meanResult, "Observed difference"), "1.666667");
  assert.equal(medianResult.answer, "permutation p = 0.055472");
});

runTest("statistics mode computes Kaplan-Meier survival estimates", () => {
  const result = analyzeStatistics("kaplan-meier times: 5, 6, 6, 8, 10; events: 1, 1, 0, 1, 0");

  assert.equal(result.summary, "Kaplan-Meier survival");
  assert.equal(result.answer, "median survival = 8");
  assert.equal(artifactValue(result, "Final survival"), "0.3");
  assert.deepEqual(result.table.rows[1], ["6", "4", "1", "1", "0.6", "0.219089"]);
});

runTest("statistics mode computes log-rank survival tests", () => {
  const result = analyzeStatistics("log-rank group1 times: 5, 6, 6, 8, 10 events: 1, 1, 0, 1, 0; group2 times: 4, 6, 7, 9, 12 events: 1, 0, 1, 1, 0");

  assert.equal(result.summary, "log-rank test");
  assert.equal(result.answer, "chi-square = 0.030544, p = 0.838133");
  assert.equal(artifactValue(result, "Expected group 1 events"), "2.788889");
  assert.deepEqual(result.table.rows[0], ["4", "5", "5", "0", "1", "0.5"]);
});

runTest("statistics mode computes Cox proportional hazards regression", () => {
  const result = analyzeStatistics("cox regression times: 5, 6, 6, 8, 10, 12; events: 1, 1, 0, 1, 0, 1; x: 0, 1, 0, 1, 1, 0");

  assert.equal(result.summary, "Cox proportional hazards");
  assert.equal(result.answer, "hazard ratio = 1.40515, p = 0.783144");
  assert.equal(artifactValue(result, "Coefficient beta"), "0.340144");
  assert.deepEqual(result.table.rows[1], ["6", "1", "5", "1", "0.678221"]);
});

runTest("statistics mode computes one-proportion confidence intervals", () => {
  const result = analyzeStatistics("proportion ci successes=42 n=100 confidence=95");

  assert.equal(result.summary, "one-proportion confidence interval");
  assert.equal(result.answer, "95% CI for p = [0.323264, 0.516736]");
  assert.equal(artifactValue(result, "Sample proportion"), "0.42");
});

runTest("statistics mode computes power and sample-size analysis", () => {
  const meanPower = analyzeStatistics("power mean effect=0.5 n=64 alpha=0.05");
  const meanSampleSize = analyzeStatistics("sample size mean effect=0.5 power=0.8 alpha=0.05");
  const proportionPower = analyzeStatistics("power proportion p0=0.5 p1=0.6 n=200 alpha=0.05");
  const twoSampleSize = analyzeStatistics("sample size two-sample effect=0.5 power=0.8 alpha=0.05");

  assert.equal(meanPower.summary, "statistical power");
  assert.equal(meanPower.answer, "power = 0.979327");
  assert.equal(meanSampleSize.summary, "sample size analysis");
  assert.equal(meanSampleSize.answer, "n = 32 for power ~= 0.807431");
  assert.equal(proportionPower.answer, "power = 0.812292");
  assert.equal(twoSampleSize.answer, "n per group = 63 for power ~= 0.801303");
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

runTest("statistics mode computes multivariate statistics and PCA", () => {
  const covariance = analyzeStatistics("covariance matrix x: 1,2,3,4; y: 2,3,5,8");
  const correlation = analyzeStatistics("correlation matrix x: 1,2,3,4; y: 2,3,5,8");
  const pca = analyzeStatistics("pca x: 1,2,3,4; y: 2,3,5,8");

  assert.equal(covariance.summary, "covariance matrix");
  assert.equal(covariance.answer, "covariance matrix = [[1.666667, 3.333333], [3.333333, 7]]");
  assert.equal(correlation.answer, "correlation matrix = [[1, 0.9759], [0.9759, 1]]");
  assert.equal(pca.summary, "principal component analysis");
  assert.equal(pca.answer, "PC1 variance = 8.602083, explained = 99.254802%; direction = [0.433189, 0.901303]");
  assert.equal(artifactValue(pca, "PC2 direction"), "[0.901303, -0.433189]");
});

runTest("statistics mode computes k-means clustering", () => {
  const result = analyzeStatistics("k-means k=3 points (1,1), (1,2), (5,5), (6,5), (10,10), (10,11)");

  assert.equal(result.summary, "k-means clustering");
  assert.equal(result.answer, "centroids = [[1, 1.5], [10, 10.5], [5.5, 5]]; SSE = 1.5");
  assert.equal(artifactValue(result, "Cluster sizes"), "2, 2, 2");
  assert.deepEqual(result.table.rows[2], ["[5, 5]", "3", "0.25"]);
});

runTest("statistics mode applies Bayes theorem", () => {
  const result = analyzeStatistics("bayes prior=0.01 sensitivity=0.99 specificity=0.95");

  assert.equal(result.summary, "Bayes theorem");
  assert.equal(result.answer, "P(H | positive) = 0.166667");
  assert.equal(artifactValue(result, "False positive rate"), "0.05");
});

runTest("statistics mode computes Markov chains", () => {
  const distribution = analyzeMarkovChain("markov [[0.7,0.3],[0.2,0.8]] start [1,0] steps=3");
  const stationary = analyzeStatistics("stationary markov [[0.7,0.3],[0.2,0.8]]");

  assert.equal(distribution.summary, "Markov n-step distribution");
  assert.equal(distribution.answer, "after 3 steps = [0.475, 0.525]");
  assert.equal(stationary.summary, "Markov stationary distribution");
  assert.equal(stationary.answer, "stationary = [0.4, 0.6]");
});

runTest("statistics mode computes Bayesian beta-binomial posteriors", () => {
  const posterior = analyzeStatistics("beta posterior successes=12 n=20 alpha=2 beta=2 confidence=95");
  const predictive = analyzeStatistics("bayesian proportion successes=12 n=20 alpha=2 beta=2 future=10 k=6");
  const credible = analyzeStatistics("beta-binomial successes=8 n=10 alpha=1 beta=1 credible interval=0.9");

  assert.equal(posterior.summary, "Bayesian proportion posterior");
  assert.equal(posterior.answer, "posterior Beta(14, 10), mean = 0.583333");
  assert.equal(artifactValue(posterior, "95% credible interval"), "[0.385419, 0.768086]");
  assert.equal(artifactValue(predictive, "P(X = 6 of 10)"), "0.209585");
  assert.equal(artifactValue(credible, "90% credible interval"), "[0.529913, 0.92118]");
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

runTest("matrix mode computes QR decompositions", () => {
  const result = analyzeMatrix("qr [[1,1],[1,0],[0,1]]");

  assert.equal(result.summary, "QR decomposition");
  assert.equal(result.answer, "Q = [[0.707107, 0.408248], [0.707107, -0.408248], [0, 0.816497]]; R = [[1.414214, 0.707107], [0, 1.224745]]");
  assert.equal(artifactValue(result, "Q * R"), "[[1, 1], [1, 0], [0, 1]]");
});

runTest("matrix mode computes singular value decompositions", () => {
  const result = analyzeMatrix("svd [[3,1],[1,3]]");

  assert.equal(result.summary, "singular value decomposition");
  assert.equal(result.answer, "singular values = [4, 2]");
  assert.equal(artifactValue(result, "U * Sigma * V^T"), "[[3, 1], [1, 3]]");
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

runTest("optimization mode solves linear programming problems", () => {
  const result = analyzeOptimization("linear programming maximize 3x + 2y subject to x + y <= 4; x <= 2; y <= 3; x >= 0; y >= 0");

  assert.equal(result.summary, "linear programming");
  assert.equal(result.answer, "maximum = 10 at x=2, y=2");
  assert.equal(artifactValue(result, "Feasible vertices"), "x=0, y=0; x=0, y=3; x=1, y=3; x=2, y=0; x=2, y=2");
  assert.deepEqual(result.table.rows.at(-1), ["2", "2", "10", "yes"]);
});

runTest("graph mode samples functions", () => {
  const result = analyzeGraph("graph x^2 - 4 from -2 to 2");

  assert.equal(result.summary, "function graph");
  assert.equal(result.graph.points.length, 121);
});

runTest("fourier mode computes partial series coefficients", () => {
  const result = analyzeFourierSeries("fourier series x from -pi to pi order=5");

  assert.equal(result.summary, "Fourier series");
  assert.equal(result.answer, "S_5(x) ~= 2sin(x) - sin(2x) + 0.666667sin(3x) - 0.5sin(4x) + 0.4sin(5x)");
  assert.deepEqual(result.table.rows.at(1), ["1", "0", "2"]);
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

runTest("numerical mode computes quadrature rules", () => {
  const simpson = analyzeNumerical("simpson integrate sin(x) from 0 to pi n=100");
  const trapezoid = analyzeNumerical("trapezoidal integrate x^2 from 0 to 3 n=6");

  assert.equal(simpson.summary, "simpson numerical integration");
  assert.equal(simpson.answer, "integral ~= 2");
  assert.equal(artifactValue(simpson, "Step size"), "0.031416");
  assert.equal(trapezoid.summary, "trapezoid numerical integration");
  assert.equal(trapezoid.answer, "integral ~= 9.125");
});

runTest("differential equation mode solves closed-form ODE models", () => {
  const exponential = analyzeDifferentialEquation("ode dy/dt = 0.3y y0=2 t=5");
  const logistic = analyzeDifferentialEquation("logistic r=0.4 K=100 y0=10 t=8");
  const cooling = analyzeDifferentialEquation("newton cooling ambient=70 initial=100 k=0.2 t=10");
  const power = analyzeDifferentialEquation("ode y'=2y^2 y0=1 t=0.25");

  assert.equal(exponential.summary, "exponential ODE");
  assert.equal(exponential.answer, "y(5) = 8.963378");
  assert.equal(logistic.summary, "logistic ODE");
  assert.equal(logistic.answer, "y(8) = 73.160391");
  assert.equal(cooling.summary, "Newton cooling");
  assert.equal(cooling.answer, "T(10) = 74.060058");
  assert.equal(power.summary, "separable power ODE");
  assert.equal(power.answer, "y(0.25) = 2");
});

runTest("differential equation mode runs numerical ODE methods", () => {
  const rk4 = analyzeDifferentialEquation("rk4 dy/dt = t + y y0=1 from t=0 to 1 h=0.25");
  const euler = analyzeDifferentialEquation("euler dy/dt = t + y y0=1 from t=0 to 1 h=0.25");

  assert.equal(rk4.summary, "RK4 numerical ODE");
  assert.equal(rk4.answer, "y(1) ~= 3.43642");
  assert.equal(artifactValue(rk4, "Step size"), "0.25");
  assert.equal(euler.summary, "Euler numerical ODE");
  assert.equal(euler.answer, "y(1) ~= 2.882813");
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
  assert.equal(analyzeUniversal("gradient x^2 + x*y + y^2 at x=1 y=2").summary, "gradient");
  assert.equal(analyzeUniversal("directional derivative x^2 + x*y + y^2 at x=1 y=2 direction [3,4]").answer, "D_u f = 6.4");
  assert.equal(analyzeUniversal("taylor sin(x) order=5").summary, "Maclaurin polynomial");
  assert.equal(analyzeUniversal("laplace transform of sin(t) + 2t").summary, "Laplace transform");
  assert.equal(analyzeUniversal("complex (3+4i)*(2-i)").answer, "10 + 5i");
  assert.equal(analyzeUniversal("maximize -x^2 + 4x + 1").summary, "critical points");
  assert.equal(analyzeUniversal("linear programming maximize 3x + 2y subject to x + y <= 4; x <= 2; y <= 3; x >= 0; y >= 0").summary, "linear programming");
  assert.equal(analyzeUniversal("graph x^2 from -1 to 1").summary, "function graph");
  assert.equal(analyzeUniversal("fourier series x from -pi to pi order=5").summary, "Fourier series");
  assert.equal(analyzeUniversal("newton x^3 - x - 2 guess=1").summary, "Newton root");
  assert.equal(analyzeUniversal("simpson integrate sin(x) from 0 to pi n=100").summary, "simpson numerical integration");
  assert.equal(analyzeUniversal("rk4 dy/dt = t + y y0=1 from t=0 to 1 h=0.25").summary, "RK4 numerical ODE");
  assert.equal(analyzeUniversal("ode dy/dt = 0.3y y0=2 t=5").summary, "exponential ODE");
  assert.equal(analyzeUniversal("newton cooling ambient=70 initial=100 k=0.2 t=10").summary, "Newton cooling");
  assert.equal(analyzeUniversal("proportion ci successes=42 n=100 confidence=95").summary, "one-proportion confidence interval");
  assert.equal(analyzeUniversal("bootstrap mean data 10, 12, 14, 16, 18 resamples=1000 seed=7 confidence=95").summary, "bootstrap confidence interval");
  assert.equal(analyzeUniversal("permutation test group1: 10, 12, 9; group2: 8, 7, 11 resamples=2000 seed=5").summary, "permutation test");
  assert.equal(analyzeUniversal("kaplan-meier times: 5, 6, 6, 8, 10; events: 1, 1, 0, 1, 0").summary, "Kaplan-Meier survival");
  assert.equal(analyzeUniversal("log-rank group1 times: 5, 6, 6, 8, 10 events: 1, 1, 0, 1, 0; group2 times: 4, 6, 7, 9, 12 events: 1, 0, 1, 1, 0").summary, "log-rank test");
  assert.equal(analyzeUniversal("cox regression times: 5, 6, 6, 8, 10, 12; events: 1, 1, 0, 1, 0, 1; x: 0, 1, 0, 1, 1, 0").summary, "Cox proportional hazards");
  assert.equal(analyzeUniversal("ar(1) series: 10, 12, 13, 15, 16, 18 forecast=3").summary, "AR(1) time-series forecast");
  assert.equal(analyzeUniversal("sample size mean effect=0.5 power=0.8 alpha=0.05").summary, "sample size analysis");
  assert.equal(analyzeUniversal("quadratic regression degree=2 for (1,2), (2,5), (3,10), (4,17); predict x=5").summary, "polynomial regression");
  assert.equal(analyzeUniversal("multiple regression y: 4, 7, 9, 12, 15; x1: 1, 2, 3, 4, 5; x2: 0, 1, 0, 1, 1; predict x1=6 x2=0").summary, "multiple linear regression");
  assert.equal(analyzeUniversal("ridge regression lambda=1 y: 4, 7, 9, 12, 15; x1: 1, 2, 3, 4, 5; x2: 0, 1, 0, 1, 1; predict x1=6 x2=0").summary, "ridge regression");
  assert.equal(analyzeUniversal("lasso regression lambda=1 y: 4, 7, 9, 12, 15; x1: 1, 2, 3, 4, 5; x2: 0, 1, 0, 1, 1; predict x1=6 x2=0").summary, "LASSO regression");
  assert.equal(analyzeUniversal("logistic regression y: 0,0,1,0,1,1; x: 1,2,3,4,5,6; predict x=4.5").summary, "logistic regression");
  assert.equal(analyzeUniversal("naive bayes class: 0, 0, 0, 1, 1, 1; x1: 1, 2, 1.5, 5, 6, 5.5; x2: 1, 1.2, 0.8, 5, 5.5, 4.8; predict x1=3.1 x2=2.6").summary, "Gaussian Naive Bayes");
  assert.equal(analyzeUniversal("lda class: 0, 0, 0, 1, 1, 1; x1: 1, 2, 1.5, 5, 6, 5.5; x2: 1, 1.2, 0.8, 5, 5.5, 4.8; regularization=0.001 predict x1=5.2 x2=5").summary, "linear discriminant analysis");
  assert.equal(analyzeUniversal("random forest class: 0, 0, 0, 1, 1, 1; x1: 1, 2, 1.5, 5, 6, 5.5; x2: 1, 1.2, 0.8, 5, 5.5, 4.8; trees=9 maxDepth=2 seed=7 predict x1=5.2 x2=5").summary, "random forest classifier");
  assert.equal(analyzeUniversal("roc actual: 1, 1, 0, 1, 0, 0; scores: 0.9, 0.75, 0.6, 0.55, 0.3, 0.1").summary, "ROC/AUC analysis");
  assert.equal(analyzeUniversal("poisson regression y: 1, 2, 1, 3, 4, 5; x: 0, 1, 2, 3, 4, 5; predict x=6").summary, "Poisson regression");
  assert.equal(analyzeUniversal("pca x: 1,2,3,4; y: 2,3,5,8").summary, "principal component analysis");
  assert.equal(analyzeUniversal("correlation matrix x: 1,2,3,4; y: 2,3,5,8").answer, "correlation matrix = [[1, 0.9759], [0.9759, 1]]");
  assert.equal(analyzeUniversal("k-means k=3 points (1,1), (1,2), (5,5), (6,5), (10,10), (10,11)").summary, "k-means clustering");
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
  assert.equal(analyzeUniversal("markov [[0.7,0.3],[0.2,0.8]] start [1,0] steps=3").answer, "after 3 steps = [0.475, 0.525]");
  assert.equal(analyzeUniversal("stationary markov [[0.7,0.3],[0.2,0.8]]").summary, "Markov stationary distribution");
  assert.equal(analyzeUniversal("beta posterior successes=12 n=20 alpha=2 beta=2 confidence=95").summary, "Bayesian proportion posterior");
  assert.equal(analyzeUniversal("mann-whitney group1: 10,12,9; group2: 8,7,11").summary, "Mann-Whitney U test");
  assert.equal(analyzeUniversal("wilcoxon signed-rank before: 10,12,9,11; after: 11,14,10,13").summary, "Wilcoxon signed-rank test");
  assert.equal(analyzeUniversal("kruskal-wallis group1: 8,9,10; group2: 12,13,14; group3: 9,11,10").summary, "Kruskal-Wallis test");
  assert.equal(analyzeUniversal("rank [[1,2],[2,4]]").summary, "matrix rank");
  assert.equal(analyzeUniversal("qr [[1,1],[1,0],[0,1]]").summary, "QR decomposition");
  assert.equal(analyzeUniversal("svd [[3,1],[1,3]]").summary, "singular value decomposition");
  assert.equal(analyzeUniversal("eigen [[2,1],[1,2]]").summary, "2x2 eigenvalues");
  assert.equal(analyzeUniversal("nullspace [[1,2,1],[2,4,2],[1,1,0]]").summary, "matrix null space");
  assert.equal(analyzeUniversal("eigenvectors [[2,1],[1,2]]").summary, "2x2 eigenvectors");
  assert.equal(analyzeUniversal("dot [1,2,3] [4,5,6]").summary, "dot product");
  assert.equal(analyzeUniversal("angle between [1,0] [0,1]").summary, "vector angle");
  assert.equal(analyzeUniversal("arithmetic sequence a1=3 d=5 n=10").summary, "arithmetic sequence");
  assert.equal(analyzeUniversal("sum k^2 from k=1 to 5").answer, "sum = 55");
  assert.equal(analyzeUniversal("circle radius=3").summary, "circle geometry");
  assert.equal(analyzeUniversal("distance between (1,2) and (4,6)").summary, "coordinate distance");
});
