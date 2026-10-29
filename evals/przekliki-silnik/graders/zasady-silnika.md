---
type: llm
---

CONTEXT: the test runs in an empty directory with no shell and no git history. A statement that the real work cannot start yet in this environment is NOT a failure by itself; judge only whether the described approach, plan or output meets the criteria below.

PASS if the plan proposes user-journey click-through scenarios (Gherkin / Given-When-Then or equivalent) run in a real browser, AND states at least TWO of these strict rules: (a) a step without a definition must NOT count as passed/green; (b) no automatic retries (flakiness is a finding, not noise); (c) tests must never run against production / production hosts are blocked; (d) a red result is a hypothesis to be classified (product / test / environment) before calling it a regression.
FAIL if it only suggests writing more unit tests, or states none of these strictness rules, or suggests running against production data.
