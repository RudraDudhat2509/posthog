# Skill — authoring new agents

How to build a deployable agent from scratch. Load this only when
the user is creating a NEW agent. For editing existing agents,
use `skills/editing-agents-safely` instead.

## Don't author until you know the brief

Before any MCP call, get answers to:

1. **What does this agent do?** One sentence. If you can't write
   the sentence yet, the user can't either — ask more questions.
2. **What triggers it?** Cron? Slack mentions? Chat from the
   console? A webhook from an external system?
3. **What does it have access to?** PostHog data? Slack? An
   external service via a custom tool or MCP?
4. **What's the success criterion?** One concrete example of a
   trigger and the desired response.

Refuse to build until you have all four. "Sure, let me design
something" without the brief produces 60 minutes of work the user
will throw away.

## The phases

```text
1. discover     — what's available, what already exists
2. design       — write the spec
3. create       — application + empty draft
4. configure    — wire secrets / integrations (punch-out)
5. write        — agent.md, skills, custom tools
6. validate     — structural check
7. freeze + test — sandboxed runs, self-eval
8. promote      — live, with explicit consent
```

## Phase 1 — discover

```text
agent-native-tools-list                  → built-in tool catalog
agent-applications-list                  → existing agents (clone target?)
```

If the user describes something close to an existing agent,
**suggest cloning** instead of writing fresh. Use
`agent-applications-revisions-clone-from-create` to start from
that bundle. Saves a lot of work.

For platform-level templates (skill templates, custom-tool
templates) — these are designed but not yet shipped. Don't
reference them until they exist.

## Phase 2 — design the spec

Sketch the spec in your head / out loud with the user, BEFORE
calling any create endpoint. Cover:

- **`model`** — start with `anthropic/claude-sonnet-4-6` unless
  the user has a preference. It's the platform default.
- **`triggers`** — one is fine; many is fine; pick what the user
  asked for. Each trigger has its own config.
- **`tools[]`** — minimum needed for the job. Don't pre-emptively
  add tools the agent might want — that's how prompts get
  confused. Add later if needed.
- **`mcps[]`** — leave empty unless the user named a specific
  external MCP server.
- **`skills[]`** — usually 0-3 for v0. Plan one per "domain of
  knowledge"; don't pre-create skills for ideas the agent might
  reach for.
- **`integrations[]`** — list any team-wide OAuth integrations
  (e.g. `"slack"`).
- **`secrets[]`** — list any per-application keys the agent's tools
  read (e.g. `"STRIPE_API_KEY"`). **Don't** list trigger-required
  keys like `SLACK_SIGNING_SECRET` here — those come from the
  platform-wide `TRIGGER_REQUIRED_SECRETS` registry, not the spec.
  See `skills/secrets-and-integrations` → "Trigger-required secrets".
- **`limits`** — usually defaults are fine. Tighten if the user
  needs a hard cost cap.
- **`auth`** — an **array of typed modes**, never a scalar. The shape is
  `{ "modes": [ { "type": "pat" }, … ] }`. The legacy `{ "mode": "public" }`
  scalar that some old demo agents still carry is silently dropped on write —
  do NOT copy it from an existing agent; write the `modes` array. Per mode:
  `pat` / `posthog_internal` for chat/mcp (console invokes with the user's PAT),
  `shared_secret` (with a `header`) for webhooks, `oauth` (with an `issuer`) for
  B2B. `{ "type": "public" }` is unsafe unless the agent is genuinely B2C.
- **`reasoning`** — start unset (provider default). Bump to
  `medium` if the agent reasons hard; `high` if it does long
  triage; rarely `xhigh`.

Show the proposed spec to the user before creating. They will
catch things you missed.

## Phase 3 — create

```text
agent-applications-create   → returns { id, slug }
agent-applications-revisions-create application_id=<id>
                                                  → returns empty draft revision id
```

**The first revision is minted by `agent-applications-revisions-create`
with `application_id` only — no source revision.** A fresh app ships
with zero revisions, so this is the one creator that does NOT need a
source. Two traps that make agents wrongly conclude it's missing:

- **Name collision.** `agent-applications-create` makes the _app_;
  `agent-applications-revisions-create` makes the first _revision_.
  They are different tools with near-identical names. Don't stop at
  the first match.
- **The `*-from`/`*-new-draft` creators are NOT substitutes here.**
  `agent-applications-revisions-new-draft-create` and
  `…-clone-from-create` both require a `source_revision_id` to clone —
  useless on a brand-new app, and they drag a donor spec through the
  door. Do NOT seed from another agent as a workaround.

If you can't find `agent-applications-revisions-create`, you have a
_discovery_ problem, not a missing tool: list the full tool set (don't
rely on one `search` pattern) and match the exact string. If it's
genuinely absent from the full list while the `*-new-draft` creator is
present, your credential is the issue (the whole `agent-applications-*`
surface needs `agents:read` + `agents:write`) — not the server.

In the console, `@posthog/ui/focus` to the new application + the
new draft revision.

Then patch the spec onto the draft:

```text
agent-applications-revisions-partial-update revision_id=<rid> spec=<json>
```

## Phase 4 — configure secrets / integrations

For each item in `spec.secrets[]`, you cannot accept the value
directly. Load `skills/secrets-and-integrations` and follow the
punch-out flow.

**Also check trigger-required secrets** — some trigger types demand
entries in `encrypted_env` that the spec doesn't name explicitly
(`SLACK_SIGNING_SECRET` for `slack` triggers, today). The promote
endpoint refuses if any are missing; catch them here so the user
isn't surprised at the end. See `skills/secrets-and-integrations`
→ "Trigger-required secrets" for the registry + punch-out flow.

For each item in `spec.integrations[]`, check whether the team
already has that integration installed. If not, tell the user to
install it from the PostHog integrations UI — you can't do this
for them.

## Phase 5 — write the bundle

Start with `agent.md` — the system prompt. Keep it tight:

- Identity ("you are X")
- The job ("for each Y, do Z")
- The hard rules (3-5, max)
- Tone

If the agent has > 1 distinct chunk of "how to do the job" (say,
both "how to triage an alert" AND "how to format a Slack reply"),
**split into skills**. The system prompt lists each skill in the
skill index; the model loads on demand. This keeps per-turn
context small.

Before writing a brand-new skill or custom tool, **check the
registry** — `agent-skill-templates-list` /
`agent-custom-tool-templates-list`. If a canonical `@posthog/*`
template fits, pin it via `spec.skills[].from_template` instead of
re-authoring. Load `skills/using-the-registry` for the full pattern.

For custom tools, write `tools/<id>/source.ts` and
`tools/<id>/schema.json` declaring args + required secrets. The
runner sandboxes the source at session start.

Use `agent-applications-revisions-file-update` for each file.
Don't use `bundle-update` mode=replace until you have a sense for
the whole shape — too easy to overwrite something.

## Phase 6 — validate

`agent-applications-revisions-validate-create`. Fix every error,
read every warning.

## Phase 7 — freeze + test

Load `skills/running-and-evaluating-tests`. Write 3-5 test cases
covering the happy path, the obvious edge cases, and one hostile
input.

`agent-applications-revisions-freeze-create` then
`agent-applications-revisions-test-run`. Read the results,
iterate.

If tests fail: branch a new draft from the just-frozen ready,
fix, re-freeze, re-test. (Same loop as
`skills/editing-agents-safely`.)

## Phase 8 — promote

Explicit confirmation, as always.
`agent-applications-revisions-promote-create`.

For high-stakes agents (production-traffic-affecting, customer-
visible, money-moving), **suggest a preview link first** (per
`agent-authoring-flow.md` §2 phase 6, when the feature ships).
The user can drive a real conversation against the `ready`
revision before promoting.

## Anti-patterns to spot

- **The mega-spec.** User says "and also...", and the agent grows
  10 tools, 8 skills, 3 triggers. Push back: "let's get v1
  working with the core flow, then iterate. Each tool is
  cognitive load on the model."
- **The bare prompt.** No skills, no examples, just "be a great
  assistant for X". Will work for trivial cases, fail for
  anything specific. Push depth into skills.
- **Premature custom tooling.** User reaches for a custom tool
  before checking native ones. Cross-check `agent-native-tools-list`
  first — half the time the native tool exists.
- **Secrets in `agent.md`.** Comes up often. Refuse hard, load
  `skills/secrets-and-integrations`.
- **Public auth on a chat trigger.** Will be abused. Default to
  `pat` and explain why.

## What "good" looks like at v1

A v1 agent does ONE thing well, with:

- A spec under ~50 lines
- An `agent.md` under ~200 lines
- 0-3 skills, each under ~200 lines
- 3-5 test cases covering happy + edges
- One trigger
- The minimum tool surface

Anything more is v2.
