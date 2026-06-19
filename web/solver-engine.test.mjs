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
  analyzeLogicBdd,
  analyzeLogicKarnaughMap,
  analyzeLogicNormalForm,
  analyzeLogicSat,
  analyzeLogicSimplification,
  analyzeLogicTableau,
  analyzeLogicTruthValue,
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
  analyzeTreeExport,
  analyzeUniversal,
  analyzeVector,
  suggestProblemHelp,
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

runTest("logic mode simplifies Boolean algebra", () => {
  assert.equal(analyzeLogicSimplification("P and true").answer, "P");
  assert.equal(analyzeLogicSimplification("P or false").answer, "P");
  assert.equal(analyzeLogicSimplification("P and P").answer, "P");
  assert.equal(analyzeLogicSimplification("P or not P").answer, "true");
  assert.equal(analyzeLogicSimplification("not not P").answer, "P");
  assert.equal(analyzeLogicSimplification("not (P and Q)").answer, "not P or not Q");
  assert.equal(analyzeLogicSimplification("P and (not P)").answer, "false");
  assert.equal(analyzeLogicSimplification("P -> false").answer, "not P");
  assert.equal(analyzeLogicSimplification("P xor P").answer, "false");
  assert.equal(analyzeLogicSimplification("P or (P and Q)").answer, "P");
  assert.equal(analyzeLogicSimplification("P and (P or Q)").answer, "P");
  assert.equal(analyzeLogicSimplification("(P and Q) or (P and not Q)").answer, "P");
  assert.equal(analyzeLogicSimplification("(P and Q) or (P and Q and R)").answer, "P and Q");
  assert.equal(analyzeLogicSimplification("(P and Q) or (not P and R) or (Q and R)").answer, "P and Q or not P and R");
  assert.equal(analyzeLogicSimplification("(P or Q) and (P or not Q)").answer, "P");
  assert.equal(analyzeLogicSimplification("(P or Q or R) and (P or not Q or R)").answer, "P or R");
  assert.equal(analyzeUniversal("simplify logic not (P and Q)").answer, "not P or not Q");
});

runTest("logic mode converts to normal forms", () => {
  const cnf = analyzeLogicNormalForm("cnf P -> (Q and R)");
  const dnf = analyzeLogicNormalForm("dnf P and (Q or R)");
  const nnf = analyzeLogicNormalForm("nnf not (P -> Q)");
  const all = analyzeLogicNormalForm("normal forms (P xor Q) -> R");

  assert.equal(cnf.summary, "CNF logic normal form");
  assert.equal(cnf.answer, "(not P or Q) and (not P or R)");
  assert.equal(artifactValue(cnf, "Equivalent"), "yes");
  assert.equal(dnf.answer, "P and Q or P and R");
  assert.equal(nnf.answer, "P and (not Q)");
  assert.equal(all.answer, "NNF: (not P or Q) and (P or not Q) or R; CNF: (not P or Q or R) and (P or not Q or R); DNF: not P and (not Q) or Q and P or R");
  assert.equal(analyzeUniversal("convert P -> Q to cnf").answer, "not P or Q");
});

runTest("logic mode solves SAT with DPLL", () => {
  const sat = analyzeLogicSat("sat (P or Q) and (not P or not Q)");
  const unsat = analyzeLogicSat("sat P and not P");

  assert.equal(sat.summary, "SAT satisfiable");
  assert.equal(sat.answer, "satisfiable: P=true, Q=false");
  assert.equal(artifactValue(sat, "Clauses"), "P or Q; not P or not Q");
  assert.equal(artifactValue(sat, "Decisions"), "1");
  assert.equal(artifactValue(sat, "Unit propagations"), "1");
  assert.deepEqual(sat.extraTables[0].rows.slice(0, 2), [["1", "branch P=true", "P=true"], ["2", "unit not Q", "P=true, Q=false"]]);
  assert.equal(unsat.summary, "SAT unsatisfiable");
  assert.equal(unsat.answer, "unsatisfiable");
  assert.equal(artifactValue(unsat, "Clauses"), "empty");
  assert.equal(artifactValue(unsat, "DPLL result"), "unsatisfiable");
  assert.equal(artifactValue(unsat, "Unsat core"), "#1: empty");
  assert.equal(analyzeUniversal("sat (P or Q) and (not P or not Q)").summary, "SAT satisfiable");
});

runTest("logic mode extracts SAT unsat cores", () => {
  const result = analyzeLogicSat("sat (P or Q) and not P and not Q and (R or S)");

  assert.equal(result.summary, "SAT unsatisfiable");
  assert.equal(artifactValue(result, "Clauses"), "P or Q; not P; not Q; R or S");
  assert.equal(artifactValue(result, "Unsat core"), "#1: P or Q; #2: not P; #3: not Q");
  assert.equal(artifactValue(result, "Unsat core size"), "3 of 4 clauses");
  assert.deepEqual(result.extraTables.map((table) => table.title), ["DPLL trace", "Unsat core"]);
  assert.deepEqual(result.extraTables[1].rows, [["1", "P or Q"], ["2", "not P"], ["3", "not Q"]]);
});

runTest("logic mode proves statements with semantic tableaux", () => {
  const valid = analyzeLogicTableau("tableau P -> P");
  const satisfiable = analyzeLogicTableau("tableau satisfiable (P or Q) and not P");
  const unsatisfiable = analyzeLogicTableau("tableau unsatisfiable P and not P");

  assert.equal(valid.summary, "tableau valid");
  assert.equal(valid.answer, "valid: every countermodel branch closes");
  assert.equal(artifactValue(valid, "Closed branches"), "1");
  assert.equal(valid.table.rows[0][1], "closed");
  assert.ok(valid.extraTables[0].rows.some((row) => row[2].includes("alpha")));

  assert.equal(satisfiable.summary, "tableau satisfiable");
  assert.equal(satisfiable.answer, "satisfiable: P=false, Q=true");
  assert.equal(artifactValue(satisfiable, "Open branches"), "1");
  assert.ok(satisfiable.table.rows.some((row) => row[1] === "open" && row[2].includes("T Q")));

  assert.equal(unsatisfiable.summary, "tableau unsatisfiable");
  assert.equal(unsatisfiable.answer, "unsatisfiable: every truth branch closes");
  assert.equal(artifactValue(unsatisfiable, "Open branches"), "0");
  assert.equal(analyzeUniversal("tableau P -> P").summary, "tableau valid");
});

runTest("logic mode builds Karnaugh maps", () => {
  const twoVariable = analyzeLogicKarnaughMap("kmap P or Q");
  const threeVariable = analyzeLogicKarnaughMap("kmap (P and Q) or (P and R)");

  assert.equal(twoVariable.summary, "Karnaugh map");
  assert.equal(twoVariable.answer, "simplified SOP: P or Q");
  assert.deepEqual(twoVariable.table.headers, ["P\\Q", "Q=0", "Q=1"]);
  assert.deepEqual(twoVariable.table.rows, [["P=0", "0", "1 m1"], ["P=1", "1 m2", "1 m3"]]);
  assert.equal(artifactValue(twoVariable, "Minterms"), "m1, m2, m3");
  assert.equal(artifactValue(twoVariable, "Selected groups"), "m2,m3 -> P; m1,m3 -> Q");
  assert.equal(twoVariable.extraTables[0].rows.length, 2);

  assert.equal(threeVariable.answer, "simplified SOP: P and Q or P and R");
  assert.equal(artifactValue(threeVariable, "Minterms"), "m5, m6, m7");
  assert.equal(artifactValue(threeVariable, "Selected groups"), "m6,m7 -> P and Q; m5,m7 -> P and R");
  assert.equal(analyzeUniversal("kmap P or Q").summary, "Karnaugh map");
});

runTest("logic mode uses Karnaugh-map don't-care cells", () => {
  const result = analyzeLogicKarnaughMap("kmap P and not Q with don't cares m3");

  assert.equal(result.answer, "simplified SOP: P");
  assert.deepEqual(result.table.rows, [["P=0", "0", "0"], ["P=1", "1 m2", "X m3"]]);
  assert.equal(artifactValue(result, "Minterms"), "m2");
  assert.equal(artifactValue(result, "Don't cares"), "x3");
  assert.equal(artifactValue(result, "Selected groups"), "m2,x3 -> P");
  assert.deepEqual(result.extraTables[0].rows, [["1", "m2,x3", "P", "2"]]);
  assert.equal(analyzeUniversal("kmap P and not Q with don't cares m3").summary, "Karnaugh map");
});

runTest("logic mode builds reduced ordered BDDs", () => {
  const result = analyzeLogicBdd("bdd (P and Q) or (P and R)");
  const dot = artifactValue(result, "BDD Graphviz DOT");

  assert.equal(result.summary, "Reduced ordered BDD");
  assert.equal(result.answer, "reduced BDD root n4 with 3 decision nodes");
  assert.deepEqual(result.table.rows, [
    ["T0", "false", "-", "-"],
    ["T1", "true", "-", "-"],
    ["n2", "R", "T0", "T1"],
    ["n3", "Q", "n2", "T1"],
    ["n4", "P", "T0", "n3"],
  ]);
  assert.deepEqual(result.extraTables[0].rows, [
    ["1", "P=true, Q=false, R=true", "TRUE"],
    ["2", "P=true, Q=true, R=*", "TRUE"],
  ]);
  assert.equal(artifactValue(result, "Variable order"), "P < Q < R");
  assert.equal(artifactValue(result, "Compression"), "3/7 decision nodes");
  assert.equal(artifactValue(result, "Equivalent truth table"), "yes");
  assert.ok(dot.startsWith("digraph BinaryDecisionDiagram"));
  assert.ok(dot.includes("n4 -> T0"));
  assert.equal(analyzeUniversal("bdd (P and Q) or (P and R)").summary, "Reduced ordered BDD");
});

runTest("logic mode evaluates fuzzy and probabilistic truth values", () => {
  const fuzzy = analyzeLogicTruthValue("fuzzy logic (P and Q) or not R with P=0.8 Q=0.6 R=0.3");
  const probability = analyzeLogicTruthValue("probabilistic logic P or Q with P=0.2 Q=0.5");
  const product = analyzeLogicTruthValue("fuzzy product logic P or Q with P=0.8 Q=0.6");
  const lukasiewicz = analyzeLogicTruthValue("fuzzy logic P and Q with P=0.8 Q=0.6 tnorm=lukasiewicz");
  const interval = analyzeLogicTruthValue("interval fuzzy logic P or Q with P=[0.2,0.5] Q=[0.4,0.7]");
  const intervalProduct = analyzeLogicTruthValue("interval fuzzy product logic P or Q with P=[0.2,0.5] Q=[0.4,0.7]");
  const correlated = analyzeLogicTruthValue("correlated probability logic P or Q with P=0.6 Q=0.5 joint(P,Q)=0.35");
  const correlatedFromRho = analyzeLogicTruthValue("correlated probability logic P and Q with P=0.6 Q=0.5 corr(P,Q)=0.5");
  const conditional = analyzeLogicTruthValue("conditional probability logic P or Q with P=0.6 cond(Q|P)=0.8 cond(Q|not P)=0.3");
  const bayesianNetwork = analyzeLogicTruthValue("bayesian network probability logic P or R with P=0.6 cond(Q|P)=0.8 cond(Q|not P)=0.3 cond(R|Q)=0.7 cond(R|not Q)=0.2");
  const bayesianEvidence = analyzeLogicTruthValue("bayesian network probability logic P given R with P=0.6 cond(Q|P)=0.8 cond(Q|not P)=0.3 cond(R|Q)=0.7 cond(R|not Q)=0.2");
  const bayesianMultiParent = analyzeLogicTruthValue("bayesian network probability logic R given P with P=0.6 Q=0.5 cond(R|P,Q)=0.95 cond(R|P,not Q)=0.7 cond(R|not P,Q)=0.4 cond(R|not P,not Q)=0.05");

  assert.equal(fuzzy.summary, "Fuzzy logic truth value");
  assert.equal(fuzzy.answer, "fuzzy truth = 0.7");
  assert.equal(artifactValue(fuzzy, "Semantics"), "fuzzy min/max");
  assert.equal(artifactValue(fuzzy, "T-norm"), "minimum");
  assert.equal(artifactValue(fuzzy, "Assignments"), "P=0.8, Q=0.6, R=0.3");
  assert.deepEqual(fuzzy.table.rows.slice(-2), [
    ["not R", "not: 1 - 0.3", "0.7"],
    ["P and Q or not R", "or: max(0.6, 0.7)", "0.7"],
  ]);

  assert.equal(product.answer, "fuzzy truth = 0.92");
  assert.equal(artifactValue(product, "Semantics"), "fuzzy product t-norm");
  assert.equal(artifactValue(product, "T-norm"), "product");
  assert.deepEqual(product.table.rows.slice(-1), [["P or Q", "or: 0.8 + 0.6 - 0.8*0.6", "0.92"]]);

  assert.equal(lukasiewicz.answer, "fuzzy truth = 0.4");
  assert.equal(artifactValue(lukasiewicz, "Semantics"), "fuzzy Lukasiewicz t-norm");
  assert.equal(artifactValue(lukasiewicz, "T-norm"), "lukasiewicz");
  assert.deepEqual(lukasiewicz.table.rows.slice(-1), [["P and Q", "and: max(0, 0.8 + 0.6 - 1)", "0.4"]]);

  assert.equal(interval.summary, "Interval fuzzy logic truth value");
  assert.equal(interval.answer, "fuzzy truth interval = [0.4, 0.7]");
  assert.equal(artifactValue(interval, "Semantics"), "interval-valued fuzzy min/max");
  assert.equal(artifactValue(interval, "Assignments"), "P=[0.2, 0.5], Q=[0.4, 0.7]");
  assert.deepEqual(interval.table.rows.slice(-1), [["P or Q", "or: interval max s-norm", "[0.4, 0.7]"]]);

  assert.equal(intervalProduct.answer, "fuzzy truth interval = [0.52, 0.85]");
  assert.equal(artifactValue(intervalProduct, "Semantics"), "interval-valued fuzzy product t-norm");
  assert.equal(artifactValue(intervalProduct, "T-norm"), "product");
  assert.deepEqual(intervalProduct.table.rows.slice(-1), [["P or Q", "or: interval product s-norm", "[0.52, 0.85]"]]);

  assert.equal(probability.summary, "Probabilistic logic truth value");
  assert.equal(probability.answer, "probability = 0.6");
  assert.equal(artifactValue(probability, "Semantics"), "independent probability");
  assert.deepEqual(probability.table.rows.slice(-1), [["P or Q", "or: P(A)+P(B)-P(A)P(B)", "0.6"]]);

  assert.equal(correlated.summary, "Correlated probabilistic logic truth value");
  assert.equal(correlated.answer, "probability = 0.75");
  assert.equal(artifactValue(correlated, "Semantics"), "correlated probability");
  assert.equal(artifactValue(correlated, "Dependence"), "joint(P,Q)=0.35");
  assert.equal(artifactValue(correlated, "P(P and Q)"), "0.35");
  assert.equal(artifactValue(correlated, "Correlation"), "0.204124");
  assert.deepEqual(correlated.table.rows.slice(-1), [["P or Q", "or: correlated joint distribution sum", "0.75"]]);
  assert.deepEqual(correlated.extraTables[0].rows, [
    ["P=true, Q=true", "0.35"],
    ["P=true, Q=false", "0.25"],
    ["P=false, Q=true", "0.15"],
    ["P=false, Q=false", "0.25"],
  ]);

  assert.equal(correlatedFromRho.answer, "probability = 0.422474");
  assert.equal(artifactValue(correlatedFromRho, "Dependence"), "corr(P,Q)=0.5");
  assert.equal(artifactValue(correlatedFromRho, "P(P and Q)"), "0.422474");

  assert.equal(conditional.summary, "Conditional probabilistic logic truth value");
  assert.equal(conditional.answer, "probability = 0.72");
  assert.equal(artifactValue(conditional, "Semantics"), "conditional probability table");
  assert.equal(artifactValue(conditional, "Assignments"), "P=0.6, Q=0.6");
  assert.equal(artifactValue(conditional, "Dependence"), "cond(Q|P)=0.8, cond(Q|not P)=0.3");
  assert.equal(artifactValue(conditional, "P(P and Q)"), "0.48");
  assert.equal(artifactValue(conditional, "Derived child marginal"), "P(Q)=0.6");
  assert.deepEqual(conditional.table.rows.slice(-1), [["P or Q", "or: conditional joint distribution sum", "0.72"]]);
  assert.deepEqual(conditional.extraTables[0].rows, [
    ["P=true, Q=true", "0.48"],
    ["P=true, Q=false", "0.12"],
    ["P=false, Q=true", "0.12"],
    ["P=false, Q=false", "0.28"],
  ]);

  assert.equal(bayesianNetwork.summary, "Bayesian network probabilistic logic truth value");
  assert.equal(bayesianNetwork.answer, "probability = 0.74");
  assert.equal(artifactValue(bayesianNetwork, "Semantics"), "binary Bayesian network");
  assert.equal(artifactValue(bayesianNetwork, "Assignments"), "P=0.6, Q=0.6, R=0.5");
  assert.equal(artifactValue(bayesianNetwork, "Network"), "P -> Q, Q -> R");
  assert.equal(artifactValue(bayesianNetwork, "Root marginals"), "P=0.6");
  assert.equal(artifactValue(bayesianNetwork, "State count"), "8");
  assert.deepEqual(bayesianNetwork.table.rows.slice(-1), [["P or R", "or: bayesian network joint distribution sum", "0.74"]]);
  assert.deepEqual(bayesianNetwork.extraTables[0].rows, [
    ["P=true, Q=true, R=true", "0.336"],
    ["P=true, Q=true, R=false", "0.144"],
    ["P=true, Q=false, R=true", "0.024"],
    ["P=true, Q=false, R=false", "0.096"],
    ["P=false, Q=true, R=true", "0.084"],
    ["P=false, Q=true, R=false", "0.036"],
    ["P=false, Q=false, R=true", "0.056"],
    ["P=false, Q=false, R=false", "0.224"],
  ]);

  assert.equal(bayesianEvidence.summary, "Bayesian network conditional probability");
  assert.equal(bayesianEvidence.answer, "conditional probability = 0.72");
  assert.equal(artifactValue(bayesianEvidence, "Query"), "P");
  assert.equal(artifactValue(bayesianEvidence, "Evidence"), "R");
  assert.equal(artifactValue(bayesianEvidence, "P(query)"), "0.6");
  assert.equal(artifactValue(bayesianEvidence, "P(evidence)"), "0.5");
  assert.equal(artifactValue(bayesianEvidence, "P(query and evidence)"), "0.36");
  assert.deepEqual(bayesianEvidence.table.rows.slice(-1), [["P given R", "conditional: P(query and evidence) / P(evidence)", "0.72"]]);

  assert.equal(bayesianMultiParent.summary, "Bayesian network conditional probability");
  assert.equal(bayesianMultiParent.answer, "conditional probability = 0.825");
  assert.equal(artifactValue(bayesianMultiParent, "Semantics"), "binary Bayesian network");
  assert.equal(artifactValue(bayesianMultiParent, "Assignments"), "P=0.6, Q=0.5, R=0.585");
  assert.equal(artifactValue(bayesianMultiParent, "Network"), "P,Q -> R");
  assert.equal(artifactValue(bayesianMultiParent, "Root marginals"), "P=0.6, Q=0.5");
  assert.equal(artifactValue(bayesianMultiParent, "Conditional rows"), "cond(R|not P,not Q)=0.05, cond(R|not P,Q)=0.4, cond(R|P,not Q)=0.7, cond(R|P,Q)=0.95");
  assert.equal(artifactValue(bayesianMultiParent, "P(evidence)"), "0.6");
  assert.equal(artifactValue(bayesianMultiParent, "P(query and evidence)"), "0.495");
  assert.deepEqual(bayesianMultiParent.table.rows.slice(-1), [["R given P", "conditional: P(query and evidence) / P(evidence)", "0.825"]]);
  assert.deepEqual(bayesianMultiParent.extraTables[0].rows, [
    ["P=true, Q=true, R=true", "0.285"],
    ["P=true, Q=true, R=false", "0.015"],
    ["P=true, Q=false, R=true", "0.21"],
    ["P=true, Q=false, R=false", "0.09"],
    ["P=false, Q=true, R=true", "0.08"],
    ["P=false, Q=true, R=false", "0.12"],
    ["P=false, Q=false, R=true", "0.01"],
    ["P=false, Q=false, R=false", "0.19"],
  ]);

  assert.equal(analyzeUniversal("fuzzy logic P and Q with P=0.8 Q=0.6").summary, "Fuzzy logic truth value");
  assert.equal(analyzeUniversal("interval fuzzy logic P or Q with P=[0.2,0.5] Q=[0.4,0.7]").summary, "Interval fuzzy logic truth value");
  assert.equal(analyzeUniversal("correlated probability logic P or Q with P=0.6 Q=0.5 joint(P,Q)=0.35").summary, "Correlated probabilistic logic truth value");
  assert.equal(analyzeUniversal("conditional probability logic P or Q with P=0.6 cond(Q|P)=0.8 cond(Q|not P)=0.3").summary, "Conditional probabilistic logic truth value");
  assert.equal(analyzeUniversal("bayesian network probability logic P or R with P=0.6 cond(Q|P)=0.8 cond(Q|not P)=0.3 cond(R|Q)=0.7 cond(R|not Q)=0.2").summary, "Bayesian network probabilistic logic truth value");
  assert.equal(analyzeUniversal("bayesian network probability logic P given R with P=0.6 cond(Q|P)=0.8 cond(Q|not P)=0.3 cond(R|Q)=0.7 cond(R|not Q)=0.2").summary, "Bayesian network conditional probability");
  assert.equal(analyzeUniversal("bayesian network probability logic R given P with P=0.6 Q=0.5 cond(R|P,Q)=0.95 cond(R|P,not Q)=0.7 cond(R|not P,Q)=0.4 cond(R|not P,not Q)=0.05").summary, "Bayesian network conditional probability");
});

runTest("tree export emits Graphviz DOT", () => {
  const math = analyzeTreeExport("dot tree x^2 + 2x + 1");
  const logic = analyzeTreeExport("graphviz tree P -> (Q or R)");
  const mathDot = artifactValue(math, "Graphviz DOT");
  const logicDot = artifactValue(logic, "Graphviz DOT");

  assert.equal(math.summary, "Graphviz DOT tree");
  assert.equal(math.answer, "Graphviz DOT with 9 nodes");
  assert.equal(artifactValue(math, "Parsed as"), "math");
  assert.equal(artifactValue(math, "Variables"), "x");
  assert.deepEqual(math.table.rows[0], ["n0", "+", "mathBinary", "n1, n8"]);
  assert.ok(mathDot.startsWith("digraph ExpressionTree"));
  assert.ok(mathDot.includes("n0 [label=\"+\\nmathBinary\"]"));
  assert.ok(math.extraTables[0].rows.some((row) => row[0] === "n0" && row[1] === "n1"));

  assert.equal(logic.answer, "Graphviz DOT with 5 nodes");
  assert.equal(artifactValue(logic, "Parsed as"), "logic");
  assert.equal(artifactValue(logic, "Variables"), "P, Q, R");
  assert.ok(logicDot.includes("IMPLIES\\nlogicBinary"));
  assert.equal(analyzeUniversal("dot tree x^2 + 2x + 1").summary, "Graphviz DOT tree");
});

runTest("input assistant suggests structured problem formats", () => {
  const fuzzyHelp = suggestProblemHelp("fuzzy truth value", "ask", "Need truth values.");
  assert.equal(fuzzyHelp.title, "Fuzzy or probabilistic logic");
  assert.equal(fuzzyHelp.examples[0][2], "fuzzy logic (P and Q) or not R with P=0.8 Q=0.6 R=0.3");

  const bddHelp = suggestProblemHelp("binary decision diagram", "ask", "Need a logic statement.");
  assert.equal(bddHelp.title, "Binary decision diagram");
  assert.equal(bddHelp.examples[0][2], "bdd (P and Q) or (P and R)");

  const treeHelp = suggestProblemHelp("export expression tree", "ask", "Need an expression.");
  assert.equal(treeHelp.title, "Graphviz tree export");
  assert.equal(treeHelp.examples[0][2], "dot tree x^2 + 2x + 1");

  const kmapHelp = suggestProblemHelp("karnaugh map", "ask", "Need a Boolean statement.");
  assert.equal(kmapHelp.title, "Karnaugh map");
  assert.equal(kmapHelp.examples[0][2], "kmap P or Q");

  const tableauHelp = suggestProblemHelp("truth tree valid?", "ask", "Need a logic statement.");
  assert.equal(tableauHelp.title, "Semantic tableau");
  assert.equal(tableauHelp.examples[0][2], "tableau P -> P");

  const satHelp = suggestProblemHelp("is this satisfiable?", "ask", "Need a logic statement.");
  assert.equal(satHelp.title, "SAT solver");
  assert.equal(satHelp.examples[0][2], "sat (P or Q) and (not P or R) and (not Q or R)");

  const normalForm = suggestProblemHelp("convert to cnf", "ask", "Need a logic statement.");
  assert.equal(normalForm.title, "Logic normal form");
  assert.equal(normalForm.examples[0][2], "cnf P -> (Q and R)");

  const twoSample = suggestProblemHelp("compare two groups with a t-test", "statistics", "Two-sample tests need group1 and group2.");
  assert.equal(twoSample.title, "Two-sample t-test");
  assert.equal(twoSample.examples[0][2], "two-sample t-test group1: 10, 12, 9; group2: 8, 7, 11");

  const mcnemarHelp = suggestProblemHelp("mcnemar paired categorical", "statistics", "Categorical test needs counts.");
  assert.equal(mcnemarHelp.title, "Contingency table test");
  assert.equal(mcnemarHelp.examples[2][2], "mcnemar [[20,5],[15,60]]");

  const correlation = suggestProblemHelp("pearson correlation", "statistics", "Pearson correlation needs x and y lists.");
  assert.equal(correlation.title, "Correlation or regression");
  assert.ok(correlation.needs.some((need) => need.includes("x and y")));

  const matrix = suggestProblemHelp("inverse matrix", "ask", "Matrix mode needs a matrix.");
  assert.equal(matrix.title, "Matrix or system solver");

  const nonlinear = suggestProblemHelp("nonlinear system with a guess", "ask", "System solving needs a guess.");
  assert.equal(nonlinear.title, "Nonlinear system solver");
  assert.ok(nonlinear.examples[0][2].includes("guess x=3 y=2"));

  const odeSystem = suggestProblemHelp("phase plane for an ode system", "ask", "Need a differential equation system.");
  assert.equal(odeSystem.title, "Linear ODE system");
  assert.ok(odeSystem.examples[0][2].includes("x'=y"));

  const trigRewrite = suggestProblemHelp("power reduce trig identity", "ask", "Need a trig expression.");
  assert.equal(trigRewrite.title, "Trig identity rewrite");
  assert.equal(trigRewrite.examples[0][2], "power reduce sin(x)^2");

  const arima = suggestProblemHelp("arima forecast", "statistics", "Time-series forecast needs a series.");
  assert.equal(arima.title, "ARIMA forecast");
  assert.ok(arima.examples[0][2].startsWith("arima(2,1,0)"));
});

runTest("simplify mode combines like terms", () => {
  const result = analyzeSimplification("2x + 3x - 4 + 10");

  assert.equal(result.answer, "5x + 6");
});

runTest("simplify mode applies trigonometric identities", () => {
  assert.equal(analyzeSimplification("sin(x)^2 + cos(x)^2").answer, "1");
  assert.equal(analyzeSimplification("1 - sin(x)^2").answer, "cos(x) ^ 2");
  assert.equal(analyzeSimplification("sin(x)/cos(x)").answer, "tan(x)");
  assert.equal(analyzeSimplification("tan(x)*cos(x)").answer, "sin(x)");
  assert.equal(analyzeSimplification("1/cos(x)").answer, "sec(x)");
  assert.equal(analyzeSimplification("1/sin(x)").answer, "csc(x)");
  assert.equal(analyzeSimplification("cos(x)/sin(x)").answer, "cot(x)");
  assert.equal(analyzeSimplification("sec(x)*cos(x)").answer, "1");
  assert.equal(analyzeSimplification("cot(x)*sin(x)").answer, "cos(x)");
  assert.equal(analyzeSimplification("sin(pi/2 - x)").answer, "cos(x)");
  assert.equal(analyzeSimplification("cos(pi/2 - x)").answer, "sin(x)");
  assert.equal(analyzeSimplification("tan(pi/2 - x)").answer, "cot(x)");
  assert.equal(analyzeSimplification("sec(pi/2 - x)").answer, "csc(x)");
  assert.equal(analyzeSimplification("sin(2x)").answer, "2 * sin(x) * cos(x)");
  assert.equal(analyzeSimplification("cos(2x)").answer, "cos(x) ^ 2 - sin(x) ^ 2");
  assert.equal(analyzeSimplification("tan(2x)").answer, "2 * tan(x) / (1 - tan(x) ^ 2)");
  assert.equal(analyzeSimplification("sin(x + y)").answer, "sin(x) * cos(y) + cos(x) * sin(y)");
  assert.equal(analyzeSimplification("cos(x - y)").answer, "cos(x) * cos(y) + sin(x) * sin(y)");
  assert.equal(analyzeSimplification("tan(x - y)").answer, "(tan(x) - tan(y)) / (1 + tan(x) * tan(y))");
  assert.equal(analyzeSimplification("sin(x)*cos(y)").answer, "0.5 * (sin(x + y) + sin(x - y))");
  assert.equal(analyzeSimplification("cos(x)*sin(y)").answer, "0.5 * (sin(x + y) - sin(x - y))");
  assert.equal(analyzeSimplification("cos(x)*cos(y)").answer, "0.5 * (cos(x + y) + cos(x - y))");
  assert.equal(analyzeSimplification("sin(x)*sin(y)").answer, "0.5 * (cos(x - y) - cos(x + y))");
  assert.equal(analyzeSimplification("sin(x)+sin(y)").answer, "2 * sin((x + y) / 2) * cos((x - y) / 2)");
  assert.equal(analyzeSimplification("sin(x)-sin(y)").answer, "2 * cos((x + y) / 2) * sin((x - y) / 2)");
  assert.equal(analyzeSimplification("cos(x)+cos(y)").answer, "2 * cos((x + y) / 2) * cos((x - y) / 2)");
  assert.equal(analyzeSimplification("cos(x)-cos(y)").answer, "-2 * sin((x + y) / 2) * sin((x - y) / 2)");
  assert.equal(analyzeSimplification("sin(x)*cos(x)").answer, "sin(x) * cos(x)");
  assert.equal(analyzeSimplification("sin(x)+sin(x)").answer, "sin(x) + sin(x)");

  assert.equal(analyzeSimplification("power reduce sin(x)^2").answer, "(1 - cos(2 * x)) / 2");
  assert.equal(analyzeSimplification("power reduction of cos(x)^2").answer, "(1 + cos(2 * x)) / 2");
  assert.equal(analyzeSimplification("power reduce tan(x)^2").answer, "(1 - cos(2 * x)) / (1 + cos(2 * x))");
  assert.equal(analyzeSimplification("power reduce sin(x)*cos(x)").answer, "0.5 * sin(2 * x)");
  assert.equal(analyzeSimplification("half angle sin(x/2)").answer, "sqrt((1 - cos(x)) / 2)");
  assert.equal(analyzeSimplification("half angle cos(x/2)").answer, "sqrt((1 + cos(x)) / 2)");
  assert.equal(analyzeSimplification("half angle tan(x/2)").answer, "sin(x) / (1 + cos(x))");
  assert.equal(analyzeUniversal("half angle sin(0.5*x)").answer, "sqrt((1 - cos(x)) / 2)");
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

runTest("equation mode formats irrational quadratic roots exactly", () => {
  const simple = analyzeEquation("x^2 - 2 = 0", "x");
  const scaled = analyzeEquation("2x^2 + 2x - 1 = 0", "x");

  assert.equal(simple.answer, "x = sqrt(2), x = -sqrt(2)");
  assert.equal(artifactValue(simple, "Numeric approximations"), "1.414214, -1.414214");
  assert.equal(scaled.answer, "x = (-1 + sqrt(3)) / 2, x = (-1 - sqrt(3)) / 2");
});

runTest("equation mode reports complex quadratic roots", () => {
  assert.equal(analyzeEquation("x^2 + 1 = 0", "x").answer, "x = i, x = -i");
  assert.equal(analyzeEquation("x^2 + 2x + 5 = 0", "x").answer, "x = -1 + 2i, x = -1 - 2i");
});

runTest("equation mode solves biquadratic quartics exactly", () => {
  const result = analyzeEquation("x^4 - 5x^2 + 4 = 0", "x");

  assert.equal(result.summary, "biquadratic quartic solution");
  assert.equal(result.answer, "x = -2, x = -1, x = 1, x = 2");
  assert.equal(artifactValue(result, "Substitution"), "u = x^2");
  assert.equal(artifactValue(result, "Quadratic in u"), "u^2 - 5u + 4 = 0");
  assert.equal(analyzeUniversal("solve x^4 - 5x^2 + 4 = 0").summary, "biquadratic quartic solution");
});

runTest("equation mode deduplicates repeated biquadratic roots", () => {
  const result = analyzeEquation("x^4 - 2x^2 + 1 = 0", "x");

  assert.equal(result.answer, "x = -1, x = 1");
  assert.equal(artifactValue(result, "u roots"), "1");
});

runTest("equation mode solves cubic rational roots exactly", () => {
  const result = analyzeEquation("x^3 - 6x^2 + 11x - 6 = 0", "x");

  assert.equal(result.summary, "rational-root equation solution");
  assert.equal(result.answer, "x = 1, x = 2, x = 3");
  assert.equal(artifactValue(result, "Method"), "rational root theorem + synthetic division");
  assert.equal(artifactValue(result, "Rational roots"), "1, 2, 3");
  assert.equal(analyzeUniversal("solve x^3 - 6x^2 + 11x - 6 = 0").summary, "rational-root equation solution");
});

runTest("equation mode solves rational-root cubics with exact quadratic residuals", () => {
  const result = analyzeEquation("x^3 - x^2 - 2x + 2 = 0", "x");

  assert.equal(result.answer, "x = -sqrt(2), x = 1, x = sqrt(2)");
  assert.equal(artifactValue(result, "Residual factor"), "x^2 - 2 = 0");
  assert.equal(artifactValue(result, "Numeric approximations"), "-1.414214, 1, 1.414214");
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

runTest("derivative mode supports reciprocal trig functions", () => {
  assert.equal(analyzeDerivative("sec(x)", "x").answer, "sec(x) * tan(x)");
  assert.equal(analyzeDerivative("csc(x)", "x").answer, "-(csc(x) * cot(x))");
  assert.equal(analyzeDerivative("cot(x)", "x").answer, "-(csc(x) ^ 2)");
  assert.equal(analyzeDerivative("atan(x)", "x").answer, "1 / (1 + x ^ 2)");
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
  assert.equal(analyzeComplex("complex sec(0)").answer, "1");
  assert.equal(analyzeComplex("complex atan(1)").answer, "0.785398");
});

runTest("statistics mode computes descriptive summaries", () => {
  const result = analyzeStatistics("mean of 2, 4, 4, 5, 9");

  assert.equal(result.summary, "descriptive statistics");
  assert.equal(result.answer, "mean = 4.8");
});

runTest("statistics mode computes Jarque-Bera normality tests", () => {
  const result = analyzeStatistics("normality test data 10, 12, 13, 15, 30, 31, 32, 33 alpha=0.05");

  assert.equal(result.summary, "Jarque-Bera normality test");
  assert.equal(result.answer, "JB = 1.210241, p = 0.546009");
  assert.equal(artifactValue(result, "Skewness"), "-0.032036");
  assert.equal(artifactValue(result, "Excess kurtosis"), "-1.904368");
  assert.equal(artifactValue(result, "Decision"), "fail to reject normality at alpha=0.05");
  assert.deepEqual(result.table.rows.at(-1), ["p-value", "0.546009"]);
});

runTest("statistics mode computes Anderson-Darling normality tests", () => {
  const result = analyzeStatistics("anderson-darling normality data 10, 12, 13, 15, 30, 31, 32, 33 alpha=0.05");

  assert.equal(result.summary, "Anderson-Darling normality test");
  assert.equal(result.answer, "A^2* = 0.878205, p = 0.024585");
  assert.equal(artifactValue(result, "A^2 statistic"), "0.777925");
  assert.equal(artifactValue(result, "Corrected A^2*"), "0.878205");
  assert.equal(artifactValue(result, "Decision"), "reject normality at alpha=0.05");
  assert.deepEqual(result.table.rows[0], ["1", "10", "-1.167117", "0.121582", "-4.056693"]);
  assert.deepEqual(result.table.rows.at(-1), ["8", "33", "1.069857", "0.857658", "-0.283182"]);
});

runTest("statistics mode computes linear regression", () => {
  const result = analyzeStatistics("regression for (1,2), (2,3), (3,5)");

  assert.equal(result.summary, "linear regression");
  assert.equal(result.answer, "y = 1.5x + 0.333333");
  assert.equal(artifactValue(result, "Slope SE"), "0.288675");
  assert.equal(artifactValue(result, "Slope p"), "0.121038");
  assert.equal(artifactValue(result, "Slope 95% CI"), "[-2.167965, 5.167965]");
  assert.deepEqual(result.table.rows[1], ["2", "3", "3.333333", "-0.333333"]);
  assert.equal(result.graph.kind, "scatter-fit");
  assert.deepEqual(result.graph.scatter[0], { x: 1, y: 2 });
  assert.equal(result.graph.lines[0].label, "Least-squares fit");
});

runTest("statistics mode computes simple regression predictions", () => {
  const result = analyzeStatistics("regression for (1,2), (2,3), (3,5), (4,8); predict x=5");

  assert.equal(result.summary, "linear regression");
  assert.equal(result.answer, "y = 2x - 0.5; prediction = 9.5");
  assert.equal(artifactValue(result, "Prediction x"), "5");
  assert.equal(artifactValue(result, "Predicted y"), "9.5");
  assert.equal(artifactValue(result, "95% mean response CI"), "[5.773793, 13.226207]");
  assert.equal(artifactValue(result, "95% prediction interval"), "[4.689488, 14.310512]");
  assert.equal(result.steps.at(-1).title, "Predict at requested x");
});

runTest("statistics mode computes Pearson correlation tests", () => {
  const result = analyzeStatistics("pearson correlation x: 1, 2, 3, 4, 5, 6; y: 2, 4, 5, 4, 5, 7");

  assert.equal(result.summary, "Pearson correlation test");
  assert.equal(result.answer, "r = 0.87831, p = 0.021312");
  assert.equal(artifactValue(result, "R squared"), "0.771429");
  assert.equal(artifactValue(result, "t statistic"), "3.674235");
  assert.equal(artifactValue(result, "95% Fisher z CI"), "[0.232414, 0.986612]");
  assert.equal(artifactValue(result, "Decision"), "reject H0 at alpha=0.05");
  assert.deepEqual(result.table.rows[3], ["4", "4", "4", "0.5", "-0.5", "-0.25"]);
  assert.equal(artifactValue(result, "Trend line"), "y = 0.771429x + 1.8");
  assert.equal(result.graph.kind, "scatter-fit");
  assert.equal(result.graph.scatter.length, 6);
  assert.equal(result.graph.lines[0].label, "Pearson trend");
});

runTest("statistics mode computes Spearman rank correlations", () => {
  const result = analyzeStatistics("spearman correlation x: 1, 2, 3, 4, 5, 6; y: 1, 3, 2, 5, 4, 6");

  assert.equal(result.summary, "Spearman rank correlation");
  assert.equal(result.answer, "rho = 0.885714, p = 0.018845");
  assert.equal(artifactValue(result, "t approximation"), "3.815836");
  assert.equal(artifactValue(result, "Sum d^2"), "4");
  assert.equal(artifactValue(result, "Decision"), "reject H0 at alpha=0.05");
  assert.deepEqual(result.table.rows[2], ["3", "3", "2", "3", "2", "1", "1"]);
});

runTest("statistics mode computes Kendall tau-b correlations", () => {
  const result = analyzeStatistics("kendall correlation x: 1, 2, 2, 3, 4, 5; y: 1, 2, 3, 3, 5, 4");

  assert.equal(result.summary, "Kendall tau-b correlation");
  assert.equal(result.answer, "tau-b = 0.785714, p = 0.038777");
  assert.equal(artifactValue(result, "Concordant pairs"), "12");
  assert.equal(artifactValue(result, "Discordant pairs"), "1");
  assert.equal(artifactValue(result, "Ties only in x"), "1");
  assert.equal(artifactValue(result, "Ties only in y"), "1");
  assert.deepEqual(result.table.rows[5], ["2-3", "ties", "increases", "tied x"]);
});

runTest("statistics mode computes polynomial regression", () => {
  const result = analyzeStatistics("quadratic regression degree=2 for (1,2), (2,5), (3,10), (4,17); predict x=5");

  assert.equal(result.summary, "polynomial regression");
  assert.equal(result.answer, "y = 1 + x^2; prediction = 26");
  assert.equal(artifactValue(result, "R squared"), "1");
  assert.deepEqual(result.table.rows[3], ["4", "4", "17", "17", "0"]);
});

runTest("statistics mode compares regression models", () => {
  const result = analyzeStatistics("compare regression models y: 2, 3, 5, 8, 13, 21; x: 1, 2, 3, 4, 5, 6 degrees=1,2,3");

  assert.equal(result.summary, "regression model comparison");
  assert.equal(result.answer, "best degree 2 by AICc: y = 3.7 - 2.217857x + 0.839286x^2");
  assert.equal(artifactValue(result, "Best degree"), "2");
  assert.equal(artifactValue(result, "Best AICc"), "7.119474");
  assert.equal(artifactValue(result, "LOOCV best degree"), "3");
  assert.equal(artifactValue(result, "LOOCV best RMSE"), "0.550766");
  assert.deepEqual(result.table.rows[1], ["2", "y = 3.7 - 2.217857x + 0.839286x^2", "0.978571", "0.996255", "0.993759", "-4.880526", "7.119474", "-5.505247", "1.270369", "1.074586"]);
  assert.equal(result.graph.expression, "AICc by polynomial degree");
  assert.equal(result.graphs.length, 2);
  assert.equal(result.graphs[0].scatter.length, 3);
  assert.equal(result.graphs[1].expression, "LOOCV RMSE by polynomial degree");
});

runTest("statistics mode compares regression models with requested validation", () => {
  const result = analyzeStatistics("compare regression models x: 1, 2, 3, 4, 5, 6; y: 2, 3, 5, 8, 13, 21 kfold=3 holdout=0.33 degrees=1,2,3");

  assert.equal(result.details, "6 observations, degrees 1, 2, 3, 3-fold CV, 2-point holdout");
  assert.equal(artifactValue(result, "K-fold count"), "3");
  assert.equal(artifactValue(result, "K-fold best degree"), "3");
  assert.equal(artifactValue(result, "K-fold best RMSE"), "0.507901");
  assert.equal(artifactValue(result, "Holdout count"), "2");
  assert.equal(artifactValue(result, "Holdout best degree"), "2");
  assert.equal(artifactValue(result, "Holdout best RMSE"), "2.915476");
  assert.deepEqual(result.table.rows[1], ["2", "y = 3.7 - 2.217857x + 0.839286x^2", "0.978571", "0.996255", "0.993759", "-4.880526", "7.119474", "-5.505247", "1.270369", "1.074586", "1.186695", "0.890171", "2.915476", "2.5"]);
  assert.equal(result.graphs.length, 4);
  assert.equal(result.graphs[2].expression, "3-fold RMSE by polynomial degree");
  assert.equal(result.graphs[3].expression, "Holdout RMSE by polynomial degree");
});

runTest("statistics mode compares nonlinear regression model families", () => {
  const result = analyzeStatistics("compare nonlinear regression models x: 1,2,3,4,5; y: 2,4,8,16,32 families=linear,exponential,logarithmic,power");

  assert.equal(result.summary, "nonlinear regression model comparison");
  assert.equal(result.answer, "best exponential model by AICc: y = 1 * e^(0.693147x)");
  assert.equal(artifactValue(result, "Best family"), "Exponential");
  assert.equal(artifactValue(result, "Best AICc"), "-105.129255");
  assert.deepEqual(result.table.rows[1], ["Exponential", "y = 1 * e^(0.693147x)", "0", "1", "-111.129255", "-105.129255", "-111.910379", "fit"]);
  assert.equal(result.graphs.length, 2);
  assert.equal(result.graphs[0].expression, "Exponential best fit");
  assert.equal(result.graphs[1].expression, "AICc by nonlinear regression family");
  assert.equal(analyzeUniversal("compare nonlinear regression models x: 1,2,3,4,5; y: 2,4,8,16,32").summary, "nonlinear regression model comparison");
});

runTest("statistics mode compares logistic growth nonlinear models", () => {
  const result = analyzeStatistics("compare nonlinear regression models x: 0,1,2,3,4,5,6,7,8; y: 1.8,4.7,11.9,26.9,50,73.1,88.1,95.3,98.2 families=linear,exponential,logistic");

  assert.equal(result.answer, "best logistic growth model by AICc: y = 100.011536 / (1 + e^(4.002689 - 1.000588x))");
  assert.equal(artifactValue(result, "Best family"), "Logistic growth");
  assert.equal(artifactValue(result, "Best AICc"), "-61.515607");
  assert.deepEqual(result.table.rows[2], ["Logistic growth", "y = 100.011536 / (1 + e^(4.002689 - 1.000588x))", "0.002915", "1", "-66.315607", "-61.515607", "-65.723934", "fit in 20 iterations"]);
  assert.equal(result.graphs[0].expression, "Logistic growth best fit");
  assert.equal(result.graphs[1].expression, "AICc by nonlinear regression family");
  assert.equal(analyzeUniversal("compare nonlinear regression models x: 0,1,2,3,4,5,6,7,8; y: 1.8,4.7,11.9,26.9,50,73.1,88.1,95.3,98.2 families=linear,logistic").summary, "nonlinear regression model comparison");
});

runTest("statistics mode fits custom nonlinear regression formulas", () => {
  const result = analyzeStatistics("custom nonlinear regression formula=a*exp(b*x); x: 1,2,3,4,5; y: 2,4,8,16,32; params a=1,b=0.5; bounds a=0:10,b=0:2; multistart=3; predict x=6");

  assert.equal(result.summary, "custom nonlinear regression");
  assert.equal(result.answer, "y = a*exp(b*x); a=1, b=0.693147; prediction = 64");
  assert.equal(artifactValue(result, "a bounds"), "[0, 10]");
  assert.equal(artifactValue(result, "b bounds"), "[0, 2]");
  assert.equal(artifactValue(result, "Converged"), "yes");
  assert.equal(artifactValue(result, "Start count"), "3");
  assert.equal(artifactValue(result, "Best start"), "2");
  assert.equal(artifactValue(result, "Trace rows"), "12");
  assert.equal(artifactValue(result, "Degrees freedom"), "3");
  assert.equal(artifactValue(result, "R squared"), "1");
  assert.equal(artifactValue(result, "b estimate"), "0.693147");
  assert.equal(artifactValue(result, "b 95% CI"), "[0.693147, 0.693147]");
  assert.equal(artifactValue(result, "Predicted y"), "64");
  assert.equal(artifactValue(result, "95% prediction interval"), "[64, 64]");
  assert.deepEqual(result.table.rows[2], ["3", "3", "8", "8", "0"]);
  assert.equal(result.extraTables[0].title, "Optimizer trace");
  assert.deepEqual(result.extraTables[0].rows[0], ["0", "4026537.13533", "0.001", "undefined", "start"]);
  assert.equal(result.extraTables[1].title, "Multi-start summary");
  assert.deepEqual(result.extraTables[1].rows[1], ["2", "a=3.737337, b=1.252174", "0", "11", "yes"]);
  assert.equal(result.steps.at(-1).title, "Predict requested input");
  assert.equal(result.graph.expression, "Custom nonlinear best fit");
  assert.equal(analyzeUniversal("custom nonlinear regression formula=a*exp(b*x); x: 1,2,3,4,5; y: 2,4,8,16,32; params a=1,b=0.5").summary, "custom nonlinear regression");
});

runTest("statistics mode compares custom nonlinear regression formulas", () => {
  const result = analyzeStatistics("compare custom nonlinear regression models formulas=a*exp(b*x) | c*x^d; x: 1,2,3,4,5; y: 2,4,8,16,32; params a=1,b=0.5,c=1,d=2; bounds a=0:10,b=0:2,c=0:10,d=0:4; multistart=3; predict x=6");

  assert.equal(result.summary, "custom nonlinear model comparison");
  assert.equal(result.answer, "best Model 1 by AICc: y = a*exp(b*x); averaged prediction = 64");
  assert.equal(artifactValue(result, "Criterion"), "AICc");
  assert.equal(artifactValue(result, "Best model"), "Model 1");
  assert.equal(artifactValue(result, "Best weight"), "1");
  assert.equal(artifactValue(result, "Model weights"), "Model 1=1, Model 2=0");
  assert.equal(artifactValue(result, "LOOCV best model"), "Model 1");
  assert.equal(artifactValue(result, "LOOCV best RMSE"), "0");
  assert.equal(artifactValue(result, "Model-averaged prediction"), "64");
  assert.deepEqual(result.table.rows[0], ["Model 1", "y = a*exp(b*x)", "a=1, b=0.693147", "0", "1", "-111.129255", "-105.129255", "-111.910379", "0", "1", "0", "0", "64", "fit in 11 iterations"]);
  assert.deepEqual(result.table.rows[1], ["Model 2", "y = c*x^d", "c=0.405279, d=2.704563", "6.148024", "0.989671", "5.033464", "11.033464", "4.25234", "116.162719", "0", "3.548939", "2.581835", "51.560077", "fit in 7 iterations"]);
  assert.equal(result.extraTables[0].title, "Model-averaged fitted values");
  assert.deepEqual(result.extraTables[0].rows[2], ["3", "3", "8", "8", "0"]);
  assert.deepEqual(result.graphs.map((graph) => graph.expression), ["Model 1 best fit", "Model-averaged custom best fit", "AICc by custom nonlinear model", "LOOCV RMSE by custom nonlinear model"]);
  assert.equal(analyzeUniversal("compare custom nonlinear regression models formulas=a*exp(b*x) | c*x^d; x: 1,2,3,4,5; y: 2,4,8,16,32; params a=1,b=0.5,c=1,d=2").summary, "custom nonlinear model comparison");
});

runTest("statistics mode validates custom nonlinear regression formula comparisons", () => {
  const result = analyzeStatistics("compare custom nonlinear regression models formulas=a*exp(b*x) | c*x^d; x: 1,2,3,4,5,6; y: 2,4,8,16,32,64; params a=1,b=0.5,c=1,d=2; bounds a=0:10,b=0:2,c=0:10,d=0:4; multistart=3; kfold=3 holdout=0.33; predict x=7");

  assert.equal(result.details, "6 observations, 2 custom formulas, 3-fold CV, 2-point holdout");
  assert.equal(artifactValue(result, "K-fold count"), "3");
  assert.equal(artifactValue(result, "K-fold best model"), "Model 1");
  assert.equal(artifactValue(result, "K-fold best RMSE"), "0");
  assert.equal(artifactValue(result, "Holdout count"), "2");
  assert.equal(artifactValue(result, "Holdout best model"), "Model 1");
  assert.equal(artifactValue(result, "Holdout best RMSE"), "0");
  assert.deepEqual(result.table.rows[1], ["Model 2", "y = c*x^d", "c=0.14667, d=3.384881", "18.345778", "0.993481", "10.70584", "14.70584", "10.289359", "144.860946", "0", "5.532237", "3.816537", "5.272062", "3.286053", "20.550785", "17.703461", "106.388971", "fit in 22 iterations"]);
  assert.deepEqual(result.graphs.map((graph) => graph.expression), ["Model 1 best fit", "Model-averaged custom best fit", "AICc by custom nonlinear model", "LOOCV RMSE by custom nonlinear model", "3-fold RMSE by custom nonlinear model", "Holdout RMSE by custom nonlinear model"]);
});

runTest("statistics mode bootstraps custom nonlinear model comparisons", () => {
  const statement = "compare custom nonlinear regression models formulas=a*exp(b*x) | c*x^d; x: 1,2,3,4,5,6; y: 2.1,3.9,8.2,15.7,32.4,63.5; params a=1,b=0.5,c=1,d=2; bounds a=0:10,b=0:2,c=0:10,d=0:4; multistart=3; kfold=3 holdout=0.33; bootstrap=60 seed=11; predict x=7";
  const result = analyzeStatistics(statement);

  assert.equal(result.details, "6 observations, 2 custom formulas, 3-fold CV, 2-point holdout, 60 bootstrap resamples");
  assert.equal(result.answer, "best Model 1 by AICc: y = a*exp(b*x); averaged prediction = 126.41703; bootstrap 95% CI = [117.437363, 134.241906]");
  assert.equal(artifactValue(result, "Bootstrap resamples"), "60");
  assert.equal(artifactValue(result, "Bootstrap valid resamples"), "60");
  assert.equal(artifactValue(result, "Bootstrap seed"), "11");
  assert.equal(artifactValue(result, "Bootstrap mean averaged prediction"), "126.745325");
  assert.equal(artifactValue(result, "Bootstrap 95% averaged prediction CI"), "[117.437363, 134.241906]");
  assert.deepEqual(result.table.rows[0], ["Model 1", "y = a*exp(b*x)", "a=1.031596, b=0.686926", "0.373683", "0.999865", "-12.656641", "-8.656641", "-13.073122", "0", "0.999989", "0.793464", "0.556051", "1.066253", "0.696957", "2.28306", "2.179814", "126.417261", "fit in 11 iterations"]);
  assert.equal(result.extraTables[1].title, "Bootstrap model uncertainty");
  assert.deepEqual(result.extraTables[1].rows, [["Model 1", "60", "1", "0.991611"], ["Model 2", "0", "0", "0.008389"]]);
  assert.deepEqual(result.graphs.slice(-2).map((graph) => graph.expression), ["Bootstrap custom model uncertainty", "Bootstrap 95% averaged prediction interval"]);
  assert.deepEqual(result.graphs.at(-2).lines.map((series) => series.label), ["Selection rate", "Mean weight"]);
  assert.equal(result.graphs.at(-1).areas[0].label, "Bootstrap interval");
  assert.equal(result.graphs.at(-1).scatter[0].x, 7);
  assert.equal(result.steps.at(-2).title, "Bootstrap model uncertainty");
  assert.equal(analyzeUniversal(statement).summary, "custom nonlinear model comparison");
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

runTest("statistics mode computes regression diagnostics", () => {
  const result = analyzeStatistics("regression diagnostics y: 2, 3, 5, 8, 13, 21; x: 1, 2, 3, 4, 5, 6");

  assert.equal(result.summary, "regression diagnostics");
  assert.equal(result.answer, "R^2 = 0.895627, DW = 1.132931, BP p = 0.34479");
  assert.equal(artifactValue(result, "Durbin-Watson"), "1.132931");
  assert.equal(artifactValue(result, "Breusch-Pagan p-value"), "0.34479");
  assert.equal(artifactValue(result, "Residual JB p-value"), "0.706194");
  assert.equal(artifactValue(result, "Influential count"), "2");
  assert.deepEqual(result.table.rows[5], ["6", "21", "17.809524", "3.190476", "1.77053", "0.52381", "1.724127"]);
  assert.equal(result.graphs.length, 3);
  assert.equal(result.graphs[0].expression, "Actual vs fitted");
  assert.equal(result.graphs[1].expression, "Residuals vs fitted");
  assert.equal(result.graphs[2].expression, "Leverage vs Cook's D");
  assert.equal(result.graphs[2].scatterLabel, "Influence");
  assert.ok(result.graphs[2].lines.some((series) => series.label === "Cook's D threshold"));
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

runTest("statistics mode computes quadratic discriminant analysis classifiers", () => {
  const result = analyzeStatistics("qda class: 0, 0, 0, 1, 1, 1; x1: 1, 2, 1.5, 5, 6, 5.5; x2: 1, 1.2, 0.8, 5, 5.5, 4.8; regularization=0.001 predict x1=5.2 x2=5");

  assert.equal(result.summary, "quadratic discriminant analysis");
  assert.equal(result.answer, "predicted class = 1 (posterior = 1)");
  assert.equal(artifactValue(result, "Covariance class 0"), "[[0.25, 0.05], [0.05, 0.04]]");
  assert.equal(artifactValue(result, "Regularized covariance class 1"), "[[0.251, 0.125], [0.125, 0.131]]");
  assert.equal(artifactValue(result, "Log determinant class 1"), "-4.059595");
  assert.equal(artifactValue(result, "Score gap"), "198.178957");
  assert.deepEqual(result.table.rows[5], ["6", "1", "1", "1", "176.103542"]);
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

runTest("statistics mode computes ARIMA forecasts", () => {
  const result = analyzeStatistics("arima(2,1,0) series: 10, 13, 15, 18, 22, 27, 31, 38 forecast=3");

  assert.equal(result.summary, "ARIMA forecast");
  assert.equal(result.answer, "ARIMA(2, 1, 0) 3-step forecast = 58.824074");
  assert.equal(artifactValue(result, "Differenced series"), "[3, 2, 3, 4, 5, 4, 7]");
  assert.equal(artifactValue(result, "AR coefficients"), "[0.166667, 0.833333]");
  assert.equal(artifactValue(result, "Innovation SD"), "1.527525");
  assert.deepEqual(result.table.rows[2], ["3", "7.212963", "58.824074"]);
});

runTest("statistics mode computes binomial probability", () => {
  const result = analyzeStatistics("binomial n=10 p=0.5 k=3");

  assert.equal(result.summary, "binomial probability");
  assert.equal(result.answer, "P(X = 3) = 0.117188");
});

runTest("statistics mode computes normal probabilities", () => {
  const result = analyzeStatistics("normal mean=0 sd=1 x=1.96");
  const rightTail = analyzeStatistics("normal mean=0 sd=1 x=1.96 greater");

  assert.equal(result.summary, "normal probability");
  assert.equal(result.answer, "P(X <= 1.96) = 0.975002");
  assert.equal(result.graph.kind, "distribution");
  assert.equal(result.graph.points.length, 181);
  assert.equal(rightTail.answer, "P(X > 1.96) = 0.024998");
  assert.equal(rightTail.graph.areas[0].label, "P(X > 1.96)");
});

runTest("statistics mode computes inverse normal percentiles", () => {
  const result = analyzeStatistics("inverse normal p=0.975 mean=0 sd=1");

  assert.equal(result.summary, "inverse normal");
  assert.equal(result.answer, "x = 1.959963");
});

runTest("statistics mode computes continuous reference distributions", () => {
  const tResult = analyzeStatistics("student t df=10 x=2 greater");
  const chiResult = analyzeStatistics("chi-square distribution df=5 x=10 greater");
  const fResult = analyzeStatistics("f distribution df1=5 df2=10 x=2 greater");
  const criticalResult = analyzeStatistics("f distribution df1=5 df2=10 p=0.95 critical");

  assert.equal(tResult.summary, "Student t distribution");
  assert.equal(tResult.answer, "P(T > 2) = 0.036694");
  assert.equal(artifactValue(tResult, "Density"), "0.061146");
  assert.equal(tResult.graph.kind, "distribution");
  assert.equal(tResult.graph.areas[0].label, "P(T > 2)");
  assert.equal(chiResult.summary, "chi-square distribution");
  assert.equal(chiResult.answer, "P(X^2 > 10) = 0.075235");
  assert.equal(artifactValue(chiResult, "P(X^2 <= 10)"), "0.924765");
  assert.equal(chiResult.graph.areas[0].label, "P(X^2 > 10)");
  assert.equal(fResult.summary, "F distribution");
  assert.equal(fResult.answer, "P(F > 2) = 0.164195");
  assert.equal(artifactValue(fResult, "Density"), "0.162006");
  assert.equal(fResult.graph.points.length, 181);
  assert.equal(criticalResult.answer, "P(F <= 3.325835) = 0.95");
  assert.equal(artifactValue(criticalResult, "F quantile p=0.95"), "3.325835");
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

runTest("statistics mode computes meta-analysis models", () => {
  const result = analyzeStatistics("meta-analysis effects: 0.2, 0.5, 0.1, 0.7; se: 0.1, 0.2, 0.15, 0.25");

  assert.equal(result.summary, "meta-analysis");
  assert.equal(result.answer, "random-effects pooled effect = 0.308813, 95% CI = [0.081935, 0.53569], p = 0.007635");
  assert.equal(artifactValue(result, "Fixed-effect pooled estimate"), "0.259617");
  assert.equal(artifactValue(result, "I squared"), "50.292862%");
  assert.equal(artifactValue(result, "Tau squared"), "0.02614");
  assert.deepEqual(result.table.rows[0], ["1", "0.2", "0.1", "53.924506", "37.076176"]);
});

runTest("statistics mode adjusts multiple-testing p-values", () => {
  const result = analyzeStatistics("adjust p-values p: 0.003, 0.02, 0.04, 0.20, 0.001 alpha=0.05");

  assert.equal(result.summary, "multiple-testing correction");
  assert.equal(result.answer, "Benjamini-Hochberg discoveries = 4 of 5 at alpha=0.05; smallest adjusted p = 0.005");
  assert.equal(artifactValue(result, "Benjamini-Hochberg discoveries"), "4");
  assert.equal(artifactValue(result, "BH q-values"), "[0.0075, 0.033333, 0.05, 0.2, 0.005]");
  assert.equal(artifactValue(result, "BY q-values"), "[0.017125, 0.076111, 0.114167, 0.456667, 0.011417]");
  assert.deepEqual(result.table.rows[0], ["1", "0.003", "0.015", "0.012", "0.0075", "0.017125", "yes"]);
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
  assert.equal(artifactValue(result, "Cohen's d 95% CI"), "[-1.241664, 1.241664]");
  assert.equal(artifactValue(result, "Effect size CI method"), "approximate t interval");
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
  assert.equal(artifactValue(result, "Hedges g 95% CI"), "[-1.219814, 2.680408]");
  assert.equal(artifactValue(result, "Effect size CI method"), "approximate t interval");
});

runTest("statistics mode computes two-sample Kolmogorov-Smirnov tests", () => {
  const result = analyzeStatistics("ks test group1: 1, 2, 3, 4; group2: 3, 4, 5, 6 alpha=0.05");

  assert.equal(result.summary, "two-sample Kolmogorov-Smirnov test");
  assert.equal(result.answer, "D = 0.5, p = 0.534416");
  assert.equal(artifactValue(result, "D+ statistic"), "0.5");
  assert.equal(artifactValue(result, "D- statistic"), "0");
  assert.equal(artifactValue(result, "Effective n"), "2");
  assert.equal(artifactValue(result, "Decision"), "fail to reject H0 at alpha=0.05");
  assert.deepEqual(result.table.rows[1], ["2", "0.5", "0", "0.5", "-0.5"]);
  assert.deepEqual(result.table.rows.at(-1), ["6", "1", "1", "0", "0"]);
});

runTest("statistics mode computes equal-variance tests", () => {
  const fTest = analyzeStatistics("f-test variance group1: 10, 12, 9, 11; group2: 8, 7, 11, 9");
  const levene = analyzeStatistics("levene group1: 8,9,10; group2: 12,14,16; group3: 9,11,15");

  assert.equal(fTest.summary, "two-sample variance F test");
  assert.equal(fTest.answer, "F = 0.571429, p = 0.657107");
  assert.equal(artifactValue(fTest, "Group 1 variance"), "1.666667");
  assert.equal(artifactValue(fTest, "Decision"), "fail to reject equal variances at alpha=0.05");
  assert.deepEqual(fTest.table.rows[1], ["2", "4", "8.75", "2.916667", "1.707825"]);

  assert.equal(levene.summary, "Levene equal-variance test");
  assert.equal(levene.answer, "F = 0.705882, p = 0.530504");
  assert.equal(artifactValue(levene, "Group sample variances"), "[1, 4, 9.333333]");
  assert.equal(artifactValue(levene, "Mean absolute deviations"), "[0.666667, 1.333333, 2]");
  assert.deepEqual(levene.table.rows[2], ["3", "3", "11", "9.333333", "2"]);
});

runTest("statistics mode computes chi-square goodness-of-fit", () => {
  const result = analyzeStatistics("chi-square observed 10, 20, 30 expected 15, 15, 30");

  assert.equal(result.summary, "chi-square goodness-of-fit");
  assert.equal(result.answer, "chi-square = 3.333333, p = 0.186672");
  assert.equal(artifactValue(result, "Cohen's w"), "0.235702");
});

runTest("statistics mode computes chi-square independence tests", () => {
  const result = analyzeStatistics("chi-square independence [[30,10],[20,40]]");

  assert.equal(result.summary, "chi-square independence test");
  assert.equal(result.answer, "chi-square = 16.666667, p = 0.000082");
  assert.equal(artifactValue(result, "Expected table"), "[[20, 20], [30, 30]]");
  assert.equal(artifactValue(result, "Cramer's V"), "0.408248");
  assert.equal(artifactValue(result, "Decision"), "reject H0 at alpha=0.05");
  assert.deepEqual(result.table.rows[0], ["R1C1", "30", "20", "5", "2.236068"]);
});

runTest("statistics mode computes Fisher exact tests", () => {
  const result = analyzeStatistics("fisher exact [[1,9],[11,3]]");

  assert.equal(result.summary, "Fisher exact test");
  assert.equal(result.answer, "p = 0.002759, odds ratio = 0.030303");
  assert.equal(artifactValue(result, "Observed probability"), "0.001346");
  assert.equal(artifactValue(result, "Left-tail p-value"), "0.00138");
  assert.equal(artifactValue(result, "Two-sided p-value"), "0.002759");
  assert.equal(artifactValue(result, "Decision"), "reject H0 at alpha=0.05");
  assert.deepEqual(result.table.rows[1], ["1", "0.001346", "two-sided"]);
});

runTest("statistics mode computes McNemar paired categorical tests", () => {
  const result = analyzeStatistics("mcnemar [[20,5],[15,60]] alpha=0.05");
  const discordantOnly = analyzeStatistics("mcnemar b=5 c=15");

  assert.equal(result.summary, "McNemar paired categorical test");
  assert.equal(result.answer, "exact p = 0.041389, matched odds ratio = 0.333333");
  assert.equal(artifactValue(result, "Discordant total"), "20");
  assert.equal(artifactValue(result, "Exact p-value"), "0.041389");
  assert.equal(artifactValue(result, "Continuity-corrected chi-square"), "4.05");
  assert.equal(artifactValue(result, "Chi-square approximation p"), "0.041686");
  assert.equal(artifactValue(result, "Decision"), "reject H0 at alpha=0.05");
  assert.deepEqual(result.table.rows[1], ["yes -> no", "5", "discordant b"]);
  assert.equal(discordantOnly.answer, "exact p = 0.041389, matched odds ratio = 0.333333");
});

runTest("statistics mode computes paired t-tests", () => {
  const result = analyzeStatistics("paired t-test before: 10, 12, 9; after: 11, 14, 10");

  assert.equal(result.summary, "paired t test");
  assert.equal(result.answer, "t = 4, p = 0.057191");
  assert.equal(artifactValue(result, "Cohen's dz"), "2.309401");
  assert.equal(artifactValue(result, "Cohen's dz 95% CI"), "[-3.2453, 7.864102]");
  assert.equal(artifactValue(result, "Effect size CI method"), "approximate t interval");
});

runTest("statistics mode computes one-way ANOVA", () => {
  const result = analyzeStatistics("ANOVA group1: 8, 9, 10; group2: 12, 13, 14; group3: 9, 11, 10");

  assert.equal(result.summary, "one-way ANOVA");
  assert.equal(result.answer, "F = 13, p = 0.006592");
  assert.equal(artifactValue(result, "Eta squared"), "0.8125");
  assert.equal(artifactValue(result, "Pairwise comparisons"), "1 vs 2: diff=-4, p_adj=0.008141; 1 vs 3: diff=-1, p_adj=0.799709; 2 vs 3: diff=3, p_adj=0.031205");
});

runTest("statistics mode computes Welch one-way ANOVA", () => {
  const result = analyzeStatistics("welch anova group1: 8,9,10; group2: 14,16,17; group3: 20,24,29");

  assert.equal(result.summary, "Welch one-way ANOVA");
  assert.equal(result.answer, "F = 27.394147, df = 2, 3.456146, p = 0.00759");
  assert.equal(artifactValue(result, "Weighted mean"), "11.44374");
  assert.equal(artifactValue(result, "Pairwise comparisons"), "1 vs 2: diff=-6.666667, p_adj=0.015604; 1 vs 3: diff=-15.333333, p_adj=0.069755; 2 vs 3: diff=-8.666667, p_adj=0.201282");
});

runTest("statistics mode computes one-way MANOVA", () => {
  const result = analyzeStatistics("manova control: (1,2), (2,1), (1.5,1.8), (2.2,2.5); treatment: (4,5), (5,4.5), (4.2,5.2), (5.1,5.4); followup: (6,7), (7,6.5), (6.5,7.2), (7.1,7.4)");

  assert.equal(result.summary, "one-way MANOVA");
  assert.equal(result.answer, "Wilks' lambda = 0.01976, chi-square = 33.354726, p = 0.000002");
  assert.equal(artifactValue(result, "Pillai trace"), "0.994341");
  assert.equal(artifactValue(result, "Pairwise Hotelling T2"), "control vs treatment: T2=140.912428, p_adj=0.001011; control vs followup: T2=395.032494, p_adj=0.000082; treatment vs followup: T2=91.420607, p_adj=0.002824");
});

runTest("statistics mode computes ANCOVA", () => {
  const result = analyzeStatistics("ancova y: 10,12,13,15,14,17,18,21; group: control,control,control,control,treatment,treatment,treatment,treatment; x: 1,2,3,4,1,2,3,4");

  assert.equal(result.summary, "ANCOVA");
  assert.equal(result.answer, "group F = 131.578947, p = 0.000088; covariate F = 95, p = 0.000193");
  assert.equal(artifactValue(result, "Adjusted means"), "control=12.5; treatment=17.5");
  assert.equal(artifactValue(result, "Pairwise adjusted comparisons"), "control vs treatment: adj diff=-5, p_adj=0.000088");
  assert.deepEqual(result.table.rows[0], ["Group", "50", "1", "50", "131.578947", "0.000088", "0.963391"]);
});

runTest("statistics mode computes repeated-measures ANOVA", () => {
  const result = analyzeStatistics("repeated measures anova baseline: 10,12,11,13; week1: 12,13,12,15; week2: 14,15,13,17");

  assert.equal(result.summary, "repeated-measures ANOVA");
  assert.equal(result.answer, "F = 42.333333, p = 0.00029");
  assert.equal(artifactValue(result, "Condition means"), "[11.5, 13, 14.75]");
  assert.equal(artifactValue(result, "Pairwise comparisons"), "baseline vs week1: diff=-1.5, p_adj=0.04154; baseline vs week2: diff=-3.25, p_adj=0.0196; week1 vs week2: diff=-1.75, p_adj=0.017959");
  assert.deepEqual(result.table.rows[0], ["Conditions", "21.166667", "2", "10.583333", "42.333333", "0.00029"]);
});

runTest("statistics mode computes two-way ANOVA", () => {
  const result = analyzeStatistics("two-way anova y: 6,7,8,9,10,11,15,16; A: low,low,low,low,high,high,high,high; B: control,control,treatment,treatment,control,control,treatment,treatment");

  assert.equal(result.summary, "two-way ANOVA");
  assert.equal(result.answer, "A: F = 121, p = 0.000388; B: F = 49, p = 0.002192; A x B: F = 9, p = 0.039942");
  assert.equal(artifactValue(result, "Interaction p-value"), "0.039942");
  assert.deepEqual(result.table.rows[0], ["A", "60.5", "1", "60.5", "121", "0.000388", "0.968"]);
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
  const pca3d = analyzeStatistics("pca x: 1,2,3,4,5; y: 2,3,5,8,13; z: 5,4,3,2,1");

  assert.equal(covariance.summary, "covariance matrix");
  assert.equal(covariance.answer, "covariance matrix = [[1.666667, 3.333333], [3.333333, 7]]");
  assert.equal(correlation.answer, "correlation matrix = [[1, 0.9759], [0.9759, 1]]");
  assert.equal(pca.summary, "principal component analysis");
  assert.equal(pca.answer, "PC1 variance = 8.602083, explained = 99.254802%; direction = [0.433189, 0.901303]");
  assert.equal(artifactValue(pca, "PC2 direction"), "[0.901303, -0.433189]");
  assert.equal(pca3d.answer, "PC1 variance = 24.397718, explained = 98.776185%; direction = [0.31222, 0.897239, -0.31222]");
  assert.equal(artifactValue(pca3d, "PC3 direction"), "[0.707107, 0, 0.707107]");
  assert.equal(artifactValue(pca3d, "PC2 cumulative variance"), "100%");
  assert.deepEqual(pca3d.table.rows[4], ["5", "5", "13", "1"]);
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

runTest("statistics mode computes Bayesian A/B tests", () => {
  const result = analyzeStatistics("bayesian ab test A: 120/1000; B: 150/1000; alpha=1 beta=1");

  assert.equal(result.summary, "Bayesian A/B test");
  assert.equal(result.answer, "P(B > A) = 0.975068, expected lift = 24.793388%");
  assert.equal(artifactValue(result, "Decision"), "B likely better");
  assert.equal(artifactValue(result, "Expected relative lift"), "24.793388%");
  assert.equal(artifactValue(result, "95% difference interval"), "[-0.000007, 0.059887]");
  assert.deepEqual(result.table.rows[1], ["B", "150", "1000", "Beta(151, 851)", "0.150699", "[0.129231, 0.173487]"]);
});

runTest("statistics mode computes Bayesian linear regression posteriors", () => {
  const result = analyzeStatistics("bayesian linear regression y: 4, 7, 9, 12, 15; x: 1, 2, 3, 4, 5; priorMean=0 priorSd=10 sigma=1 predict x=6");

  assert.equal(result.summary, "Bayesian linear regression");
  assert.equal(result.answer, "posterior prediction = 17.500954, 95% predictive interval = [14.664576, 20.337331]");
  assert.equal(artifactValue(result, "Posterior equation"), "y = 1.293871 + 2.70118x");
  assert.equal(artifactValue(result, "Posterior coefficients"), "[1.293871, 2.70118]");
  assert.equal(artifactValue(result, "95% mean response interval"), "[15.45069, 19.551217]");
  assert.deepEqual(result.table.rows[1], ["x", "2.70118", "0.314661", "[2.084456, 3.317905]"]);
});

runTest("statistics mode computes Bayesian normal mean posteriors", () => {
  const result = analyzeStatistics("bayesian normal mean data: 10, 12, 14, 15; priorMean=11 priorSd=3 sigma=2 threshold=13");

  assert.equal(result.summary, "Bayesian normal mean");
  assert.equal(result.answer, "posterior mean = 12.575, 95% credible interval = [10.715615, 14.434385]");
  assert.equal(artifactValue(result, "Posterior SD"), "0.948683");
  assert.equal(artifactValue(result, "95% predictive interval"), "[8.236435, 16.913565]");
  assert.equal(artifactValue(result, "P(mu > 13)"), "0.32708");
  assert.deepEqual(result.table.rows[7], ["95% credible interval", "[10.715615, 14.434385]"]);
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
  assert.equal(result.answer, "U = 2, p = 0.4");
  assert.equal(artifactValue(result, "p-value method"), "exact enumeration");
  assert.equal(artifactValue(result, "Exact arrangements"), "20");
  assert.equal(artifactValue(result, "Rank-biserial r"), "0.555556");
  assert.equal(artifactValue(result, "Hodges-Lehmann shift (group2 - group1)"), "-2");
  assert.equal(artifactValue(result, "Pairwise shifts"), "-5, -4, -3, -2, -2, -1, -1, 1, 2");
  assert.deepEqual(result.extraTables[0].rows, [
    ["1", "-5"],
    ["2", "-4"],
    ["3", "-3"],
    ["4", "-2"],
    ["5", "-2"],
    ["6", "-1"],
    ["7", "-1"],
    ["8", "1"],
    ["9", "2"],
  ]);
});

runTest("statistics mode falls back to Mann-Whitney normal approximation with ties", () => {
  const result = analyzeStatistics("mann-whitney group1: 1, 2, 2; group2: 2, 3, 4");

  assert.equal(result.summary, "Mann-Whitney U test");
  assert.equal(artifactValue(result, "p-value method"), "normal approximation");
  assert.equal(artifactValue(result, "p-value"), "0.104571");
});

runTest("statistics mode computes Wilcoxon signed-rank tests", () => {
  const result = analyzeStatistics("wilcoxon signed-rank before: 10, 12, 9, 11; after: 11, 15, 11, 15");

  assert.equal(result.summary, "Wilcoxon signed-rank test");
  assert.equal(result.answer, "W = 0, p = 0.125");
  assert.equal(artifactValue(result, "p-value method"), "exact enumeration");
  assert.equal(artifactValue(result, "Exact sign assignments"), "16");
  assert.equal(artifactValue(result, "Matched rank-biserial r"), "1");
  assert.equal(artifactValue(result, "Hodges-Lehmann paired shift"), "2.5");
  assert.equal(artifactValue(result, "Walsh averages"), "1, 1.5, 2, 2, 2.5, 2.5, 3, 3, 3.5, 4");
  assert.deepEqual(result.extraTables[0].rows, [
    ["1", "1"],
    ["2", "1.5"],
    ["3", "2"],
    ["4", "2"],
    ["5", "2.5"],
    ["6", "2.5"],
    ["7", "3"],
    ["8", "3"],
    ["9", "3.5"],
    ["10", "4"],
  ]);
});

runTest("statistics mode falls back to Wilcoxon normal approximation with tied ranks", () => {
  const result = analyzeStatistics("wilcoxon signed-rank before: 10, 12, 9, 11; after: 11, 14, 10, 13");

  assert.equal(result.summary, "Wilcoxon signed-rank test");
  assert.equal(result.answer, "W = 0, p = 0.063318");
  assert.equal(artifactValue(result, "p-value method"), "normal approximation");
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

runTest("system solver handles nonlinear systems with Newton iteration", () => {
  const result = analyzeSystem("solve nonlinear system x^2 + y^2 = 25; x - y = 1 guess x=3 y=2");

  assert.equal(result.summary, "nonlinear system");
  assert.equal(result.answer, "x = 4, y = 3");
  assert.equal(artifactValue(result, "Initial guess"), "[3, 2]");
  assert.equal(artifactValue(result, "Converged"), "yes");
  assert.deepEqual(result.table.rows[1], ["1", "4.2", "3.2", "2.88", "1.697056"]);
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

runTest("matrix mode computes row-space and column-space bases", () => {
  const rowSpace = analyzeMatrix("row space [[1,2,1],[2,4,2],[1,1,0]]");
  const columnSpace = analyzeMatrix("column space [[1,2,1],[2,4,2],[1,1,0]]");

  assert.equal(rowSpace.summary, "matrix row space");
  assert.equal(rowSpace.answer, "basis = [[1, 0, -1], [0, 1, 1]]");
  assert.equal(artifactValue(rowSpace, "Rank"), "2");
  assert.equal(columnSpace.summary, "matrix column space");
  assert.equal(columnSpace.answer, "basis = [[1, 2, 1], [2, 4, 1]]");
  assert.equal(artifactValue(columnSpace, "Pivot columns"), "1, 2");
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

runTest("matrix mode computes complex 2x2 eigenvalues", () => {
  const result = analyzeMatrix("eigen [[0,-1],[1,0]]");

  assert.equal(result.summary, "2x2 eigenvalues");
  assert.equal(result.answer, "lambda = i, -i");
  assert.equal(artifactValue(result, "Eigenvalues"), "i, -i");
});

runTest("matrix mode approximates symmetric matrix eigenvalues", () => {
  const result = analyzeMatrix("eigenvalues [[4,1,0],[1,3,0],[0,0,2]]");

  assert.equal(result.summary, "symmetric matrix eigenvalues");
  assert.equal(result.answer, "lambda ~= [4.618034, 2.381966, 2]");
  assert.equal(artifactValue(result, "Method"), "Jacobi rotations");
  assert.equal(artifactValue(result, "Converged"), "yes");
  assert.equal(artifactValue(result, "Tolerance"), "1e-10");
});

runTest("matrix mode computes nonsymmetric 3x3 real eigenvalues", () => {
  const result = analyzeMatrix("eigenvalues [[5,1,0],[0,3,1],[0,0,1]]");

  assert.equal(result.summary, "3x3 real eigenvalues");
  assert.equal(result.answer, "lambda ~= [5, 3, 1]");
  assert.equal(artifactValue(result, "Method"), "3x3 characteristic cubic");
  assert.equal(artifactValue(result, "Characteristic polynomial"), "lambda^3 - 9lambda^2 + 23lambda - 15");
  assert.equal(artifactValue(result, "Characteristic residuals"), "[0, 0, 0]");
  assert.equal(analyzeUniversal("eigenvalues [[5,1,0],[0,3,1],[0,0,1]]").summary, "3x3 real eigenvalues");
});

runTest("matrix mode approximates symmetric matrix eigenvectors", () => {
  const result = analyzeMatrix("eigenvectors [[4,1,0],[1,3,0],[0,0,2]]");

  assert.equal(result.summary, "symmetric matrix eigenvectors");
  assert.equal(result.answer, "lambda 4.618034: [0.850651, 0.525731, 0]; lambda 2.381966: [0.525731, -0.850651, 0]; lambda 2: [0, 0, 1]");
  assert.equal(artifactValue(result, "Method"), "Jacobi rotations");
  assert.equal(artifactValue(result, "Eigenvalues"), "[4.618034, 2.381966, 2]");
  assert.equal(artifactValue(result, "Converged"), "yes");
});

runTest("matrix mode computes nonsymmetric 3x3 real eigenvectors", () => {
  const result = analyzeMatrix("eigenvectors [[5,1,0],[0,3,1],[0,0,1]]");

  assert.equal(result.summary, "3x3 real eigenvectors");
  assert.equal(result.answer, "lambda 5: [1, 0, 0]; lambda 3: [0.447214, -0.894427, 0]; lambda 1: [0.111111, -0.444444, 0.888889]");
  assert.equal(artifactValue(result, "Real eigenvalues"), "[5, 3, 1]");
  assert.equal(artifactValue(result, "Residual norms"), "[0, 0, 0]");
  assert.equal(result.steps.at(-1).title, "Check residuals");
  assert.equal(analyzeUniversal("eigenvectors [[5,1,0],[0,3,1],[0,0,1]]").summary, "3x3 real eigenvectors");
});

runTest("matrix mode approximates dominant eigenpairs", () => {
  const result = analyzeMatrix("dominant eigen [[4,1,0],[1,3,0],[0,0,2]]");

  assert.equal(result.summary, "dominant eigenpair");
  assert.equal(result.answer, "lambda ~= 4.618034, v ~= [0.850651, 0.525731, 0]");
  assert.equal(artifactValue(result, "Method"), "power iteration");
  assert.equal(artifactValue(result, "Converged"), "yes");
  assert.equal(artifactValue(result, "Tolerance"), "1e-10");
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

runTest("matrix mode computes complex 2x2 eigenvectors", () => {
  const result = analyzeMatrix("eigenvectors [[0,-1],[1,0]]");

  assert.equal(result.summary, "2x2 eigenvectors");
  assert.equal(result.answer, "lambda i: [[1, -i]]; lambda -i: [[1, i]]");
  assert.equal(artifactValue(result, "Eigenvectors"), "lambda i: [[1, -i]]; lambda -i: [[1, i]]");
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

runTest("integral mode handles partial fractions", () => {
  assert.equal(
    analyzeIntegral("integrate (2x + 3)/(x^2 + 3x + 2)").answer,
    "ln(abs(x + 1)) + ln(abs(x + 2)) + C",
  );
  assert.equal(
    analyzeIntegral("integrate 1/(x^2 - 1)").answer,
    "-0.5ln(abs(x + 1)) + 0.5ln(abs(x - 1)) + C",
  );
  assert.equal(
    analyzeIntegral("integrate (x^2 + 1)/(x + 1)").answer,
    "0.5x^2 - x + 2ln(abs(x + 1)) + C",
  );
  assert.equal(
    analyzeIntegral("integrate (2x+3)/(x^2+3x+2) from 0 to 1").answer,
    "integral = 1.098612",
  );
});

runTest("integral mode handles repeated partial fractions", () => {
  assert.equal(analyzeIntegral("integrate 1/(x - 1)^2").answer, "-1/(x - 1) + C");
  assert.equal(
    analyzeIntegral("integrate (x + 1)/(x^2 - 2x + 1)").answer,
    "ln(abs(x - 1)) - 2/(x - 1) + C",
  );
  assert.equal(
    analyzeIntegral("integrate 1/(x^3 - 3x^2 + 3x - 1)").answer,
    "-0.5/(x - 1)^2 + C",
  );
  assert.equal(analyzeIntegral("integrate 1/(x - 1)^2 from 2 to 3").answer, "integral = 0.5");
});

runTest("integral mode handles irreducible quadratic partial fractions", () => {
  assert.equal(analyzeIntegral("integrate 1/(x^2 + 1)").answer, "atan(x) + C");
  assert.equal(analyzeIntegral("integrate x/(x^2 + 1)").answer, "0.5ln(abs(x^2 + 1)) + C");
  assert.equal(analyzeIntegral("integrate (2x + 3)/(x^2 + 1)").answer, "ln(abs(x^2 + 1)) + 3atan(x) + C");
  assert.equal(analyzeIntegral("integrate 1/(x^2 + 2x + 2)").answer, "atan(x + 1) + C");
  assert.equal(
    analyzeIntegral("integrate 1/((x + 1)*(x^2 + 1))").answer,
    "0.5ln(abs(x + 1)) - 0.25ln(abs(x^2 + 1)) + 0.5atan(x) + C",
  );
  assert.equal(analyzeIntegral("integrate 1/(x^2 + 1) from 0 to 1").answer, "integral = 0.785398");
});

runTest("integral mode applies u-substitution", () => {
  assert.equal(analyzeIntegral("integrate 2x*cos(x^2)").answer, "sin(x ^ 2) + C");
  assert.equal(analyzeIntegral("integrate x*cos(x^2)").answer, "0.5sin(x ^ 2) + C");
  assert.equal(analyzeIntegral("integrate 3x^2*exp(x^3)").answer, "exp(x ^ 3) + C");
  assert.equal(analyzeIntegral("integrate 2x*sin(x^2)").answer, "-cos(x ^ 2) + C");
  assert.equal(analyzeIntegral("integrate 2x*tan(x^2)").answer, "-ln(abs(cos(x ^ 2))) + C");
  assert.equal(analyzeIntegral("integrate 2x*cos(x^2) from 0 to 1").answer, "integral = 0.841471");
});

runTest("integral mode handles integration by parts for linear factors", () => {
  assert.equal(analyzeIntegral("integrate x*exp(x)").answer, "(x - 1) * exp(x) + C");
  assert.equal(analyzeIntegral("integrate x*sin(x)").answer, "-x * cos(x) + sin(x) + C");
  assert.equal(analyzeIntegral("integrate x*cos(x)").answer, "x * sin(x) + cos(x) + C");
  assert.equal(analyzeIntegral("integrate x*exp(x) from 0 to 1").answer, "integral = 1");
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

runTest("graph mode overlays tangent lines", () => {
  const result = analyzeGraph("graph tangent line x^2 at x=2 from 0 to 4");

  assert.equal(result.summary, "tangent line graph");
  assert.equal(result.answer, "tangent line: y = 4x - 4");
  assert.equal(artifactValue(result, "Derivative"), "2x");
  assert.equal(artifactValue(result, "Tangency point"), "(2, 4)");
  assert.equal(artifactValue(result, "Slope"), "4");
  assert.equal(result.graph.lines.length, 2);
  assert.equal(result.graph.lines[1].className, "graph-line-accent");
  assert.deepEqual(result.table.rows.find((row) => row[0] === "2"), ["2", "4", "4"]);
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
  assert.equal(result.graph.kind, "root-iterations");
  assert.equal(result.graph.scatterLabel, "Iterations");
  assert.ok(result.graph.lines.some((series) => series.label === "Newton tangent steps"));
  assert.equal(result.table.headers.join(","), "Iter,x,f(x),f'(x),Next x");
  assert.ok(Number(artifactValue(result, "Iterations")) > 3);
});

runTest("numerical mode runs bisection", () => {
  const result = analyzeNumerical("bisection x^2 - 4 interval 0 3");

  assert.equal(result.summary, "bisection root");
  assert.equal(result.answer, "x ~= 2");
  assert.equal(result.graph.kind, "root-iterations");
  assert.equal(result.graph.scatterLabel, "Iterations");
  assert.equal(result.table.headers.join(","), "Iter,Low,High,Mid,f(mid)");
  assert.equal(artifactValue(result, "Initial bracket"), "[0, 3]");
  assert.ok(Number(artifactValue(result, "Iterations")) > 20);
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

runTest("differential equation mode analyzes linear ODE systems", () => {
  const equationInput = analyzeDifferentialEquation("ode system dx/dt = y; dy/dt = -2*x - 3*y; x0=1 y0=0 t=1");
  const matrixInput = analyzeDifferentialEquation("phase plane [[0,1],[-2,-3]] initial [1,0] t=1");

  assert.equal(equationInput.summary, "linear ODE system");
  assert.equal(equationInput.answer, "state(1) = [0.600424, -0.465088]; stable node");
  assert.equal(artifactValue(equationInput, "Eigenvalues"), "-1, -2");
  assert.equal(artifactValue(equationInput, "Classification"), "stable node");
  assert.equal(equationInput.table.headers.join(","), "x,y,x',y'");
  assert.equal(matrixInput.answer, equationInput.answer);
});

runTest("differential equation mode analyzes nonlinear phase planes", () => {
  const statement = "phase plane x' = x - x*y; y' = -y + x*y; x0=2 y0=1 t=1 steps=40";
  const result = analyzeDifferentialEquation(statement);

  assert.equal(result.summary, "nonlinear ODE system");
  assert.equal(result.answer, "state(1) ~= [1.156474, 1.977678]; equilibria: [0, 0] saddle point; [1, 1] center");
  assert.equal(result.details, "2D autonomous system with numeric equilibria, nullclines, and RK4 trajectory");
  assert.equal(artifactValue(result, "Equilibria found"), "2");
  assert.equal(artifactValue(result, "Equilibria"), "[0, 0] saddle point; [1, 1] center");
  assert.equal(artifactValue(result, "Nullcline samples"), "66");
  assert.deepEqual(result.extraTables.map((table) => table.title), ["Equilibria and local linearization", "Approximate nullcline samples", "Trajectory samples"]);
  assert.deepEqual(result.extraTables[0].rows, [["0", "0", "0", "-1", "saddle point"], ["1", "1", "0", "1", "center"]]);
  assert.deepEqual(result.graphs.map((graph) => graph.expression), ["Nonlinear phase trajectory", "Approximate nonlinear nullclines"]);
  assert.deepEqual(result.graphs[1].lines.map((line) => line.label), ["x'=0", "y'=0"]);
  assert.equal(analyzeUniversal(statement).summary, "nonlinear ODE system");
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
  const nonlinear = analyzeUniversal("solve nonlinear equations x^2 + y^2 = 25; x - y = 1 guess x=3 y=2");

  assert.equal(result.summary, "linear system");
  assert.equal(result.answer, "x = 2, y = 1");
  assert.equal(nonlinear.summary, "nonlinear system");
  assert.equal(nonlinear.answer, "x = 4, y = 3");
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
  assert.equal(analyzeUniversal("tangent line x^2 at x=2").summary, "tangent line graph");
  assert.equal(analyzeUniversal("fourier series x from -pi to pi order=5").summary, "Fourier series");
  assert.equal(analyzeUniversal("newton x^3 - x - 2 guess=1").summary, "Newton root");
  assert.equal(analyzeUniversal("simpson integrate sin(x) from 0 to pi n=100").summary, "simpson numerical integration");
  assert.equal(analyzeUniversal("rk4 dy/dt = t + y y0=1 from t=0 to 1 h=0.25").summary, "RK4 numerical ODE");
  assert.equal(analyzeUniversal("ode dy/dt = 0.3y y0=2 t=5").summary, "exponential ODE");
  assert.equal(analyzeUniversal("ode system dx/dt = y; dy/dt = -2*x - 3*y; x0=1 y0=0 t=1").summary, "linear ODE system");
  assert.equal(analyzeUniversal("newton cooling ambient=70 initial=100 k=0.2 t=10").summary, "Newton cooling");
  assert.equal(analyzeUniversal("proportion ci successes=42 n=100 confidence=95").summary, "one-proportion confidence interval");
  assert.equal(analyzeUniversal("bootstrap mean data 10, 12, 14, 16, 18 resamples=1000 seed=7 confidence=95").summary, "bootstrap confidence interval");
  assert.equal(analyzeUniversal("normality test data 10, 12, 13, 15, 30, 31, 32, 33").summary, "Jarque-Bera normality test");
  assert.equal(analyzeUniversal("anderson-darling normality data 10, 12, 13, 15, 30, 31, 32, 33").summary, "Anderson-Darling normality test");
  assert.equal(analyzeUniversal("ks test group1: 1, 2, 3, 4; group2: 3, 4, 5, 6").summary, "two-sample Kolmogorov-Smirnov test");
  assert.equal(analyzeUniversal("mcnemar [[20,5],[15,60]]").summary, "McNemar paired categorical test");
  assert.equal(analyzeUniversal("permutation test group1: 10, 12, 9; group2: 8, 7, 11 resamples=2000 seed=5").summary, "permutation test");
  assert.equal(analyzeUniversal("adjust p-values p: 0.003, 0.02, 0.04, 0.20, 0.001 alpha=0.05").summary, "multiple-testing correction");
  assert.equal(analyzeUniversal("kaplan-meier times: 5, 6, 6, 8, 10; events: 1, 1, 0, 1, 0").summary, "Kaplan-Meier survival");
  assert.equal(analyzeUniversal("log-rank group1 times: 5, 6, 6, 8, 10 events: 1, 1, 0, 1, 0; group2 times: 4, 6, 7, 9, 12 events: 1, 0, 1, 1, 0").summary, "log-rank test");
  assert.equal(analyzeUniversal("cox regression times: 5, 6, 6, 8, 10, 12; events: 1, 1, 0, 1, 0, 1; x: 0, 1, 0, 1, 1, 0").summary, "Cox proportional hazards");
  assert.equal(analyzeUniversal("ar(1) series: 10, 12, 13, 15, 16, 18 forecast=3").summary, "AR(1) time-series forecast");
  assert.equal(analyzeUniversal("arima(2,1,0) series: 10, 13, 15, 18, 22, 27, 31, 38 forecast=3").summary, "ARIMA forecast");
  assert.equal(analyzeUniversal("sample size mean effect=0.5 power=0.8 alpha=0.05").summary, "sample size analysis");
  assert.equal(analyzeUniversal("meta-analysis effects: 0.2, 0.5, 0.1, 0.7; se: 0.1, 0.2, 0.15, 0.25").summary, "meta-analysis");
  assert.equal(analyzeUniversal("quadratic regression degree=2 for (1,2), (2,5), (3,10), (4,17); predict x=5").summary, "polynomial regression");
  assert.equal(analyzeUniversal("compare regression models y: 2, 3, 5, 8, 13, 21; x: 1, 2, 3, 4, 5, 6 degrees=1,2,3").summary, "regression model comparison");
  assert.equal(analyzeUniversal("multiple regression y: 4, 7, 9, 12, 15; x1: 1, 2, 3, 4, 5; x2: 0, 1, 0, 1, 1; predict x1=6 x2=0").summary, "multiple linear regression");
  assert.equal(analyzeUniversal("pearson correlation x: 1,2,3,4,5,6; y: 2,4,5,4,5,7").summary, "Pearson correlation test");
  assert.equal(analyzeUniversal("spearman correlation x: 1,2,3,4,5,6; y: 1,3,2,5,4,6").summary, "Spearman rank correlation");
  assert.equal(analyzeUniversal("kendall correlation x: 1,2,2,3,4,5; y: 1,2,3,3,5,4").summary, "Kendall tau-b correlation");
  assert.equal(analyzeUniversal("regression diagnostics y: 2, 3, 5, 8, 13, 21; x: 1, 2, 3, 4, 5, 6").summary, "regression diagnostics");
  assert.equal(analyzeUniversal("ridge regression lambda=1 y: 4, 7, 9, 12, 15; x1: 1, 2, 3, 4, 5; x2: 0, 1, 0, 1, 1; predict x1=6 x2=0").summary, "ridge regression");
  assert.equal(analyzeUniversal("lasso regression lambda=1 y: 4, 7, 9, 12, 15; x1: 1, 2, 3, 4, 5; x2: 0, 1, 0, 1, 1; predict x1=6 x2=0").summary, "LASSO regression");
  assert.equal(analyzeUniversal("logistic regression y: 0,0,1,0,1,1; x: 1,2,3,4,5,6; predict x=4.5").summary, "logistic regression");
  assert.equal(analyzeUniversal("naive bayes class: 0, 0, 0, 1, 1, 1; x1: 1, 2, 1.5, 5, 6, 5.5; x2: 1, 1.2, 0.8, 5, 5.5, 4.8; predict x1=3.1 x2=2.6").summary, "Gaussian Naive Bayes");
  assert.equal(analyzeUniversal("lda class: 0, 0, 0, 1, 1, 1; x1: 1, 2, 1.5, 5, 6, 5.5; x2: 1, 1.2, 0.8, 5, 5.5, 4.8; regularization=0.001 predict x1=5.2 x2=5").summary, "linear discriminant analysis");
  assert.equal(analyzeUniversal("qda class: 0, 0, 0, 1, 1, 1; x1: 1, 2, 1.5, 5, 6, 5.5; x2: 1, 1.2, 0.8, 5, 5.5, 4.8; regularization=0.001 predict x1=5.2 x2=5").summary, "quadratic discriminant analysis");
  assert.equal(analyzeUniversal("random forest class: 0, 0, 0, 1, 1, 1; x1: 1, 2, 1.5, 5, 6, 5.5; x2: 1, 1.2, 0.8, 5, 5.5, 4.8; trees=9 maxDepth=2 seed=7 predict x1=5.2 x2=5").summary, "random forest classifier");
  assert.equal(analyzeUniversal("roc actual: 1, 1, 0, 1, 0, 0; scores: 0.9, 0.75, 0.6, 0.55, 0.3, 0.1").summary, "ROC/AUC analysis");
  assert.equal(analyzeUniversal("poisson regression y: 1, 2, 1, 3, 4, 5; x: 0, 1, 2, 3, 4, 5; predict x=6").summary, "Poisson regression");
  assert.equal(analyzeUniversal("pca x: 1,2,3,4; y: 2,3,5,8").summary, "principal component analysis");
  assert.equal(analyzeUniversal("pca x: 1,2,3,4,5; y: 2,3,5,8,13; z: 5,4,3,2,1").summary, "principal component analysis");
  assert.equal(analyzeUniversal("correlation matrix x: 1,2,3,4; y: 2,3,5,8").answer, "correlation matrix = [[1, 0.9759], [0.9759, 1]]");
  assert.equal(analyzeUniversal("k-means k=3 points (1,1), (1,2), (5,5), (6,5), (10,10), (10,11)").summary, "k-means clustering");
  assert.equal(analyzeUniversal("one-proportion z-test successes=56 n=100 p0=0.5").summary, "one-proportion z test");
  assert.equal(analyzeUniversal("two-proportion z-test successes1=56 n1=100 successes2=44 n2=100").summary, "two-proportion z test");
  assert.equal(analyzeUniversal("variance test group1: 10,12,9,11; group2: 8,7,11,9").summary, "two-sample variance F test");
  assert.equal(analyzeUniversal("chi-square observed 10,20,30 expected 15,15,30").summary, "chi-square goodness-of-fit");
  assert.equal(analyzeUniversal("chi-square independence [[30,10],[20,40]]").summary, "chi-square independence test");
  assert.equal(analyzeUniversal("fisher exact [[1,9],[11,3]]").summary, "Fisher exact test");
  assert.equal(analyzeUniversal("paired t-test before: 10,12,9; after: 11,14,10").summary, "paired t test");
  assert.equal(analyzeUniversal("ANOVA group1: 8,9,10; group2: 12,13,14; group3: 9,11,10").summary, "one-way ANOVA");
  assert.equal(analyzeUniversal("manova control: (1,2), (2,1), (1.5,1.8), (2.2,2.5); treatment: (4,5), (5,4.5), (4.2,5.2), (5.1,5.4); followup: (6,7), (7,6.5), (6.5,7.2), (7.1,7.4)").summary, "one-way MANOVA");
  assert.equal(analyzeUniversal("ancova y: 10,12,13,15,14,17,18,21; group: control,control,control,control,treatment,treatment,treatment,treatment; x: 1,2,3,4,1,2,3,4").summary, "ANCOVA");
  assert.equal(analyzeUniversal("repeated measures anova baseline: 10,12,11,13; week1: 12,13,12,15; week2: 14,15,13,17").summary, "repeated-measures ANOVA");
  assert.equal(analyzeUniversal("two-way anova y: 6,7,8,9,10,11,15,16; A: low,low,low,low,high,high,high,high; B: control,control,treatment,treatment,control,control,treatment,treatment").summary, "two-way ANOVA");
  assert.equal(analyzeUniversal("poisson lambda=3 k=2").summary, "Poisson probability");
  assert.equal(analyzeUniversal("geometric p=0.25 k=3").summary, "geometric probability");
  assert.equal(analyzeUniversal("exponential lambda=2 x=1").summary, "exponential probability");
  assert.equal(analyzeUniversal("uniform min=2 max=10 between 4 and 7").summary, "uniform probability");
  assert.equal(analyzeUniversal("inverse normal p=0.975 mean=0 sd=1").summary, "inverse normal");
  assert.equal(analyzeUniversal("student t df=10 x=2 greater").summary, "Student t distribution");
  assert.equal(analyzeUniversal("chi-square distribution df=5 x=10 greater").summary, "chi-square distribution");
  assert.equal(analyzeUniversal("f distribution df1=5 df2=10 x=2 greater").summary, "F distribution");
  assert.equal(analyzeUniversal("hypergeometric population=50 successes=5 draws=10 k=2").summary, "hypergeometric probability");
  assert.equal(analyzeUniversal("expected value values: 0, 1, 2 probabilities: 0.2, 0.5, 0.3").summary, "discrete expected value");
  assert.equal(analyzeUniversal("bayes prior=0.01 sensitivity=0.99 specificity=0.95").summary, "Bayes theorem");
  assert.equal(analyzeUniversal("bayesian ab test A: 120/1000; B: 150/1000; alpha=1 beta=1").summary, "Bayesian A/B test");
  assert.equal(analyzeUniversal("bayesian linear regression y: 4, 7, 9, 12, 15; x: 1, 2, 3, 4, 5; priorMean=0 priorSd=10 sigma=1 predict x=6").summary, "Bayesian linear regression");
  assert.equal(analyzeUniversal("bayesian normal mean data: 10, 12, 14, 15; priorMean=11 priorSd=3 sigma=2 threshold=13").summary, "Bayesian normal mean");
  assert.equal(analyzeUniversal("markov [[0.7,0.3],[0.2,0.8]] start [1,0] steps=3").answer, "after 3 steps = [0.475, 0.525]");
  assert.equal(analyzeUniversal("stationary markov [[0.7,0.3],[0.2,0.8]]").summary, "Markov stationary distribution");
  assert.equal(analyzeUniversal("beta posterior successes=12 n=20 alpha=2 beta=2 confidence=95").summary, "Bayesian proportion posterior");
  assert.equal(analyzeUniversal("mann-whitney group1: 10,12,9; group2: 8,7,11").summary, "Mann-Whitney U test");
  assert.equal(analyzeUniversal("wilcoxon signed-rank before: 10,12,9,11; after: 11,14,10,13").summary, "Wilcoxon signed-rank test");
  assert.equal(analyzeUniversal("kruskal-wallis group1: 8,9,10; group2: 12,13,14; group3: 9,11,10").summary, "Kruskal-Wallis test");
  assert.equal(analyzeUniversal("welch anova group1: 8,9,10; group2: 14,16,17; group3: 20,24,29").summary, "Welch one-way ANOVA");
  assert.equal(analyzeUniversal("rank [[1,2],[2,4]]").summary, "matrix rank");
  assert.equal(analyzeUniversal("row space [[1,2,1],[2,4,2],[1,1,0]]").summary, "matrix row space");
  assert.equal(analyzeUniversal("column space [[1,2,1],[2,4,2],[1,1,0]]").summary, "matrix column space");
  assert.equal(analyzeUniversal("qr [[1,1],[1,0],[0,1]]").summary, "QR decomposition");
  assert.equal(analyzeUniversal("svd [[3,1],[1,3]]").summary, "singular value decomposition");
  assert.equal(analyzeUniversal("eigen [[2,1],[1,2]]").summary, "2x2 eigenvalues");
  assert.equal(analyzeUniversal("eigenvalues [[4,1,0],[1,3,0],[0,0,2]]").summary, "symmetric matrix eigenvalues");
  assert.equal(analyzeUniversal("eigenvectors [[4,1,0],[1,3,0],[0,0,2]]").summary, "symmetric matrix eigenvectors");
  assert.equal(analyzeUniversal("power iteration [[4,1,0],[1,3,0],[0,0,2]]").summary, "dominant eigenpair");
  assert.equal(analyzeUniversal("nullspace [[1,2,1],[2,4,2],[1,1,0]]").summary, "matrix null space");
  assert.equal(analyzeUniversal("eigenvectors [[2,1],[1,2]]").summary, "2x2 eigenvectors");
  assert.equal(analyzeUniversal("eigenvectors [[0,-1],[1,0]]").answer, "lambda i: [[1, -i]]; lambda -i: [[1, i]]");
  assert.equal(analyzeUniversal("dot [1,2,3] [4,5,6]").summary, "dot product");
  assert.equal(analyzeUniversal("angle between [1,0] [0,1]").summary, "vector angle");
  assert.equal(analyzeUniversal("arithmetic sequence a1=3 d=5 n=10").summary, "arithmetic sequence");
  assert.equal(analyzeUniversal("sum k^2 from k=1 to 5").answer, "sum = 55");
  assert.equal(analyzeUniversal("circle radius=3").summary, "circle geometry");
  assert.equal(analyzeUniversal("distance between (1,2) and (4,6)").summary, "coordinate distance");
});
