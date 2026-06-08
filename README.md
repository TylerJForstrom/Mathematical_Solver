# Mathematical Solver

Mathematical Solver is a browser-based symbolic math and logic workbench. It
parses problems into expression trees, then uses those trees to evaluate logic,
simplify algebra, solve equations, compute derivatives, and explain the work
step by step.

The frontend currently supports:

- Propositional logic evaluation and truth tables
- Algebra simplification with constants and like terms
- Linear and quadratic equation solving
- Polynomial derivatives with power, sum, difference, product, and quotient rules
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

- Four simple modes: Equation, Simplify, Derivative, and Logic
- A single problem input with example buttons
- A clear answer area
- Expression-tree visualization
- Truth tables for logic mode
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

1. Add exact radical output for quadratic equations with irrational roots.
2. Add trigonometric simplification identities.
3. Add definite and indefinite integration for common functions.
4. Add systems of linear equations with Gaussian elimination.
5. Convert logic statements to negation normal form, conjunctive normal form, and
   disjunctive normal form.
6. Add Boolean algebra simplification rules, such as idempotent laws,
   absorption laws, De Morgan's laws, and double-negation elimination.
7. Build a small SAT solver using the DPLL algorithm instead of checking every
   truth-table row.
8. Generate formal proof steps for tautologies using natural deduction or
   sequent calculus.
9. Add semantic tableaux, which are also tree-based, to prove whether a
   statement is satisfiable.
10. Add Karnaugh maps for statements with two to four variables.
11. Export expression trees to Graphviz DOT so the parse tree can be visualized.
12. Add binary decision diagrams to represent equivalent formulas compactly.
13. Add probability or fuzzy truth values so statements can evaluate beyond
    simple true/false logic.
