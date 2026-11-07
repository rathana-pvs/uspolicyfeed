#!/bin/bash
# deploy.sh — US Policy Feed VPS Deployment Script
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying US Policy Feed...${NC}"

# 1. Pull latest code
echo "📥 Pulling latest code..."
git pull origin main || { echo -e "${RED}❌ Error: git pull failed.${NC}"; exit 1; }

# ── Protect uploads during the build ───────────────────────────────
# `next build` wipes .next/standalone. If .next/standalone/public/media is a
# symlink, that cleanup can follow it and delete the real uploads (this
# happened on 2026-11-07). Mirror the uploads first, then drop the link
# before building; it is recreated after the build.
MEDIA_DIR=/var/www/uspolicyfeed/public/media
MEDIA_MIRROR=/root/backups/uspolicyfeed-media-mirror
mkdir -p "$MEDIA_DIR" "$MEDIA_MIRROR"
cp -a --update=none "$MEDIA_DIR"/. "$MEDIA_MIRROR"/ 2>/dev/null || true
MEDIA_COUNT_BEFORE=$(ls -A "$MEDIA_DIR" | wc -l)
if [ -L .next/standalone/public/media ]; then rm .next/standalone/public/media; fi

# Fail fast if the code would save uploads anywhere inside .next/ (wiped on build)
npx tsx scripts/check-media-dir.ts > /dev/null || { echo -e "${RED}❌ media-dir check failed — not deploying. Run: npm run check:media${NC}"; exit 1; }

# 2. Build production Next.js app
echo "🔨 Building production Next.js app..."
NODE_OPTIONS="--max-old-space-size=1536" npm run build
# Uploads live in $MEDIA_DIR. Link the build's media folder to it.
# Rescue anything that ended up in a real standalone media dir before replacing it.
if [ -d .next/standalone/public/media ] && [ ! -L .next/standalone/public/media ]; then
  cp -a --update=none .next/standalone/public/media/. "$MEDIA_DIR"/ 2>/dev/null || true
  rm -rf .next/standalone/public/media
fi
mkdir -p .next/standalone/public
(cd public && find . -mindepth 1 -maxdepth 1 ! -name media -exec cp -rn {} ../.next/standalone/public/ \;) 2>/dev/null || true
ln -sfn "$MEDIA_DIR" .next/standalone/public/media

# Safety net: if any uploads disappeared during the build, restore them from the mirror
if [ "$(ls -A "$MEDIA_DIR" | wc -l)" -lt "$MEDIA_COUNT_BEFORE" ]; then
  echo -e "${RED}⚠️ Media files went missing during build — restoring from $MEDIA_MIRROR${NC}"
  cp -a --update=none "$MEDIA_MIRROR"/. "$MEDIA_DIR"/
fi
[ -L .next/standalone/public/media ] || { echo -e "${RED}❌ media link missing${NC}"; exit 1; }
echo "🖼️  Media files: $(ls -A "$MEDIA_DIR" | wc -l) (before build: $MEDIA_COUNT_BEFORE)"
cp -f public/ads.txt .next/standalone/public/ads.txt 2>/dev/null || true
cp -rn .next/static .next/standalone/.next/ 2>/dev/null || true
ln -sfn /var/www/uspolicyfeed/public/media /var/www/media 2>/dev/null || true

# 3. Reload PM2 process
echo "♻️  Reloading PM2 process..."
pm2 reload uspolicyfeed

# 4a. Media check: the restarted app must serve an existing upload from $MEDIA_DIR
sleep 3
SAMPLE=$(ls -t "$MEDIA_DIR" | head -1)
if [ -n "$SAMPLE" ]; then
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: uspolicyfeed.com" "http://localhost:3002/api/media/file/$SAMPLE")
  if [ "$CODE" = "200" ]; then
    echo -e "${GREEN}✓ Media served from $MEDIA_DIR ($SAMPLE)${NC}"
  else
    echo -e "${RED}❌ Media check failed: /api/media/file/$SAMPLE returned $CODE. Check uploads before using the admin.${NC}"
    exit 1
  fi
fi

# 4. Health Check
echo "🔥 Checking application health..."
sleep 3
if curl -s -f -H "Host: uspolicyfeed.com" http://localhost:3002 > /dev/null; then
    echo -e "${GREEN}✓ Application updated successfully!${NC}"
else
    echo -e "${RED}⚠️ Warning: Health check returned non-200. Check pm2 logs uspolicyfeed${NC}"
fi

echo -e "${GREEN}✅ Deployment complete!${NC}"

