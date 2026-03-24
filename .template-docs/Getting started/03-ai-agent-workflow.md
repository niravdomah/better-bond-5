# Step 3: AI Agent Workflow

Now that your environment is configured, you can begin using AI agents to guide your development process.

This template uses a **4-agent TDD workflow**:

```
Spec → feature-planner → test-generator → [Implement] → code-reviewer
            PLAN              RED            GREEN              QA
```

## The Agents

| Agent | Phase | What It Does |
|-------|-------|--------------|
| **feature-planner** | PLAN | Breaks specs into epics, stories, and acceptance tests |
| **test-generator** | RED | Converts acceptance tests into executable Vitest tests |
| **code-reviewer** | QA | Reviews code quality, security, and validates all quality gates before PR |

## How It Works

1. **Planning:** Describe your feature. The feature-planner breaks it into epics and stories (with your approval at each stage).
2. **Testing:** The test-generator creates failing tests from acceptance criteria.
3. **Implementation:** You implement code to make the tests pass.
4. **Review:** The code-reviewer checks quality and security.
5. **Verification:** Run `/quality-check` to validate all gates before PR.

At each phase, you stay in control - the agents pause for your approval before proceeding.

**What's next?**
Once your feature is implemented and tested, run `/quality-check` to validate before creating a PR.

**More details:** See [AI Agent Guide](../guides/AI_AGENT_GUIDE.md)
