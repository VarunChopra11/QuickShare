# QuickShare 🚀

**QuickShare** is a lightweight, privacy-focused temporary file and text sharing web service designed for fast device-to-device transfers without user accounts, sign-ups, or persistent tracking.

A sender uploads text, notes, links, or files and instantly receives a random **6-digit code**. The recipient enters this code on any device to retrieve the content. All shares and associated physical files **automatically self-destruct after 10 minutes**.

QuickShare is engineered to run comfortably on low-resource ARM hardware (e.g. Raspberry Pi, Android/Termux, or low-RAM VPS) using minimal CPU, minimal memory, and zero external infrastructure dependencies.

---

## Key Features

- **Zero Friction:** No accounts, passwords, cookies, or profile management.
- **6-Digit PIN Sharing:** Easy to read across a room, copy, or share via direct link (`?code=123456`).
- **Supports Mixed Content:** Share plain text, code snippets, URLs, and multiple file uploads in a single share.
- **Automatic 10-Minute Expiration:** All database records and physical files on disk are completely deleted when the timer expires.
- **Persistent Cleanup Survives Server Restarts:** Even if the server is stopped or restarted, stale files and records are pruned immediately upon startup and during periodic sweeps.
- **Low-Resource ARM Architecture:** Built with Python (FastAPI) and modern lightweight React (Vite). Consumes under 40 MB of RAM in production.
- **Brute-Force & Enumeration Protection:** Cryptographic random code generation, collision resistance, sliding-window IP rate limiting, and failed-attempt lockouts.
- **Path Traversal & File Safety:** Files on disk are stored strictly with randomized UUIDs; user filenames are sanitized, and directory traversal attacks are completely blocked.
- **Zip Packaging:** Download all files in a multi-file share at once as a single zip archive.
- **Light & Dark Theme:** Responsive, touch-friendly UI that works seamlessly on mobile phones and desktop displays.
- **Zero Docker Required:** Runs directly on native Python and Node environments without container overhead.

---

## Architecture & Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Backend** | Python 3.10+ / FastAPI / Uvicorn | REST API with streaming chunked file I/O for low RAM |
| **Database** | SQLite (WAL Mode) | Embedded, zero daemon overhead, indexed by `code` and `expires_at` |
| **Storage** | Local Filesystem | Randomized disk filenames (`uuid.uuid4().hex`), isolated upload path |
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS | Responsive, mobile-first, client bundle < 60 KB gzipped |
| **Deployment** | Standalone Single Process | FastAPI can directly serve the compiled frontend (`frontend/dist`) |

### How It Works

```
Sender Device                                               Receiver Device
     │                                                             │
     ├─ 1. Enter text / Drop files                                 │
     ├─ 2. POST /api/shares                                        │
     │     │                                                       │
     │     ▼                                                       │
     │  FastAPI Backend (Saves chunks, creates SQLite entry)       │
     │  Generates 6-digit PIN (e.g. 482910)                        │
     │     │                                                       │
     │◄────┴─ Returns code & 10m countdown                         │
     │                                                             │
     │ (Shares PIN via room, voice, or link) ─────────────────────►│
     │                                                             ├─ 3. Enter PIN (or ?code=482910)
     │                                                             ├─ 4. GET /api/shares/482910
     │                                                             │     │
     │                                                             │     ▼
     │                                                             │  Validates active & rate limit
     │                                                             │  Returns metadata & text
     │                                                             │◄────┤
     │                                                             ├─ 5. Download files / Copy text
     │                                                             └─ 6. Optional: Burn / Delete now
     │
     ▼
[Background Worker & Startup Sweep]
Scans SQLite every 30s: if now >= expires_at, unlinks physical files and deletes DB row.
```

---

## Repository Structure

```text
QuickShare/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI app, lifespan, security headers & static mount
│   │   ├── config.py        # Environment settings (Pydantic)
│   │   ├── database.py      # SQLite connection & schema initialization
│   │   ├── security.py      # PIN generator, filename sanitizer, path verification
│   │   ├── rate_limit.py    # Sliding window & failed attempt lockout
│   │   ├── cleanup.py       # Expiration logic & physical file unlink
│   │   ├── storage.py       # Streaming chunked disk writer
│   │   ├── schemas.py       # Pydantic request & response schemas
│   │   └── routers/
│   │       ├── shares.py    # /api/shares endpoints
│   │       └── health.py    # /api/health endpoint
│   ├── tests/
│   │   ├── conftest.py      # Test database & upload isolation
│   │   ├── test_shares.py   # Creation, retrieval, downloads, validation tests
│   │   ├── test_cleanup.py  # Expiration, physical deletion & restart tests
│   │   └── test_rate_limit.py # Lockout & brute-force defense tests
│   ├── requirements.txt     # Backend Python dependencies
│   ├── pytest.ini           # Test configuration
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx         # Logo, badges, theme toggle
│   │   │   ├── CreateShare.tsx    # Dropzone, text input, upload progress
│   │   │   ├── ReceiveShare.tsx   # PIN input, retrieved content & actions
│   │   │   ├── CodeDisplay.tsx    # Prominent 6-digit display & copy links
│   │   │   ├── CodeInput.tsx      # 6-box PIN input with paste & touch support
│   │   │   ├── CountdownTimer.tsx # Live self-destruct timer (MM:SS)
│   │   │   ├── ThemeToggle.tsx    # Light/Dark mode switcher
│   │   │   └── Toast.tsx          # Transient alerts
│   │   ├── services/
│   │   │   └── api.ts             # API client & progress tracking
│   │   ├── types/
│   │   │   └── index.ts           # TypeScript interfaces
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── scripts/
│   ├── install.sh           # Installs backend venv and frontend packages
│   ├── dev.sh               # Runs backend & frontend concurrently in dev mode
│   ├── build.sh             # Compiles frontend for production
│   ├── start.sh             # Starts production server (single process)
│   ├── start-backend.sh     # Starts backend standalone
│   ├── start-frontend.sh    # Starts frontend Vite dev server standalone
│   └── clean.sh             # Runs manual cleanup CLI
├── .env.example
├── .gitignore
└── README.md
```

---

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **npm**
- Linux, macOS, or Windows (WSL)

---

## Installation

Run the automated installer script:

```bash
chmod +x scripts/*.sh
./scripts/install.sh
```

This will:
1. Create a Python virtual environment in `backend/.venv`
2. Install Python dependencies (`fastapi`, `uvicorn`, `pydantic`, `pytest`, etc.)
3. Install frontend dependencies via `npm`

---

## Local Development

To run both backend and frontend concurrently with auto-reload:

```bash
./scripts/dev.sh
```

- **Frontend:** [http://localhost:5173](http://localhost:5173) (Vite dev server with `/api` proxy)
- **Backend API:** [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive OpenAPI Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

To stop both dev servers, press `Ctrl+C`.

### Running Services Independently

You can also run each part in separate terminals:

**Terminal 1 (Backend):**
```bash
./scripts/start-backend.sh
```

**Terminal 2 (Frontend):**
```bash
./scripts/start-frontend.sh
```

---

## Running Backend Automated Tests

Run the test suite using `pytest`:

```bash
cd backend
./.venv/bin/pytest tests -v
```

Tests cover:
- Text and file share creation
- PIN retrieval and metadata validation
- Single file download with safety headers
- Multi-file ZIP archive creation
- 404 handling on missing or expired shares
- Directory traversal and filename sanitization attacks
- Payload size and empty submission validation
- Automatic expiration and physical file disk unlinking
- Offline expiration cleanup simulation (server restart)
- Rate limiting and brute-force lockout defense

---

## Production Deployment (No Docker Required)

QuickShare is optimized for single-binary/single-process deployment without Docker.

### 1. Build Frontend & Start Server

```bash
./scripts/build.sh
./scripts/start.sh
```

`scripts/start.sh` builds the frontend assets and starts Uvicorn. When `frontend/dist` is present, **the backend automatically serves the compiled frontend, static assets, and API routes on a single port** (`http://0.0.0.0:8000`).

### 2. Running as a Systemd Service (Optional Linux Service)

Create `/etc/systemd/system/quickshare.service`:

```ini
[Unit]
Description=QuickShare Service
After=network.target

[Service]
Type=simple
User=arch
WorkingDirectory=/home/arch/Programming/QuickShare/backend
ExecStart=/home/arch/Programming/QuickShare/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
Restart=always
RestartSec=3
Environment=PORT=8000
Environment=EXPIRY_MINUTES=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now quickshare
```

---

## Configuration

All configuration is managed via environment variables or a `.env` file in the root or `backend/` directory:

| Variable | Default | Description |
|---|---|---|
| `HOST` | `0.0.0.0` | Server bind IP |
| `PORT` | `8000` | Server port |
| `EXPIRY_MINUTES` | `10` | Lifetime of shares in minutes |
| `MAX_FILE_SIZE_MB` | `50` | Maximum size per individual file (MB) |
| `MAX_TOTAL_SHARE_SIZE_MB` | `100` | Maximum total size for a single share (MB) |
| `MAX_FILES_PER_SHARE` | `10` | Maximum number of files in one share |
| `MAX_TEXT_LENGTH` | `50000` | Maximum text character count |
| `RATE_LIMIT_LOOKUP_PER_MINUTE` | `20` | Max lookup requests allowed per IP per minute |
| `RATE_LIMIT_CREATE_PER_MINUTE` | `10` | Max shares an IP can create per minute |
| `MAX_FAILED_ATTEMPTS` | `5` | Failed guesses before IP lockout is triggered |
| `FAILED_ATTEMPT_LOCKOUT_SECONDS`| `60` | Duration of brute-force lockout (seconds) |
| `CLEANUP_INTERVAL_SECONDS` | `30` | Frequency of background cleanup cycle (seconds) |
| `CORS_ORIGINS` | `*` | Allowed CORS origins (comma-separated or `*`) |

---

## Database & File Storage Design

### SQLite with Write-Ahead Logging (WAL)
- QuickShare uses standard Python `sqlite3` configured with `PRAGMA journal_mode = WAL;` and `PRAGMA foreign_keys = ON;`.
- WAL mode allows concurrent readers without blocking writes.
- Two simple tables:
  1. `shares`: Stores `id`, `code`, `text_content`, `created_at`, `expires_at`, `downloads_count`.
  2. `files`: Stores `id`, `share_id`, `original_filename`, `stored_filename`, `file_size`, `mime_type`, `created_at`.
- Dedicated indexes on `shares(code)` and `shares(expires_at)` guarantee instant $O(1)$ lookup and rapid cleanup scans.

### Physical File Storage
- Files are stored in `data/uploads/` on the local filesystem.
- Uploaded files are assigned random UUID filenames on disk (e.g., `3f74ad89a19c4d92a99c43b9e4a3b118.pdf`).
- User-supplied filenames are never used as filesystem paths.
- Chunked streaming I/O (64 KB buffers) ensures that large uploads never exhaust server RAM.

---

## 10-Minute Expiration & Cleanup Mechanism

Expiration does **not** rely on in-memory timers:

1. **Database Timestamp:** Each share is saved with an immutable Unix epoch `expires_at = created_at + 600`.
2. **Periodic Background Loop:** An `asyncio` task runs every 30 seconds, executing `cleanup_expired_shares()`:
   - Finds all shares where `expires_at <= current_time`.
   - Reads associated `stored_filename` entries and calls `unlink()` on each physical file.
   - Deletes the database records.
3. **Startup Sweep:** When the server boots (lifespan startup), `cleanup_expired_shares()` executes immediately to prune any shares that expired while the server was offline.
4. **On-Access Guard:** When a user queries `GET /api/shares/{code}`, the query explicitly filters by `expires_at > current_time`. Expired items return `404 Not Found` immediately.
5. **Manual / Cron Cleanup:** You can trigger cleanup on demand or via a system cron job:
   ```bash
   ./scripts/clean.sh
   ```

---

## Security & Privacy Considerations

- **Brute-Force Mitigation:** 6-digit codes yield 1,000,000 combinations. The server enforces a sliding-window rate limit (20 req/min) and triggers a 60-second IP lockout after 5 consecutive failed guesses (HTTP 429 with `Retry-After`).
- **Path Traversal Defense:** Filenames are sanitized with regex, stripped of `..`, slashes, null bytes, and non-printable characters. All file lookups resolve strictly inside `UPLOAD_DIR`.
- **Safe Downloads:** Files are served with `X-Content-Type-Options: nosniff` and `Content-Disposition: attachment; filename="safe_filename"`, preventing browser execution of untrusted scripts.
- **Security Headers:** Every response includes `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-XSS-Protection: 1; mode=block`.
- **Zero Sensitive Logging:** Server logs record only non-sensitive counts (e.g. `Cleanup: pruned 2 expired shares`) and never log passwords, shared text, or user filenames.
- **Burn After Reading:** Both sender and recipient have a "Delete / Erase Share Now" button that instantly wipes text and physical files prior to the 10-minute timeout.

---

## License

MIT License. Free for personal and commercial use.
