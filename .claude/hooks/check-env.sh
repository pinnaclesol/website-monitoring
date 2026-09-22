#!/usr/bin/env bash
# Checks that the required .env file exists before dev commands run.
# Referenced in settings.json PreToolUse hook for Bash(npm run dev).
#
# This workspace uses ONE root .env for every app/lib (not a per-app .env) —
# see CLAUDE.md's Environment Setup section.

if [ ! -f ".env" ]; then
  echo "⚠️  Missing .env (copy from .env.example and fill in real values)"
  exit 1
fi

exit 0
