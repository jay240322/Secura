#!/usr/bin/env bash
# Secura — Start Backend and Frontend concurrently

set -e

# Resolve repository root directory
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🛡️  Starting Secura Development Environment..."

# 1. Activate Python virtual environment if present
if [ -f "$REPO_ROOT/.venv/bin/activate" ]; then
    echo "📦 Activating Python virtual environment (.venv)..."
    source "$REPO_ROOT/.venv/bin/activate"
fi

# Cleanup function to kill child processes on Ctrl+C
cleanup() {
    echo ""
    echo "🛑 Shutting down Secura backend and frontend..."
    # Kill background jobs started by this shell
    kill $(jobs -p) 2>/dev/null || true
    wait 2>/dev/null || true
    echo "✅ All servers stopped."
}
trap cleanup SIGINT SIGTERM EXIT

# 2. Start FastAPI Backend in background
echo "🚀 Starting Backend on http://localhost:8000..."
cd "$REPO_ROOT/website/backend"
export PYTHONPATH=".:../../"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Wait 2 seconds for backend to start up
sleep 2

# 3. Start Next.js Frontend in background
echo "🌐 Starting Frontend on http://localhost:3000..."
cd "$REPO_ROOT/website/frontend"
if [ ! -d "node_modules/firebase" ]; then
    echo "📦 Ensuring frontend dependencies (including firebase) are installed..."
    npm install firebase --no-audit --no-fund || true
fi
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✨ Secura is up and running!"
echo "   👉 Frontend: http://localhost:3000 (or http://127.0.0.1:3000)"
echo "   👉 Backend:  http://localhost:8000"
echo "   👉 API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C at any time to stop both servers."
echo ""

# Keep running until Ctrl+C is pressed or one process exits
wait $BACKEND_PID $FRONTEND_PID

