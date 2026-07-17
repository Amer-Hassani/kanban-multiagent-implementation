#!/usr/bin/env node
/*
 * Reviewer: keep Bash READ-ONLY. Allow only inspection commands (read-only git, ls, cat, rg…);
 * deny anything that mutates the tree or state. settings.json can't scope Bash per-agent, so this
 * PreToolUse hook does it for the reviewer agent specifically.
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

// read-only allowlist (each segment of a &&/|/; chain must match one of these)
const READ_ONLY = [
  /^git (status|diff|log|show|blame|branch --list|rev-parse|ls-files)\b/,
  /^(ls|cat|head|tail|wc|rg|grep|find|pwd|echo|which|node --version|npm ls)\b/,
];
const MUTATORS = /\b(git (add|commit|checkout|switch|reset|stash|push|merge|rebase|clean|restore)|rm|mv|cp|npm (install|run|start|publish)|npx|>|>>|tee|sed -i|touch|mkdir)\b/;

if (MUTATORS.test(cmd)) return deny(`Reviewer is read-only; this command mutates state: ${cmd}`);
const segments = cmd.split(/&&|\|\||;|\|/).map(s => s.trim()).filter(Boolean);
const allOk = segments.every(seg => READ_ONLY.some(rx => rx.test(seg)));
if (!allOk) return deny(`Reviewer may run read-only inspection commands only. Blocked: ${cmd}`);
process.exit(0);
