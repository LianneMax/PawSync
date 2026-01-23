#!/bin/bash

# PawSync Database Setup Script
# This script sets up MongoDB and starts both frontend and backend servers

set -e

echo "🐾 PawSync Database Setup"
echo "=========================="
echo ""

# Check if MongoDB is installed
if ! command -v mongod &> /dev/null; then
    echo "❌ MongoDB is not installed"
    echo ""
    echo "📦 Installing MongoDB on macOS..."
    brew tap mongodb/brew
    brew install mongodb-community
    echo "✅ MongoDB installed"
    echo ""
fi

# Start MongoDB
echo "🚀 Starting MongoDB service..."
brew services start mongodb-community || brew services restart mongodb-community
echo "✅ MongoDB started on mongodb://localhost:27017"
echo ""

# Setup backend
echo "📦 Setting up backend..."
cd backend

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ Created backend/.env"
else
    echo "✅ .env already exists"
fi

# Install dependencies
if [ ! -d node_modules ]; then
    echo "Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

cd ..
echo "✅ Backend setup complete"
echo ""

# Setup frontend
echo "📦 Setting up frontend..."
cd frontend

if [ ! -d node_modules ]; then
    echo "Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

cd ..
echo "✅ Frontend setup complete"
echo ""

# Provide next steps
echo "🎉 Setup Complete!"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1️⃣  Backend (Terminal 1):"
echo "   cd backend && npm run dev"
echo ""
echo "2️⃣  Frontend (Terminal 2):"
echo "   cd frontend && npm run dev"
echo ""
echo "3️⃣  Test the application:"
echo "   http://localhost:3000/signup"
echo ""
echo "📊 Database:"
echo "   MongoDB running on: mongodb://localhost:27017/pawsync"
echo ""
echo "📚 Documentation:"
echo "   - QUICK_START.md - Quick reference guide"
echo "   - DATABASE_SETUP.md - Detailed setup instructions"
echo "   - ARCHITECTURE.md - System design and flows"
echo "   - IMPLEMENTATION_SUMMARY.md - What was implemented"
echo ""
echo "✨ You're all set! Happy coding! 🎉"
