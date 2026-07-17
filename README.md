# kanban-multiagent-implementation — v2.5

A Claude Code skill that drives implementation from a Notion Kanban board using
**ten role-scoped agents**, each a specialist at one job — with the best tools
for it (kit), a world-class professional's methodology written into it (craft),
and its restrictions enforced by real config (not just requested).

**Surface-adaptive:** one board drives **web, Android, and iOS** from the same
pipeline. Every ticket carries a surface tag; the orchestrator spawns the matching
build/test agents. iOS builds/tests locally on **macOS**; from Windows/Linux the
iOS *code* is written from the same Expo/React Native codebase and its build routes
to a Mac or a cloud build (Expo EAS) — the skill detects the host OS at setup and
tells the operator honestly what runs locally.

> Note: this repo previously held the single-agent `kanban-agent-implementation`
> skill. It has been replaced by this multi-agent successor.

## The eight agents

| Agent | Role |
|---|---|
| **Product Owner** | idea → prioritized backlog of user stories; tags each story's surface; advises |
| **Orchestrator** | owns the board, WIP limit, and log; routes tickets by surface; spawns the others; never codes |
| **Planner** | triage, order, decompose, author acceptance tests (web + mobile checklists) |
| **Builder — web** | web/backend, test-first, smallest change, commits at green |
| **Builder — android** | Android (Flutter/Expo), test-first, mobile musts (permissions, offline) |
| **Builder — ios** *(macOS)* | iOS (Flutter/Expo), test-first, Info.plist/HIG musts |
| **Reviewer** | independent correctness + security review (web + mobile) |
| **Tester — web** | drives the web app (Playwright), attacks edge cases, plain-language evidence |
| **Tester — android** | drives the Android app on an emulator (Maestro), mobile attacks |
| **Tester — ios** *(macOS)* | drives the iOS app on the Simulator (Maestro), mobile attacks |

The thinking agents (PO, Planner, Reviewer) are one file each and handle every
surface; the hands-on agents (Builder, Tester) come in web and android variants.

## What's in the skill

```
.claude/skills/kanban-multiagent-implementation/
├── SKILL.md            the workflow, setup, surface routing, agent roster
├── README.md           skill-level readme + install
├── V2_NOTES.md         the full design + audit record behind every decision
└── templates/          copied into your project at setup
    ├── agents/*.md      the 8 agent definitions (tools + craft + enforcement)
    ├── hooks/*.js       PreToolUse hooks for per-agent path/Bash limits
    └── settings.kanban.json   session-wide permissions (secrets, irreversible ops)
```

## Install

```bash
# Personal (all your projects):
cp -R .claude/skills/kanban-multiagent-implementation ~/.claude/skills/

# Or per-project: copy it into the repo you want to use it in, then
# restart Claude Code (or run /skills) to confirm it's listed.
```

See `.claude/skills/kanban-multiagent-implementation/SKILL.md` for the full setup
step, prerequisites, and the starter prompt.

## Status

Built, wired, and verified against the Claude Code docs; enforcement is proven by
execution (the hooks actually deny/allow). Not yet run end-to-end on a live board —
treat the first run as a shakeout with one small ticket. Full rationale for every
design decision is in `V2_NOTES.md`.
