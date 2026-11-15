# CYBER-DOCKER // Terminal Ops Dashboard

A high-contrast **Cyberpunk / Terminal Ops** real-time Docker container monitoring and lifecycle management dashboard built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Recharts**, and **Dockerode**.

---

## Features

- **Multi-Host Docker Engine Support**: Connect to the local Unix socket (`/var/run/docker.sock`) or remote Docker hosts over **TCP (`http://` / `https://`)** and **SSH (`ssh://`)** with runtime host switching.
- **Summary KPI Telemetry Strip**: Real-time fleet status (`Running / Paused / Exited`), aggregate CPU utilization, memory allocation vs. host capacity, and network/block I/O throughput.
- **Filterable Container Inventory**: Toggle between a high-density telemetry table and compact card grid with instant search and status filtering.
- **Container Lifecycle Controls**: Execute `Start`, `Stop`, `Restart`, `Pause`, `Unpause`, and `Remove` operations directly from the table, grid, or detail drawer.
- **Slide-Over Detail Drawer**:
  - **Live Telemetry**: Real-time SSE streaming charts (`Recharts`) for CPU %, Memory Usage, Network RX/TX, and Disk Block I/O.
  - **Live Terminal Logs**: Real-time multiplexed `stdout`/`stderr` log stream with search, level filtering, line wrap, pause/resume, and log download.
  - **Container Inspector**: Full inspection of environment variables, volume mounts, network settings, port bindings, labels, and commands.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
- **Docker Engine Client**: `dockerode` + `ssh2`
- **Real-Time Streaming**: Server-Sent Events (SSE)
- **Styling & Charts**: Tailwind CSS + Recharts + Lucide React
- **Containerization & CI/CD**: Docker + Docker Compose + GitHub Actions + Railway

---

## Local Development

### Using Docker Compose (Recommended)

```bash
docker compose up --build
```

The dashboard will be available at `http://localhost:3000` with access to the host Docker socket (`/var/run/docker.sock`).

### Using Node.js Directly

```bash
npm install
npm run dev
```

---

## Quality & Verification Commands

```bash
npm run lint        # Run ESLint checks
npm run typecheck   # Run TypeScript compiler checks
npm test            # Run unit tests
npm run build       # Build production Next.js bundle
```

---

## Author

**Domonick Mack**
