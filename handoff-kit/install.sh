#!/usr/bin/env bash
# Install the context-handoff skill/prompts into your agent tools.
# Model- and vendor-agnostic. Copies files into each tool's GLOBAL config so the
# handoff workflow is available in every repo. Re-runnable (idempotent).
#
# Usage:
#   ./install.sh                 # install for every tool found on this machine
#   ./install.sh --claude        # Claude Code skill only  -> ~/.claude/skills
#   ./install.sh --codex         # Codex prompt only        -> ~/.codex/prompts
#   ./install.sh --opencode      # OpenCode command only    -> ~/.config/opencode/command
#   ./install.sh --agents PATH   # sync the AGENTS.md protocol block into PATH
#
# Nothing here touches git history or your repos. Review before running.
set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$KIT_DIR/.." && pwd)"
SKILL_SRC="$REPO_ROOT/.claude/skills/context-handoff"

log() { printf '  %s\n' "$*"; }
ok()  { printf '✓ %s\n' "$*"; }

install_claude() {
  local dest="$HOME/.claude/skills/context-handoff"
  [ -d "$SKILL_SRC" ] || { log "skill source not found at $SKILL_SRC — skipping Claude"; return; }
  mkdir -p "$dest"
  cp -R "$SKILL_SRC/." "$dest/"
  ok "Claude Code skill -> $dest"
  log "use it: it auto-triggers, or run /context-handoff"
}

install_codex() {
  local dest="$HOME/.codex/prompts"
  mkdir -p "$dest"
  cp "$KIT_DIR/codex/handoff.md" "$dest/handoff.md"
  ok "Codex prompt -> $dest/handoff.md   (use: /handoff  or  /handoff resume)"
  log "also add the AGENTS.md block: ./install.sh --agents ~/.codex/AGENTS.md"
}

install_opencode() {
  local dest="$HOME/.config/opencode/command"
  mkdir -p "$dest"
  cp "$KIT_DIR/opencode/handoff.md" "$dest/handoff.md"
  ok "OpenCode command -> $dest/handoff.md   (use: /handoff  or  /handoff resume)"
  log "also add the AGENTS.md block: ./install.sh --agents ~/.config/opencode/AGENTS.md"
}

# Idempotently insert/replace the managed block between its BEGIN/END markers.
sync_agents() {
  local target="$1"
  local block_file="$KIT_DIR/AGENTS.md-block.md"
  # Extract only the marker-delimited block from the kit file.
  local block
  block="$(awk '/<!-- BEGIN CONTEXT-HANDOFF PROTOCOL/{f=1} f{print} /<!-- END CONTEXT-HANDOFF PROTOCOL/{f=0}' "$block_file")"
  mkdir -p "$(dirname "$target")"
  touch "$target"
  if grep -q 'BEGIN CONTEXT-HANDOFF PROTOCOL' "$target"; then
    # Replace existing block.
    awk -v repl="$block" '
      /<!-- BEGIN CONTEXT-HANDOFF PROTOCOL/{print repl; skip=1}
      skip && /<!-- END CONTEXT-HANDOFF PROTOCOL/{skip=0; next}
      !skip{print}
    ' "$target" > "$target.tmp" && mv "$target.tmp" "$target"
    ok "AGENTS.md block updated in $target"
  else
    printf '\n%s\n' "$block" >> "$target"
    ok "AGENTS.md block appended to $target"
  fi
}

main() {
  if [ "$#" -eq 0 ]; then
    echo "Installing context-handoff for all detected tools…"
    install_claude
    if [ -d "$HOME/.codex" ] || command -v codex >/dev/null 2>&1; then
      install_codex
    else
      log "Codex not detected — skip (run with --codex to force)"
    fi
    if [ -d "$HOME/.config/opencode" ] || command -v opencode >/dev/null 2>&1; then
      install_opencode
    else
      log "OpenCode not detected — skip (run with --opencode to force)"
    fi
    echo
    echo "Next: add the shared protocol to AGENTS.md so Codex/OpenCode follow it, e.g."
    echo "  ./install.sh --agents ~/.codex/AGENTS.md"
    echo "  ./install.sh --agents ~/.config/opencode/AGENTS.md"
    echo "  ./install.sh --agents ./AGENTS.md      # per-repo"
    return
  fi
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --claude)   install_claude ;;
      --codex)    install_codex ;;
      --opencode) install_opencode ;;
      --agents)   shift; [ "${1:-}" ] || { echo "--agents needs a PATH"; exit 1; }; sync_agents "$1" ;;
      -h|--help)  sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' ;;
      *) echo "unknown option: $1"; exit 1 ;;
    esac
    shift
  done
}
main "$@"
