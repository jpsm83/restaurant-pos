<!--
Standards source for the code-review skill (Standards axis).

The Standards sub-agent in .agents/skills/code-review/SKILL.md reads this file
(relative to the repo root) and cites any rule a diff breaks. A documented rule
here overrides the review's baseline code smells.

This file is the index. The rules live in docs/conventions/, split by activity so
a task loads only what it needs.
-->

| File | Load it when |
|------|--------------|
| [`conventions/principles.md`](./conventions/principles.md) | Always — simplicity, consistency, scope, priorities. |
| [`conventions/building.md`](./conventions/building.md) | Writing or changing code — architecture, schemas/DTOs, errors, React, TypeScript, UI, comments. |
| [`conventions/selective-ddd.md`](./conventions/selective-ddd.md) | Designing or refactoring complex business slices — where to apply DDD and where to keep CRUD simple. |
| [`conventions/debugging.md`](./conventions/debugging.md) | Diagnosing or fixing a bug — root cause, verifying real flows. |
| [`conventions/testing.md`](./conventions/testing.md) | Writing or running tests. |
| [`conventions/finishing.md`](./conventions/finishing.md) | Wrapping up — cleanup and docs. |
