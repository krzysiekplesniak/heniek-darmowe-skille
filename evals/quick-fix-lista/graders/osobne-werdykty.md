---
type: llm
---

CONTEXT: the test runs in an empty directory with no shell and no git history. A statement that the real work cannot start yet in this environment is NOT a failure by itself; judge only whether the described approach, plan or output meets the criteria below.

PASS if the plan states that EACH fix gets its own verification and its own verdict (no single collective "all done"), AND that fixes touching the same file (here the two footer fixes) are handled sequentially by one executor rather than in parallel, AND that the work ends with a pull request link (merge left to the user).
FAIL if it plans to verify several fixes with one screenshot/one check, reports them collectively, or plans parallel edits of the same file.
