#!/bin/bash

# R2 Setup Script for Racing Game
# This script automates the R2 setup process

set -e

echo "🏎️  Racing Game R2 Setup"
echo "========================"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "⚠️  Wrangler not found. Installing dependencies..."
    cd workers
    npm install
    cd ..
else
    echo "✓ Wrangler found"
fi

# Check if logged in
echo ""
echo "Checking Cloudflare authentication..."
if ! npx wrangler whoami &> /dev/null; then
    echo "Please login to Cloudflare:"
    npx wrangler login
else
    echo "✓ Already logged in"
fi

# Upload map
echo ""
echo "📤 Uploading map to R2..."
cd workers
npm run upload-map

# Deploy worker
echo ""
echo "🚀 Deploying worker..."
npm run deploy

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy the worker URL from above"
echo "2. Create .env file: cp .env.example .env"
echo "3. Update VITE_R2_BASE_URL in .env with your worker URL"
echo "4. Run: npm run dev"
echo ""
echo "See SETUP_R2.md for more details."
