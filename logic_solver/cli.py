"""Command line entry point for the mathematical solver."""

from __future__ import annotations

import argparse
from collections.abc import Sequence

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

        result = expression.evaluate(values)
    except (ParseError, EvaluationError) as error:
        print(f"Error: {error}")
        return 2

    print(f"{expression.to_infix()} = {format_truth(result)}")
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


if __name__ == "__main__":
    raise SystemExit(main())
