---
name: kanban-agent-implementation
description: Use when implementing tasks from a Notion Kanban board (structured like "Vendure Platform Build") via Claude Code. Triage the backlog, implement To Do tasks test-first one at a time, self-QA with a checklist, and advance tickets through the board while logging every action with a machine-time timestamp.
---

# Kanban Agent Implementation

> **Purpose:** Drive Claude Code (VS Code) directly from a Notion Kanban board built by the Product Owner. Claude triages the backlog, implements ready tasks test-first one at a time, self-QAs, and moves each ticket through the board — logging every action on the ticket with a machine-time timestamp.

## Skill metadata
- **Name:** `kanban-agent-implementation`
- **Use when:** The user points Claude Code at a Notion Kanban board structured like **Vendure Platform Build** and wants tasks triaged, implemented, QA'd, and advanced through the board.
- **System of record:** The Notion board and its task pages, accessed via the **Notion MCP server** (read + write). Every action is logged on the ticket with a timestamp.
- **Primary outcome:** Each ready ticket moves **To Do → In progress → QA → Done** (or **To Fix**/**Blocked** with a precise reason), with test-first code and a full timestamped trail.

---

## Board model (this board's exact columns)
```text
Backlog → To Do → In progress → QA → Done
         ↘ Blocked        ↘ To Fix        (Canceled = dropped)
```
- **To Do** = the ready-to-implement queue.
- **Blocked**, **To Fix**, **Canceled** are side states.
- **WIP limit:** exactly one ticket in **In progress** at any time.
- Always read the live board first and use its **exact** Status/property names via MCP — never assume.

---

## Timestamps (critical)
- Use the **machine's local clock**, format `YYYY-MM-DD HH:mm`.
- **No board action without a timestamped log line on the ticket.** Timestamps are the proof of what was done and when.
- Never backdate, batch, or invent timestamps.

## Writing style (enforced)
- **Compact and impactful. No fluff, no filler, no duplication.**
- Add only new signal; never restate what the ticket already says.

## Activity log (write in ticket body)
Maintain one `## Activity log` section per ticket. Append entries; never rewrite history.
```text
- [YYYY-MM-DD HH:mm] <what was done> · Next: <next step or "—">
```

---

## Workflow

### 0. Session setup (before any board change)
1. **Ask where to execute** — existing repo URL, a local path on this machine, or a new project location. Do not assume.
2. Confirm **Notion MCP** read + write access to the board.
3. Read the board: Status options, **Phase** order, Priority, Target Date, and the Table / By Phase views.
4. If the project is a git repo, confirm the working tree is clean; if unrelated local changes exist, **stop and ask** before touching code. For local-only/no-repo work, note the starting state instead.

### 1. Triage the Backlog
For each **Backlog** ticket:
- Read it fully; check for blockers (missing requirements, access, dependency, decision, unavailable repo/design).
- **No blocker → move to To Do.** Log: `Triaged: ready, no blockers.`
- **Blocker → move to Blocked.** Log what you checked, the exact blocker, and the timestamp.

### 2. Review the To Do queue
Read every **To Do** ticket thoroughly. Order implementation by:
1. **Phase** order (respect the incremental build sequence).
2. Dependencies resolved first.
3. Early-testing value (unblocks the most downstream work).
4. Priority: High → Medium → Low.
5. Earliest **Target Date**.
6. Board order for ties.

### 3. Implement one ticket (test-first)
1. Move **To Do → In progress** (confirm nothing else is In progress). Log the start.
2. Read the ticket, acceptance criteria, and linked repo/design. Read `CLAUDE.md` **if present**, plus config and existing tests. For a new project with no `CLAUDE.md`, offer to create a starter one from the board's conventions.
3. **Version control (only if used):** If the project is a git repo, create a focused branch: `git checkout -b claude/<id>-<slug>`. For local-only work with no repo, skip branching (optionally offer `git init`) and note it in the log. Skip the PR/branch steps everywhere they appear when there is no repo.
4. Write/update the **failing test(s)** from the acceptance criteria.
5. Implement the **smallest change** to pass; refactor while green.
6. Integrate fully — **no orphaned or duplicate code**.
7. Run whatever exists: focused tests → regression → lint → typecheck → build → pre-commit. Log any command that couldn't run and why.
8. Log progress with timestamps as you go (`what done · Next`).

### 4. Hand off to QA
When implementation + validation pass:
- Move **In progress → QA**.
- Write a **QA test-scenario checklist** on the ticket (checkbox list) for the tester: primary path, edge/validation, permission, empty/error, regression. Each item observable and testable.
- Log: files changed, tests run + results, PR link (or `—`).

### 5. Act as tester (QA)
- Read the QA checklist thoroughly and **execute every scenario**. **Tick each checkbox that passes** and append its pass time `— [YYYY-MM-DD HH:mm]` to that item; leave failed ones unchecked so the pass/fail state and timing are visible on the ticket.
- **All pass → move to Done.** Log the QA result + timestamp.
- **Any failure → move to To Fix.** Log: what was implemented, what passed in QA, and exactly what failed.

### 6. To Fix handling
- Read the **To Fix** ticket thoroughly.
- If a **blocker** caused the failure → move to **Blocked**, state the problems precisely, then fix the errors.
- After fixing, return the ticket to **QA** and repeat the QA loop (step 5).
- Log every transition with a timestamp.

### 7. Move to the next ticket
- After a ticket reaches **Done** (or is parked in **Blocked**/**To Fix**), pick the next **To Do** ticket per step 2 and repeat — one ticket in **In progress** at a time.

---

## Ticket log templates

**Triage → Blocked**
```text
- [YYYY-MM-DD HH:mm] Triaged. Checked: <what>. Blocker: <specific missing dep/access/decision>. Next: <resolution needed>.
```

**Start work**
```text
- [YYYY-MM-DD HH:mm] Started. Branch: claude/<id>-<slug>. Next: failing tests for <criteria>.
```

**QA handoff** (body section + log line)
```text
## QA scenarios
- [ ] Primary: <action> → <expected>
- [ ] Edge/validation: <input> → <expected>
- [ ] Permission/empty/error: <case> → <expected>
- [ ] Regression: <existing behavior remains>
# On pass → tick and stamp, e.g.: - [x] Primary: <action> → <expected> — [YYYY-MM-DD HH:mm]
```
```text
- [YYYY-MM-DD HH:mm] Implemented <summary>. Tests: <results>. PR: <link/—>. Moved to QA.
```

**QA result**
```text
- [YYYY-MM-DD HH:mm] QA: <n/n> passed. Failed: <none | list>. Moved to <Done | To Fix>.
```

**To Fix / re-block**
```text
- [YYYY-MM-DD HH:mm] To Fix. Passed: <list>. Failed: <specific>. Cause: <blocker? y/n>. Action: <fix | moved to Blocked>.
```

---

## Guardrails
- One ticket **In progress** at a time.
- Version control, branches, and PRs are **optional** — skip them cleanly when there is no repo; never fail or block a task for lack of git.
- Every board action = **one timestamped log line** on the ticket (machine time, `YYYY-MM-DD HH:mm`).
- Never skip a status transition; never backdate or fake timestamps.
- Use the board's **exact** column/property names via MCP.
- **Test-first always.** Never skip validation silently — log skipped checks and the risk.
- No orphaned/duplicate code, no unrelated refactors, no dependency bumps unless required.
- Never guess missing requirements — move to **Blocked** with a precise question.
- Do not alter **Phase**, **Priority**, or **Target Date** unless the user asks.
- Everything written to Notion is **compact, no fluff, no duplication**.

---

## Starter prompt (paste into Claude Code)
```text
Use the kanban-agent-implementation skill.
Board: <paste Notion board link>. Before any code, ask me where to run the project (repo URL / local path / new project).

Triage Backlog → To Do (no blockers) / Blocked (with the exact blocker), each with a timestamped note.
Review To Do thoroughly, order by Phase → dependencies → early-testing value → Priority → Target Date, and implement ONE ticket at a time, test-first.

Log every action on the ticket in an Activity log with a machine-time timestamp (YYYY-MM-DD HH:mm) — compact, no fluff, no duplication.
Move finished work to QA with a tester checklist, act as tester, then Done (all pass) or To Fix (any fail). Loop To Fix → (Blocked if a blocker) → QA until it passes.
```
