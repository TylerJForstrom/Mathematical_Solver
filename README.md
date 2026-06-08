# Mathematical Solver

Mathematical Solver is a tree-based propositional logic project. It takes a
logic statement, parses it into an expression tree, and evaluates the tree as
true or false.

The project currently supports:

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

- A live propositional-logic statement editor
- Variable toggles for one-case evaluation
- Expression-tree visualization
- Truth-table generation
- Tautology, contradiction, and contingency classification
- Logical-equivalence checking
- Tree complexity metrics

Because the frontend is static HTML, CSS, and JavaScript, it can be hosted on
GitHub Pages without a backend.

## Run Tests

```powershell
python -m unittest discover -s tests
```

## Mathematical Upgrade Ideas

These are good ways to make the project more impressive mathematically:

1. Convert statements to negation normal form, conjunctive normal form, and
   disjunctive normal form.
2. Add Boolean algebra simplification rules, such as idempotent laws,
   absorption laws, De Morgan's laws, and double-negation elimination.
3. Build a small SAT solver using the DPLL algorithm instead of checking every
   truth-table row.
4. Generate formal proof steps for tautologies using natural deduction or
   sequent calculus.
5. Add semantic tableaux, which are also tree-based, to prove whether a
   statement is satisfiable.
6. Support predicate logic with quantifiers like `forall x` and `exists x`.
7. Add Karnaugh maps for statements with two to four variables.
8. Export expression trees to Graphviz DOT so the parse tree can be visualized.
9. Add binary decision diagrams to represent equivalent formulas compactly.
10. Add probability or fuzzy truth values so statements can evaluate beyond
    simple true/false logic.
