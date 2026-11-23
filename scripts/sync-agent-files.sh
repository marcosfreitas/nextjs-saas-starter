#!/usr/bin/env bash
# Copy the template's agent files (rules, the orc skill) into a project built from it.
#
# Run it from the root of the TARGET project:
#   bash ~/Projects/Web/nextjs-saas-starter/scripts/sync-agent-files.sh           # shows the plan, writes nothing
#   bash ~/Projects/Web/nextjs-saas-starter/scripts/sync-agent-files.sh --apply   # copies
#   ... --apply --force   # also overwrites files the project customised (see below)
#
# What it never does:
# - It never overwrites a file the project has customised. A target file is replaced
#   only when its content is byte-identical to some version this template has shipped
#   (checked against the template's git history). Anything else is reported as
#   CUSTOMISED and left alone, to be merged by hand.
# - It never touches files the template does not ship: project-specific rules, skills
#   and notes stay as they are.
# - It never edits CLAUDE.md.
#
# --force lifts the first guard: a customised file with the template's name is
# overwritten too, and a rule the project lacks is added. The local version is lost
# from the working tree, so --force refuses a file with uncommitted changes (git could
# not give it back). Use it only where the template's text is right for the project:
# a rule or skill that carries project state, or that describes another stack, is
# wrong to overwrite.
#
# Copies are plain `cp`, so the result is the template's file, not a rewrite of it.

set -euo pipefail

TEMPLATE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$(pwd)"
APPLY=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --force) FORCE=1 ;;
    *) echo "unknown option: $arg (use --apply and, optionally, --force)" >&2; exit 2 ;;
  esac
done

if [ "$TARGET" = "$TEMPLATE" ]; then
  echo "Run this from the target project, not from the template." >&2
  exit 2
fi
if [ ! -d "$TARGET/.git" ] && [ ! -f "$TARGET/.git" ]; then
  echo "$TARGET is not a git repository root. Run from the project root." >&2
  exit 2
fi

# Files the template ships and keeps in sync. Rules are listed from disk so a new
# rule is picked up without editing this script.
FILES=()
while IFS= read -r f; do FILES+=("$f"); done < <(cd "$TEMPLATE" && ls .agents/rules/*.md)
FILES+=(".claude/skills/orc/SKILL.md" ".claude/skills/agentic-owasp-security/SKILL.md")

# Prints the template commit whose version of this path equals the target file, if any.
matching_template_commit() {
  local rel="$1" hash commit
  hash="$(git hash-object "$TARGET/$rel")"
  while read -r commit; do
    if [ "$(git -C "$TEMPLATE" rev-parse "$commit:$rel" 2>/dev/null)" = "$hash" ]; then
      echo "$commit"
      return 0
    fi
  done < <(git -C "$TEMPLATE" log --format=%H -- "$rel")
  return 1
}

# Baseline: the newest template commit that any of the project's files still matches.
# It dates the template snapshot the project was built from. A rule the project lacks
# is added only if the template created it AFTER that date. A rule that already
# existed back then and is missing here was left out by the project on purpose.
baseline=0
declare -A MATCH
for rel in "${FILES[@]}"; do
  [ -f "$TARGET/$rel" ] || continue
  if commit="$(matching_template_commit "$rel")"; then
    MATCH["$rel"]="$commit"
    ts="$(git -C "$TEMPLATE" show -s --format=%ct "$commit")"
    [ "$ts" -gt "$baseline" ] && baseline="$ts"
  fi
done

copied=0; customised=0; same=0; skipped=0

# A rule's paths block is also a list of what the rule assumes exists. When most of
# its globs match nothing in the target, the rule probably describes code this
# project does not have: say so, so someone reads it before trusting it.
fit_note() {
  local rel="$1"
  case "$rel" in .agents/rules/*) ;; *) return 0 ;; esac
  python3 - "$TEMPLATE/$rel" "$TARGET" "$rel" <<'PY'
import glob, itertools, os, re, sys
rule, target, rel = sys.argv[1:4]
paths, block = [], 0
for line in open(rule):
    if line.strip() == '---':
        block += 1
        if block == 2: break
        continue
    m = re.match(r'\s+-\s+"?(.*?)"?\s*$', line)
    if block == 1 and m: paths.append(m.group(1))
def braces(pattern):                      # expand {a,b}; glob itself does not
    parts = re.split(r'\{([^}]*)\}', pattern)
    options = [p.split(',') if i % 2 else [p] for i, p in enumerate(parts)]
    return [''.join(c) for c in itertools.product(*options)]
missing = sum(1 for p in paths
              if not any(glob.glob(os.path.join(glob.escape(target), g), recursive=True) for g in braces(p)))
if paths and missing * 2 > len(paths):
    print(f"  REVIEW    {rel}: {missing} of {len(paths)} paths match nothing here. It may describe code this project lacks.")
PY
}

for rel in "${FILES[@]}"; do
  src="$TEMPLATE/$rel"; dst="$TARGET/$rel"

  # A rule is only added to a project that already keeps rules in .agents/rules.
  # A skill is only updated where the project already has that skill.
  case "$rel" in
    .agents/rules/*) [ -d "$TARGET/.agents/rules" ] || { skipped=$((skipped+1)); continue; } ;;
    *)               [ -f "$dst" ] || { echo "SKIP        $rel (the project does not have this skill)"; skipped=$((skipped+1)); continue; } ;;
  esac

  if [ ! -e "$dst" ]; then
    created="$(git -C "$TEMPLATE" log --diff-filter=A --format=%ct -- "$rel" | tail -1)"
    if [ $FORCE = 1 ] || { [ "$baseline" -gt 0 ] && [ "${created:-0}" -gt "$baseline" ]; }; then
      echo "NEW         $rel"
      fit_note "$rel"
      [ $APPLY = 1 ] && cp "$src" "$dst"
      copied=$((copied+1))
    else
      echo "ABSENT      $rel (the project does not carry this rule: not added)"
      skipped=$((skipped+1))
    fi
  elif cmp -s "$src" "$dst"; then
    same=$((same+1))
  elif [ -n "${MATCH[$rel]:-}" ]; then
    echo "UPDATE      $rel"
    fit_note "$rel"
    [ $APPLY = 1 ] && cp "$src" "$dst"
    copied=$((copied+1))
  elif [ $FORCE = 1 ]; then
    if [ -n "$(git -C "$TARGET" status --porcelain -- "$rel")" ]; then
      echo "DIRTY       $rel (customised AND uncommitted: commit or stash it first, not overwritten)"
      customised=$((customised+1))
    else
      echo "OVERWRITE   $rel (customised here; the local version stays in git history)"
      fit_note "$rel"
      [ $APPLY = 1 ] && cp "$src" "$dst"
      copied=$((copied+1))
    fi
  else
    echo "CUSTOMISED  $rel (differs from every template version: left alone; --force overwrites)"
    customised=$((customised+1))
  fi
done

# Make the rules reachable: Claude Code reads .claude/rules, not .agents/rules.
if [ -d "$TARGET/.agents/rules" ]; then
  if [ -L "$TARGET/.claude/rules" ]; then
    echo "LINK        .claude/rules is already a symlink"
  elif [ ! -e "$TARGET/.claude/rules" ]; then
    echo "LINK        .claude/rules -> ../.agents/rules"
    if [ $APPLY = 1 ]; then mkdir -p "$TARGET/.claude"; ln -s ../.agents/rules "$TARGET/.claude/rules"; fi
  else
    # A real directory may hold rules that exist nowhere else: link file by file.
    for f in "$TARGET"/.agents/rules/*.md; do
      name="$(basename "$f")"
      if [ ! -e "$TARGET/.claude/rules/$name" ] && [ ! -L "$TARGET/.claude/rules/$name" ]; then
        echo "LINK        .claude/rules/$name -> ../../.agents/rules/$name"
        [ $APPLY = 1 ] && ln -s "../../.agents/rules/$name" "$TARGET/.claude/rules/$name"
      fi
    done
  fi
fi

echo
echo "to copy: $copied   already current: $same   customised (kept): $customised   not applicable: $skipped"
if [ $APPLY = 0 ]; then
  echo "Plan only, nothing was written. Re-run with --apply."
else
  echo "Done. Review with: git status --short && git diff --stat"
fi
echo "Not touched: CLAUDE.md, and every rule or skill the template does not ship."
