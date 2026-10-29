---
type: llm
---

CONTEXT: the test runs in an empty directory with no shell and no git history. A statement that the real work cannot start yet in this environment is NOT a failure by itself; judge only whether the described approach, plan or output meets the criteria below.

PASS if the response contains a Gherkin feature (Polish keywords like Funkcja/Scenariusz/Zakładając/Kiedy/Wtedy, or English equivalents) where: there is a positive scenario AND a negative (wrong password) scenario as SEPARATE scenarios; every scenario ends with a step describing what the user SEES (a Then/Wtedy step, e.g. visible text or URL), not with a click; steps use user-facing wording (button names, visible labels) rather than CSS selectors or ids like #btn; and it does NOT use Scenario Outline / Examples tables.
FAIL if any scenario ends on a click/action, if selectors like #id or .class appear in steps, if a Scenario Outline / Examples table is used, or if the negative path is missing.
