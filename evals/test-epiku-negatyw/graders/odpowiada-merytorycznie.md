---
type: llm
---

CONTEXT: the test runs in an empty directory with no shell and no git history. A statement that the real work cannot start yet in this environment is NOT a failure by itself; judge only whether the described approach, plan or output meets the criteria below.

PASS if the response gives a concrete starting plan for a full pre-release test run and/or raising coverage of existing code (e.g. run the full suite, measure current coverage, prioritise critical paths).
FAIL if the response refuses, or only redirects to a small daily targeted round instead of addressing the full run.
