# QueueFlow – Smart Queue Management System

> Production-ready, full-stack queue management application built with **React.js, Vite, Tailwind CSS, Node.js, Express.js, and PostgreSQL**.

[![Stack: React + Vite](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC.svg)](https://tailwindcss.com/)
[![Backend: Express.js](https://img.shields.io/badge/Backend-Express.js-000000.svg)](https://expressjs.com/)
[![Database: PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20node--postgres-336791.svg)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 📌 Project Overview

**QueueFlow** is a modern SaaS-style web application designed to streamline customer queues, token dispatching, and service desk operations. Built for facility managers, clinics, banks, and service counters, it allows administrators to create multiple queues, issue sequential tokens, reorder waiting priority, call tokens for service, track real-time elapsed duration, and monitor throughput analytics with Chart.js.

### Key Highlights
- **100% Full-Stack Implementation**: Not a UI mockup. Complete Express REST API, PostgreSQL database with relational constraints and transactions, and reactive React frontend.
- **Zero-Setup Demonstration**: Automatically detects whether a live PostgreSQL server is running. If not, it seamlessly boots an embedded in-memory PostgreSQL engine (`pg-mem`) so reviewers can test the application instantly without configuring databases first!
- **Strict Concurrency Protection**: Partial unique indexes and database transactions ensure that **at most ONE token is served at a time** per queue, preventing race conditions.
- **Linear/Vercel-inspired UI**: Minimalist, clean dashboard layout with real-time KPI counters, custom badges, confirmation dialogs, and smooth transitions.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
|---|---|
| **Frontend** | React 18, Vite, JavaScript (ES6+), Tailwind CSS, React Router DOM v6, Axios, Chart.js + react-chartjs-2, Lucide React, HTML5, CSS3 |
| **Backend** | Node.js, Express.js, RESTful Architecture, JWT (JSON Web Tokens), HTTP-Only Cookies, bcryptjs, CORS, express-validator, cookie-parser |
| **Database** | PostgreSQL, `pg` (node-postgres), relational schema with foreign key cascades, partial unique indexes, and fallback embedded PostgreSQL emulator |
| **Tooling** | Nodemon, npm, Git |

---

## 🏛️ Architecture Overview

```mermaid
flowchart TD
    Client["React.js SPA (Vite + Tailwind CSS)"]
    Router["React Router DOM (Protected Routes)"]
    AxiosService["Axios API Client (withCredentials: true)"]
    
    ExpressApp["Express.js Server (Port 5000)"]
    AuthMiddleware["Auth Middleware (JWT in HTTP-Only Cookie)"]
    Controllers["Express Controllers (Auth, Queue, Token, Analytics)"]
    
    PostgreSQL[("PostgreSQL Database / pg Pool")]
    
    Client --> Router
    Router --> AxiosService
    AxiosService -->|REST HTTP Requests| ExpressApp
    ExpressApp --> AuthMiddleware
    AuthMiddleware --> Controllers
    Controllers -->|SQL Parameterized Queries & Transactions| PostgreSQL
```

---

## 🗄️ Database Design (PostgreSQL)

The database schema enforces data integrity through foreign keys, `ON DELETE CASCADE`, check constraints, and partial unique indexes.

### Relational Schema Diagram

```mermaid
erDiagram
    MANAGERS ||--o{ QUEUES : owns
    QUEUES ||--o{ TOKENS : contains
    QUEUES ||--o{ QUEUE_ACTIVITY : logs
    QUEUES ||--o{ QUEUE_SNAPSHOTS : records
    TOKENS ||--o{ QUEUE_ACTIVITY : relates_to

    MANAGERS {
        int id PK
        varchar full_name
        varchar email UK
        varchar password
        timestamp created_at
    }

    QUEUES {
        int id PK
        int manager_id FK
        varchar name
        varchar prefix
        timestamp created_at
        timestamp updated_at
    }

    TOKENS {
        int id PK
        int queue_id FK
        varchar token_number
        varchar person_name
        varchar phone_number
        int position
        varchar status
        timestamp created_at
        timestamp called_at
        timestamp service_started_at
        timestamp completed_at
        timestamp cancelled_at
    }

    QUEUE_ACTIVITY {
        int id PK
        int queue_id FK
        int token_id FK
        varchar activity_type
        text details
        timestamp created_at
    }

    QUEUE_SNAPSHOTS {
        int id PK
        int queue_id FK
        int waiting_count
        int serving_count
        timestamp recorded_at
    }
```

### Critical PostgreSQL Constraints & Indexes

1. **Enforce Strictly One SERVING Token per Queue**:
   ```sql
   CREATE UNIQUE INDEX idx_unique_serving_per_queue 
   ON tokens (queue_id) 
   WHERE status = 'SERVING';
   ```
   *Interview explanation:* A partial unique index ensures that only rows where `status = 'SERVING'` are subject to uniqueness on `queue_id`. Any attempt to insert or update a second token to `SERVING` in the same queue is rejected at the database level.

2. **Unique Token Number per Queue**:
   ```sql
   CREATE UNIQUE INDEX idx_unique_token_per_queue 
   ON tokens (queue_id, token_number);
   ```

3. **Lightning-Fast Waiting Queue Sorting**:
   ```sql
   CREATE INDEX idx_tokens_queue_status_position 
   ON tokens (queue_id, status, position);
   ```

---

## ✨ Features

### 1. Authentication & Security
- Manager registration with full validation (email uniqueness, password confirmation).
- Password hashing with **bcrypt** (salt rounds = 10).
- Session stored securely in **HTTP-only, SameSite lax cookies** (immune to XSS token theft).
- Ownership verification: Managers can **only** view, edit, or delete their own queues and tokens.

### 2. Overview Dashboard
- Welcome greeting: `"Welcome back, [Manager Name]!"`
- 6 Real-time KPI Cards:
  1. **Total Queues**
  2. **Total Tokens Generated**
  3. **Currently Waiting**
  4. **Currently Serving**
  5. **Completed Services**
  6. **Cancelled Tokens**
- Live queue cards overview with instant status badges.
- Real-time audit log of recent operations (`TOKEN_CREATED`, `TOKEN_CALLED`, `TOKEN_MOVED_UP`, etc.).

### 3. Queue Management
- Create multiple queues (e.g. "Doctor Consultation", "Pharmacy Desk", "Billing Counter").
- Custom prefix support (`DOC`, `PHARM`, `BIL`) for realistic token issuance.
- Rename queues with instant validation.
- Delete queues with a safety confirmation modal.

### 4. Token Management & Queue Ordering
- **Add Person**: Modal to collect Name (required) and Phone Number (optional). Auto-generates unique sequential token (e.g. `DOC001`, `DOC002`).
- **Dynamic Waiting Time**: Estimated wait time is dynamically calculated:
  $$\text{Est. Wait} = (\text{Position} - 1) \times \text{Avg Service Duration}$$
- **Move Up & Move Down**: Atomic position swapping using database transactions.
  - Position 1 cannot move up (boundary protected).
  - Last position cannot move down (boundary protected).
- **Call Next Token**: Summons the first waiting token in line (`position = 1`), transitions it to `SERVING`, records `service_started_at`, and shifts subsequent tokens up (`position = position - 1`).
- **Live Elapsed Service Timer**: Real-time ticker displaying how long the current person has been at the counter.
- **Complete Service**: Changes status to `COMPLETED`, records `completed_at`, calculates service duration, updates analytics, and frees the counter for the next customer.
- **Cancel Token**: Safely cancels a waiting token, re-indexes remaining waiting tokens, and records audit logs.

### 5. Analytics Dashboard (Chart.js)
- **KPI Metrics**: Average waiting time, average service duration, current total queue length, completion rate.
- **Queue Length Trend**: Interactive line chart visualizing queue length fluctuations over snapshots.
- **Token Status Distribution**: Doughnut chart showing proportions of Waiting, Serving, Completed, and Cancelled tokens.
- **Average Waiting Time by Queue**: Bar chart comparing wait times across different service queues.
- **Daily Token Generation**: Bar chart plotting customer volume by day.
- **Operational Insights**: Busiest queue, longest waiting customer, and services completed today.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** (v18+ or v22+ recommended)
- **npm** (v9+ or v10+)
- **PostgreSQL** (Optional; automatically runs embedded memory PostgreSQL if live server is not running)

### Step 1: Clone Repository & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/your-username/QueueFlow.git
cd QueueFlow

# Install dependencies for both server and client
npm run install:all
```

*(Alternatively, install each individually:)*
```bash
cd server && npm install
cd ../client && npm install
```

### Step 2: Environment Configuration
Create `.env` inside `server/`:
```bash
# In server/.env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
JWT_SECRET=queueflow_super_secret_jwt_key_2026_dev

# Optional: PostgreSQL Database connection details
DB_HOST=localhost
DB_PORT=5432
DB_NAME=queueflow
DB_USER=postgres
DB_PASSWORD=postgres
# Or:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/queueflow
```

> **Note on Zero-Config Testing**: If you don't have PostgreSQL installed on your machine right now, you don't need to install anything! QueueFlow will automatically detect that PostgreSQL is not running and switch to the embedded PostgreSQL engine (`pg-mem`).

### Step 3: Run the Application
In separate terminal windows (or using the root script):

**Terminal 1 (Backend Server):**
```bash
cd server
npm run dev
# Server starts at http://localhost:5000
```

**Terminal 2 (Frontend Client):**
```bash
cd client
npm run dev
# Client starts at http://localhost:5173
```

Open your browser at **`http://localhost:5173`**.

---

## 🧪 Automated Testing

QueueFlow includes a full 14-step automated end-to-end integration test suite verifying authentication, queue ordering, concurrency locks, and analytics:

```bash
cd server
npm test
```

### Test Suite Output
```text
====================================================
🚀 RUNNING QUEUEFLOW COMPREHENSIVE END-TO-END TESTS
====================================================

▶ Test 1: Manager Registration...
  ✓ Manager registered successfully: ID 1
▶ Test 2: Prevent Duplicate Registration...
  ✓ Duplicate email rejected with 409 Conflict.
▶ Test 3: Manager Login...
  ✓ Manager authenticated successfully.
▶ Test 4: Create Queues...
  ✓ Queue created: "General Consultation" with prefix "DOC" (ID: 1)
▶ Test 5: Add Tokens to Queue (Rahul, Amit, Priya)...
  ✓ Issued Token DOC001 for Rahul Verma at Position 1
  ✓ Issued Token DOC002 for Amit Patel at Position 2
  ✓ Issued Token DOC003 for Priya Singh at Position 3
▶ Test 6: Move Token Up (Swap Positions)...
  ✓ Token DOC002 moved up to Position 1.
▶ Test 7: Verify Boundary Protection (Position 1 cannot move up)...
  ✓ Boundary protected: "This token is already at the first position in the waiting queue."
  ✓ Token moved back down to original order.
▶ Test 8: Call Next Token for Service...
  ✓ Now serving Token DOC001 (Rahul Verma).
▶ Test 9: Enforce Single Serving Token Rule (Attempt concurrent Call Next)...
  ✓ Call Next blocked while token is serving: "Cannot call next token: Token DOC001 is currently being served."
▶ Test 10: Complete Service...
  ✓ Completed service for Token DOC001. Service duration calculated.
▶ Test 11: Call Next Token after completion...
  ✓ Successfully called next Token DOC002.
▶ Test 12: Cancel Waiting Token...
  ✓ Token DOC003 cancelled.
▶ Test 13: Verify Analytics & KPI Calculations...
  ✓ Total Tokens: 3
  ✓ Total Completed: 1
  ✓ Total Cancelled: 1
  ✓ Currently Serving: 1
  ✓ Currently Waiting: 0
▶ Test 14: Manager Ownership Security...
  ✓ Resource ownership access control verified (403 Forbidden).

====================================================
🎉 ALL 14 TEST SUITES PASSED FLAWLESSLY!
====================================================
```

---

## 📡 REST API Documentation

### Authentication Endpoints
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register a new facility manager | No |
| `POST` | `/api/auth/login` | Authenticate manager & issue HTTP-only cookie | No |
| `POST` | `/api/auth/logout` | Clear authentication session cookie | No |
| `GET` | `/api/auth/me` | Fetch currently logged-in manager profile | **Yes** |

### Queue Endpoints
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/queues` | Get all queues for manager with real-time counts | **Yes** |
| `POST` | `/api/queues` | Create a new queue line (name, prefix) | **Yes** |
| `GET` | `/api/queues/:id` | Get details and status for a single queue | **Yes** |
| `PUT` | `/api/queues/:id` | Rename queue | **Yes** |
| `DELETE` | `/api/queues/:id` | Delete queue and all associated tokens | **Yes** |

### Token Operations
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/queues/:id/tokens` | Get waiting, serving, completed & cancelled tokens | **Yes** |
| `POST` | `/api/queues/:id/tokens` | Add person to queue (auto-issues token) | **Yes** |
| `PUT` | `/api/tokens/:id/move-up` | Swap waiting position with preceding token | **Yes** |
| `PUT` | `/api/tokens/:id/move-down`| Swap waiting position with following token | **Yes** |
| `PUT` | `/api/queues/:id/call-next`| Transition first waiting token to SERVING | **Yes** |
| `PUT` | `/api/tokens/:id/complete` | Complete currently serving token | **Yes** |
| `PUT` | `/api/tokens/:id/cancel` | Cancel waiting or serving token | **Yes** |

### Analytics Endpoints
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/analytics/overview` | Fetch KPI cards & operational insights | **Yes** |
| `GET` | `/api/analytics/queue-trends` | Queue length snapshots for Line chart | **Yes** |
| `GET` | `/api/analytics/waiting-times` | Average waiting times per queue for Bar chart | **Yes** |
| `GET` | `/api/analytics/token-distribution`| Status breakdown for Doughnut chart | **Yes** |
| `GET` | `/api/analytics/daily-tokens` | Daily token creation volume for Bar chart | **Yes** |

---

## 🎯 Interview Deep Dive (Confidence Guide)

When explaining this project during a technical interview, use these key talking points:

### 1. How the Application Works
"QueueFlow is a full-stack queue management platform. A manager registers and creates independent queue counters (e.g., General Consultation, Cash Counter). Customers are added to queues, receiving auto-generated tokens (e.g. DOC001, DOC002). The manager can reorder priority with atomic Move Up/Move Down actions, call the next person for service, monitor active service time, and complete or cancel tokens. All statistics and charts on the dashboard and analytics pages are queried in real-time from PostgreSQL."

### 2. Database Relationships & Normalization
- `managers (1) ────< (M) queues`: One manager owns multiple queues with `ON DELETE CASCADE`.
- `queues (1) ────< (M) tokens`: Tokens belong to a specific queue.
- `queues (1) ────< (M) queue_activity`: Real-time audit trails of token actions.
- `queues (1) ────< (M) queue_snapshots`: Periodic and event-driven waiting length metrics.

### 3. Authentication & Security Flow
- Passwords hashed with `bcryptjs` using 10 salt rounds.
- After validation, a signed JWT payload (`{ id, email, full_name }`) is set inside an **HTTP-only cookie** (`SameSite: Lax`).
- This prevents JavaScript XSS access to the token, unlike `localStorage`.
- In all protected routes, `authMiddleware` verifies the cookie and queries the DB to attach `req.manager`.
- All database queries check `WHERE q.manager_id = $1` to enforce strict multi-tenant tenant isolation.

### 4. Queue Ordering Algorithm (Move Up / Down)
- Waiting tokens are assigned sequential 1-based integer positions (`1, 2, 3...`).
- When a manager clicks **Move Up**:
  1. We verify `position > 1`.
  2. In a PostgreSQL transaction (`BEGIN ... COMMIT`), we locate the preceding token at `position - 1`.
  3. We swap the two positions using a temporary placeholder (`-999`) to prevent unique constraint collisions.
  4. Activity is logged and the transaction is committed.

### 5. CALL NEXT Implementation & Concurrency Protection
- To enforce that **only one person is served at a time**, we use a two-tier safeguard:
  1. **Database Level**: A PostgreSQL partial unique index:
     `CREATE UNIQUE INDEX idx_unique_serving_per_queue ON tokens (queue_id) WHERE status = 'SERVING';`
  2. **Application Level**: Inside a transaction, we query `SELECT id FROM tokens WHERE queue_id = $1 AND status = 'SERVING' FOR UPDATE`. If one exists, the request is rejected with `400 Bad Request`.
  3. The first waiting token is fetched with `ORDER BY position ASC LIMIT 1`, updated to `SERVING`, and all remaining waiting tokens have their position decremented: `UPDATE tokens SET position = position - 1 WHERE queue_id = $1 AND status = 'WAITING'`.

### 6. Waiting-Time Calculation
- **Estimated Wait Time** shown in the table is dynamically calculated:
  $$\text{Est. Wait Time} = (\text{Position} - 1) \times \text{Average Service Duration}$$
  where average service duration is computed from completed tokens in that queue (defaulting to 5 minutes).
- **Historical Wait Time** in Analytics is calculated as:
  $$\text{Wait Duration} = \text{service\_started\_at} - \text{created\_at}$$

---

## 🔮 Future Scope
- **Public Display Board**: Large screen / TV display mode (`/display/:queueId`) showing currently serving tokens with audio chimes.
- **Customer Self-Service Kiosk**: Mobile check-in page with QR code scanning and real-time SMS / WhatsApp alerts when their token is 2 positions away.
- **WebSocket / Server-Sent Events (SSE)**: Instant cross-tab real-time sync when a token is called without needing polling or manual refresh.
- **Counter Multi-Staffing**: Allow multiple counter staff under one organization with role-based access control (Staff vs Administrator).

---

## 📄 License
This project is licensed under the MIT License. Developed as a production-quality full-stack showcase.

