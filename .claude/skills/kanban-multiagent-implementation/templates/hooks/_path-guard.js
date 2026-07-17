#!/usr/bin/env node
/*
 * Shared PreToolUse path-guard for the kanban agents.
 * Claude Code passes the tool call as JSON on stdin; a hook DENIES the call by
 * printing a JSON decision with permissionDecision "deny" (and a reason) and
 * exiting 0. Anything else = allow. See code.claude.com/docs/en/hooks.
 *
 * This file is the shared engine; the per-agent wrappers below call guard(mode).
 * EDIT the path constants to match THIS project's layout before use.
 */

// Where the Planner writes acceptance tests. The setup step should keep this in sync
// with the project's real location; the default covers web (tests/acceptance/) AND
// mobile Maestro flows (.maestro/acceptance/ or tests/acceptance/*.yaml).
const ACCEPTANCE_TEST_GLOB = /(^|\/)tests\/acceptance\/|(^|\/)\.maestro\/acceptance\//;

// Any test file/dir the Planner or Tester may write. Covers:
//  · web/unit: *.test.*, *.spec.*, tests/, __tests__/
//  · android native: androidTest/, *UITest(s)
//  · mobile e2e flows (Maestro YAML): .maestro/, maestro/, flows/, e2e/, and *.yaml/*.yml under those
const ANY_TEST_GLOB = new RegExp([
  /(\.|_|\/)(test|spec)s?[.\/]/.source,          // foo.test.ts, foo_spec.rb, /tests/…
  /(^|\/)tests?\//.source,                        // tests/ or test/
  /(^|\/)__tests__\//.source,                     // __tests__/
  /(^|\/)androidTest\//.source,                   // Android instrumented tests
  /(^|\/)\.?maestro\//.source,                    // .maestro/ or maestro/ (Maestro flows)
  /(^|\/)(flows|e2e)\/.*\.ya?ml$/.source,         // flows/…​.yaml, e2e/…​.yml
  /UITests?[.\/]/.source,                          // iOS *UITests
].join('|'), 'i');

const PRODUCT_DENY_HINT = "This agent may write test files only (unit/spec, tests/, .maestro/ flows), not product code.";

function readInput() {
  try { return JSON.parse(require('fs').readFileSync(0, 'utf8')); }
  catch { return {}; }
}
function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason }
  }));
  process.exit(0);
}
function allow() { process.exit(0); }

// pull the target file path out of the tool input across Edit/Write/MultiEdit shapes
function targetPath(input) {
  const t = input.tool_input || input.toolInput || {};
  return t.file_path || t.path || (t.edits && t.edits[0] && t.edits[0].file_path) || "";
}

function guard(mode) {
  const input = readInput();
  const p = String(targetPath(input)).replace(/\\/g, '/');
  if (!p) return allow();

  if (mode === 'planner-tests-only' || mode === 'tester-tests-only') {
    // may write ONLY test files
    if (ANY_TEST_GLOB.test(p)) return allow();
    return deny(PRODUCT_DENY_HINT + ` Blocked write to: ${p}`);
  }
  if (mode === 'builder-no-acceptance') {
    // may write anything EXCEPT the Planner's acceptance tests
    if (ACCEPTANCE_TEST_GLOB.test(p)) return deny(`The Builder may not edit acceptance tests it must pass. Blocked: ${p}`);
    return allow();
  }
  return allow();
}

module.exports = { guard };
