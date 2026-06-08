import assert from "node:assert/strict";

import {
  analyzeDerivative,
  analyzeEquation,
  analyzeLogic,
  analyzeSimplification,
  analyzeStatistics,
  analyzeSystem,
  analyzeUniversal,
} from "./solver-engine.mjs";

function runTest(name, callback) {
  callback();
  console.log(`ok - ${name}`);
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

runTest("system solver handles two-variable systems", () => {
  const result = analyzeSystem("2x + y = 5; x - y = 1");

  assert.equal(result.summary, "linear system");
  assert.equal(result.answer, "x = 2, y = 1");
});

runTest("equation mode approximates higher-degree real roots", () => {
  const result = analyzeEquation("x^3 - x - 2 = 0", "x");

  assert.equal(result.summary, "numeric roots");
  assert.equal(result.answer, "x ≈ 1.52138");
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
