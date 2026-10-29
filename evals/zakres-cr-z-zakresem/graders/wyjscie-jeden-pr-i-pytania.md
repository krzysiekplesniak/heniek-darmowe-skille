---
type: llm
---

CONTEXT: the test runs in an empty directory with no shell and no git history. A statement that the real work cannot start yet in this environment is NOT a failure by itself; judge only whether the described approach, plan or output meets the criteria below.

PASS if the response says the review ends with exactly ONE pull request containing the fixes AND exactly ONE (numbered) list of decision questions, each question with a recommendation; AND says findings are fixed in the same wave/round (not "report now, fix later"); AND says each reviewer finding is verified (confirmed/refuted) before it counts.
FAIL if any of these three elements is missing, if it proposes several PRs (one per fix), if it only promises a report of findings without fixing them, or if it pastes diffs.
