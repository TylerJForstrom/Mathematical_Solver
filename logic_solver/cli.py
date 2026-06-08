"""Command line entry point for the mathematical solver."""

from __future__ import annotations

import argparse


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
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    if not args.statement:
        parser.print_help()
        return

    print("Parser coming soon:", args.statement)


if __name__ == "__main__":
    main()

