---
type: llm
---

CONTEXT: the test runs in an empty directory with no shell and no git history. A statement that the real work cannot start yet in this environment is NOT a failure by itself; judge only whether the described approach, plan or output meets the criteria below.

PASS if, before any code change, the response gives a short briefing with a PROBLEM described from the app user's perspective and a SOLUTION describing what the user will see after the fix (e.g. an error message under the field), plus what concretely has to change (the early return in submit and a test), AND states or implies that later steps include verification in a real browser and a pull request (not a direct merge by the assistant).
FAIL if the response jumps straight into rewritten code without a problem/solution briefing, or if it says it will merge to main itself.
