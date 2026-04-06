#!/usr/bin/env bash
set -e

if [ ! -f .env ]; then
    echo "Error: .env file not found. Please copy .env.example to .env and configure MONGODB_URL to point to your Atlas database."
    exit 1
fi

ARGS=("$@")
[[ "${ARGS[0]:-}" == "log" ]] && ARGS[0]="logs"

# docker compose needs a subcommand. Allow shorthand:
#   ./start.sh              -> up
#   ./start.sh --build      -> up --build
#   ./start.sh -d           -> up -d
#   ./start.sh down         -> down  (unchanged)
# Do not prepend if user passes global flags first (-f, --file, -p, ...).
_prepend_up() {
    [[ ${#ARGS[@]} -eq 0 ]] && return 0
    local a="${ARGS[0]}"
    [[ "$a" == -f || "$a" == --file || "$a" == -p || "$a" == --project-name \
       || "$a" == --profile || "$a" == --env-file ]] && return 1
    [[ "$a" == -* ]] && return 0
    return 1
}
if _prepend_up; then
    ARGS=(up "${ARGS[@]}")
fi

COMPOSE_FILES=(-f docker-compose.yml)
DOCKER_ARGS=()

if command -v nvidia-smi &>/dev/null \
   && nvidia-smi &>/dev/null 2>&1 \
   && docker --context default info 2>/dev/null | grep -qi "nvidia"; then
    echo "GPU detected — using host Docker (context: default)."
    echo "Status and logs should be checked in terminal, not Docker Desktop."
    DOCKER_ARGS+=(--context default)
    COMPOSE_FILES+=(-f docker-compose.gpu.yml)
elif docker context inspect desktop-linux >/dev/null 2>&1; then
    echo "GPU mode not available — using Docker Desktop (context: desktop-linux) on CPU."
    DOCKER_ARGS+=(--context desktop-linux)
else
    echo "GPU mode not available — using current Docker context on CPU."
fi

docker "${DOCKER_ARGS[@]}" compose "${COMPOSE_FILES[@]}" "${ARGS[@]}"
