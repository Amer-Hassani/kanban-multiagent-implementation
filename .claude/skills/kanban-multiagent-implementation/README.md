# kanban-multiagent-implementation (Claude Code skill) — v2.3

Drives implementation from a Notion Kanban board using **five role-scoped agents**,
each a specialist at one job: a **Planner** that decomposes and writes acceptance
tests, a **Builder** that implements test-first, and independent **Reviewer** and
**Tester** agents that check the work without inheriting the Builder's reasoning —
all coordinated by an **Orchestrator** that owns the board and never writes code.
Agents advance tickets to **Ready for review**; only you move a ticket to **Done**.

Sibling to [`kanban-agent-implementation`](../kanban-agent-implementation/) (one
instance does everything). Use this when you want genuinely independent
build/review/test instead of the same context grading its own work.

## What's in this skill

```
kanban-multiagent-implementation/
├── SKILL.md                        the workflow + setup
├── README.md                       this file
├── V2_NOTES.md                     the full audit/design record behind v2
└── templates/                      copied into your project at setup
    ├── agents/
    │   ├── kanban-orchestrator.md  each file = one agent's tools + craft
    │   ├── kanban-planner.md
    │   ├── kanban-builder.md
    │   ├── kanban-reviewer.md
    │   └── kanban-tester.md
    └── settings.kanban.json        path/command permissions (enforcement)
```

Each agent file carries three things: its **kit** (which tools it may use), its
**craft** (the elite methodology written into its instructions — how a world-class
professional in that role actually works), and its **enforcement** (tool scoping).
The `settings.kanban.json` adds the path- and command-level rules that agent
frontmatter can't express (secret protection, Bash allowlists, human-only ops).

## Install

Personal (all projects): `cp -R kanban-multiagent-implementation ~/.claude/skills/`
Project (shared): `cp -R kanban-multiagent-implementation <repo>/.claude/skills/`

Then restart Claude Code (or run `/skills`) to confirm it's listed.

## Prerequisites

The skill's **setup step checks these for you and walks you through anything
missing** — you don't need to install up front.

- **Notion MCP** connected to your board — required (the one true blocker).
- **Playwright MCP** — `claude mcp add playwright npx @playwright/mcp@latest` (Tester).
- **Superpowers** — `/plugin install superpowers@claude-plugins-official` (Builder, optional).
- **Chrome DevTools MCP** — `/plugin install chrome-devtools-mcp@claude-plugins-official` (optional).
- Already built-in, nothing to do: `/code-review`, `/security-review`, `/verify`, Plan Mode.

## Use

Paste the starter prompt from `SKILL.md` (bottom), replacing `<paste Notion board
link>`. The orchestrator runs a one-time setup (installs the agent files, merges the
permissions, proposes your risky-code list in plain language), then works tickets one
at a time.

**What to expect:** tickets stop at **Ready for review**, not Done. You'll get
plain-language evidence (what changed, how to try it, screenshots) and move the ticket
to Done yourself. You'll be asked before `git push`, deploys, or any new dependency.

## How it works, briefly

The Orchestrator does not grant tools at runtime — it spawns the right pre-equipped
agent **by name**, and that agent is born already holding its kit and craft. The
Orchestrator only passes **this ticket's context**, and enforces the Reviewer's and
Tester's independence by *omitting* the Builder's reasoning from their prompt.
Isolation is an act of omission, not a tool.

See `V2_NOTES.md` for the full design record — the audits, the per-agent findings,
the elite-craft research, and the curated tool kit that produced this version.

## Put this skill in a GitHub repo

```bash
mkdir -p .claude/skills
cp -R /path/to/kanban-multiagent-implementation .claude/skills/
git add .claude/skills/kanban-multiagent-implementation
git commit -m "Add kanban-multiagent-implementation Claude skill (v2.3)"
git push
```
