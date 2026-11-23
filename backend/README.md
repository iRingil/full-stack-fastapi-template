# FastAPI Project - Backend

> **Note:** This project is an architectural refactoring of the original project [fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template).

The backend is a [FastAPI](https://fastapi.tiangolo.com) application with asynchronous access to PostgreSQL, written
as classes with explicit dependencies: every layer gets what it needs through its constructor or FastAPI's DI, so
each class can be tested on its own.

## Stack

- **FastAPI** + **Uvicorn** — the API under `/api/v1`; the docs (`/docs`) only with `ENVIRONMENT=local`.
- **SQLModel** + **SQLAlchemy 2** (asyncpg) — table models and their Create/Update/Public schemas in `app/models.py`.
- **Alembic** — database migrations in `src/migrations/`.
- **pydantic-settings** — settings from the environment and `src/.env`, in groups with strict types.
- **PyJWT** + **bcrypt** — access tokens and password hashes.
- **fastapi-mail** + **Jinja2** — emails from templates, HTML with a plain-text alternative.
- **loguru** — one line per log record, exceptions included.
- **pytest** against a real PostgreSQL; **Ruff** — lint and format; **basedpyright** — types.

## Architecture

```
src/app/
├── main.py              # app = AppFactory().app
├── app_factory.py       # AppFactory: logging, lifespan (database connect/close), middleware, routers
├── api/
│   ├── main.py          # MainRouter: every router under /api/v1; `private` only with ENVIRONMENT=local
│   ├── deps.py          # All FastAPI dependencies: provider classes + Annotated aliases
│   └── routes/          # Class-based views: login, users, items, utils, private
├── crud/                # Repositories: BaseCRUD + UserCRUD, ItemCRUD
├── core/                # Settings, database, security, emails, logging, middleware
├── models.py            # SQLModel tables and API schemas
├── initial_data.py      # Creates the first superuser
└── email-templates/     # base.html + a .html/.txt pair per letter
```

- **Routes** are class-based views (`fastapi_utils.cbv`): the dependencies shared by the endpoints — the current
  user, the CRUD instance — are typed parameters of `__init__`. Routes never touch the session or write queries.
- **Dependencies** live only in `api/deps.py`. The non-trivial ones are callable provider classes, exported as
  `Annotated` aliases:

  ```python
  class UserCRUDProvider:
      def __call__(self, session: SessionDep) -> UserCRUD:
          return UserCRUD(session=session)

  UserCrudDep = Annotated[UserCRUD, Depends(UserCRUDProvider())]
  ```

  `CurrentUser` requires a token, `OptionalCurrentUser` returns `None` for an anonymous visitor.
- **Repositories** (`crud/`): `BaseCRUD[Model, Create, Update, Public, PublicList]` gives reads by id, a page with
  its total in one query, partial updates, deletes through the ORM (cascades run in the same transaction) and bulk
  inserts with `ON CONFLICT DO NOTHING`; the subclasses add their own (password hashing, items of an owner).
- **Infrastructure** (`core/`): `DatabaseManager`, `SecurityManager`, `EmailManager` get their dependencies in the
  constructor; a getter with `@lru_cache(maxsize=1)` builds the single instance:

  ```python
  @lru_cache(maxsize=1)
  def get_db_manager() -> DatabaseManager:
      return DatabaseManager(settings=get_settings())
  ```

- **Operation IDs** are `{first tag}-{route name}`; they become the method names of the frontend's generated client,
  so name routes with care.

### Security

- A token carries the user's `token_version`: logout, a new password and a password reset increase it and so revoke
  every token issued before, links in emails included. Any token that does not give an active user is 401.
- Email tokens carry a `purpose`: a password-reset token cannot confirm an email and vice versa.
- Passwords: bcrypt; longer than 72 bytes or from the list of common passwords — rejected, not truncated.
- Sign-up and password recovery answer the same for a known and an unknown email; changing your own email requires
  the current password.
- Rate limits per client IP (login, sign-up, password recovery, resending the email) and a counter of failed logins
  per account, both in the memory of the process: run **one** Uvicorn process, behind nginx with `--proxy-headers`.

### Logging

Every line is `module:Class.method:line | message`. There are no tracebacks: an exception — from the project,
Uvicorn, asyncio or the standard `logging` — becomes one line «type: first line of the message (place in the
project's code)»; SQLAlchemy errors keep the driver's message without the SQL and its parameters. The log is written
to `src/logs/<project name>.log`.

## Getting started

Requirements: Python 3.13, PostgreSQL; an SMTP server is optional in development.

```bash
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r src/requirements.txt
cp src/.env.example src/.env         # fill it in, see below
cd src
alembic upgrade head                 # create the tables
python -m app.initial_data           # create the first superuser
uvicorn app.main:app --reload --log-config log_config.yaml   # http://127.0.0.1:8000, docs at /docs
```

## Configuration

Settings come from the environment and `src/.env` (the environment wins). In `src/.env.example` the empty variables
are required and the commented ones show their defaults:

| Group      | Variables                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------- |
| Required   | `PROJECT_NAME`, `ENVIRONMENT` (`local`, `staging`, `production`), `SECRET_KEY`                 |
| Superuser  | `FIRST_SUPERUSER` (email), `FIRST_SUPERUSER_PASSWORD`                                          |
| PostgreSQL | `POSTGRES_SERVER`, `POSTGRES_USER`, `POSTGRES_DB`; `POSTGRES_PASSWORD`, `POSTGRES_PORT`, `POSTGRES_SOCKET` |
| Frontend   | `FRONTEND_HOST` (`http://localhost:5173`) — the links in emails and CORS; `BACKEND_CORS_ORIGINS` |
| Tokens     | `ACCESS_TOKEN_EXPIRE_MINUTES`, `EMAIL_RESET_TOKEN_EXPIRE_HOURS`, `EMAIL_VERIFY_TOKEN_EXPIRE_HOURS` |
| Emails     | `SMTP_*`, `EMAILS_FROM_EMAIL`, `EMAILS_FROM_NAME` — sent only when `SMTP_HOST` and `EMAILS_FROM_EMAIL` are set |

Generate the key with `python -c "import secrets; print(secrets.token_urlsafe(32))"`.

## Migrations

Every change of the tables in `app/models.py` needs a migration (from `src/`):

```bash
alembic revision --autogenerate -m "add item price"
alembic upgrade head
```

Read the generated file before committing it: a renamed column comes out as a drop and an add, and data changes are
added by hand (`op.execute`). The generated file is already clean for Ruff and basedpyright. A test applies the
migrations to an empty database, runs `alembic check` (a model changed without a migration fails it), rolls them back
and checks the offline mode (`--sql`).

## Tests and checks

```bash
pip install -r src/requirements-dev.txt
pytest -c pyproject.toml tests --cov     # fails below 100% of the lines and branches of src
ruff check src tests && ruff format --check src tests
basedpyright
```

- The tests mirror `src/app/` one to one and run against a real PostgreSQL — nothing in SQL is mocked:
  `127.0.0.1:5432`, database `test_db`, user `test_user` / `test_password`, schema `test_schema`. CI starts it as a
  service container (`.github/workflows/pytest.yml`).
- `tests/conftest.py` sets the settings through the environment (the local `src/.env` is not read), creates the tables
  for every test and gives the fixtures: `client` (the real application), `create_user` / `create_item`,
  `auth_headers`, `outbox` (the emails, never sent), `log_messages`.
- Ruff runs with `select = ["ALL"]`, basedpyright in the `all` mode; Ruff, basedpyright and pip-audit are installed
  globally, their versions are pinned in `.github/workflows/lint.yml`.

## Deployment

`infrastructure/systemd/app-backend.service` holds the installation steps in its header. In short: a virtual environment
in `/opt/app/backend/.venv`, `src/.env` with `ENVIRONMENT=production`, then the service runs as the user `app`,
applies new migrations on every start and serves one Uvicorn process on `127.0.0.1:8000` with `--proxy-headers`.
nginx (`infrastructure/nginx/app.conf`) stands in front of the Next.js server, which is the only client of the
backend; the log is rotated by `infrastructure/logrotate/app`.

## Original Features

Registration, CRUD of users and items and password recovery come from the original project; see
[its README](https://github.com/fastapi/full-stack-fastapi-template/blob/master/README.md).
