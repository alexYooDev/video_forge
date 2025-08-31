#!/bin/bash

# VideoForge GitHub Push Helper
# This script helps push the cleaned repository to GitHub

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 VideoForge GitHub Push Helper${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""

# Check if we have a remote
if git remote -v | grep -q origin; then
    echo -e "${GREEN}✅ Remote 'origin' exists:${NC}"
    git remote -v | grep origin
    echo ""
    
    REMOTE_URL=$(git remote get-url origin)
    echo -e "${YELLOW}📍 Current remote URL: $REMOTE_URL${NC}"
    echo ""
    
    read -p "Do you want to push to this remote? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  No remote 'origin' found${NC}"
    echo ""
    read -p "Enter your GitHub repository URL: " REPO_URL
    
    if [ -z "$REPO_URL" ]; then
        echo -e "${RED}❌ Repository URL is required${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}🔗 Adding remote origin...${NC}"
    git remote add origin "$REPO_URL"
    echo -e "${GREEN}✅ Remote added successfully${NC}"
    echo ""
fi

# Show repository stats
echo -e "${BLUE}📊 Repository Statistics:${NC}"
echo "Git repository size: $(du -sh .git | cut -f1)"
echo "Total commits: $(git rev-list --all --count)"
echo "Current branch: $(git branch --show-current)"
echo ""

# Check for large files
echo -e "${BLUE}🔍 Checking for large files...${NC}"
LARGE_FILES=$(find . -type f -size +50M 2>/dev/null | grep -v ".git/" | head -5 || echo "")
if [ -z "$LARGE_FILES" ]; then
    echo -e "${GREEN}✅ No large files found (>50MB)${NC}"
else
    echo -e "${YELLOW}⚠️  Large files found:${NC}"
    echo "$LARGE_FILES"
    echo ""
    read -p "Continue anyway? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Please review and handle large files before pushing."
        exit 1
    fi
fi

echo ""

# Show what will be pushed
echo -e "${BLUE}📦 What will be pushed:${NC}"
echo "Files in repository:"
git ls-tree -r --name-only HEAD | grep -E "\.(js|jsx|json|md|html|css|sql|sh|yml|yaml|txt|env\.example)$" | head -20
if [ $(git ls-tree -r --name-only HEAD | wc -l) -gt 20 ]; then
    echo "... and $(git ls-tree -r --name-only HEAD | wc -l) total files"
fi
echo ""

# Verify important files are included
echo -e "${BLUE}✅ Essential files check:${NC}"
ESSENTIAL_FILES=(
    "package.json"
    "server/package.json"
    "client/package.json"
    "docker-compose.yml"
    "README.md"
    ".gitignore"
)

for file in "${ESSENTIAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${YELLOW}⚠${NC} $file (missing)"
    fi
done
echo ""

# Final confirmation
echo -e "${BLUE}🚨 Ready to push to GitHub${NC}"
echo ""
read -p "Are you sure you want to push? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Push cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}📤 Pushing to GitHub...${NC}"

# Try to push
if git push origin $(git branch --show-current); then
    echo ""
    echo -e "${GREEN}🎉 Successfully pushed to GitHub!${NC}"
    echo ""
    echo -e "${BLUE}📍 Repository URL:${NC} $(git remote get-url origin)"
    echo -e "${BLUE}🌳 Branch:${NC} $(git branch --show-current)"
    echo ""
    echo -e "${GREEN}✅ Your VideoForge project is now on GitHub!${NC}"
else
    echo ""
    echo -e "${RED}❌ Push failed${NC}"
    echo ""
    echo -e "${YELLOW}💡 Common solutions:${NC}"
    echo "1. If this is the first push: git push -u origin main"
    echo "2. If branch doesn't exist on remote: git push -u origin $(git branch --show-current)"
    echo "3. If authentication failed: check your GitHub credentials"
    echo "4. If rejected: git pull origin main --rebase"
    echo ""
    
    read -p "Try force push? (WARNING: This will overwrite remote history) (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⚠️  Force pushing...${NC}"
        if git push -f origin $(git branch --show-current); then
            echo -e "${GREEN}✅ Force push successful!${NC}"
        else
            echo -e "${RED}❌ Force push also failed${NC}"
            exit 1
        fi
    else
        echo "Please resolve the issues and try again."
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}🔗 Quick links:${NC}"
GITHUB_URL=$(git remote get-url origin | sed 's/\.git$//')
if [[ $GITHUB_URL == git@github.com:* ]]; then
    GITHUB_URL=$(echo $GITHUB_URL | sed 's/git@github.com:/https:\/\/github.com\//')
fi
echo "Repository: $GITHUB_URL"
echo "Clone command: git clone $(git remote get-url origin)"