"""Expression tree nodes for propositional logic."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping


class EvaluationError(ValueError):
    """Raised when an expression cannot be evaluated with the given values."""


class Expression:
    """Base class for expression tree nodes."""

    def evaluate(self, values: Mapping[str, bool]) -> bool:
        raise NotImplementedError

    def variables(self) -> set[str]:
        raise NotImplementedError

    def children(self) -> tuple["Expression", ...]:
        return ()

    def label(self) -> str:
        raise NotImplementedError

    def to_infix(self) -> str:
        raise NotImplementedError

    def render_tree(self) -> str:
        lines: list[str] = []
        _render(self, "", True, lines)
        return "\n".join(lines)


@dataclass(frozen=True)
class Constant(Expression):
    value: bool

    def evaluate(self, values: Mapping[str, bool]) -> bool:
        return self.value

    def variables(self) -> set[str]:
        return set()

    def label(self) -> str:
        return "TRUE" if self.value else "FALSE"

    def to_infix(self) -> str:
        return self.label().lower()


@dataclass(frozen=True)
class Variable(Expression):
    name: str

    def evaluate(self, values: Mapping[str, bool]) -> bool:
        if self.name not in values:
            raise EvaluationError(f"Missing truth value for variable '{self.name}'.")
        return bool(values[self.name])

    def variables(self) -> set[str]:
        return {self.name}

    def label(self) -> str:
        return self.name

    def to_infix(self) -> str:
        return self.name


@dataclass(frozen=True)
class Not(Expression):
    operand: Expression

    def evaluate(self, values: Mapping[str, bool]) -> bool:
        return not self.operand.evaluate(values)

    def variables(self) -> set[str]:
        return self.operand.variables()

    def children(self) -> tuple[Expression, ...]:
        return (self.operand,)

    def label(self) -> str:
        return "NOT"

    def to_infix(self) -> str:
        return f"not ({self.operand.to_infix()})"


@dataclass(frozen=True)
class Binary(Expression):
    operator: str
    left: Expression
    right: Expression

    def evaluate(self, values: Mapping[str, bool]) -> bool:
        left = self.left.evaluate(values)
        right = self.right.evaluate(values)

        if self.operator == "and":
            return left and right
        if self.operator == "or":
            return left or right
        if self.operator == "xor":
            return left != right
        if self.operator == "implies":
            return (not left) or right
        if self.operator == "iff":
            return left == right

        raise EvaluationError(f"Unknown binary operator '{self.operator}'.")

    def variables(self) -> set[str]:
        return self.left.variables() | self.right.variables()

    def children(self) -> tuple[Expression, ...]:
        return (self.left, self.right)

    def label(self) -> str:
        return self.operator.upper()

    def to_infix(self) -> str:
        return f"({self.left.to_infix()} {self.operator} {self.right.to_infix()})"


def format_truth(value: bool) -> str:
    return "true" if value else "false"


def _render(node: Expression, prefix: str, is_last: bool, lines: list[str]) -> None:
    connector = "`-- " if is_last else "|-- "
    lines.append(f"{prefix}{connector}{node.label()}")
    child_prefix = f"{prefix}{'    ' if is_last else '|   '}"
    children = node.children()
    for index, child in enumerate(children):
        _render(child, child_prefix, index == len(children) - 1, lines)

