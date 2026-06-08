"""Recursive descent parser for propositional logic statements."""

from __future__ import annotations

from dataclasses import dataclass

from logic_solver.nodes import Binary, Constant, Expression, Not, Variable


class ParseError(ValueError):
    """Raised when a statement cannot be parsed."""


@dataclass(frozen=True)
class Token:
    kind: str
    value: str
    position: int


SYMBOL_OPERATORS = {
    "!": "NOT",
    "~": "NOT",
    "&": "AND",
    "&&": "AND",
    "|": "OR",
    "||": "OR",
    "^": "XOR",
    "->": "IMPLIES",
    "=>": "IMPLIES",
    "<->": "IFF",
    "<=>": "IFF",
}

WORD_OPERATORS = {
    "not": "NOT",
    "and": "AND",
    "or": "OR",
    "xor": "XOR",
    "implies": "IMPLIES",
    "iff": "IFF",
}


def parse(statement: str) -> Expression:
    parser = Parser(tokenize(statement))
    return parser.parse()


def tokenize(statement: str) -> list[Token]:
    tokens: list[Token] = []
    index = 0

    while index < len(statement):
        char = statement[index]

        if char.isspace():
            index += 1
            continue

        matched = _match_symbol_operator(statement, index)
        if matched:
            tokens.append(Token("OP", SYMBOL_OPERATORS[matched], index))
            index += len(matched)
            continue

        if char == "(":
            tokens.append(Token("LPAREN", char, index))
            index += 1
            continue

        if char == ")":
            tokens.append(Token("RPAREN", char, index))
            index += 1
            continue

        if char.isalpha() or char == "_":
            start = index
            index += 1
            while index < len(statement) and (
                statement[index].isalnum() or statement[index] == "_"
            ):
                index += 1
            word = statement[start:index]
            lower_word = word.lower()

            if lower_word in ("true", "false"):
                tokens.append(Token("CONST", lower_word, start))
            elif lower_word in WORD_OPERATORS:
                tokens.append(Token("OP", WORD_OPERATORS[lower_word], start))
            else:
                tokens.append(Token("VAR", word, start))
            continue

        raise ParseError(f"Unexpected character '{char}' at position {index}.")

    tokens.append(Token("EOF", "", len(statement)))
    return tokens


class Parser:
    def __init__(self, tokens: list[Token]) -> None:
        self.tokens = tokens
        self.index = 0

    def parse(self) -> Expression:
        expression = self._parse_iff()
        if not self._is("EOF"):
            token = self._current()
            raise ParseError(
                f"Unexpected token '{token.value}' at position {token.position}."
            )
        return expression

    def _parse_iff(self) -> Expression:
        expression = self._parse_implies()
        while self._match_op("IFF"):
            expression = Binary("iff", expression, self._parse_implies())
        return expression

    def _parse_implies(self) -> Expression:
        expression = self._parse_or()
        if self._match_op("IMPLIES"):
            expression = Binary("implies", expression, self._parse_implies())
        return expression

    def _parse_or(self) -> Expression:
        expression = self._parse_xor()
        while self._match_op("OR"):
            expression = Binary("or", expression, self._parse_xor())
        return expression

    def _parse_xor(self) -> Expression:
        expression = self._parse_and()
        while self._match_op("XOR"):
            expression = Binary("xor", expression, self._parse_and())
        return expression

    def _parse_and(self) -> Expression:
        expression = self._parse_not()
        while self._match_op("AND"):
            expression = Binary("and", expression, self._parse_not())
        return expression

    def _parse_not(self) -> Expression:
        if self._match_op("NOT"):
            return Not(self._parse_not())
        return self._parse_atom()

    def _parse_atom(self) -> Expression:
        token = self._current()

        if self._match("CONST"):
            return Constant(token.value == "true")

        if self._match("VAR"):
            return Variable(token.value)

        if self._match("LPAREN"):
            expression = self._parse_iff()
            if not self._match("RPAREN"):
                current = self._current()
                raise ParseError(
                    f"Expected ')' before position {current.position}."
                )
            return expression

        raise ParseError(f"Expected expression at position {token.position}.")

    def _current(self) -> Token:
        return self.tokens[self.index]

    def _is(self, kind: str, value: str | None = None) -> bool:
        token = self._current()
        if token.kind != kind:
            return False
        return value is None or token.value == value

    def _match(self, kind: str, value: str | None = None) -> bool:
        if self._is(kind, value):
            self.index += 1
            return True
        return False

    def _match_op(self, operator: str) -> bool:
        return self._match("OP", operator)


def _match_symbol_operator(statement: str, index: int) -> str | None:
    for symbol in ("<->", "<=>", "->", "=>", "&&", "||", "!", "~", "&", "|", "^"):
        if statement.startswith(symbol, index):
            return symbol
    return None

