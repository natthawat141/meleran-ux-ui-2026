# Escalation workflow for difficult or uncertain work

Use this for Melearn tasks with material uncertainty, cross-feature/app impact,
complex migration dependencies, or architectural choices that remain unclear after
the Lead has inspected the relevant source and specifications. Routine tasks stay
with the existing defaults in `docs/AI_DELEGATION_POLICY_TH.md`.

## GPT-6.1 Sol review or bounded implementation

1. The Lead frames the task with confirmed facts, relevant paths, the decision or
   implementation needed, constraints, and the specific uncertainties.
2. Spawn `.codex/agents/melearn_complex.toml` as `melearn_complex` using
   `gpt-6.1-sol` with `xhigh` reasoning. Ask for independent review when a decision
   is uncertain. Ask it to implement only a bounded slice when implementation is
   already authorized and the expected changes can be reviewed independently.
3. Keep the Lead responsible for the final architecture/business decision. Review
   source evidence and every changed line, integrate the work, and run the relevant
   checks before reporting completion.

Do not substitute this role for the four read-only Luna roles in R0 Inventory.
Their evidence-gathering limits remain in force.

## Gemini CLI for a second perspective

If material uncertainty remains after the Sol review, or the task benefits from a
second independent analysis, the Lead may consult Gemini with a focused prompt and
the minimum relevant source context. Use the installed `agy` CLI, select
`gemini-3.8-flash-high`, and request `xhigh` effort when that installed version
supports it. Treat Gemini's output as an independent recommendation for the Lead
to verify, not as approval or a source of new business requirements.

The user's preferred invocation is `agy --yolo`. Check `agy --help` first because
the flag is version-dependent and skips permission prompts. If it is unavailable,
the current CLI may expose the equivalent bypass as
`--dangerously-skip-permissions`; use that only for a narrowly scoped, already
authorized local task. Do not use a permission-bypass mode to broaden scope, access
secrets, install software, change Git history/remotes, deploy, publish, or perform
destructive/external actions. Review any output or file changes before integration.

When supported, a focused invocation can be:

```powershell
agy --yolo --model gemini-3.8-flash-high --effort xhigh -p "Review the scoped question and return evidence, options, risks, and a recommendation. Do not edit files."
```

If this CLI version does not accept `--yolo`, use its documented permission-bypass
flag only when the bounded task is already authorized:

```powershell
agy --dangerously-skip-permissions --model gemini-3.8-flash-high --effort xhigh -p "Review the scoped question and return evidence, options, risks, and a recommendation. Do not edit files."
```

At the 2026-10-07 setup check, `agy models` listed `gemini-3.8-flash-high` and
`agy --help` listed `--effort ... xhigh` and `--dangerously-skip-permissions`, but
did not list `--yolo`. Recheck the installed CLI before relying on these details.
