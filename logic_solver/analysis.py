"""Mathematical analysis tools for expression trees."""

from __future__ import annotations

from dataclasses import dataclass
from itertools import product
from typing import Iterable

from logic_solver.nodes import Binary, Expression, Not


Assignment = dict[str, bool]
TruthRow = tuple[Assignment, bool]


@dataclass(frozen=True)
class Classification:
    name: str
    true_rows: int
    false_rows: int
    total_rows: int


@dataclass(frozen=True)
class Complexity:
    nodes: int
    height: int
    variables: int
    operators: int


def all_assignments(variables: Iterable[str]) -> list[Assignment]:
    ordered = sorted(variables)
    return [
        dict(zip(ordered, values))
        for values in product((False, True), repeat=len(ordered))
    ]


def truth_table(expression: Expression) -> list[TruthRow]:
    rows: list[TruthRow] = []
    for assignment in all_assignments(expression.variables()):
        rows.append((assignment, expression.evaluate(assignment)))
    return rows


def classify(expression: Expression) -> Classification:
    rows = truth_table(expression)
    true_rows = sum(1 for _, result in rows if result)
    false_rows = len(rows) - true_rows

    if true_rows == len(rows):
        name = "tautology"
    elif false_rows == len(rows):
        name = "contradiction"
    else:
        name = "contingency"

    return Classification(name, true_rows, false_rows, len(rows))


def satisfying_assignments(expression: Expression) -> list[Assignment]:
    return [assignment for assignment, result in truth_table(expression) if result]


def find_equivalence_counterexample(
    left: Expression,
    right: Expression,
) -> Assignment | None:
    variables = left.variables() | right.variables()
    for assignment in all_assignments(variables):
        if left.evaluate(assignment) != right.evaluate(assignment):
            return assignment
    return None


def are_equivalent(left: Expression, right: Expression) -> bool:
    return find_equivalence_counterexample(left, right) is None


def complexity(expression: Expression) -> Complexity:
    nodes, height, operators = _walk_complexity(expression)
    return Complexity(
        nodes=nodes,
        height=height,
        variables=len(expression.variables()),
        operators=operators,
    )


def _walk_complexity(expression: Expression) -> tuple[int, int, int]:
    children = expression.children()
    if not children:
        return 1, 1, 0

    child_metrics = [_walk_complexity(child) for child in children]
    nodes = 1 + sum(metric[0] for metric in child_metrics)
    height = 1 + max(metric[1] for metric in child_metrics)
    operators = int(isinstance(expression, (Binary, Not))) + sum(
        metric[2] for metric in child_metrics
    )
    return nodes, height, operators

