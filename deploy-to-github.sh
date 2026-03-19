#!/bin/bash

# Deploy Procurement Dashboard to GitHub
# Repository: https://github.com/kd26-droid/procurement-dashboard.git

echo "🚀 Starting deployment to GitHub..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Make sure you're in the project root directory."
    exit 1
fi

# Initialize git if not already done
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
fi

# Add all files to staging
echo "📋 Adding all files to git..."
git add .

# Check if there are any changes to commit
if git diff --staged --quiet; then
    echo "✅ No changes to commit."
else
    # Commit with timestamp
    COMMIT_MESSAGE="Deploy procurement dashboard - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "💾 Committing changes: $COMMIT_MESSAGE"
    git commit -m "$COMMIT_MESSAGE"
fi

# Add remote origin if it doesn't exist
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "🔗 Adding GitHub remote..."
    git remote add origin https://github.com/kd26-droid/procurement-dashboard.git
fi

# Set main as default branch
echo "🌿 Setting main branch..."
git branch -M main

# Push to GitHub
echo "⬆️ Pushing to GitHub..."
if git push -u origin main; then
    echo "✅ Successfully deployed to GitHub!"
    echo "🌐 Repository: https://github.com/kd26-droid/procurement-dashboard"
    echo ""
    echo "📝 Next steps:"
    echo "1. Go to https://github.com/kd26-droid/procurement-dashboard"
    echo "2. Verify your code is uploaded"
    echo "3. Deploy to Vercel/Netlify using the instructions in DEPLOYMENT.md"
else
    echo "❌ Failed to push to GitHub."
    echo "💡 If this is the first push, you might need to authenticate with GitHub:"
    echo "   - Use 'git push -u origin main --force' if the remote has different history"
    echo "   - Or set up GitHub CLI: gh auth login"
    exit 1
fi

echo "🎉 Deployment complete!"