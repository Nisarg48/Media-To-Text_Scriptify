# CI Workflow Documentation

This document describes the **Continuous Integration (CI)** workflow used in this project: what it is, why we use it, and how each part works from a DevOps perspective.

---

## What is this file?

- **File location:** `.github/workflows/ci.yml`
- **What it is:** A **GitHub Actions** workflow: a YAML file that tells GitHub when and how to run automated jobs (lint, build, tests) on your code.
- **When it runs:** Every time someone **pushes** to the `main` branch or opens/updates a **pull request** targeting `main`.

---

## Why do we use it?

| Purpose | Explanation |
|--------|-------------|
| **Catch breakages early** | Before code is merged, the pipeline runs lint, tests, and build. If something is broken or doesn't follow rules, the run fails and blocks merge (if you enforce status checks). |
| **Single source of truth** | Everyone (and every branch) is checked the same way. No "it works on my machine" without at least "it passes in CI." |
| **Automation** | No need to remember to run lint/tests locally every time; the server does it on every push/PR. |
| **Foundation for CD** | A green CI is the usual prerequisite for Continuous Deployment (CD): only deploy when CI passes. |

So: **the file is used in DevOps to automate quality checks and to create a reliable, repeatable gate before merge and deploy.**

---

## High-level structure

```yaml
name: CI
on: ...          # When the workflow runs
jobs:
  backend: ...   # Job 1: Node backend
  frontend: ...  # Job 2: React frontend
  worker: ...    # Job 3: Python AI worker
```

The workflow has **one name** and **three jobs**. Jobs run **in parallel** by default. Each job has its own **runner** (a fresh Ubuntu VM) and **steps**.

---

## Section-by-section explanation

### 1. `name: CI`

- **What it is:** Display name of the workflow.
- **Where you see it:** In the GitHub Actions tab (e.g. "CI" in the list of workflows).
- **DevOps use:** Lets you quickly identify this workflow in the UI and in status badges.

---

### 2. `on: push / pull_request`

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

- **What it does:** Defines the **triggers**.
  - **push** to branch `main` → workflow runs.
  - **pull_request** whose base branch is `main` → workflow runs (on open and on new commits).
- **Why only `main`?** So we don't run CI on every feature branch push unless they're targeting `main` via a PR. You can add more branches (e.g. `master`, `develop`) under `branches` if needed.
- **DevOps use:** Controls cost and noise: CI runs only for the branches you care about (usually mainline).

---

### 3. Jobs overview

Each **job**:

- Runs in a **separate**, **fresh** Ubuntu VM (`runs-on: ubuntu-latest`).
- Has a **name** (shown in the Actions UI).
- Has a list of **steps**. If any step fails, the job fails and the workflow is marked failed.

---

### 4. Job: `backend`

**Goal:** Ensure the Node.js backend installs, lints, and passes tests.

| Step | Command / Action | What it does | DevOps meaning |
|------|------------------|-------------|----------------|
| **Checkout** | `uses: actions/checkout@v4` | Clones the repo into the runner so the workflow can see your code. | Without this, no `apps/backend` exists on the runner. |
| **Setup Node.js** | `uses: actions/setup-node@v4` with `node-version: '20'` | Installs Node 20 and makes `node` / `npm` available. | Same Node version as in production avoids "works in CI but not in prod." |
| **Cache** | `cache: 'npm'`, `cache-dependency-path: apps/backend/package-lock.json` | Caches `node_modules` (or npm cache) keyed by `package-lock.json`. | Speeds up `npm ci` on later runs; important for fast feedback. |
| **Install dependencies** | `run: npm ci` in `apps/backend` | Installs exact versions from `package-lock.json`. | Reproducible installs; `npm ci` is preferred in CI over `npm install`. |
| **Lint** | `run: npm run lint` in `apps/backend` | Runs ESLint. | Enforces code style and catches many bugs before merge. |
| **Test** | `run: npm test` in `apps/backend` | Runs Jest/supertest API tests; `mongodb-memory-server` provides an in-process MongoDB (no real DB needed in CI). | Catches regressions in routes, middleware, and business logic before merge. |

---

### 5. Job: `frontend`

**Goal:** Ensure the React frontend installs, lints, and **builds** successfully.

| Step | Command / Action | What it does | DevOps meaning |
|------|------------------|-------------|----------------|
| **Checkout** | `uses: actions/checkout@v4` | Same as backend: repo is available on the runner. | Required for all jobs that need source code. |
| **Setup Node.js** | Same pattern as backend, with `cache-dependency-path: apps/frontend/package-lock.json` | Node 20 + npm cache for the **frontend** app. | Cache is per `package-lock.json`, so backend and frontend caches don't clash. |
| **Install dependencies** | `npm ci` in `apps/frontend` | Same idea as backend: reproducible install. | Ensures frontend deps resolve and match lockfile. |
| **Lint** | `npm run lint` in `apps/frontend` | ESLint for React/JS. | Catches frontend lint and React rule violations. |
| **Test** | `npm test` in `apps/frontend` | Runs Vitest unit tests. | Validates component and utility logic. |
| **Build** | `npm run build` in `apps/frontend` with `VITE_API_BASE_URL: http://localhost:5000/api` | Runs Vite production build. | Proves the app **builds**; the env var is needed because the frontend references the API URL at build time. In CI we use a placeholder; in real deploy you'd use the real API URL. |

**Why `VITE_API_BASE_URL`?** Vite inlines env vars that start with `VITE_` at build time. The app uses this for the API base URL. CI doesn't need a real backend; it only needs the build to succeed.

---

### 6. Job: `worker`

**Goal:** Ensure the Python AI worker has installable dependencies and **syntactically valid** Python.

| Step | Command / Action | What it does | DevOps meaning |
|------|------------------|-------------|----------------|
| **Checkout** | `uses: actions/checkout@v4` | Same as above. | Needed to get `apps/ai_worker`. |
| **Setup Python** | `uses: actions/setup-python@v5` with `python-version: '3.11'` | Installs Python 3.11. | Pins runtime to match what you use locally/production. |
| **Install dependencies** | `pip install -r requirements.txt` in `apps/ai_worker` | Installs a minimal subset of Python deps (not Whisper/torch which are too heavy for CI). | Validates that the lightweight deps resolve; fails if the file is broken or incomplete. |
| **Syntax check** | `python -m py_compile main.py` in `apps/ai_worker` | Compiles `main.py` to bytecode; fails if syntax is invalid. | Lightweight check without running the app or loading heavy models. |
| **pytest** | `pytest` in `apps/ai_worker` | Runs Python unit tests. | Validates worker logic without needing GPU, Whisper, or external services. |

**Why not "run the worker" or "import main"?** The worker depends on Whisper/torch and possibly other heavy or external services. In CI we only check syntax, a minimal dep install, and lightweight pytest tests to keep runs fast and free of GPU/external dependencies.

---

## How is this used in DevOps?

1. **Quality gate**  
   PRs (and pushes to `main`) must pass all three jobs. You can set **branch protection** so that `main` is not mergeable until "CI" is green.

2. **Consistency**  
   Same commands (`npm ci`, `npm run lint`, `npm test`, `npm run build`, `pip install`, `py_compile`) run in the same way every time. No dependence on a single developer's environment.

3. **Visibility**  
   In the GitHub **Actions** tab you see which job failed and the logs for each step. That makes fixing failures straightforward.

4. **Foundation for CD**  
   A separate workflow (`.github/workflows/docker-publish.yml`) builds Docker images and pushes them to Docker Hub on push to `main` or manual dispatch. CI (`ci.yml`) stays focused on quality gating; publishing is a separate concern.

5. **Speed and cost**  
   Backend, frontend, and worker run **in parallel**. Caching keeps installs fast. You stay within GitHub Actions free tier if the repo is public or within limits for private repos.

---

## Common questions

**Q: Where do I see the results?**  
**A:** Repo on GitHub → **Actions** tab. Click a run to see each job and step; green = success, red = failure and logs.

**Q: Can I run the same checks locally?**  
**A:** Yes, from each app directory:  
`apps/backend`: `npm ci && npm run lint && npm test`  
`apps/frontend`: `npm ci && npm run lint && npm test && npm run build`  
`apps/ai_worker`: `pip install -r requirements.txt && python -m py_compile main.py && pytest`

**Q: Why `npm ci` instead of `npm install`?**  
**A:** `npm ci` installs exactly what's in `package-lock.json` and removes existing `node_modules`. It's deterministic and recommended for CI and production-like environments.

**Q: Why separate jobs for backend, frontend, and worker?**  
**A:** So they run in parallel (faster), and so a failure in one (e.g. frontend lint) doesn't hide another (e.g. backend test failure). You see exactly which part of the stack failed.

**Q: How do I run CI on another branch (e.g. `develop`)?**  
**A:** Add the branch under `on.push.branches` and `on.pull_request.branches`, e.g. `branches: [main, develop]`.

**Q: What if the workflow file has a typo?**  
**A:** GitHub will show a warning in the Actions tab and often on the repo. Fix the YAML and push; the workflow will run with the next trigger.

**Q: How are Docker images published?**  
**A:** A separate workflow, `.github/workflows/docker-publish.yml`, builds and pushes `nisarg48/scriptify-{backend,frontend,worker}` to Docker Hub on push to `main` or manual dispatch. This keeps quality gating (`ci.yml`) separate from image publishing (`docker-publish.yml`).

---

## Summary

| Item | Purpose |
|------|--------|
| **File** | `.github/workflows/ci.yml` |
| **Role** | Run automated lint, tests, and build for backend, frontend, and worker on every push/PR to `main`. |
| **DevOps use** | Quality gate, consistent checks, and a green pipeline as the basis for safe merges and deployment. |
| **Commands** | Checkout → setup Node/Python → install deps → lint → test (and frontend build); worker gets syntax check + pytest. |

Keeping this workflow green is the first step toward a full DevOps pipeline. Docker image publishing is handled by `docker-publish.yml`.
