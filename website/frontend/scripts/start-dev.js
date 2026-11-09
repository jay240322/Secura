#!/usr/bin/env node
/**
 * Secura Development Runner
 * Ensures FastAPI backend (:8000) is running before launching Next.js (:3000).
 * Prevents ECONNREFUSED proxy errors when running `npm run dev`.
 */

const { spawn } = require("child_process");
const net = require("net");
const path = require("path");
const fs = require("fs");

const FRONTEND_DIR = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(FRONTEND_DIR, "../..");
const BACKEND_DIR = path.resolve(REPO_ROOT, "website/backend");

function isPortOpen(port, host = "127.0.0.1", timeout = 600) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function waitForPort(port, maxWaitMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (await isPortOpen(port)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function findUvicornCommand() {
  const candidates = [
    { cmd: path.join(REPO_ROOT, ".venv/bin/uvicorn"), args: [] },
    { cmd: path.join(BACKEND_DIR, ".venv/bin/uvicorn"), args: [] },
    { cmd: path.join(REPO_ROOT, ".venv/bin/python"), args: ["-m", "uvicorn"] },
    { cmd: path.join(REPO_ROOT, ".venv/Scripts/uvicorn.exe"), args: [] },
    { cmd: path.join(REPO_ROOT, ".venv/Scripts/python.exe"), args: ["-m", "uvicorn"] },
    { cmd: "uvicorn", args: [] },
    { cmd: "python3", args: ["-m", "uvicorn"] },
    { cmd: "python", args: ["-m", "uvicorn"] },
  ];

  for (const c of candidates) {
    if (c.cmd.includes(path.sep) || c.cmd.includes("/")) {
      if (fs.existsSync(c.cmd)) {
        return c;
      }
    }
  }
  return candidates[0]; // fallback to .venv uvicorn
}

let backendProc = null;

function cleanup() {
  if (backendProc && !backendProc.killed) {
    try {
      backendProc.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});
process.on("exit", () => {
  cleanup();
});

async function main() {
  console.log("\x1b[36m[Secura]\x1b[0m Checking development environment...");

  const backendAlreadyRunning = await isPortOpen(8000);

  if (backendAlreadyRunning) {
    console.log("\x1b[32m[Secura]\x1b[0m FastAPI backend is already running on http://127.0.0.1:8000 (connected).");
  } else {
    console.log("\x1b[33m[Secura]\x1b[0m FastAPI backend not detected on :8000. Auto-starting backend...");

    const uvi = findUvicornCommand();
    const uvicornArgs = [
      ...uvi.args,
      "app.main:app",
      "--host",
      "0.0.0.0",
      "--port",
      "8000",
      "--reload",
    ];

    const pythonPath = `${BACKEND_DIR}${path.delimiter}${REPO_ROOT}`;
    const env = {
      ...process.env,
      PYTHONPATH: pythonPath,
      PYTHONUNBUFFERED: "1",
    };

    backendProc = spawn(uvi.cmd, uvicornArgs, {
      cwd: BACKEND_DIR,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    backendProc.stdout.on("data", (chunk) => {
      process.stdout.write(`\x1b[35m[backend]\x1b[0m ${chunk}`);
    });

    backendProc.stderr.on("data", (chunk) => {
      process.stderr.write(`\x1b[35m[backend]\x1b[0m ${chunk}`);
    });

    backendProc.on("error", (err) => {
      console.error("\x1b[31m[Secura Backend Error]\x1b[0m Failed to spawn uvicorn:", err.message);
      console.error("Tip: Start the backend manually with: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload");
    });

    backendProc.on("close", (code) => {
      if (code !== 0 && code !== null) {
        console.warn(`\x1b[33m[Secura]\x1b[0m Backend process exited with code ${code}.`);
      }
    });

    // Wait up to 5 seconds for backend port 8000 to accept connections
    const ready = await waitForPort(8000, 5000);
    if (ready) {
      console.log("\x1b[32m[Secura]\x1b[0m FastAPI backend is now ready on http://127.0.0.1:8000!");
    } else {
      console.warn("\x1b[33m[Secura]\x1b[0m Backend is still initializing; starting Next.js frontend...");
    }
  }

  // Start Next.js development server
  console.log("\x1b[36m[Secura]\x1b[0m Starting Next.js frontend on http://localhost:3000...\n");

  const nextBin = path.join(FRONTEND_DIR, "node_modules/.bin/next");
  const nextCmd = fs.existsSync(nextBin) ? nextBin : "next";

  const nextProc = spawn(nextCmd, ["dev", "-H", "0.0.0.0", "-p", "3000"], {
    cwd: FRONTEND_DIR,
    stdio: "inherit",
    shell: true,
  });

  nextProc.on("close", (code) => {
    cleanup();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error("[Secura Dev Runner Error]:", err);
  cleanup();
  process.exit(1);
});

