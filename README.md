# Modern CRM

A full-featured, production-ready CRM application built with Node.js, Express, PostgreSQL, React, and Socket.io.

## Features

- **Authentication** - JWT-based with role-based access control (admin / manager / user)
- **Contact Management** - CRUD + tags + search
- **Lead Management** - Status pipeline, assignment, notes
- **Deal Pipeline** - Drag-and-drop Kanban across configurable stages
- **Ticketing System** - Comments thread, file attachments, status/priority, assignment
- **Task Management** - Priorities, due dates, assignment, completion
- **Real-time Notifications** - Socket.io, bell indicator, toasts
- **Reports & Analytics** - Dashboard KPIs + charts (Recharts)
- **Settings** - App config + pipeline stage management
- **Audit Logs** - Every important action recorded

## Tech Stack

| Layer       | Technology                                          |
| ----------- | --------------------------------------------------- |
| Backend     | Node.js, Express, PostgreSQL (`pg`), Socket.io      |
| Auth        | JWT, bcryptjs                                       |
| Validation  | express-validator                                   |
| Uploads     | multer                                              |
| Frontend    | React 18, Vite, TailwindCSS, React Router           |
| HTTP        | axios                                               |
| Charts      | Recharts                                            |
| Realtime    | socket.io-client                                    |
| Toasts      | react-hot-toast                                     |

## Project Structure

```
CRM-Project/
├── server/                       # Backend (Node + Express)
│   ├── src/
│   │   ├── config/               # db.js, socket.js
│   │   ├── controllers/          # Request handlers
│   │   ├── services/             # Business logic
│   │   ├── routes/               # Express routers
│   │   ├── middleware/           # auth, error, validate, upload, audit
│   │   ├── db/                   # schema.sql, migrate.js, seed.js
│   │   ├── app.js                # Express app
│   │   └── server.js             # HTTP + Socket.io bootstrap
│   ├── uploads/                  # File attachments (generated)
│   ├── .env.example
│   └── package.json
├── client/                       # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/           # layout, ui, notifications
│   │   ├── context/              # AuthContext, NotificationContext
│   │   ├── pages/                # Dashboard, Contacts, Leads, ...
│   │   ├── services/             # API service layer + socket
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── vite.config.js            # Proxies /api, /uploads, /socket.io
│   └── package.json
├── prompt.md
├── package.json                  # Root scripts
└── README.md
```

## Prerequisites

- **Node.js** >= 18
- **PostgreSQL** >= 13
- **npm** >= 9

## Setup (Step by Step)

### 1. Create the database

```bash
# Using psql (adjust user if needed)
psql -U postgres -c "CREATE DATABASE crm_db;"
```

### 2. Configure environment variables

```bash
# Backend
cp server/.env.example server/.env
# Edit server/.env with your PostgreSQL credentials and JWT secret

# Frontend (optional - defaults work with the Vite proxy)
cp client/.env.example client/.env
```

Example `server/.env`:

```env
PORT=5000
CLIENT_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_NAME=crm_db
DB_USER=postgres
DB_PASSWORD=postgres

JWT_SECRET=change_me_please
JWT_EXPIRES_IN=7d

UPLOAD_DIR=uploads
MAX_UPLOAD_MB=10
```

### 3. Install dependencies

```bash
# From the repository root
npm run install:all

# Or manually
cd server && npm install
cd ../client && npm install
```

### 4. Run migrations and seed data

```bash
npm run db:migrate     # creates all tables, indexes, FKs
npm run db:seed        # creates demo users, stages, contacts, leads, deals...
```

Demo users created by the seed script:

| Role    | Email              | Password     |
| ------- | ------------------ | ------------ |
| admin   | admin@crm.test     | admin123     |
| manager | manager@crm.test   | manager123   |
| user    | sales@crm.test     | sales123     |

### 5. Run the app

Open two terminals:

```bash
# Terminal 1 - backend
npm run dev:server       # http://localhost:5000

# Terminal 2 - frontend
npm run dev:client       # http://localhost:5173
```

Then open `http://localhost:5173` and sign in with a demo account.

## API Reference (Summary)

All endpoints are prefixed with `/api`. Protected endpoints require
`Authorization: Bearer <token>`.

### Auth

| Method | Path               | Description              |
| ------ | ------------------ | ------------------------ |
| POST   | `/auth/register`   | Create account           |
| POST   | `/auth/login`      | Login → returns JWT      |
| GET    | `/auth/me`         | Current user             |
| POST   | `/auth/logout`     | Invalidate (client side) |

### Users (auth required; admin for mutations)

| Method | Path                  | Roles              |
| ------ | --------------------- | ------------------ |
| GET    | `/users`              | any authed         |
| GET    | `/users/:id`          | any authed         |
| POST   | `/users`              | admin              |
| PUT    | `/users/:id`          | admin, manager     |
| PATCH  | `/users/:id/status`   | admin              |
| DELETE | `/users/:id`          | admin              |

### Contacts

`GET|POST /contacts` · `GET|PUT|DELETE /contacts/:id`
Query: `search`, `tag`, `page`, `limit`

### Leads

`GET|POST /leads` · `GET|PUT|DELETE /leads/:id`
`PATCH /leads/:id/status` · `PATCH /leads/:id/assign`

### Pipeline Stages

`GET /pipeline-stages` · `POST|PUT|DELETE` (admin/manager)

### Deals

`GET|POST /deals` · `GET /deals/board` · `GET|PUT|DELETE /deals/:id`
`PATCH /deals/:id/stage`  — drag & drop persistence

### Tickets

`GET|POST /tickets` · `GET|PUT|DELETE /tickets/:id`
`PATCH /tickets/:id/status` · `PATCH /tickets/:id/assign`
`GET /tickets/:id/comments` · `POST /tickets/:id/comments` *(multipart: `body`, `files[]`)*

### Tasks

`GET|POST /tasks` · `PUT|DELETE /tasks/:id` · `PATCH /tasks/:id/complete`

### Notifications

`GET /notifications` · `PATCH /notifications/:id/read`
`PATCH /notifications/read-all` · `DELETE /notifications/:id`

### Reports

`GET /reports/dashboard`
`GET /reports/leads-by-status`
`GET /reports/deals-by-stage`
`GET /reports/tickets-resolution`
`GET /reports/revenue-trend`

### Settings (admin for PUT)

`GET|PUT /settings`

### Logs (admin/manager)

`GET /logs`

## Realtime Events (Socket.io)

The client connects to `/socket.io` and authenticates with `auth.token`.

| Event              | Direction | Payload                                     |
| ------------------ | --------- | ------------------------------------------- |
| `notification:new` | server→client | `{ id, type, title, message, link, ... }` |

Triggered by:
- Lead creation / assignment
- Ticket creation / assignment
- Task assigned to another user

## Security Notes

- Passwords hashed with `bcryptjs` (10 rounds)
- JWT signed with `JWT_SECRET` (rotate in production)
- Global rate limiter (`express-rate-limit`) on `/api`
- `helmet` enabled
- CORS restricted to `CLIENT_URL`
- Role-based route guards via `requireRole()` middleware
- Request validation via `express-validator`

## Production Build

```bash
# Build the React bundle
npm run build:client        # outputs client/dist

# Serve the backend
cd server && NODE_ENV=production npm start
# (You can host client/dist behind nginx / any static host, or adapt Express to serve it.)
```

## License

MIT

