# User Manual: TypeScript Bun Starter (TBS)

> End-user documentation for the TypeScript Bun Starter CLI and API.

## 1. Quick Start

### 1.1 Installation

**From source:**

```bash
git clone <repo-url> && cd typescript-bun-starter
bun install
bun run bootstrap -- --name my-project --scope @acme --title "My Project"
```

**From compiled binary:**

Download the binary for your platform and place it on your `PATH`:

```bash
chmod +x tbs
./tbs --help
```

### 1.2 First Commands

Before you start adding domain logic, bootstrap the spawned project identity:

```bash
bun run bootstrap -- --name my-project --scope @acme --title "My Project"
```

This rewrites package names, internal imports, generated instruction files, CLI
metadata, and starter-facing copy from the default starter identity.

```bash
# Create a skill
bun run dev:cli -- skill create --name "my-skill" --description "My first skill"

# List all skills
bun run dev:cli -- skill list

# Get a specific skill
bun run dev:cli -- skill get --id <skill-id>

# Delete a skill
bun run dev:cli -- skill delete --id <skill-id>
```

## 2. CLI Reference

The CLI binary is named `tbs` (TypeScript Bun Starter). Run it via:

```bash
# Development
bun run dev:cli -- <command>

# Compiled binary
./tbs <command>
```

### 2.1 Global Options

| Option | Description |
|--------|-------------|
| `--help` | Show help for any command |

### 2.2 Commands

#### `skill create`

Create a new skill.

```bash
tbs skill create --name <name> [--description <desc>] [--json]
tbs skill create                    # prompts for missing values in human mode
```

| Option | Required | Description |
|--------|----------|-------------|
| `--name` | No in human mode / Yes in `--json` mode | Skill name (1-100 characters) |
| `--description` | No | Skill description |
| `--json` | No | Output as JSON (for scripts and AI agents) |

**Human mode output:**

```
Created skill: my-skill (abc-123-def-456)
```

If `--name` or `--description` is omitted in human mode, the CLI prompts for it interactively.

**JSON mode output (`--json`):**

```json
{
  "id": "abc-123-def-456",
  "name": "my-skill",
  "description": "A skill description",
  "version": 1,
  "config": null,
  "createdAt": "2026-04-10T00:00:00.000Z",
  "updatedAt": "2026-04-10T00:00:00.000Z"
}
```

**Error (missing name in `--json` mode):**

```
# Human mode (stderr):
Error: skill name is required

# JSON mode (stdout):
{"error":"--name is required"}
```

---

#### `skill list`

List all skills.

```bash
tbs skill list [--json]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--json` | No | Output as JSON |

**Human mode output:**

```
my-skill (abc-123)
  Description: A skill description
  Version: 1
  Updated: 2026-04-10

another-skill (def-456)
  Version: 1
  Updated: 2026-04-10
```

**JSON mode output (`--json`):**

Returns an array of skill objects:

```json
[
  {
    "id": "abc-123",
    "name": "my-skill",
    "description": "A skill description",
    "version": 1,
    "config": null,
    "createdAt": "2026-04-10T00:00:00.000Z",
    "updatedAt": "2026-04-10T00:00:00.000Z"
  }
]
```

---

#### `skill get`

Get a single skill by ID.

```bash
tbs skill get --id <id> [--json]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--id` | Yes | Skill ID |
| `--json` | No | Output as JSON |

**Human mode output:**

```
Skill: my-skill
  ID: abc-123
  Description: A skill description
  Version: 1
  Config: null
  Created: 2026-04-10
  Updated: 2026-04-10
```

**JSON mode output (`--json`):**

Returns a single skill object (same format as `skill create`).

**Error (not found):**

```
# Human mode (stderr):
Error: Skill not found: nonexistent-id

# JSON mode (stdout):
{"error":"Skill not found: nonexistent-id"}
```

---

#### `skill delete`

Delete a skill by ID.

```bash
tbs skill delete --id <id> [--json]
tbs skill delete                    # prompts for ID and confirmation in human mode
```

| Option | Required | Description |
|--------|----------|-------------|
| `--id` | No in human mode / Yes in `--json` mode | Skill ID |
| `--json` | No | Output as JSON |

**Human mode output:**

```
Deleted skill: abc-123
```

In human mode, the CLI asks for confirmation before deleting. Cancelled deletions print:

```
Deletion cancelled.
```

**JSON mode output (`--json`):**

```json
{"deleted":true,"id":"abc-123"}
```

**Error (missing ID):**

```json
{"error":"--id is required"}
```

**Error (not found):**

```json
{"error":"Skill not found: nonexistent-id"}
```

### 2.3 Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error (validation, not found, etc.) |

### 2.4 Agent Mode

All commands support `--json` for machine-readable output. This is designed for:

- **AI agents** consuming output programmatically
- **Shell scripts** piping data between commands
- **CI/CD pipelines** integrating skill management

```bash
# Create and capture the ID
SKILL=$(tbs skill create --name "deploy" --json)
ID=$(echo "$SKILL" | jq -r '.id')

# Use the ID in another command
tbs skill get --id "$ID" --json

# Clean up
tbs skill delete --id "$ID" --json
```

## 3. API Reference

### 3.1 Starting the Server

```bash
# Development (with hot reload)
bun run dev:server

# Production
bun run apps/server/src/index.ts
```

The server starts on port 3000 by default. Override with the `PORT` environment variable.

### 3.2 Authentication

When the `API_KEY` environment variable is set, all `/api/*` endpoints require authentication:

```
API_KEY=sk-your-secret-key
```

**If `API_KEY` is not set**, authentication is skipped (dev mode).

Provide the API key via one of two methods:

| Method | Header | Example |
|--------|--------|---------|
| HTTP header | `X-API-Key` | `curl -H "X-API-Key: sk-your-secret-key" http://localhost:3000/api/skills` |

### 3.3 Endpoints

#### `GET /api/skills`

List all skills.

```bash
curl http://localhost:3000/api/skills
```

**Response (200):**

```json
{
  "data": [
    {
      "id": "abc-123",
      "name": "web-search",
      "description": "Search the web",
      "version": 1,
      "config": null,
      "createdAt": "2026-04-10T00:00:00.000Z",
      "updatedAt": "2026-04-10T00:00:00.000Z"
    }
  ]
}
```

---

#### `POST /api/skills`

Create a new skill.

```bash
curl -X POST http://localhost:3000/api/skills \
  -H "Content-Type: application/json" \
  -d '{"name": "web-search", "description": "Search the web"}'
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Skill name (1-100 characters) |
| `description` | string | No | Skill description |
| `config` | unknown | No | Skill configuration (JSON object) |

**Response (201):**

```json
{
  "data": {
    "id": "abc-123",
    "name": "web-search",
    "description": "Search the web",
    "version": 1,
    "config": null,
    "createdAt": "2026-04-10T00:00:00.000Z",
    "updatedAt": "2026-04-10T00:00:00.000Z"
  }
}
```

**Response (400):**

```json
{"error":"Validation error details"}
```

---

#### `GET /api/skills/:id`

Get a skill by ID.

```bash
curl http://localhost:3000/api/skills/abc-123
```

**Response (200):**

```json
{
  "data": {
    "id": "abc-123",
    "name": "web-search",
    "description": "Search the web",
    "version": 1,
    "config": null,
    "createdAt": "2026-04-10T00:00:00.000Z",
    "updatedAt": "2026-04-10T00:00:00.000Z"
  }
}
```

**Response (404):**

```json
{"error":"Skill not found: nonexistent"}
```

---

#### `DELETE /api/skills/:id`

Delete a skill by ID.

```bash
curl -X DELETE http://localhost:3000/api/skills/abc-123
```

**Response (200):**

```json
{"data":null}
```

**Response (404):**

```json
{"error":"Skill not found: nonexistent"}
```

### 3.4 OpenAPI Documentation

Interactive API documentation is available when the server is running:

| URL | Description |
|-----|-------------|
| `http://localhost:3000/doc` | OpenAPI 3.0 JSON specification |
| `http://localhost:3000/swagger` | Swagger UI (interactive) |

The OpenAPI spec can be used directly with tools like:
- **OpenAI Actions** -- connect as a custom action
- **Claude MCP** -- use as a tool definition
- **Postman** -- import the spec
- **curl/httpie** -- reference for request formats

### 3.5 Health Check

```bash
curl http://localhost:3000/
```

**Response (200):**

```json
{"status":"ok"}
```

## 4. Configuration

### 4.1 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `data/app.db` | SQLite databtbs file path |
| `API_KEY` | *(none)* | API authentication key. If unset, auth is disabled |
| `PORT` | `3000` | Server listen port |
| `LOG_LEVEL` | `info` | Logging verbosity |

### 4.2 Databtbs

The default databtbs is a SQLite file at `data/app.db`. It is created automatically on first use.

```bash
# Use a custom databtbs path
DATABASE_URL=/path/to/custom.db bun run dev:cli -- skill list

# Push schema changes (after code changes)
bun run db:push
```

The `data/` directory is gitignored -- the databtbs is not committed to version control.

## 5. Deployment

### 5.1 CLI Binary

Compile to a standalone binary:

```bash
bun run build:cli
# Output: dist/tbs (or dist/tbs.exe on Windows)
```

Cross-compile for other platforms:

```bash
bun build --compile --target=bun-linux-x64 apps/cli/src/index.ts --outfile dist/tbs-linux
bun build --compile --target=bun-darwin-arm64 apps/cli/src/index.ts --outfile dist/tbs-macos
```

The binary includes the Bun runtime -- no installation required on the target machine.

### 5.2 API Server (Docker)

```dockerfile
FROM oven/bun:1
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
RUN bun install --frozen-lockfile --production

COPY packages/contracts packages/contracts
COPY packages/core packages/core
COPY apps/server apps/server

EXPOSE 3000
CMD ["bun", "run", "apps/server/src/index.ts"]
```

```bash
docker build -t typescript-bun-starter .
docker run -p 3000:3000 -e API_KEY=sk-secret typescript-bun-starter
```

### 5.3 Cloudflare Workers (D1)

For edge deployment using Cloudflare D1:

1. Configure `wrangler.json` with D1 bindings.
2. Generate migrations: `bun run db:generate`
3. Apply migrations: `wrangler d1 migrations apply <DB_NAME> --remote`
4. Deploy: `wrangler deploy`

## 6. Skill Data Model

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Auto-generated unique identifier |
| `name` | string | Skill name (1-100 characters) |
| `description` | string or null | Optional description |
| `version` | number | Schema version (starts at 1) |
| `config` | any (JSON) or null | Skill-specific configuration |
| `createdAt` | ISO 8601 date | Creation timestamp |
| `updatedAt` | ISO 8601 date | Last update timestamp |

## 7. Troubleshooting

### `Error: --name is required`

This only applies in `--json` mode. In human mode, `skill create` prompts for the missing name. For JSON/script usage, provide it explicitly:

```bash
tbs skill create --name "my-skill"
```

### `Skill not found: <id>`

The skill ID does not exist. Check with `skill list` to see available IDs.

### `{"error":"Unauthorized"}`

The `API_KEY` environment variable is set but you did not provide a valid key. Either:
- Pass the key: `curl -H "X-API-Key: your-key" ...`
- Or unset `API_KEY` for local development (auth is disabled when not set).

### Database not found / empty

The database is created automatically on first use. If skills are missing, check:
- `DATABASE_URL` points to the correct file
- Run `bun run db:push` to ensure the schema is up to date
