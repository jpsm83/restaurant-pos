# Principles (always apply)

- **Simplicity first.** Prefer the straightforward solution. No over-engineering, and no abstractions, files, or layers unless they clearly pay for themselves.
- **Consistency.** Match the existing structure, naming, and patterns; consistency beats personal preference.
- **Scope discipline.** Implement exactly what was requested — no unrelated changes, refactors, or TODOs.
- **Understand before writing.** Identify requirements, constraints, and existing patterns; ask when unclear and never guess business logic. State your plan before proposing a solution.
- **Readability over cleverness.** Clear naming and straightforward control flow.
- **Never expose dotfile data.** Files whose names start with `.` (e.g. `.env`) hold secrets. Under absolutely no circumstances read, print, log, echo, commit, or otherwise expose their contents.

## Decision priority order

When decisions conflict, prefer: correctness → existing project structure and patterns → simplicity → maintainability → performance → personal preference.
