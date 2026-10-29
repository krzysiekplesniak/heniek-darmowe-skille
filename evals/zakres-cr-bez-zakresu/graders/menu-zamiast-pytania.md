---
type: llm
---

CONTEXT: the test runs in an empty directory with no shell and no git history. A statement that the real work cannot start yet in this environment is NOT a failure by itself; judge only whether the described approach, plan or output meets the criteria below.

PASS if the response either presents (or clearly commits to presenting) a NUMBERED MENU of candidate review scopes measured from git (branches/PRs/commits), and explicitly states a default time window such as "today" that the user can widen (e.g. "7 days"). Reporting that git or the repository is unavailable in this environment is acceptable as long as the response still describes this numbered-menu-from-git approach with the explicit default window.
FAIL if the response only asks the user an open question like "what would you like me to review?" without proposing the menu, or if it starts reviewing arbitrary code without a scope.
