# Kanban Multi-Agent Implementation (v2.5)

> **Purpose:** Drive Claude Code from a Notion Kanban board using **ten role-scoped agents**, each a world-class professional at its one job — the best tools for it (kit), the elite methodology written into it (craft), and its restrictions actually enforced by real config (not just requested). Surface-adaptive: one board drives **web, Android, and iOS** (iOS builds locally on macOS; from Windows/Linux, iOS routes to a Mac or cloud build). A single orchestrator owns the board; agents advance tickets to **Ready for review**; only the human moves a ticket to **Done**.

## How it's built (and how enforcement really works)
The skill ships **ten agent-definition files** (`templates/agents/*.md`) with real tool scoping + the elite craft, **PreToolUse hooks** (`templates/hooks/`) for per-agent path/command limits, and a **session-wide permissions template** (`templates/settings.kanban.json`) for secrets + irreversible ops. The tool restrictions are real (verified against the Claude Code docs and proven by execution), the agents think like experts, and the pipeline routes each ticket to the right build/test agents by its surface.

<details><summary>Version history (progress log)</summary>

- **v2.5** — full-audit fix pass (30 findings). Fixed the load-bearing bugs: setup file-ops moved off the write-free orchestrator to the setup session; the path-guard now allows Maestro `.maestro/` flows (mobile tickets no longer stall); the "read-only" Reviewer hook now actually blocks shell-redirect writes (was bypassable); bare `kanban-builder`/`kanban-tester` names replaced with the surface-routed ones that exist; settings hardened (pod/eas/yarn/pnpm installs + signing files denied, `gradlew.bat` for Windows, tighter secret globs); iOS permission-state naming corrected, no more silent-closing iOS tickets, app-install-before-Maestro spelled out.
- **v2.4** — added the **iOS surface** as a first-class citizen (iOS Builder + Tester, Maestro on the iOS Simulator). iOS availability is **detected by host OS at setup** (full local on macOS; routed to a Mac/cloud on Windows/Linux) rather than assumed.
- **v2.3** — surface-adaptive: added web/Android split for Builder + Tester, the Product Owner agent, and mobile craft (Maestro MCP, permissions/offline/push).
- **v2.2** — processed all 36+12 audit findings; fixed wiring against the real docs.
- **v2.1** — switched tool scoping from `tools:` allowlists to `disallowedTools:` denylists (an allowlist silently strips MCP + skills) and moved per-agent limits into PreToolUse hooks.
- **v2** — first wired version: agent files with tool scoping, elite craft, and enforcement instead of advisory prose.
</details>

**How enforcement actually works (verified against Claude Code docs):**
- Each agent uses a **`disallowedTools:` denylist**, not a `tools:` allowlist — an allowlist would silently strip the MCP tools (Notion, Playwright, Chrome DevTools) and skill access each agent needs. Denylist = inherit everything, subtract only what's forbidden.
- **`settings.json` is session-wide** (applies to every agent equally). It correctly holds secret-read denies, config-edit denies, and irreversible-op denies (push/deploy/dependency-install).
- **Per-agent scoping** (Planner/Tester write test files only; Builder can't touch acceptance tests; Reviewer read-only Bash) is impossible in session-wide settings, so it lives in **PreToolUse hooks** referenced by each agent file.
- File rules use **`Edit(...)`** not `Write(...)` (a `Write(path)` rule is accepted but never matched as of v2.1.210).
- **Honest limit:** PreToolUse hooks and permission rules are *best-effort*, not a hard security boundary — a determined agent with Bash could attempt shell tricks. The hooks here block the obvious bypasses (output redirection, mutating commands), but for a *guaranteed* boundary (e.g. an agent that truly cannot touch a path or the network), enable Claude Code's OS **`sandbox`** in settings. This skill is designed for trusted, operator-supervised use with a human gate before anything ships — not as a defense against a hostile agent.

Sibling to `kanban-agent-implementation` (one instance does everything). Use this when you want genuinely independent build/review/test.

---

## Setup (step 0 — do this ONCE per project, before any ticket)

**Who runs setup:** the file-installing steps (copy agent files/hooks, merge settings, detect the host OS) are done by a **normal Claude Code session or the operator** — NOT the orchestrator. The orchestrator agent is deliberately write-free (no Write/Edit/Bash), so it *cannot* copy files or merge settings; it only takes over *after* setup, to run tickets. Setup is an interactive checklist explained in plain language, yes/no answers. **Nothing here requires the operator to write code themselves.**

1. **Ask where to run** — repo URL / local path / new project.
2. **Detect the host OS + declare which surfaces build locally.** The setup session runs one command — `node -e "console.log(process.platform)"` (darwin = macOS, win32 = Windows, linux = Linux) — and tells the operator plainly what this machine can do:
   - **macOS (`darwin`)** → web ✓, Android ✓, **iOS ✓** — all three build and test locally.
   - **Windows (`win32`) / Linux** → web ✓, Android ✓ locally; **iOS code is written here but its build/test needs macOS** (Apple's rule) — iOS-specific tickets route to a Mac host or a cloud build (Expo EAS). This is honest, not a limitation of the skill.
   Record the result (e.g. in the Notion "Run state" page) so the orchestrator routes `ios` tickets correctly for THIS host. Never assume the operator's OS — detect it.
3. **Verify prerequisites** — the setup session checks each and walks the operator through anything missing (gate mobile/iOS tools on the surfaces this project actually has and this host supports):
   - **Notion MCP** connected to the board (required — the one true blocker).
   - **Playwright MCP** — `claude mcp add playwright npx @playwright/mcp@latest` (web Tester).
   - **Maestro** — for the mobile Testers (drives Android emulator + iOS Simulator). Install per maestro.dev; `maestro mcp` exposes it to the agent.
   - **Superpowers** — `/plugin install superpowers@claude-plugins-official` (Builders, risky tickets). *Optional — without it Builders plan in prose.*
   - **Chrome DevTools MCP** — `/plugin install chrome-devtools-mcp@claude-plugins-official` (browser bugs). *Optional.*
   - **Xcode** — required on macOS for the iOS surface (`xcodebuild`, iOS Simulator). Not applicable off macOS.
   - Built-in and already present: `/code-review`, `/security-review`, `/verify`, Plan Mode.
   - Gate DB/API tools (Postgres, Sentry, Postman MCP) on whether the project actually has that surface.
4. **Install the agent files + hooks** — the setup session copies `templates/agents/*.md` → `.claude/agents/` (ten agents) and `templates/hooks/*.js` → `.claude/hooks/`. It then **auto-detects** the test path from the repo (scans for `tests/`, `__tests__/`, `androidTest/`, `.maestro/`, `*.spec.*`) and fills the `ACCEPTANCE_TEST_GLOB` / test-path constants in `_path-guard.js` — showing the operator what it found ("your tests live in `tests/` — correct? yes/no"), never asking them to type a glob. (This must happen BEFORE the orchestrator launches — the orchestrator can't write files.)
5. **Merge the permissions safely** — the setup session reads any existing `.claude/settings.json`, writes a timestamped `.bak` backup, then **array-unions** `permissions.deny` and `permissions.allow` (dedup) leaving all other keys untouched — never a whole-block paste. It **auto-fills** the test/build/lint/serve commands by reading `package.json` scripts (and the Gradle wrapper form for the host OS — `gradlew.bat` on Windows, `./gradlew` elsewhere), showing each as "your test command is `npm test` (found in package.json) — does running it show your tests? yes/no." Then shows a before/after diff and confirms no existing deny was removed.
6. **Confirm the risky-code list** — the setup session (or the orchestrator, which has Read/Grep) SCANS the repo and PROPOSES which files/areas are shared/critical (auth, payments, schema, shared components), each with a one-line plain reason, and asks yes/no. Default if unsure: treat everything as Risky. The operator owns this list; the Planner may propose additions, never removals.
7. **Confirm the board** — read the live board's exact Status/Phase/Priority names via MCP; never assume them.
8. **NOW launch the orchestrator** — with `claude --agent kanban-orchestrator` (it is never spawned as a subagent). It proves it's the main session by reading the board's status names via Notion MCP; if that fails, it stops and tells the operator to relaunch. From here the orchestrator runs tickets; it never writes files.

---

## Surface-adaptive: one skill, web + Android + iOS

Every ticket has a **surface** — `web`, `android`, `ios`, or `backend`. The *thinking* agents (PO, Planner, Reviewer) are one file each and handle all surfaces; the *hands-on-the-app* agents (Builder, Tester) come in **web**, **android**, and **ios** variants, and the orchestrator spawns the right one per ticket. This matches the "one backend, many faces" architecture — a single board can drive a web app and mobile apps that share a backend.

- **`web` / `backend`** → `kanban-builder-web` + `kanban-tester-web` (npm/vite, Playwright). Runs on any OS.
- **`android`** → `kanban-builder-android` + `kanban-tester-android` (Flutter/Expo/Gradle, **Maestro MCP**). Runs on any OS (Windows/Mac/Linux).
- **`ios`** → `kanban-builder-ios` + `kanban-tester-ios` (Expo/Flutter, `xcodebuild`, **Maestro on the iOS Simulator**). **Requires a macOS host** — that's Apple's rule, not the skill's.

**iOS is a full surface — availability depends on the host, detected at setup, not assumed.** On a **Mac**, all three (web/android/ios) build and test locally. On **Windows/Linux**, web + Android are fully local; iOS *code* is written from the same Expo/RN codebase, but its build/test needs macOS — so an iOS-specific ticket routes to a Mac host or a cloud build (Expo EAS), and the skill says so plainly rather than pretending. With Expo/React Native, most iOS work is shared with Android (one codebase), so on a non-Mac host a shared `ios` ticket is usually already covered by its matching `android` ticket.

## The ten agents

| Agent | Role | Best kit | Per-agent limit enforced by |
|---|---|---|---|
| **Product Owner** | FIRST — idea → user stories → backlog; advises; tags surface | PM skills · Notion MCP · story mapping | denylist: no code edit/Bash |
| **Orchestrator** | owns board, WIP, log; **routes by surface**; spawns others; never codes | Notion MCP · Agent tool · budget caps | denylist: no Edit/Write/Bash |
| **Planner** | triage, order, **decompose** (web + mobile checklists), author acceptance tests | Spec-Kit skill (or plan-in-prose) | hook: test files only |
| **Builder — web** | web/backend test-first, smallest change, commits at green | Superpowers · Chrome DevTools/Postgres/Sentry MCP | hook: can't touch acceptance tests |
| **Builder — android** | Android (Flutter/Expo) test-first; permissions/offline musts | Superpowers · Flutter/Expo/Gradle/adb | hook: can't touch acceptance tests |
| **Builder — ios** *(macOS host)* | iOS (Expo/Flutter) test-first; permissions/Info.plist/HIG musts | Superpowers · Expo/Flutter/xcodebuild/simctl | hook: can't touch acceptance tests |
| **Reviewer** *(risky)* | independent correctness + security (web + mobile checklists) | `/code-review` · `/security-review` · Semgrep | denylist no write + hook: read-only Bash |
| **Tester — web** *(risky + evidence)* | drive web app, attack edge cases, plain evidence | Playwright · `/verify` · Chrome DevTools | hook: test files only |
| **Tester — android** *(risky + evidence)* | drive Android app on emulator; **mobile attacks** | **Maestro MCP** · `/verify` · adb | hook: test files only |
| **Tester — ios** *(risky, macOS host)* | drive iOS app on the Simulator; **mobile attacks** | **Maestro MCP** · `/verify` · simctl | hook: test files only |

Full definitions live in `templates/agents/*.md`. The **Product Owner** runs once at the start and is consulted later — not part of the per-ticket loop. The **ios** Builder/Tester are only spawned on a **macOS host** (see the surface section); on Windows/Linux the orchestrator routes iOS work to a Mac or cloud build.

**How skills reach each agent:** they're baked into the agent's own `.claude/agents/*.md` file — the orchestrator does NOT grant tools at runtime. It spawns the right agent by name (which is born already holding its kit + craft), then passes only **this ticket's context** in the spawn prompt, and enforces independence by **omitting** what would break it (never passing the Builder's reasoning to the Reviewer/Tester).

---

## Board model
```text
Backlog → To Do → In progress → Ready for review → Done (human-only)
         ↘ Blocked        ↘ To Fix       (Canceled = dropped)
```
Legal transitions (the only ones): Backlog→To Do/Blocked · To Do→In progress · In progress→Ready for review/Blocked/To Do(reconciliation reset) · Ready for review→Done(human)/To Fix · To Fix→In progress · Blocked→To Do(when unblocked). **Agents never move a ticket to Done.**

**WIP limit:** exactly one ticket In progress — enforced because the orchestrator is the sole board-writer.

---

## The two paths

The **orchestrator** decides the path (the Planner only recommends), by an explicit rule, checked **before** the Builder starts and **re-checked** against the actual diff when the Builder returns (a Simple ticket that grew gets upgraded).

**Escalate to Risky if:** the ticket implies >1 file OR touches shared/critical code (the operator's risky-code list).

**Simple path** (most tickets):
```
To Do → In progress → Planner (writes 1 failing test) → Builder → Tester (minimal check) → Ready for review
```
Even Simple tickets get an independent oracle. **One owner, decided:** the Planner writes a single failing acceptance test from the criteria (a light pass — one test, not the full Risky ceremony); the Builder makes it pass but may not edit it; the **Tester** runs it fresh and confirms. The Builder never authors the test it must pass, on either path.

**Risky path:**
```
To Do → In progress → Planner writes acceptance tests → Builder → Reviewer + Tester → Ready for review
                                                              ↑___________________|
                                                          loop, capped at 4 combined rounds
```
- **Loop cap = 4 combined** Builder↔Reviewer↔Tester rounds. On cap-exit with any non-pass verdict, move to **Blocked** with a plain-language note + a human-decision menu (retry N more / split / drop) — never dangling In progress; the WIP slot is released.
- A ticket bounced to **To Fix** always gets independent review on retry, even if it started Simple.

---

## Verification (the orchestrator never trusts a claim)
The orchestrator has no Bash — it cannot re-run tests itself. So it does NOT accept a Builder's "tests pass" as evidence. **The independent re-run is always a fresh Tester spawn** — the orchestrator spawns the surface-matched tester (`kanban-tester-web` / `-android` / `-ios`) with (diff, acceptance criteria, checklist) and consumes its PASS/FAIL. (`/verify` is a tool the Tester uses, not a separate actor.) Self-reported success is never sufficient — on **both** paths.

---

## Evidence at Ready for review (EVERY ticket, both paths)
The human reviews **evidence, not diffs**. Every ticket reaching Ready for review carries:
- **What changed** — one sentence a non-programmer understands.
- **How to try it yourself** — a URL + click-by-click steps.
- **A screenshot** where the change is visual.

The human moves it to **Done** (or bounces to **To Fix** with a note).

---

## Timestamps & durability (orchestrator-owned)
- The Activity log records **orchestrator lifecycle events**, stamped when the orchestrator acts (`YYYY-MM-DD HH:mm`, machine time). Subagents' blow-by-blow goes to an attached notes artifact, not the timestamped log.
- **Write-ahead:** `INTENT attempt-N: <transition>` before a board write, `DONE attempt-N` after — covering both the status change and the log line.
- **Idempotency key** = ticket-id + transition + args + attempt-number. On retry, read the log first; skip a matching DONE.
- **Startup reconciliation** (every session start + after compaction): any In-progress ticket is orphaned. Inspect its INTENT/DONE pair + repo state → tests green on its branch = resume at Reviewer/Tester; dirty+failing = discard to last green commit and resume Builder (ask before discarding, plain-language); no commits = reset to To Do. Never start new work first.
- **Orchestrator context lifecycle:** the orchestrator has no Write tool and cannot touch `.claude/`, so it persists its run-state **in the Notion board itself** — a dedicated "Run state" page (queue order, current ticket, attempt counters, the risky-code list). It CAN write Notion, so this needs no filesystem access. Compact ~60% fill; hand off to a fresh session every N tickets, restoring state by re-reading the board + the Run-state page.

---

## Cost control (backlog level)
- Native caps: `--max-budget-usd` and `--max-turns` stop a runaway run.
- Numeric defaults: Simple ≈ 2 spawns, Risky ≈ 5–8. A per-ticket ceiling → Blocked with a cost note.
- **Circuit breaker:** halt the whole run (not just the ticket) after 2 consecutive ticket failures/cap-exits — consecutive failure signals a systemic problem.

---

## Human gates (always ask, plain language)
Before `git push`, any deploy, or adding/upgrading a dependency — the orchestrator stops and asks, explaining why it's needed, what happens without it, how established the dependency is, and its recommendation. Builder works on a branch, never main. Config files and secrets are human-only (enforced by deny-rules).

## Post-Done (close the loop)
When the human moves a ticket to Done, the orchestrator merges its branch to the main branch and reports "ticket X is now part of the real project" — asking before the push. Without this, finished work would strand on `claude/*` branches.

---

## Guardrails (summary)
- Orchestrator is the only Notion writer; enforces WIP=1 and owns every log line.
- Agents stop at Ready for review; only the human moves to Done.
- Each agent carries only its own tools (denylist in agent files) + only its allowed paths/commands (PreToolUse hooks + session-wide settings) — enforced, not advisory.
- Test-first always; Builder never authors the test it must pass; Builder commits at every green.
- Reviewer/Tester never see the Builder's reasoning (independence by omission).
- Orchestrator verifies the artifact; never trusts a self-reported "done."
- Escalation is a fixed rule, checked pre- and post-build.
- Cap-exit → Blocked, never dangling.
- No orphaned/duplicate code, no unrelated refactors, no dependency bumps without human approval.
- Never guess a missing requirement — Blocked with a precise question.
- Don't add agents beyond these ten without a demonstrated recurring failure.

---

## Starter prompt (paste into Claude Code)
```text
Use the kanban-multiagent-implementation skill.
Board: <paste Notion board link>.

Run Setup step 0 first: ask me where to run the project; verify prerequisites and walk me through installing anything missing; install the agent files into .claude/agents/; merge the permissions template into .claude/settings.json (show me the block, explain each rule, edit the commands to match this project); then SCAN the repo and PROPOSE the shared/risky-code list to me in plain language for a yes/no. I am not a programmer — every question must be plain language, with a recommended default.

Then run startup reconciliation (heal any orphaned In-progress ticket) before new work.

Work tickets one at a time as the Orchestrator: you are the ONLY one who writes to Notion. First read each ticket's SURFACE (web/android/ios/backend) and pick the matching builder/tester variant. Decide Simple vs Risky per the rule, re-checking against the actual diff. Spawn fresh role agents by name — `kanban-planner`, `kanban-reviewer`, and the surface-routed `kanban-builder-{web,android,ios}` / `kanban-tester-{web,android,ios}` (there is no bare kanban-builder/kanban-tester). Pass each only this ticket's context, and NEVER pass the Builder's reasoning to the Reviewer/Tester. Never accept "tests pass" as evidence — a fresh Tester must independently confirm. Log every transition write-ahead (INTENT then DONE) with a machine-time stamp.

Move tickets only as far as Ready for review, with plain-language evidence attached (what changed / how to try it / screenshot). I move tickets to Done myself. Ask before git push, deploys, or any new dependency.
```
