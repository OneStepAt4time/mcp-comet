#!/usr/bin/env bash
input=$(cat)

cwd=$(echo "$input" | jq -r '.workspace.current_dir // "."')
project_dir=$(echo "$input" | jq -r '.workspace.project_dir // "."')
model=$(echo "$input" | jq -r '.model.display_name // "unknown"')
pct=$(echo "$input" | jq -r '.context_window.used_percentage // 0')
ctx_size=$(echo "$input" | jq -r '.context_window.context_window_size // 200000')
cost=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')
duration_ms=$(echo "$input" | jq -r '.cost.total_duration_ms // 0')

REMOTE=$(git -C "$cwd" remote get-url origin 2>/dev/null | sed 's/git@github.com:/https:\/\/github.com\//' | sed 's/\.git$//')
BRANCH=$(git -C "$cwd" branch --show-current 2>/dev/null || echo "")
cost_fmt=$(printf '$%.2f' "$cost")
mins=$((duration_ms / 60000))
secs=$(((duration_ms % 60000) / 1000))

ESC=$'\033'
CYAN="${ESC}[36m"
GREEN="${ESC}[32m"
YELLOW="${ESC}[33m"
RED="${ESC}[31m"
DIM="${ESC}[2m"
RESET="${ESC}[0m"

# RIGA 1
if [ -n "$REMOTE" ]; then
  echo "${CYAN}${REMOTE}${RESET} ${DIM}|${RESET} ${GREEN}${BRANCH}${RESET} ${DIM}|${RESET} ${model} ${DIM}|${RESET} ${cost_fmt} ${DIM}|${RESET} ${mins}m ${secs}s"
else
  echo "${CYAN}${project_dir##*/}${RESET} ${DIM}|${RESET} ${GREEN}${BRANCH}${RESET} ${DIM}|${RESET} ${model} ${DIM}|${RESET} ${cost_fmt} ${DIM}|${RESET} ${mins}m ${secs}s"
fi

# RIGA 2: barra contesto
pct_int=$(printf "%.0f" "$pct")
if [ "$pct_int" -lt 50 ]; then BAR_COLOR="$GREEN"
elif [ "$pct_int" -lt 80 ]; then BAR_COLOR="$YELLOW"
else BAR_COLOR="$RED"
fi

filled=$((pct_int * 20 / 100))
empty=$((20 - filled))
bar=""
for ((i=0; i<filled; i++)); do bar+="▓"; done
for ((i=0; i<empty; i++)); do bar+="░"; done

if [ "$ctx_size" -ge 1000000 ]; then ctx_label="$((ctx_size / 1000000))M"
elif [ "$ctx_size" -ge 1000 ]; then ctx_label="$((ctx_size / 1000))k"
else ctx_label="$ctx_size"
fi

echo "${BAR_COLOR}█${RESET} ${bar} ${pct}% ${DIM}of ${ctx_label} | ${pct}% used${RESET}"
