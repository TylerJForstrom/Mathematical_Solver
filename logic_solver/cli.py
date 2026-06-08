"""Command line entry point for the mathematical solver."""

from __future__ import annotations

import argparse
from collections.abc import Sequence

from logic_solver.analysis import (
    Classification,
    classify,
    complexity,
    find_equivalence_counterexample,
    truth_table,
)
from logic_solver.nodes import EvaluationError, format_truth
from logic_solver.parser import ParseError, parse


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="math-solver",
        description="Evaluate a propositional logic statement with an expression tree.",
    )
    parser.add_argument(
        "statement",
        nargs="?",
        help="Logic statement such as '(P and Q) -> R'.",
    )
    parser.add_argument(
        "--values",
        nargs="*",
        default=[],
        metavar="NAME=BOOL",
        help="Variable assignments, such as P=true Q=false.",
    )
    parser.add_argument(
        "--tree",
        action="store_true",
        help="Print the expression tree before evaluating.",
    )
    parser.add_argument(
        "--table",
        action="store_true",
        help="Print a full truth table for the statement.",
    )
    parser.add_argument(
        "--classify",
        action="store_true",
        help="Classify the statement as a tautology, contradiction, or contingency.",
    )
    parser.add_argument(
        "--compare",
        metavar="OTHER",
        help="Compare this statement with another statement for logical equivalence.",
    )
    parser.add_argument(
        "--metrics",
        action="store_true",
        help="Print expression-tree complexity metrics.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not args.statement:
        parser.print_help()
        return 0

    try:
        expression = parse(args.statement)
        values = parse_values(args.values)

        if args.tree:
            print(expression.render_tree())

        if args.metrics:
            metrics = complexity(expression)
            print(
                "metrics: "
                f"nodes={metrics.nodes}, "
                f"height={metrics.height}, "
                f"variables={metrics.variables}, "
                f"operators={metrics.operators}"
            )

        if args.table:
            print_truth_table(expression)

        if args.classify:
            print_classification(classify(expression))

        if args.compare:
            other_expression = parse(args.compare)
            counterexample = find_equivalence_counterexample(
                expression,
                other_expression,
            )
            if counterexample is None:
                print("equivalent: true")
            else:
                print("equivalent: false")
                print(
                    "counterexample: "
                    + ", ".join(
                        f"{name}={format_truth(value)}"
                        for name, value in sorted(counterexample.items())
                    )
                )

        should_evaluate_once = bool(values) or not expression.variables()
        has_analysis_action = (
            args.table or args.classify or args.compare or args.metrics
        )
        if should_evaluate_once:
            result = expression.evaluate(values)
            print(f"{expression.to_infix()} = {format_truth(result)}")
        elif not has_analysis_action:
            variables = ", ".join(sorted(expression.variables()))
            print(f"variables: {variables}")
            print("Use --values NAME=true to evaluate one case or --table for all cases.")
    except (ParseError, EvaluationError) as error:
        print(f"Error: {error}")
        return 2

    return 0


def parse_values(pairs: Sequence[str]) -> dict[str, bool]:
    values: dict[str, bool] = {}
    for pair in pairs:
        if "=" not in pair:
            raise EvaluationError(
                f"Expected value assignment like P=true, got '{pair}'."
            )
        name, raw_value = pair.split("=", 1)
        name = name.strip()
        if not name:
            raise EvaluationError("Variable names cannot be empty.")
        values[name] = parse_bool(raw_value)
    return values


def parse_bool(raw_value: str) -> bool:
    normalized = raw_value.strip().lower()
    if normalized in ("true", "t", "1", "yes", "y"):
        return True
    if normalized in ("false", "f", "0", "no", "n"):
        return False
    raise EvaluationError(f"Expected true/false value, got '{raw_value}'.")


def print_truth_table(expression) -> None:
    variables = sorted(expression.variables())
    rows = truth_table(expression)
    headers = variables + ["result"]
    rendered_rows = [
        [format_truth(assignment[name]) for name in variables]
        + [format_truth(result)]
        for assignment, result in rows
    ]
    widths = [
        max(len(headers[index]), *(len(row[index]) for row in rendered_rows))
        for index in range(len(headers))
    ]

    print(" | ".join(header.ljust(widths[index]) for index, header in enumerate(headers)))
    print("-+-".join("-" * width for width in widths))
    for row in rendered_rows:
        print(" | ".join(cell.ljust(widths[index]) for index, cell in enumerate(row)))


def print_classification(summary: Classification) -> None:
    print(
        "classification: "
        f"{summary.name} "
        f"({summary.true_rows}/{summary.total_rows} true, "
        f"{summary.false_rows}/{summary.total_rows} false)"
    )


if __name__ == "__main__":
    raise SystemExit(main())
