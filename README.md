# Orbit LMS — Backend

Backend API for the Orbit LMS coursework project. Built with **Express**,
**PostgreSQL**, and **Prisma**. Requires **Node.js 18+**.

## Folder structure

```
orbit-lms-backend/
├── prisma/
│   ├── schema.prisma        # database schema (source of truth)
│   ├── migrations/          # committed SQL migrations (applied by `prisma migrate`)
│   └── seed.js              # mock data for frontend integration
├── postman/
│   ├── Orbit-LMS.postman_collection.json
│   └── Orbit-LMS.postman_environment.json
├── tests/
│   ├── auth.test.js         # integration tests — auth flow
│   └── courses.test.js      # integration tests — CRUD + route protection
├── src/
│   ├── config/db.js         # Prisma client singleton
│   ├── controllers/         # request handlers (business logic)
│   ├── middleware/
│   │   ├── asyncHandler.js  # wraps async routes so errors reach errorHandler
│   │   ├── errorHandler.js  # central error handling incl. Prisma error mapping
│   │   ├── auth.js          # requireAuth (JWT) + optionalAuth + requireRole (route protection)
│   │   └── validate.js      # validateBody(schema) request validation
│   ├── utils/
│   │   ├── jwt.js           # sign/verify JWTs
│   │   ├── serializeQuiz.js # hides quiz answer flags (isCorrect) from non-admins
│   │   └── validators.js    # small schema-based validator (no external lib)
│   ├── routes/               # one router per resource, mounted under /api
│   ├── app.js                # Express app (middleware + routes)
│   └── server.js             # entry point
├── railway.json               # Railway deployment config
├── render.yaml                # Render.com deployment blueprint
├── Procfile                   # generic process declaration (Heroku/Render)
├── .env.example
└── package.json
```

Routes define URLs and protection rules → controllers hold the logic →
controllers talk to Postgres through the shared Prisma client. New
resources follow the same `*.controller.js` + `*.routes.js` pattern already
set up for every resource below.

## Setup

1. **Install dependencies:**
```
   npm install
```

2. **Set up your environment:**
```
   cp .env.example .env
```
   Then fill in the values:

   | Variable | Required | Description |
   |---|---|---|
   | `DATABASE_URL` | Yes | Postgres connection string used by the app at runtime (with Neon, use the *pooled* connection string) |
   | `DIRECT_URL` | Yes (migrations) | Direct, non-pooled connection string used only by `prisma migrate`. Use the same value as `DATABASE_URL` if you're not behind a pooler (e.g. local Postgres) |
   | `JWT_SECRET` | Yes | Any long random string — used to sign and verify JWTs |
   | `JWT_EXPIRES_IN` | No | Token lifetime. Defaults to `7d` if unset (`.env.example` sets `30d`) |
   | `PORT` | No | Defaults to `4000` |
   | `NODE_ENV` | No | `development` or `production` — in production, `500` responses don't include stack traces |
   | `CLIENT_ORIGIN` | No | The one origin allowed by CORS. It must match the address your frontend is opened at exactly (protocol, host, and port; no trailing slash). Locally that's your Live Server address, e.g. `http://127.0.0.1:5501` (the frontend's `.vscode/settings.json` uses port 5501; `.env.example` shows Live Server's default, 5500). In production it's your Vercel URL. Defaults to `*` if unset |

3. **Create the database tables:**
```
   npx prisma migrate dev
```
   This applies the migrations in `prisma/migrations`. (`npx prisma migrate deploy`
   is the non-interactive version used by the production start commands.)

4. **Seed mock data:**
```
   npm run seed
```
   ⚠️ The seed script **deletes all existing data** (users, courses,
   enrollments, progress, quiz attempts) before inserting the mock data.
   Don't run it against a database that holds anything you want to keep.

5. **Start the server:**
```
   npm run dev
```
   API runs at `http://localhost:4000` by default. Quick check:
   `GET http://localhost:4000/api/health` → `{ "status": "ok" }`.

### Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the server with `node --watch` (restarts on file changes) |
| `npm start` | Start the server without watch mode |
| `npm run seed` | Wipe the database and load the mock data |
| `npm test` | Run the integration tests |
| `npm run prisma:generate` | Regenerate the Prisma client |
| `npm run prisma:migrate` | Same as `npx prisma migrate dev` |
| `npm run prisma:studio` | Open Prisma Studio to browse the database |

### Connecting the frontend

The frontend (a static site, hosted on Vercel in production) reads its API
address from `API_BASE_URL` in its `js/api.js`. To use your local backend,
set it to `http://localhost:4000/api`, and make sure `CLIENT_ORIGIN` matches
the origin the frontend is served from — `localhost` and `127.0.0.1` count
as different origins — otherwise the browser will block requests with a CORS
error. See the frontend README for the full local and Vercel setup.

## Seeded accounts

All seeded users share the password `password123`.

| Role         | Email                 |
|--------------|------------------------|
| Admin/Mentor | mentor@orbit.com      |
| Intern       | jane.smith@orbit.com  |
| Intern       | budi.t@orbit.com      |
| Intern       | nadia.a@orbit.com     |
| Intern       | farhan.h@orbit.com    |

These credentials are public (they're in this README), and the mentor account
is an admin — so **never leave them on a database that a public site uses.**
Delete the seeded users or change their passwords after seeding a deployed
database.

## Authentication

Auth uses **JWT bearer tokens**.

1. `POST /api/auth/register` or `POST /api/auth/login` returns `{ data: { user, token } }`.
2. Send that token on protected routes as a header:
```
   Authorization: Bearer <token>
```
3. Registering never lets you set your own role to `ADMIN` — every new
   account is `INTERN` by default. Promoting someone to `ADMIN` is done by
   an existing admin via `PUT /api/users/:id`.

Tokens last as long as `JWT_EXPIRES_IN` says (default `7d`).

Passwords are hashed with **bcrypt** (10 salt rounds) — plaintext
passwords are never stored, logged, or returned in any response.

## Route protection

- **Public** (no token needed): browsing courses, modules, materials, and
  quizzes — this matches the frontend's public course catalog. Quiz answers
  are hidden (see below).
- **`optionalAuth`** (a few public routes): the route works without a token,
  but if a valid one is sent the caller is identified, so the response can
  depend on who's asking. A missing, invalid, or expired token is simply
  treated as an anonymous visitor — it never causes a `401`.
- **`requireAuth`**: any logged-in user — used for things like marking a
  material complete, submitting a quiz attempt, loading a quiz to take it,
  or viewing your own profile/progress.
- **`requireAuth` + `requireRole('ADMIN')`**: mentor/admin-only actions —
  creating, updating, or deleting courses, modules, materials, quizzes,
  and questions; viewing the full user roster; managing enrollments.
- Some routes do a **self-or-admin check inside the controller** (e.g.
  `GET /api/users/:id`, `GET /api/users/:userId/progress`) — a user can
  always see their own data; only an admin can see someone else's.

### Quiz answers stay hidden from non-admins

`isCorrect` is only ever included in a response for an **admin**. Every route
a non-admin can use to read a quiz's options goes through the same serializer
(`src/utils/serializeQuiz.js`):

| Route | Access | Answers visible to |
|---|---|---|
| `GET /courses/:id` | 🔓 + `optionalAuth` | admins only |
| `GET /modules/:id` | 🔓 + `optionalAuth` | admins only |
| `GET /modules/:moduleId/quiz` | 🔓 + `optionalAuth` | admins only |
| `GET /quizzes/:id` | 🔑 | admins only |

Anonymous visitors, interns, and requests with an invalid or expired token all
get the options with `isCorrect` removed; an admin's token gets the full quiz
(the frontend's module editor relies on this). The only place an intern sees
the correct answers is the response to their own quiz attempt, which reveals
the right answer for each question after they submit.

## Quiz grading & progress

- **Grading is server-side.** `POST /api/quizzes/:quizId/attempt` takes
  `{ "answers": [{ "questionId": "...", "optionId": "..." }] }` and scores it
  against the answer key. The passing mark is **70%**. Every submission is
  saved as a `QuizAttempt` (retakes are allowed), and the response includes
  the score, percent, pass/fail, and a per-question breakdown with the
  correct answer.
- **Progress** (`GET /api/users/:userId/progress`) returns each enrolled
  course → its modules → their items. Every material and every quiz counts
  as one item toward its module's percent: a material counts once it's been
  marked complete, and a quiz counts once the user has **passed** it (the
  latest attempt is used). The response also carries per-material
  `completed` flags and per-quiz `attempted` / `passed` / `score` / `percent`
  so pages can render real state without extra requests.

## Request validation

Every write endpoint validates its request body before touching the
database, using a small custom validator (`src/utils/validators.js`) — no
external schema library needed. Invalid requests get a `400` with a
plain-English message, e.g.:

```json
{ "error": { "message": "\"email\" must be a valid email address. \"password\" must be at least 8 characters." } }
```

Quiz questions have an extra rule enforced in the controller: every
question needs 2+ options with **exactly one** marked `isCorrect`.

## Error handling

All errors funnel through one central handler (`src/middleware/errorHandler.js`),
which maps:
- App-level `ApiError`s → their attached status code (400/401/403/404/409...)
- Prisma `P2002` (unique constraint) → `409 Conflict`
- Prisma `P2025` (record not found) → `404 Not Found`
- Prisma `P2003` (foreign key violation) → `400 Bad Request`
- JWT errors (expired/malformed) → `401 Unauthorized`
- Anything unexpected → `500`, with the stack trace only in non-production

Every controller is wrapped in `asyncHandler` so a rejected promise (a
failed DB query, etc.) is forwarded here instead of crashing the process
or hanging the request.

## Data integrity

Enforced at the database level via the Prisma schema, not just app code:
- `User.email` — unique
- `Enrollment` — unique on `(userId, courseId)` — can't double-enroll
- `MaterialCompletion` — unique on `(userId, materialId)` — completing a
  material twice just no-ops (upsert) instead of creating duplicates
- `Quiz.moduleId` — unique — a module can only have one quiz
- Every child record (`Module`, `Material`, `Quiz`, `QuizQuestion`,
  `QuizOption`, `Enrollment`, `MaterialCompletion`, `QuizAttempt`) has a
  required foreign key with `onDelete: Cascade` — deleting a course cleans
  up its modules, materials, quizzes, questions, and options automatically

## API reference

Base URL: `/api`. 🔓 = public, 🔑 = requires login, 🛡️ = requires `ADMIN` role.
A few 🔓 routes accept an optional token — an admin's token unlocks the quiz
answer flags (see *Route protection*).

### Health
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/health` | 🔓 | Health check — returns `{ "status": "ok" }` |

### Auth
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | 🔓 | Create an account (always as INTERN) |
| POST | `/auth/login` | 🔓 | Log in, get a JWT |
| GET | `/auth/me` | 🔑 | Get the logged-in user's profile |

### Users
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/users` | 🛡️ | Team roster (all users + their courses) |
| GET | `/users/:id` | 🔑 self-or-admin | Get one user |
| PUT | `/users/:id` | 🔑 self-or-admin | Update profile or password (only admin can change `role`) |
| DELETE | `/users/:id` | 🛡️ | Delete a user |
| GET | `/users/:userId/enrollments` | 🔑 self-or-admin | Courses a user is enrolled in |
| GET | `/users/:userId/progress` | 🔑 self-or-admin | Per-course, per-module progress: item completion %, material completion flags, latest quiz attempt |

### Courses
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/courses` | 🔓 | List all courses (with module and enrolled counts) |
| POST | `/courses` | 🛡️ | Create a course |
| GET | `/courses/:id` | 🔓 | Get one course + its modules, materials, and quizzes (answers hidden unless admin) |
| PUT | `/courses/:id` | 🛡️ | Update a course |
| DELETE | `/courses/:id` | 🛡️ | Delete a course (cascades) |

### Modules
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/courses/:courseId/modules` | 🔓 | List modules for a course (with materials and quiz) |
| POST | `/courses/:courseId/modules` | 🛡️ | Create a module |
| GET | `/modules/:id` | 🔓 | Get one module + materials + quiz (answers hidden unless admin) |
| PUT | `/modules/:id` | 🛡️ | Update a module |
| DELETE | `/modules/:id` | 🛡️ | Delete a module (cascades) |

### Materials
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/modules/:moduleId/materials` | 🔓 | List materials for a module |
| POST | `/modules/:moduleId/materials` | 🛡️ | Add a material (document/video) |
| GET | `/materials/:id` | 🔓 | Get one material |
| PUT | `/materials/:id` | 🛡️ | Update a material |
| DELETE | `/materials/:id` | 🛡️ | Delete a material |
| POST | `/materials/:materialId/complete` | 🔑 | Mark complete for yourself |

### Quizzes & Questions
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/modules/:moduleId/quiz` | 🔓 | Get a module's quiz (answers hidden unless admin) |
| GET | `/quizzes/:id` | 🔑 | Get a quiz by id (answers hidden unless admin) |
| POST | `/modules/:moduleId/quiz` | 🛡️ | Create a module's quiz |
| PUT | `/quizzes/:id` | 🛡️ | Update quiz title |
| DELETE | `/quizzes/:id` | 🛡️ | Delete a quiz |
| POST | `/quizzes/:quizId/questions` | 🛡️ | Add a question (with options) |
| PUT | `/questions/:id` | 🛡️ | Update a question / replace its options |
| DELETE | `/questions/:id` | 🛡️ | Delete a question |
| POST | `/quizzes/:quizId/attempt` | 🔑 | Submit answers, get graded server-side (70% to pass) and record the attempt |

### Enrollments
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/enrollments` | 🛡️ | Enroll a user in a course |
| DELETE | `/enrollments/:id` | 🛡️ | Unenroll |

Request/response examples for the endpoints are in the Postman collection
(see below) — that's the easiest way to explore them. It doesn't include
`GET /quizzes/:id` yet.

## Testing with Postman

Import both files from `/postman`:
- `Orbit-LMS.postman_collection.json`
- `Orbit-LMS.postman_environment.json` ("Orbit LMS — Local", pointed at
  `http://localhost:4000/api` — select it as your active environment)

Then, with the server running:
1. Run **Auth → Login (Admin)** or **Login (Intern)** first — its test
   script automatically saves the returned token into `{{token}}`, so
   every other request in the collection picks it up automatically.
2. Work through the folders top to bottom (Users → Courses → Modules →
   Materials → Quizzes & Questions → Enrollments) — several requests save
   IDs (`{{courseId}}`, `{{moduleId}}`, etc.) into the environment for the
   next request to use, so running a folder in order chains naturally.
3. Try the "should fail" cases manually to confirm protection works: hit
   a 🛡️ endpoint after logging in as the intern (expect `403`), or with
   no `Authorization` header at all (expect `401`).

## Integration testing (automated)

```
npm run seed   # make sure seeded users/courses exist (this wipes existing data)
npm test
```

`tests/auth.test.js` and `tests/courses.test.js` use Node's built-in test
runner (`node --test`) + `supertest` to hit the real Express app in-process
against your real (seeded) database — no mocking. They cover:
- Register/login happy paths and failure cases (duplicate email, bad
  password, wrong credentials)
- `GET /auth/me` with and without a token
- A full course CRUD lifecycle (create → read → update → delete → confirm
  404 after delete)
- Route protection: no token → `401`, wrong role → `403`, bad body → `400`

Quizzes, progress, and enrollments aren't covered by automated tests yet.
The `test` script in `package.json` lists the test files explicitly, so
add any new test file there.

## Deployment

Recommended setup: **backend + PostgreSQL on Railway (or Render), frontend on
Vercel.** This backend is a long-running Express server, so it's configured
for Railway/Render (`railway.json`, `render.yaml`) rather than Vercel, which
hosts the static frontend.

The API needs a Node host and a PostgreSQL database. Every start command
below runs `prisma migrate deploy` first, so the tables are created and
updated automatically on each deploy.

### Railway

`railway.json` is already set up:
- **Build:** `npm install && npx prisma generate`
- **Start:** `npx prisma migrate deploy && node src/server.js` (restarts on
  failure, up to 3 retries)

1. Push this repo to GitHub and create a new Railway project from it.
2. Add a Postgres database (Railway's own, or an external one such as
   Neon) and set these variables on the web service: `DATABASE_URL`,
   `DIRECT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, and `NODE_ENV=production`.
   (`CLIENT_ORIGIN` comes in step 5, once the frontend has a URL.)
3. Optionally seed a **fresh, empty** database with `npm run seed` — it
   deletes existing data, so never run it against a live database with real
   users in it.
4. Point the frontend's `API_BASE_URL` (in `js/api.js`) at
   `https://<your-service>.up.railway.app/api`, then deploy the frontend to
   Vercel (see the frontend README).
5. Set `CLIENT_ORIGIN` on the Railway service to your Vercel URL — e.g.
   `https://your-project.vercel.app` (`https://`, no trailing slash, exact
   match) — and restart/redeploy the service. Until you do, the browser will
   block the frontend's requests with a CORS error.

### Render.com (alternative)

`render.yaml` is a blueprint for **Render.com**:

1. Push this repo to GitHub.
2. In Render, choose **New → Blueprint**, point it at the repo — it reads
   `render.yaml` and provisions both the Postgres database and the web
   service automatically, wiring `DATABASE_URL` between them for you.
3. Once deployed, you can run the seed script once against the new,
   empty database (Render's **Shell** tab on the web service, or run it
   locally with `DATABASE_URL` temporarily pointed at it):
```
   npm run seed
```
   Remember it wipes existing data, so only do this on a fresh database.
4. Update `CLIENT_ORIGIN` in the Render dashboard to your Vercel URL (it
   defaults to `*` in `render.yaml`, which works for testing but should be
   tightened for a real deployment).
5. Your API is now live at `https://<your-service-name>.onrender.com/api`.

The same setup adapts easily to Fly.io or Heroku (see the `Procfile`).

## Known limitations & next steps

Known limitations:
- **`CLIENT_ORIGIN` allows a single origin.** Vercel's preview deployments
  (one URL per branch/PR) are different origins, so they can't call the API
  unless `CLIENT_ORIGIN` is set to that URL — and a production URL and a
  custom domain can't both be allowed at once.

Natural next steps:
- File upload handling for materials (currently a `url` string field —
  wiring up real uploads, e.g. via `multer` + cloud storage, is the next
  step for the "upload reading materials/videos" feature on the frontend)
- Pagination/filtering on list endpoints
- Rate limiting on `/auth/login` to slow down brute-force attempts
- Refresh tokens (current JWTs are long-lived and can't be revoked before
  they expire)