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

# 2. Build production Next.js app
echo "🔨 Building production Next.js app..."
NODE_OPTIONS="--max-old-space-size=1536" npm run build
# Persistent uploads live in /var/www/uspolicyfeed/public/media. Link the build's
# media folder to it so uploads never land inside .next/standalone (wiped on build).
MEDIA_DIR=/var/www/uspolicyfeed/public/media
mkdir -p "$MEDIA_DIR"
# Rescue anything that still ended up in a real standalone media dir before replacing it
if [ -d .next/standalone/public/media ] && [ ! -L .next/standalone/public/media ]; then
  cp -a --update=none .next/standalone/public/media/. "$MEDIA_DIR"/ 2>/dev/null || true
  rm -rf .next/standalone/public/media
fi
mkdir -p .next/standalone/public
(cd public && find . -mindepth 1 -maxdepth 1 ! -name media -exec cp -rn {} ../.next/standalone/public/ \;) 2>/dev/null || true
ln -sfn "$MEDIA_DIR" .next/standalone/public/media
cp -f public/ads.txt .next/standalone/public/ads.txt 2>/dev/null || true
cp -rn .next/static .next/standalone/.next/ 2>/dev/null || true
ln -sfn /var/www/uspolicyfeed/public/media /var/www/media 2>/dev/null || true

# 3. Reload PM2 process
echo "♻️  Reloading PM2 process..."
pm2 reload uspolicyfeed

# 4. Health Check
echo "🔥 Checking application health..."
sleep 3
if curl -s -f -H "Host: uspolicyfeed.com" http://localhost:3002 > /dev/null; then
    echo -e "${GREEN}✓ Application updated successfully!${NC}"
else
    echo -e "${RED}⚠️ Warning: Health check returned non-200. Check pm2 logs uspolicyfeed${NC}"
fi

echo -e "${GREEN}✅ Deployment complete!${NC}"

