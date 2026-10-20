#!/bin/sh
set -eu
APEX_PROJECT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
APEX_DEPS=/Users/agent/agentSSD/dev/apex-web
mkdir -p "$APEX_DEPS" /Users/agent/agentSSD/dev/cache/npm /Users/agent/agentSSD/dev/cache/playwright
cp "$APEX_PROJECT/package.json" "$APEX_PROJECT/package-lock.json" "$APEX_DEPS/"
npm ci --prefix "$APEX_DEPS" --cache /Users/agent/agentSSD/dev/cache/npm
if [ ! -e "$APEX_PROJECT/node_modules" ]; then ln -s "$APEX_DEPS/node_modules" "$APEX_PROJECT/node_modules"; fi
PLAYWRIGHT_BROWSERS_PATH=/Users/agent/agentSSD/dev/cache/playwright "$APEX_DEPS/node_modules/.bin/playwright" install chromium webkit
