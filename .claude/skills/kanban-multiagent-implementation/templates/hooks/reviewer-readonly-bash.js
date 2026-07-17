#!/usr/bin/env node
/*
 * Reviewer: keep Bash READ-ONLY. Allow only inspection commands (read-only git, ls, cat, rg…);
 * deny anything that mutates the tree or state, INCLUDING shell output redirection (> >> | tee)
 * which would otherwise let `echo x > file` overwrite any file and bypass the whole restriction.
 * settings.json can't scope Bash per-agent, so this PreToolUse hook does it for the reviewer.
 *
 * NOTE (honest limitation): a PreToolUse hook is best-effort, not a security boundary. For a hard
 * guarantee that a subprocess cannot touch a path, enable Claude Code's OS `sandbox`. This hook
 * raises the bar (blocks the obvious mutation/redirect paths) but is not a sandbox substitute.
 */
function readInput() { try { return JSON.parse(require('fs').readFileSync(0, 'utf8')); } catch { return {}; } }
function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason }
  }));
  process.exit(0);
}

const input = readInput();
const cmd = String((input.tool_input || input.toolInput || {}).command || "").trim();
if (!cmd) process.exit(0);

// 1) Redirection / pipe-to-writer: matched as literal chars (word boundaries do NOT work on > | ).
//    Blocks: > file, >> file, | tee, and process substitution.
if (/(^|[^0-9])>>?|(\btee\b)|>\(/.test(cmd)) {
  deny(`Reviewer is read-only; output redirection is not allowed: ${cmd}`);
}

// 2) Mutating commands (word-bounded is fine for these — they're all word tokens).
const MUTATORS = /\b(git\s+(add|commit|checkout|switch|reset|stash|push|merge|rebase|clean|restore|apply)|rm|mv|cp|install|npm\s+(install|run|start|publish|ci)|npx|yarn|pnpm|pip|sed\s+-i|touch|mkdir|dd|chmod|chown|ln)\b/;
if (MUTATORS.test(cmd)) {
  deny(`Reviewer is read-only; this command mutates state: ${cmd}`);
}

// 3) Positive allowlist: every segment of a &&/||/;/| chain must be a known read-only command.
const READ_ONLY = [
  /^git\s+(status|diff|log|show|blame|rev-parse|ls-files|cat-file|branch\s+--list)\b/,
  /^(ls|cat|head|tail|wc|rg|grep|find|pwd|echo|which|file|stat|node\s+--version|npm\s+ls)\b/,
];
const segments = cmd.split(/&&|\|\||;|\|/).map(s => s.trim()).filter(Boolean);
const allOk = segments.every(seg => READ_ONLY.some(rx => rx.test(seg)));
if (!allOk) {
  deny(`Reviewer may run read-only inspection commands only. Blocked: ${cmd}`);
}
process.exit(0);
