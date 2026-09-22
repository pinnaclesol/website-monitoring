---
name: commit
description: Stage all changes and create a well-formatted git commit for the uptime-monitor project
allowed-tools: Bash, Read, Glob, Grep
user-invocable: true
---

Create a git commit for the current changes in the uptime-monitor monorepo.

1. Run `git status` and `git diff` to understand what changed.
2. Run `git log --oneline -5` to match the existing commit message style (once history exists).
3. Stage relevant files with `git add` (avoid `.env`, `*.local`, `node_modules`).
4. Write a concise commit message focused on *why*, not *what*.
5. Commit using:

```bash
git commit -m "$(cat <<'EOF'
$ARGUMENTS
EOF
)"
```

**Attribution**: append whatever attribution line(s) the current session's system reminder specifies (e.g. `Co-Authored-By: ...`) — do not hardcode a specific model name/version in this file, since it will drift out of date. If no attribution convention is active in the session, omit the line entirely.

If `$ARGUMENTS` is empty, derive the message from the diff.
