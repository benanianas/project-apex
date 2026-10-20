#!/bin/sh
# Publishes only compiled static files to the repository's gh-pages branch.
# Run from this project after validation. No personal browser data is part of dist.
set -eu
APEX_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$APEX_ROOT"
APEX_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
APEX_NAME=${APEX_REPO#*/}
APEX_REMOTE=$(git remote get-url origin)
BASE_PATH="/$APEX_NAME/" npm run build
APEX_PUBLISH=$(mktemp -d "$APEX_ROOT/.pages-publish.XXXXXX")
trap 'rm -rf "$APEX_PUBLISH"' EXIT
cp -R dist/. "$APEX_PUBLISH/"
touch "$APEX_PUBLISH/.nojekyll"
git -C "$APEX_PUBLISH" init -b gh-pages
if git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
  git -C "$APEX_PUBLISH" remote add origin "$APEX_REMOTE"
  git -C "$APEX_PUBLISH" fetch origin gh-pages --depth=1
  git -C "$APEX_PUBLISH" reset --soft FETCH_HEAD
else
  git -C "$APEX_PUBLISH" remote add origin "$APEX_REMOTE"
fi
git -C "$APEX_PUBLISH" add -A
git -C "$APEX_PUBLISH" -c user.name='APEX deployment' -c user.email='apex-deploy@users.noreply.github.com' commit -m "Deploy PROJECT APEX $(git rev-parse --short HEAD)"
git -C "$APEX_PUBLISH" push origin HEAD:gh-pages
