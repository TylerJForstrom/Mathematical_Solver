from __future__ import annotations

import unittest

from logic_solver.analysis import classify, find_equivalence_counterexample
from logic_solver.parser import ParseError, parse


class LogicSolverTests(unittest.TestCase):
    def test_evaluates_implication_tree(self) -> None:
        expression = parse("(P and Q) -> R")

        self.assertTrue(
            expression.evaluate({"P": True, "Q": False, "R": False})
        )
        self.assertFalse(
            expression.evaluate({"P": True, "Q": True, "R": False})
        )

    def test_operator_precedence(self) -> None:
        expression = parse("P or Q and R")

        self.assertFalse(
            expression.evaluate({"P": False, "Q": True, "R": False})
        )
        self.assertTrue(
            expression.evaluate({"P": True, "Q": False, "R": False})
        )

    def test_classifies_tautology(self) -> None:
        summary = classify(parse("P or not P"))

        self.assertEqual(summary.name, "tautology")
        self.assertEqual(summary.false_rows, 0)

    def test_classifies_contradiction(self) -> None:
        summary = classify(parse("P and not P"))

        self.assertEqual(summary.name, "contradiction")
        self.assertEqual(summary.true_rows, 0)

    def test_finds_no_counterexample_for_equivalent_statements(self) -> None:
        left = parse("P -> Q")
        right = parse("not P or Q")

        self.assertIsNone(find_equivalence_counterexample(left, right))

    def test_finds_counterexample_for_different_statements(self) -> None:
        left = parse("P")
        right = parse("Q")

        self.assertEqual(
            find_equivalence_counterexample(left, right),
            {"P": False, "Q": True},
        )

    def test_rejects_invalid_syntax(self) -> None:
        with self.assertRaises(ParseError):
            parse("P and -> Q")


if __name__ == "__main__":
    unittest.main()

