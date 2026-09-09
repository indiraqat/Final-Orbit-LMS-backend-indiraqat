# Orbit LMS — Backend

Backend API for the Orbit LMS coursework project. Built with **Express**,
**PostgreSQL**, and **Prisma**.

## Folder structure

```
orbit-lms-backend/
├── prisma/
│   ├── schema.prisma        # database schema (source of truth)
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
│   │   ├── auth.js          # requireAuth (JWT) + requireRole (route protection)
│   │   └── validate.js      # validateBody(schema) request validation
│   ├── utils/
│   │   ├── jwt.js           # sign/verify JWTs
│   │   └── validators.js    # small schema-based validator (no external lib)
│   ├── routes/               # one router per resource, mounted under /api
│   ├── app.js                # Express app (middleware + routes)
│   └── server.js             # entry point
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
   Fill in `DATABASE_URL` (your Postgres connection string) and set
   `JWT_SECRET` to any long random string.

3. **Create the database tables:**
   ```
   npx prisma migrate dev --name init
   ```

4. **Seed mock data:**
   ```
   npm run seed
   ```

5. **Start the server:**
   ```
   npm run dev
   ```
   API runs at `http://localhost:4000` by default.

## Seeded accounts

All seeded users share the password `password123`.

| Role         | Email                 |
|--------------|------------------------|
| Admin/Mentor | mentor@orbit.com      |
| Intern       | jane.smith@orbit.com  |
| Intern       | budi.t@orbit.com      |
| Intern       | nadia.a@orbit.com     |
| Intern       | farhan.h@orbit.com    |

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

Passwords are hashed with **bcrypt** (10 salt rounds) — plaintext
passwords are never stored, logged, or returned in any response.

## Route protection

- **Public** (no token needed): browsing courses, modules, materials, and
  quiz questions (without answers) — this matches the frontend's public
  course catalog.
- **`requireAuth`**: any logged-in user — used for things like marking a
  material complete, submitting a quiz attempt, or viewing your own
  profile/progress.
- **`requireAuth` + `requireRole('ADMIN')`**: mentor/admin-only actions —
  creating, updating, or deleting courses, modules, materials, quizzes,
  and questions; viewing the full user roster; managing enrollments.
- Some routes do a **self-or-admin check inside the controller** (e.g.
  `GET /api/users/:id`, `GET /api/users/:userId/progress`) — a user can
  always see their own data; only an admin can see someone else's.

Quiz responses are also **role-aware**: `GET /api/modules/:moduleId/quiz`
strips `isCorrect` from every option unless the caller is an admin, so an
intern taking the quiz never receives the answer key.

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
| PUT | `/users/:id` | 🔑 self-or-admin | Update profile (only admin can change `role`) |
| DELETE | `/users/:id` | 🛡️ | Delete a user |
| GET | `/users/:userId/enrollments` | 🔑 self-or-admin | Courses a user is enrolled in |
| GET | `/users/:userId/progress` | 🔑 self-or-admin | Per-course, per-module item completion % |

### Courses
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/courses` | 🔓 | List all courses |
| POST | `/courses` | 🛡️ | Create a course |
| GET | `/courses/:id` | 🔓 | Get one course + its modules |
| PUT | `/courses/:id` | 🛡️ | Update a course |
| DELETE | `/courses/:id` | 🛡️ | Delete a course (cascades) |

### Modules
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/courses/:courseId/modules` | 🔓 | List modules for a course |
| POST | `/courses/:courseId/modules` | 🛡️ | Create a module |
| GET | `/modules/:id` | 🔓 | Get one module + materials + quiz |
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
| POST | `/modules/:moduleId/quiz` | 🛡️ | Create a module's quiz |
| PUT | `/quizzes/:id` | 🛡️ | Update quiz title |
| DELETE | `/quizzes/:id` | 🛡️ | Delete a quiz |
| POST | `/quizzes/:quizId/questions` | 🛡️ | Add a question (with options) |
| PUT | `/questions/:id` | 🛡️ | Update a question / replace its options |
| DELETE | `/questions/:id` | 🛡️ | Delete a question |
| POST | `/quizzes/:quizId/attempt` | 🔑 | Submit answers, get graded server-side |

### Enrollments
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/enrollments` | 🛡️ | Enroll a user in a course |
| DELETE | `/enrollments/:id` | 🛡️ | Unenroll |

Full request/response bodies and examples for every endpoint are in the
Postman collection (see below) — that's the easiest way to explore them.

## Testing with Postman

Import both files from `/postman`:
- `Orbit-LMS.postman_collection.json`
- `Orbit-LMS.postman_environment.json` (select it as your active environment)

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
npm run seed   # make sure seeded users/courses exist
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

## Deployment

These files are ready for **Render.com** (a common free option for a
Node + Postgres coursework project):

1. Push this repo to GitHub.
2. In Render, choose **New → Blueprint**, point it at the repo — it reads
   `render.yaml` and provisions both the Postgres database and the web
   service automatically, wiring `DATABASE_URL` between them for you.
3. Once deployed, run the seed script once against the live database
   (Render's **Shell** tab on the web service, or run it locally with
   `DATABASE_URL` temporarily pointed at the live database):
   ```
   npm run seed
   ```
4. Update `CLIENT_ORIGIN` in the Render dashboard to your deployed
   frontend's actual URL (it defaults to `*` in `render.yaml`, which
   works for testing but should be tightened for a real deployment).
5. Your API is now live at `https://<your-service-name>.onrender.com/api`.

No Postgres server or Render/Heroku account is available in the
environment I build in, so I can't complete an actual live deployment for
you — but everything above (`render.yaml`, the `Procfile`, `prisma migrate
deploy` in the start command, `PORT`/`DATABASE_URL` read from environment
variables) is already deployment-ready. The same `render.yaml` shape
adapts easily to Railway or Fly.io if you'd rather use one of those.

## Still not built

Everything requested for this phase is covered. Natural next steps beyond
it:
- File upload handling for materials (currently a `url` string field —
  wiring up real uploads, e.g. via `multer` + cloud storage, is the next
  step for the "upload reading materials/videos" feature on the frontend)
- Pagination/filtering on list endpoints
- Rate limiting on `/auth/login` to slow down brute-force attempts
- Refresh tokens (current JWTs are long-lived and can't be revoked before
  they expire)
