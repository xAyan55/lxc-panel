# 🌌 VM Panel - Pro VPS Management

A high-performance, production-ready VPS management panel built with **LXC/LXD**, **Node.js**, and **React**. Designed for speed, security, and a premium user experience.

![Dashboard Preview](https://github.com/placeholder-preview-image.png)

## 💎 Features

- 🏗️ **LXC Container Management**: Full lifecycle (create, start, stop, restart, kill, rename).
- 🛡️ **Isolation & Security**: JWT auth, Argon2/Bcrypt hashing, role-based access (RBAC).
- 🎨 **Dynamic Branding**: Per-user company name and theme color customization.
- ⚡ **Real-time Metrics**: Live CPU, RAM, Disk, and Network monitoring with data polling.
- 💻 **Interactive Console**: Full Web-based terminal powered by `xterm.js` and WebSockets.
- 📡 **TMATE Integration**: One-click remote terminal sharing with RW/RO session links.
- 💾 **Advanced Backup System**: Automatic daily schedules + manual snapshots.
- 🔑 **API Access**: Per-user API keys for programmatic control.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, better-sqlite3 (WAL mode).
- **Frontend**: React (Vite), TailwindCSS v4, Lucide Icons, Recharts.
- **Engine**: LXD (LXC) REST API / CLI Wrapper.

---

## 🚀 Quick Deployment (Ubuntu 22.04+)

Run the following command on a fresh Ubuntu server with root access:

```bash
# Clone the repository
git clone https://github.com/your-repo/vmpanel.git
cd vmpanel

# Run the installer
chmod +x scripts/setup.sh
sudo ./scripts/setup.sh
```

The installer will:
1. Install system dependencies (LXD, Snap, Node.js, SQLite).
2. Automatically initialize LXD.
3. Build the frontend production bundle.
4. Prompt you for initial **Admin Email and Password**.

---

## 🏗️ Production Setup (PM2)

After running the installer, manage your panel with PM2 for 24/7 uptime:

```bash
npm install -g pm2

# Start Backend API
cd backend
pm2 start src/server.js --name vmpanel-api

# For frontend, serve the `frontend/dist` directory using Nginx or PM2-Serve
pm2 serve ../frontend/dist 5173 --name vmpanel-ui
```

### 🔒 Security Recommendations

- **Reverse Proxy**: Use Nginx with SSL (Let's Encrypt) to proxy requests to port 5173/3001.
- **Firewall**: Ensure port 3001 and 5173 are only reachable locally if using Nginx.
- **Unix Socket**: Ensure the backend user has permissions to access `/var/snap/lxd/common/lxd/unix.socket`.

---

## 📜 API Documentation

All routes are prefixed with `/api`. Authenticate via `Authorization: Bearer <JWT>` or `X-API-Key: <KEY>`.

| Route | Method | Access | Description |
|-------|--------|--------|-------------|
| `/auth/login` | POST | Public | Authenticate and get JWT |
| `/containers` | GET | User/Admin | List available VPS |
| `/containers/:id/start` | POST | Owner/Admin | Start a container |
| `/stats/container/:id` | GET | Owner/Admin | Get live metrics |
| `/backups/:id` | GET | Owner/Admin | List snapshots |

---

## 📂 Project Structure

- `/backend`: Express API and LXD service wrapper.
- `/frontend`: React SPA dashboard.
- `/scripts`: Shell installer and CLI tools.
- `/services`: Core LXD logic.
- `/database`: SQLite storage (persistent).

---

© 2026 VM Panel - Built for high-performance hosting environments.
