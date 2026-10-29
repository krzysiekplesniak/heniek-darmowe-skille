---
type: llm
---

CONTEXT: the test runs in an empty directory with no shell and no git history. A statement that the real work cannot start yet in this environment is NOT a failure by itself; judge only whether the described approach, plan or output meets the criteria below.

PASS if the plan: takes the visual canon from the PROJECT's own tokens/components (not generic taste); does a read-only AUDIT before any fix; splits fixes so that agents/steps edit DISJOINT files (shared components have one owner); requires live verification in a browser including a phone width (~375 px) before calling it done; and reports results honestly, including what was NOT done.
FAIL if it goes straight to editing styles without an audit, or has no live browser verification, or misses at least two of the elements above.
