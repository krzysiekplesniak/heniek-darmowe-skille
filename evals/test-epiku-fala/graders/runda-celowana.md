---
type: llm
---

CONTEXT: the test runs in an empty directory with no shell and no git history. A statement that the real work cannot start yet in this environment is NOT a failure by itself; judge only whether the described approach, plan or output meets the criteria below.

PASS if the plan is a TARGETED round (tests selected from the map of changed files / user paths, explicitly not the full suite), records the state BEFORE (runs the selected tests first), requires every NEW test to pass TWO negative controls (break production code -> test red; break the test's expectation -> test red), and includes ONE run against staging, ending with a short report.
FAIL if it plans to run the entire test suite as the main step, or if new tests have no negative control (mutation) at all.
