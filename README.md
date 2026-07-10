# kanban-agent-implementation (Claude Code skill)

A Claude Code skill that drives implementation directly from a Notion Kanban board.
Claude triages the backlog, implements To Do tasks test-first one at a time, self-QAs
with a timestamped checklist, and advances tickets through the board.

## Install

### Option A — Personal skill (all your projects)
Copy the folder to your personal skills directory:

```bash
cp -R kanban-agent-implementation ~/.claude/skills/
```

Result: `~/.claude/skills/kanban-agent-implementation/SKILL.md`

### Option B — Project skill (shared with a repo/team)
Copy the folder into the repo you want to use it in:

```bash
mkdir -p .claude/skills
cp -R kanban-agent-implementation .claude/skills/
```

Result: `<repo>/.claude/skills/kanban-agent-implementation/SKILL.md`

Then restart Claude Code (or run `/skills`) to confirm it is listed.

## Prerequisite: Notion MCP connection

This skill reads and writes your Notion board through the **Notion MCP server**.
That connection is configured in **Claude Code's settings on each machine**, not in
this skill file. Anyone using the skill must have the Notion MCP server connected
and granted access to the board.

## Use

Paste the starter prompt from `SKILL.md` (bottom section) into Claude Code, replacing
`<paste Notion board link>` with your board's link. Claude will ask where to run the
project before writing any code.

## Put this skill in a GitHub repo

### New repo
```bash
mkdir vendure-claude-skills && cd vendure-claude-skills
mkdir -p .claude/skills
cp -R /path/to/kanban-agent-implementation .claude/skills/
git init
git add .
git commit -m "Add kanban-agent-implementation Claude skill"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### Existing repo
```bash
mkdir -p .claude/skills
cp -R /path/to/kanban-agent-implementation .claude/skills/
git add .claude/skills/kanban-agent-implementation
git commit -m "Add kanban-agent-implementation Claude skill"
git push
```

Anyone who clones the repo and opens it in Claude Code gets the skill automatically.
