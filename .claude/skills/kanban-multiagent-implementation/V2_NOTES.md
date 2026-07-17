# kanban-multiagent-implementation — build notes

## 🔧 v2.5 FIX PASS — full audit of v2.4 found 30 confirmed + 5 low. Fixing all by root cause.
Audit verify-phase cut off by session limit, but audit phase (5 dims) complete + several findings CONFIRMED with executed proof (e.g. reviewer redirect bypass proven by running the hook).
- RC1 [#1,#12,#22,#25 HIGH] Orchestrator is write-free (no Bash/Write/Edit) but SKILL setup steps 5-7 tell IT to copy files, merge settings, detect OS. Impossible + self-contradicts SKILL:138. → setup done by human/plain session BEFORE launching orchestrator; reword steps; OS-detect is a one-off operator/setup Bash step.
- RC2 [#2,#11,#23,#27 HIGH] path-guard ANY_TEST_GLOB blocks Maestro .maestro/*.yaml flows the mobile Testers/Planner must write → every mobile ticket stalls. → add .maestro/, flows/, e2e/, *.yaml-under-flows to the allow regex.
- RC3 [#5,#6,#7 HIGH] bare kanban-builder/kanban-tester spawn names DON'T EXIST (only -web/-android/-ios). Leftover from v2.3 split. → surface-routed names everywhere (orchestrator body, SKILL:119/181, guardrail).
- RC4 [#14,#15,#28 HIGH·security] "read-only" Reviewer + all path hooks only guard Edit/Write, NOT Bash → bypassable via `echo x > file`. Proven by execution. → reviewer hook denies redirects (>,>>,tee,|) without \b; note that true path enforcement needs OS sandbox.
- RC5 [#8 HIGH] Builder acceptance-test lock only fires on hardcoded tests/acceptance/ but Planner never told to write there → gap. → Planner writes acceptance tests under tests/acceptance/ (+ .maestro for mobile); state it; gate hook on it.
- RC6 [#3,#16,#17,#19,#20,#21,#24 settings] pod install wrongly ALLOWED; missing denies: eas build/submit, expo submit, xcrun altool/notarytool, yarn/pnpm install, signing files (.mobileprovision/.keystore/.jks/.cer); ./gradlew won't run on Windows (need gradlew.bat); over-broad Read(**/*secret*) also blocks Edit on legit source; git config too broad for the attribution-trailer commit. → fix each.
- RC7 [#9,#10,#13,#18,#26,#29,#30] iOS 4th permission state naming (Android=permanently-denied, iOS=restricted); drop "Windows machine" hard-code in android builder; app must be built+installed before Maestro drives it (pass --app-path); don't silent-CLOSE a shared ios ticket on Windows (mark Blocked-pending-macOS/EAS); Maestro/emulator env check in setup.
- #4 [mcpServers] → REFUTED-ish: docs prose allows mapping form, but canonical EXAMPLE uses list form (- name: / type: stdio). Align to list form to be safe.
- LOW: reviewer allowlist too strict; PO skills:[user-stories] not guaranteed present; Superpowers required-vs-optional inconsistent; reviewer hook stray top-level return.
STATUS: ✅ v2.5 DONE. All 7 root causes + low findings fixed. Validated by execution:
- reviewer hook: redirect attacks (echo>file, cat>>settings, |tee, rm) all DENIED; legit read-only ALLOWED. ✓
- path-guard: .maestro/ flows ALLOWED (the bug that stalled every mobile ticket), product code DENIED. ✓
- builder: can't edit acceptance tests, can edit product. ✓
- settings JSON valid (59 deny / 49 allow); pod install moved allow→deny. ✓
- 10/10 agent names match files; all testers list-form mcpServers; all hook refs resolve. ✓
- #4 mcpServers: aligned to documented list form (- name:/type:stdio) to be safe.
Honest note added to SKILL: hooks are best-effort not a sandbox; for a hard boundary enable OS sandbox; skill is for trusted operator-supervised use with a human gate.
NEXT: push v2.5, then re-audit to confirm clean.

---

# kanban-multiagent-implementation — v2 build notes

> Running blueprint for v2. Captures every audit finding so the v2 rewrite can fold them
> in all at once. **v2 is NOT written yet** — SKILL.md/README.md on disk are still v1.
> This file is the durable record; if the session ends, v2 can be assembled from here.

Last updated: 2026-07-11 (session in progress)

---

## Status tracker

| Step | Status |
|---|---|
| Whole-skill audit (33 findings) | ✅ done — captured below |
| Per-agent audit: Orchestrator | 🔄 running |
| Per-agent audit: Planner | ⏳ pending |
| Per-agent audit: Builder | ⏳ pending |
| Per-agent audit: Reviewer | ⏳ pending |
| Per-agent audit: Tester | ⏳ pending |
| Write v2 (fold in everything) | ⏳ pending — do LAST |

---

## Locked decisions (agreed with operator this session)

- **Human-in-the-loop, not full autonomy.** Agents advance tickets only to **Ready for review**; the human moves to **Done**.
- **Security scope:** operator confirmed the board is NOT fed by untrusted parties (the ClickUp↔Notion sync worry was mine, over-reached — it's a separate project). So: DROP the prompt-injection/sandbox/lethal-trifecta machinery. KEEP only the cheap always-sensible parts: secret-path deny-rules + human approval before irreversible actions (push/deploy/dependency).
- **Tool loadout per role (best-in-class, matched to the work):**
  - **Builder:** Superpowers (plan/TDD) for RISKY tickets; built-in Plan Mode for SIMPLE tickets; Chrome DevTools MCP for browser bugs.
  - **Tester:** Playwright MCP for driving web apps + built-in `/verify` always-on ("prove it ran"); Chrome DevTools MCP for visual/browser evidence; plain Bash test-run for backend-only tickets with no screen.
  - **Reviewer:** built-in `/code-review`.
  - **Planner:** built-in Plan Mode.
- **Installed vs. named (checked on disk):** only `/code-review` + `/verify` + Plan Mode are built-in/present. Superpowers, Chrome DevTools MCP, Playwright MCP are NOT installed → v2 must include a prerequisite-check step that installs only what's missing, in plain language. Notion MCP is NOT in global config → must be verified at setup (the one true blocker).
- **Project context exists:** Vendure project has CLAUDE.md + AGENTS.md already (good Builder context).

---

## THE BIG ONE (from whole-skill audit) — tool restrictions are not enforced

v1 claims "each agent carries ONLY its own tools" but that is **advisory text, not enforcement**.
Generic Task-spawned subagents inherit ALL tools (incl. Notion MCP). So as written:
- Builder CAN write to the board (nothing stops it)
- "Reviewer has no Bash" would BREAK `/code-review` (it needs git)
- "Tester writes test files only" isn't expressible as a tool grant (needs path perms)
- "WIP enforced by construction" is therefore also just convention

**Fix (v2 must ship these artifacts):**
- Four agent-definition files: `.claude/agents/kanban-planner.md`, `-builder.md`, `-reviewer.md`, `-tester.md`, each with real `tools:` / `disallowedTools:` frontmatter (+ `mcpServers:` where a server must be scoped to one role, e.g. Playwright→Tester only).
- A `permissions` block in `.claude/settings.json` for: path-scoped edits (Tester→tests/** only), command-scoped Bash (Builder→known test/build/lint), and secret-path deny-rules (.env, credentials, .claude/settings.json, hooks).
- Setup step must CREATE/VERIFY these before any ticket runs.
- Reword the Roles table so each restriction names the mechanism that backs it (agent file vs. permissions vs. honest "convention only").
- Reviewer/Tester DO need scoped Bash (read-only git for reviewer; test/serve for tester) — the "no Bash" claim was wrong.

---

## Whole-skill audit — confirmed findings (33 total). Grouped.

### Enforceability (all confirmed)
1. [HIGH] Per-role tool scoping asserted, never wired → agent-definition files needed (see BIG ONE).
2. [HIGH] "No subagent ever calls Notion MCP" false in practice → disallowedTools mcp__<notion> in each agent file.
3. [HIGH] Tester "write test files only" not expressible via tools frontmatter → needs settings.json path perms.
4. [HIGH] Reviewer "no Bash" contradicts /code-review needing git → allow read-only git Bash via perms.
5. [MED] Builder "Bash scoped to known commands" not a tools-frontmatter concept → permissions.allow Bash patterns.
6. [MED] Playwright/Chrome DevTools MCP: unstated install prereq + inheritance means not exclusive → declare via mcpServers in agent file + install step.
7. [MED] Deny-rules are a settings feature nobody is told to create → concrete setup step w/ exact JSON to paste.

### Best-practice fidelity
8. [HIGH] No subagent return-size limits; everything funneled through orchestrator context → each subagent writes full notes to a file, returns bounded summary (~300 words) + path.
9. [HIGH→DOWNGRADED] Orchestrator context lifecycle across many tickets unaddressed → external state file + fresh-session cadence + plan persistence. (Deeper dive in Orchestrator per-agent audit.)
10. [HIGH→DOWNGRADED] No watchdog timeout for a hung/runaway subagent → per-spawn wall-clock/tool-call budget; on breach terminate + triage.
11. [HIGH] Idempotency/write-ahead cover only Notion, not git → Builder commits at every green state (these ARE the checkpoints recovery refers to); reuse branch on retry; branch name = git idempotency key.
12. [MED] Cost controls qualitative only → numeric defaults: simple ≈2 spawns, risky ≈5-8; per-ticket ceiling → Blocked w/ cost note; session-level stop threshold.

### Operator usability (non-coder) — the recurring fix is "orchestrator proposes/explains/defaults; operator only picks from labeled options"
13. [HIGH] Operator can't seed the "shared/risky code" list → orchestrator SCANS repo, proposes list w/ 1-line plain reasons, asks yes/no; default "treat everything as risky" if unsure.
14. [HIGH] Blocked cap-exit ticket unusable by non-coder → Blocked note must be plain-language + a menu of decisions operator CAN make (retry N more rounds / split ticket / drop).
15. [HIGH] Plain-language evidence is risky-only, but simple = "most tickets" → make plain-language evidence mandatory on BOTH paths: "what changed in one sentence" + "how to try it yourself" (URL + click steps) + screenshot if visual.
16. [HIGH→DOWNGRADED] Deny-rules instruction has no actor/procedure → orchestrator offers to write them via update-config skill, shows the block, explains each, asks yes/no; ship exact JSON in skill.
17. [HIGH] Nothing ever merges finished branches → post-Done step: orchestrator merges ticket branch to main, reports "ticket X is now in the real project", asks before push.
18. [HIGH] Toolkit names third-party installs w/ no prereq check → setup step verifies each tool present; walks through install or declares fallback.
19. [MED] "confirm working tree is clean" ask is unanswerable for non-coder → describe leftover changes plainly, 2 labeled options (set aside safely / stop), recommended default.
20. [MED] Startup reconciliation "discard to last checkpoint" is destructive w/ no operator veto → consent gate on the destructive branch only, plain-language what's lost, yes/no.
21. [MED] QA checklist undefined (who authors it) → orchestrator generates it from acceptance criteria; operator never writes it. (Also finding 27.)
22. [MED] Approval-gate example gives operator nothing to decide with → approval template: why needed, what if not, how widely used, recommendation.
23. [MED] Starter prompt inherits the risky-list problem + jargon → rewrite asks: "propose the list to me", "check prereqs first", add "I am not a programmer — plain language, numbered options, recommended default."

### Consistency (spec bugs — literal execution hits a wall)
24. [HIGH] No role can START the app the Tester must drive → grant Tester scoped Bash for run/serve, OR orchestrator/setup starts app + passes URL to Tester payload.
25. [HIGH] Simple-path "lightweight check" is an unspecified role — no tool row, no failure transition → add a Roles row + define its failure transition (loop to Builder w/ cap, or upgrade to Risky).
26. [HIGH] Planner told to write tests but tool row denies write → grant Planner "write test files only" OR redefine as returning test specs the orchestrator/Builder materializes; SAY WHICH.
27. [HIGH] QA checklist load-bearing but no author/source/location defined → define author (orchestrator from acceptance criteria) — see 21.
28. [MED] To Fix transitions inconsistent (In progress→To Fix never described; To Fix→In progress only in an example) → enumerate legal transitions explicitly.
29. [MED→DOWNGRADED] To Fix on originally-Simple ticket lacks Risky-loop inputs → bounced Simple ticket first gets a Planner pass to author tests from the To Fix note; Reviewer sees cumulative diff; round cap resets.
30. [MED] "3–5 rounds" isn't a cap (must be one number) → pick one (or operator-set default); define "round" = one full Builder→Reviewer→Tester cycle; cap-exit covers ANY non-pass, not just red tests.
31. [MED→DOWNGRADED] "Sees only X" vs "may read whole repo" contradiction → reword: "payload contains only: diff, criteria, checklist — plus on-demand read-only repo access; never the Builder's reasoning."
32. [MED→DOWNGRADED] "No subagent calls Notion MCP" vs Planner row listing "Notion MCP read-only" → Planner gets orchestrator-relayed text only; move Notion entirely to its does-NOT-get column.
33. [MED→DOWNGRADED] Post-hoc re-check defined inside Risky section so it never runs on Simple tickets → move re-check into step 5 (runs on every ticket, before the Simple lightweight check).

### What held up (keep as-is in v2)
- Context isolation (fresh Reviewer/Tester, no Builder reasoning) — rated exemplary.
- Human-only Done gate + approval gates.
- Write-ahead INTENT/DONE logging + startup reconciliation (Notion side).
- Orchestrator-stamped timestamps (fixed semantics — log records orchestrator lifecycle events, not fake real-time subagent play-by-play).
- Simple/Risky split (risk-scaled effort).
- Single-writer orchestrator (once enforced by real tool scoping).

---

## ELITE CRAFT — expert methodology to write into each agent's instructions (the "best of all time" layer, no download provides this)
Sourced from named authorities: Kaner/Bach/Bolton (testing), Ousterhout "Philosophy of Software Design" (building), Google eng practices (review), INVEST/premortem (planning).

### Tester directives
1. Test to DISPROVE, not confirm — hunt how it's broken, don't check that it works.
2. Carry an explicit oracle (FEW HICCUPPS) — know what "correct" means before looking.
3. Prioritize by risk — aim effort where failure is most likely + most damaging.
4. Attack boundaries + equivalence classes MECHANICALLY — for 1-100 test 0,1,2,99,100,101 (just below/at/just above every edge); Zero/One/Many, Beginning/Middle/End, Some/None/All, Too Big/Small/Just Right. "One good one bad" is banned.
5. Fire a standing arsenal at EVERY field: empty, null, spaces, huge (256/1024/2048+), unicode/CJK/emoji/RTL, delimiters & special chars, injection payloads, overflow numbers (2^15/2^31/2^32 ±1), negatives/decimals/sci-notation/locale separators, Feb 29 non-leap/Feb 30/DST/tz/clock-rollback, missing/locked/corrupted files, domain-rule violations, uniqueness violations.
6. Test adversarially — attacker + saboteur: illegal data, out-of-order steps, interrupt mid-op, replay/double-submit, wrong user/role, resource starvation. (negative tests ~29% of cases → ~71% of defects.)
7. Provoke concurrency/timing/state-transition bugs (the ones that vanish when you look).
8. Model whole product w/ SFDIPOT — test what the ticket FORGOT, every quality criterion.
9. Structure exploration with charters + tours — thorough + accountable, not aimless clicking.

### Builder directives
1. Match the existing codebase before writing anything.
2. Smallest change that FULLY solves the problem, and only that problem.
3. Build deep modules; minimize what the next reader must hold in their head (Ousterhout).
4. Prefer duplication over the WRONG abstraction — wait for three real instances.
5. Write to reveal intention — code is read far more than written.
6. Define errors out of existence; pull complexity downward.
7. Sketch two approaches before committing; comment only the non-obvious "why".
8. Program strategically in small doses — make the change easy, then make the easy change.

### Reviewer directives
1. Review against intent; weight scrutiny toward incident-causing defect classes.
2. Construct concrete failure scenarios, not "does this look right?".
3. Audit for what is ABSENT — missing tests, unhandled errors, unvalidated input.
4. Read one frame up and one frame down before flagging/approving.
5. Label every finding by severity; back objections with fact/failure, never preference.
6. Approve on "definitely improves code health," not "perfect" — refuse to bikeshed.

### Planner directives
1. Slice vertically — every task delivers observable end-to-end value or concrete learning.
2. Sequence by risk + economics — scary-and-critical first; run a premortem before committing.
3. Every task INVEST-compliant + right-sized (esp. Independent, Valuable, Testable, Small).
4. Acceptance criteria as concrete Given-When-Then examples — objective, never adjectives; keep separate from a project-wide Definition of Done.
5. Validate the breakdown for 100% coverage + zero overlap — incl. unglamorous glue work.
6. Match planning depth to how knowable the work is; spikes as last resort.

### Orchestrator directives
1. Delegate outcomes with intent + boundaries, not step-by-step recipes; trust the process by default.
2. Verify the actual ARTIFACT against pre-agreed objective criteria — never accept self-reported "done", never redo work that already passes.
3. Calibrate oversight to task-relevant maturity — vary check-in rate per delegate/task.
4. Triage decisions by reversibility — fast on two-way doors, slow only on one-way doors.
5. Derive state from systems of record — read artifacts before interrogating anyone; keep an append-only decision log.
6. Act on leading indicators of drift — "wait and hope" is a failure mode.
7. Spend scarce intervention only on blockers only you can clear; shield delegates from the rest.
8. Escalate genuine deadlock immediately; once legitimately overruled, disagree-and-commit.

---

## PROFESSIONAL KIT — curated (signal cut from 28 verified picks; avoid tool-bloat / 20+ tool confusion)
Principle: core tool + ONLY additive non-redundant extras. Superpowers already bundles debugging/TDD/planning — do NOT double-install those.

### Discovery: /security-review is BUILT-IN (verification found it) → Reviewer gets security auditing for free.

| Agent | CORE (install/have) | ADDITIVE extras worth it | Deliberately SKIP (redundant/conflict) |
|---|---|---|---|
| Planner | Plan Mode (built-in) | **GitHub Spec-Kit** (/speckit.tasks + .analyze + .clarify) — real dependency-order + decomposition + gap detection (the Planner's #1 audit gap) | RICE-scoring, issue-triage, separate requirements skills (overlap Plan Mode+Spec-Kit) |
| Builder | Superpowers (risky) / Plan Mode (simple) / Chrome DevTools MCP (browser) | **Postgres MCP** (if DB), **Sentry MCP** (if prod error triage) — backend debugging gap | separate debugging/TDD skills (Superpowers already has systematic-debugging + TDD); Codex |
| Reviewer | /code-review + **/security-review** (both built-in) | **Semgrep MCP** (SAST), TruffleHog/Gitleaks (secret scan) — security depth | Adversarial-reviewer skill (overlaps built-ins), Greptile/CodeRabbit (external PR reviewers, redundant w/ our Reviewer) |
| Tester | Playwright MCP + /verify (built-in) + Chrome DevTools MCP (visual) | **Postman MCP** (API/backend testing — the no-UI gap); design-review skill (visual/UX) | duplicate screenshot tools; systematic-debugging (Builder's) |
| Orchestrator | Notion MCP | **native budget controls** (--max-budget-usd, --max-turns) — the cost-cap audit gap; Structured Outputs (JSON schema) for validating subagent returns | Slack plugin (already have notification paths) |

Note: gate DB/API/prod tools on whether the project actually has that surface (Vendure does: Postgres + API). Don't install what a given project can't use.

## Per-agent audits (deeper pass — fill in as each completes)

### Orchestrator — ✅ done  (durability design — WAL, single-writer, attempt-# idempotency — rated TEXTBOOK/strongest part)
1. [HIGH · GAP] "Validates against live board state" checks the WRONG thing. Orchestrator has only Notion MCP (no Bash/test runner) → cannot verify a Builder "tests pass" claim; just checks board consistency then TRUSTS it. Best practice: never trust subagent self-reported success. → Before Ready-for-review, require ONE independent re-execution of the tests (by the Tester, or a verify step) confirming the claim — on BOTH paths. Split "validate" into (a) board-state check + (b) claim-evidence check.
2. [HIGH · GAP] No proactive context management — Orchestrator persists across whole backlog, degradation starts ~70% fill, no trigger. → compact ~60%, fresh-session handoff every N tickets w/ explicit handoff brief, persist plan/progress to an EXTERNAL file (not just chat+board).
3. [MED · GAP] Dual-write consistency — board transition + log line are two separate Notion writes, no transaction; crash between = out of sync. → write-ahead INTENT/DONE must explicitly cover both writes; add TTL-staleness on remembered board view.
4. [MED · ENFORCEMENT] "Does not write code itself" is advisory → agent-definition file / --agent denies Edit/Bash/Read/Grep outright (pure delegation enforced, not requested).
- Also: add lease/heartbeat + fencing token to orphaned-"In progress" reclamation (currently conceptual only); guard against non-deterministic replay on recovery; give each subagent a COMPLETE brief (objective + output format + tools + explicit boundaries — vague delegation is the #1 orchestration failure).
- Credited as DONE WELL: WAL INTENT/DONE + unmatched-INTENT reconciliation, single-writer ownership, attempt-# idempotency key, lean coordinator taking only distilled returns, WIP=1 as context hygiene.

---
## ⚠️ v2 BUILT, then AUDITED — CONFIRMED WIRING BUGS TO FIX (v2.1)
The post-build audit (5 auditors; verify phase cut off by session limit) found the wiring I asserted from knowledge is WRONG in load-bearing ways. Must fix before the skill can run:

1. [HIGH] Agents can't invoke their skills — Reviewer/Tester/Builder frontmatter omits the **`Skill`** tool, so /code-review, /security-review, /verify, Superpowers CANNOT fire. The whole independent-oracle guarantee silently fails. FIX: add `Skill` to tools of Reviewer, Tester, Builder (and PO); optionally scope Skill(code-review *) etc.
2. [HIGH] Orchestrator can't spawn subagents — its tools are Read/Grep/Glob only, missing **`Agent`** (and it needs the Notion MCP tools too, which aren't inherited). FIX: orchestrator tools must include Agent + the Notion MCP tools; it's the main session so it keeps those, but the frontmatter allowlist STILL restricts it — so list them.
3. [HIGH] settings.json is SESSION-WIDE, not per-agent — cannot express "Planner writes tests, Builder can't" or "Reviewer read-only git, Builder write git". The deny on tests/acceptance/** actually BLOCKS the Planner/Tester from their own job. FIX: per-agent path/Bash scoping must be a **PreToolUse hook in the agent's own frontmatter**, not shared settings.json. Correct SKILL.md's "enforced by settings" claim — settings does secrets + irreversible-op denies (session-wide, correct); per-agent scoping needs hooks.
4. [HIGH] `Write(path)` deny-rules are NO-OPS since Claude Code v2.1.210 — only `Edit(path)` / `Read(path)` match. FIX: change all Write(...) denies to Edit(...); remove Write() forms.
5. [MED] Shared allow-list gives write-capable git (checkout/add/commit) + npm run dev/start to EVERY agent → Reviewer isn't actually read-only. Same hook-based fix as #3.
6. [MED] Plan Mode / EnterPlanMode may not be invocable by spawned subagents — verify; Builder "uses Plan Mode" may need a different mechanism.
7. [MED] Human gates (push/deploy/dependency) are advisory prose with no matching deny — the push/deploy denies exist in settings (good) but "ask before adding a dependency" has no enforcement. FIX: add a deny or hook on package-install commands.
8. [LOW/consistency] In-progress→To Do used by reconciliation but not in the legal-transitions list; Simple-path test-author self-contradiction; SKILL tool descriptions vs actual frontmatter drift.

STATUS: v2 files written but NOT runnable until #1-#4 fixed. This is a v2.1 wiring pass, not a redesign — the architecture/craft hold.

## ✅ v2.1 WIRING FIX — DONE (verified against real Claude Code docs, not asserted)
Checked docs first; the audit was RIGHT on the problem but WRONG on the fix for #1:
- Docs: subagents invoke skills through the Skill tool AUTOMATICALLY — do NOT need "Skill" in tools (use `skills:` to PRELOAD). Audit's "add Skill to tools" was wrong.
- Docs: a `tools:` list is an ALLOWLIST that strips MCP tools. THE REAL BUG. Fix: use `disallowedTools:` DENYLIST on all 6 agents → they inherit MCP (Notion/Playwright/Chrome DevTools) + Skill, we subtract only what's forbidden. ✓ done all 6.
- Docs: `mcpServers:` inline IS valid frontmatter (Tester's Playwright wiring was already correct). ✓
- Docs: settings.json is SESSION-WIDE — can't do per-agent path/Bash scoping. Moved that to PreToolUse HOOKS (templates/hooks/*.js), referenced per agent. ✓ 5 hook scripts, SMOKE-TESTED (tester denied writing src/, allowed writing tests/). 
- Docs: Write(path) rule never matches as of v2.1.210 → changed all to Edit(). ✓
- Bonus: added npm install/i to settings DENY (closes finding #7 — dependency-add now actually blocked, routes to human). ✓
- Fixed board-transition consistency (added In progress→To Do reconciliation reset, Blocked→To Do). ✓
- SKILL.md updated: 6 agents, corrected "enforced by" claims (denylist + hooks + session settings, not the earlier wrong story). ✓
Files now: 6 agents + 5 hooks + settings + SKILL/README/V2_NOTES. All JSON valid, all JS parses, hooks proven to deny/allow correctly by execution.
CAVEAT: audit VERIFY phase never ran (hit session limit) — so a few lower-severity findings (craft length, operator-safety nuance) are noted but not yet re-audited. Core wiring is now doc-verified + smoke-tested.

## ✅ v2.2 — ALL 36+12 AUDIT FINDINGS PROCESSED (verified against docs, smoke-tested by execution)
Went through every single finding. Result: many were duplicates of the same root cause, several were REFUTED by the real docs, the rest fixed. Final disposition:
- REFUTED by docs (audit was wrong): #1/#17/#30 "add Skill to tools" — docs say subagents invoke skills automatically, no Skill in tools needed. #7/#19/#33 "mcpServers needs list+type:stdio" — docs confirm the mapping form (name as key, config as value) is valid; Tester wiring was correct.
- FIXED — mechanics: denylist not allowlist (all 6 agents, done in v2.1); Write()→Edit() (#4); Orchestrator MUST be main session + has Agent tool, documented loudly (#6/#18/#22/#29/#32); Plan Mode is main-session/read-only → Builder+Planner now plan in PROSE not the mode (#5/#23/#15).
- FIXED — settings: broadened secret denies (wrangler in subdirs via **/, .dev.vars, .npmrc, id_ed25519, p8/p12/key, git-credentials, tfvars) (#26); added ALL dependency/escalation denies — npm install/i, yarn/pnpm add, pip install, git config/remote, chmod, commit --no-verify (#24); rm:* replaces evadable rm -rf:* (#L1/#L9); bare Bash forms added alongside :* (#31).
- FIXED — consistency: Simple-path oracle has ONE owner now — Planner writes 1 failing test, Builder can't edit it, Tester runs it (#11/#12/#32); /verify is a tool not an actor (#13); run-state persists to a Notion "Run state" page (orchestrator has no Write + .claude is denied) (#36); legal transitions list includes reconciliation resets (#16); kit column no longer names Plan Mode as a tool (#15/#10); orchestrator numbered rules de-duplicated 1-5 (#L2/#L5/#L11).
- FIXED — operator safety: setup now AUTO-DETECTS commands from package.json + test path from repo (no glob typing) (#25/#27); merge is a safe array-union with .bak backup + before/after diff, never a block paste (#28); main-session Notion smoke-test in setup (#22).
- FIXED — independence: Builder no longer writes a reasoning file into the repo (Reviewer/Tester could read it) — reasoning stays in the bounded return to the orchestrator only (#35/#8).
VALIDATION: settings JSON valid (36 deny / 23 allow); all 5 hooks parse; hooks SMOKE-TESTED by execution — Builder denied editing acceptance test + allowed product code; Reviewer denied git commit + allowed git diff. Cross-file grep clean.
REMAINING (deliberately deferred, low-value or need live env): craft-length trims (#L6-8, quality not bug); a couple of "verify in target install that /security-review exists" items that can only be checked on the real machine at setup; these are noted in setup step 2 (prerequisite check).

## ✅ v2.3 — SURFACE-ADAPTIVE (web + Android + iOS-ready) — one skill does both
Operator wants ONE skill for web AND mobile (Toggl rebuild = one backend, web + Android faces). Design chosen: ADAPTIVE agents.
- Verified vs docs: tools/mcpServers are fixed per agent FILE, not per-invocation → adaptive = separate per-surface "hands" agents, orchestrator routes. Thinking agents stay one file (dual-mode).
- SURFACE tag per ticket: web / android / backend / ios. Orchestrator routes: web→builder-web+tester-web (Playwright); android→builder-android+tester-android (Maestro MCP); backend→web agents no-UI; ios→deferred.
- ROSTER now 8: PO, Orchestrator, Planner, Reviewer (single, dual-mode) + Builder-web/Builder-android + Tester-web/Tester-android.
- Mobile framework decision: Flutter or RN — research found **Maestro MCP is the best agent-driver for Flutter** (first-class, drives release APK via semantics tree, has MCP for Claude; mobile-mcp is WEAK for Flutter). RN can also use mobile-mcp. Android tester wired to Maestro MCP inline.
- iOS: operator picked "Android-drivable now, iOS-ready". Expo = one codebase both platforms, BUT iOS build/test needs macOS. So ios tickets → Blocked—needs cloud build (EAS); shared code covered by matching android ticket; never claim iOS verified locally. No Mac purchase — EAS cloud when they choose to ship iOS.
- PO gained mobile story-classes (permissions 4-states, offline, push, Play Store, Material) — Android-only, skip Apple/HIG unless asked.
- Planner/Reviewer gained mobile checklists (dual-mode, same file). Builder-android has mobile musts (Semantics identifiers for testability, permission states, offline).
- Settings: added flutter/gradlew/expo/adb/emulator/maestro Bash (allow now 40).
- VALIDATED: 8 agents, name==filename all ✓; settings JSON valid; Maestro MCP wired; hooks re-smoke-tested with mobile paths (Android tester DENIED lib/main.dart, ALLOWED test/*.yaml).
- KEY CONSTRAINT (unchanged, absolute): iOS needs macOS — on Windows, Android is fully local, iOS is cloud-only. Not a skill limit, an Apple one.

## + NEW AGENT: Product Owner (idea → user stories → backlog; advises as PO). FIRST agent in pipeline. Research done (recovered from journal).
### PO craft (distilled — authorities: Patton, Cohn, Torres, Wake, Pichler, Ulwick, Scrum Guide):
1. Outcomes, not output — backlog is a bet on results, not a feature list.
2. Every story is a placeholder for a conversation — Connextra "As a [SPECIFIC persona]/I want/so that"; BAN "As a user".
3. Gate every story against INVEST before Ready.
4. Split vertically with a NAMED method (Lawrence's 9 patterns / Cohn SPIDR) — never by architecture layer or arbitrary chunk.
5. Given-When-Then acceptance criteria a QA can verify with zero follow-up — ALWAYS include unhappy paths; EARS SHALL patterns for system/NFR.
6. Build a story MAP not a flat list — user-journey backbone, mile-wide before inch-deep, slice releases through it (Patton).
7. MVP = walking skeleton — thinnest end-to-end slice delivering a real outcome, built breadth-first.
8. Prioritize with a NAMED framework matched to maturity (Kano/Value-vs-Effort early → WSJF at scale → MoSCoW for scope) and SHOW the math (RICE/ICE).
9. Discovery precedes delivery — anchor in validated opportunities not assumed solutions (Torres OST); map problem space before solution space (Impact Mapping); anchor needs in the job (JTBD/Ulwick).
10. Definition of Ready = entry gate; Definition of Done = exit commitment.
11. Design the Notion DB schema deliberately — the properties ARE the process; capture the idea as a concise living outcome-first brief.
### PO kit (Claude Code, not external SaaS):
- deanpeters/Product-Manager-Skills (plugin suite: user stories, backlog, prioritization, OST, epic-breakdown) — install
- claude-code-pm-skills user-stories skill (INVEST + Gherkin) — install
- EARS requirements skill — install
- Notion MCP (create-database, create-pages, update) — HAVE
- Built-in Plan Mode fallback for all of the above.

## ✅ ALL 5 PER-AGENT AUDITS COMPLETE + craft + kit gathered. READY TO WRITE v2.
Recovery note: Orchestrator audit workflow (wf_ac78f1cf-59b) died before writing its output file; results recovered from journal.jsonl. Only 1 of 4 audit verdicts was fully captured (the HIGH one above); the other 3 aspects covered by research findings + whole-skill audit.

### Planner — ✅ done
1. [HIGH · CONTRADICTION] Planner told to WRITE failing test files (Risky) but tool row grants only read → give it "write access to test files only" (mirror Tester) + define where test files land.
2. [MED · GAP] Planner never DECOMPOSES oversized tickets — its most important job. Models: >70% single-file → <25% multi-file. It just triages+orders, hands whole multi-file ticket to one Builder. Post-hoc "upgrade to Risky" is reactive, not proactive splitting. → Add a sizing/decomposition gate BEFORE ordering: "can this be built in one pass? if not, split into bounded sub-tickets."
3. [MED · CONTRADICTION] Simple-vs-Risky decision owner is ambiguous — line 33 says Orchestrator, line 91 says Planner. → Orchestrator decides; Planner only recommends/flags.
4. [HIGH · GAP] Planner authors tests without first learning project's test conventions (framework, naming, patterns) → risks tests that don't fit / Builder games. → Planner must survey existing tests + read CLAUDE.md before authoring.
- Research to carry into v2: normalize acceptance criteria into testable form (EARS / Given-When-Then) BEFORE writing tests, so "testable" is a property of the criteria. Also: add a cheap PRE-build review gate on the Planner's own output (ordering + Simple/Risky call + test set), not just the terminal Ready-for-review gate — "cheap iterations on the plan beat expensive iterations on the code."

### Builder — ✅ done  (smallest-change rule + tool-scaling intent rated STRENGTHS)
1. [HIGH · GAP] Recovery says "discard to last checkpoint" but Builder is NEVER told to commit checkpoints — word "checkpoint" appears once, only in the recovery rule. → Builder MUST commit at every green test (RED-GREEN cycle = 1 commit); deterministic branch = idempotency anchor; reuse branch on retry.
2. [HIGH · GAP] Toolkit NAMES tools (Superpowers, Chrome DevTools MCP, Plan Mode) but never WIRES them, and some aren't subagent-invocable as assumed → replace descriptive Toolkit table with explicit per-role tool declarations the orchestrator passes at spawn (concrete tool names) via the agent-definition files.
3. [MED · GAP] Simple path: Builder writes its OWN tests AND implementation → self-grading returns. → Split test authorship from the check on Simple path too: Planner writes ≥1 acceptance test even on Simple path (minimal), OR the fresh-context check owns the oracle — Builder never authors the test it must pass.
4. [MED · GAP] Builder return unbounded (diff summary + raw test output funneled through orchestrator) → bounded return (~200 words / ~1500 tokens): full evidence to a file on disk, orchestrator attaches by reference.
- Research to carry into v2: (a) mandatory RED phase — Builder must run the test, paste failing output, THEN implement (else it writes a test that already passes); (b) imperative-mood commit messages + agent-attribution trailer so git history mirrors the Notion audit trail; (c) name YAGNI explicitly + Reviewer rejects unrequested new files/helpers/abstractions (not just new deps); (d) state "pick Plan Mode OR Superpowers, not both — redundant."

### Tester — ✅ done  (drive-real-app + fresh-context + non-coder evidence rated STRENGTHS)
1. [HIGH · GAP] Tester must "drive the app" but has NO Bash to start/serve it → app never starts on Risky path. → Hybrid: orchestrator provides a base URL AND Tester gets scoped Bash for the run/serve command (can't rely on orchestrator staying alive per line 85).
2. [MED · GAP] "write test files only" not enforceable as prose → ship settings.json permissions block (deny Edit/Write on product paths, allow tests/**) installed before spawning Tester.
3. [HIGH · CONTRADICTION] Operator-usable evidence (plain-language + screenshots) is Risky-path ONLY, but Simple = "most tickets" → most tickets reach the human with NO readable evidence. → DECOUPLE evidence from the risk decision: every Ready-for-review ticket gets plain-language "what changed" + "how to try it" + screenshot if visual, regardless of path.
4. [MED · GAP] Tester defined only around Playwright/browser, but escalation sends backend-only tickets (Workers/APIs) to it with no UI → make instrument conditional: UI ticket → Playwright; non-UI → run the suite + /verify (needs scoped Bash).
- Research to carry into v2: (a) drive via accessibility-tree snapshots + ref IDs (deterministic, ~200-400 tokens), screenshots as EVIDENCE not interaction; (b) verify ONLY against the human/Planner-authored oracle checklist — forbid Tester inventing its own pass criteria (LLMs biased toward "no defect"; oracle lifted F1 30%→49%); (c) "push on it" — probe edge cases/bad inputs after happy path, document even null findings; strict PASS/FAIL/SKIP; (d) leave behind a committed deterministic Playwright test (chat transcript ≠ regression suite); tag agent-authored tests; cap tool iterations (~8); (e) confirm a failure is a REAL bug (flake/hallucination triage) before surfacing.

### Reviewer — ✅ done  (core design rated a genuine STRENGTH — these are refinements)
1. [HIGH · CONTRADICTION] Reviewer gets /code-review but denied Bash; /code-review MUST run git diff (confirmed vs real command on disk) → grant read-only git Bash (git status/diff/log/show/blame); remove Bash from "does NOT get".
2. [LOW · CONTRADICTION] "Sees only diff+criteria+checklist" vs "may pull related files" in same row → reword: "only" = Builder's work-product (no reasoning trace); on-demand read-only repo access explicitly allowed.
3. [MED · GAP] Nothing scopes Reviewer to correctness/requirement gaps → will nitpick into over-engineering. No "nothing out of scope changed" check. → Add scope contract: flag only real defects w/ concrete failure scenario, drop nitpicks; severity taxonomy BLOCK/CONCERNS/CLEAN instead of bare pass/fail.
4. [MED · GAP] Same-model blind spot — Reviewer is fresh-context but same model family as Builder → make cross-model review an explicit RECOMMENDED option on Risky path (keep context isolation as primary).
- Research to carry into v2: (a) every finding must carry a concrete failure scenario (inputs/state→wrong output), not just file:line; (b) validation gate — each finding self-verified against the code before surfaced, uncertain ones DROPPED (mirrors how real /code-review works internally); (c) note that /code-review defaults to diff-only, so the on-demand-repo-pull behavior must be stated explicitly, not assumed.

### Tester — ⏳ pending
