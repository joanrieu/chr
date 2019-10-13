# CHR Solver

**🔀 A solver for [Constraint Handling Rules](https://en.wikipedia.org/wiki/Constraint_Handling_Rules).**

## How do CHRs work?

CHRs are logic rules.

1. The system is given a set of rules it can use to make deductions.
2. The system is initialized using a list of facts constituting its starting point.
3. The stored facts will then evolve over time as the system adds or removes facts according to the rules.
4. If a stable state is reached, the program will stop. If no such state exists, it will keep running forever.

## Features of this solver

- simplification, propagation and simpagation rules,
- symbols (uppercase letters) and numbers in constraints,
- JavaScript expressions:
  - in heads (compute and assign),
  - guards (compute and use result as filter)
  - and body (compute and assign).

## Usage

Try ones of the examples:

    node chr.js primes/rules.tsv primes/store.tsv

The solver will iterate and produce a list of prime numbers below 50:

    prime 47
    prime 43
    prime 41
    prime 37
    prime 31
    prime 29
    prime 23
    prime 19
    prime 17
    prime 13
    prime 11
    prime 7
    prime 5
    prime 3
    prime 2

## Syntax

Rules are stored in a tab-separated file (TSV is like CSV with tabs instead of commas).

The columns are:

1. rule name,
2. heads (removed if the rule is accepted),
3. guards (kept even if the rule is accepted),
4. body (added if the rule is accepted).

The constraints are comma-separated inside each column.

## Constraints

Any text can be used inside the constraints. Uppercase symbols and numbers get special treatment.

JavaScript expressions are written enclosed in parentheses. The JavaScript code has access to the same variables as the constraints on the same line. It can read variables used by previous constraints and bind values to variables that the following constraints can use. JavaScript code cannot be used inside a symbolic/numeric constraint, it needs to have its own constraint.

The store is a multi-set which supports duplicate entries. If this causes undesirable effects, you can write an idempotence rule to get rid of duplicates.

## Processing order

The solver has an external loop over rules, and an internal loop over constraints. Constraints are matched in most-recent-first order. There is no optimisation preventing reprocessing of rules matched at the previous iteration.

The solver removes the heads immediately after the end of a successful rule match. The body is added only after all the constraints in the store have been processed by this rule (to prevent infinite looping over rules which match their own results).
