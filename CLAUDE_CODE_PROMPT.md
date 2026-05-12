# Aglaea Implementation Briefing

> Paste this into Claude Code (or feed into OMC deep-interview) as the project kickoff prompt.

---

## Your task

You are implementing **Aglaea v0.1**, a personal SRE & monitoring platform. The maintainer is `@lushuyu` (Shuyu, NUS CS PhD). The repository is at `https://github.com/lushuyu/Aglaea`.

**Do not write any code in this first pass.** Your job in this session is to:

1. Load all context (§A below)
2. Generate a structured interview that pins down every implementation decision SPEC.md leaves ambiguous (§B)
3. After the interview, produce a phased implementation plan (§C)

Only after the maintainer acknowledges the plan should you proceed to code.

---

## §A. Context loading (read in this order)

1. **`/SPEC.md`** in the Aglaea repository. This is the authoritative design contract. Treat its decisions as final unless the maintainer explicitly overrides one. Pay particular attention to:
   - §5 Data model (full SQL schema)
   - §6 API routes (three categories with auth model)
   - §7 Background workers (incident detector, pull prober, report generator)
   - §8 Public/private boundary table
   - §9 Security hardening (every item is non-negotiable)
   - §11–§12 Cerydra and Hyacine integration

2. **`/docs/design/`** — Claude Design's frontend output. This is the visual contract for the frontend. Follow its design tokens (colors, typography, spacing, components) and screen layouts. Adapt the data shapes in §3 of the design brief to what SPEC.md §5–§6 actually exposes.

3. **Cerydra source code** — locate at `~/cerydra` or wherever it sits under `~`:
   ```bash
   find ~ -maxdepth 4 -name cerydra -type d 2>/dev/null
   ```
   Read everything relevant to status reporting. Especially:
   - The `/doctor` slash command implementation and its output structure
   - Existing subcheck components: Jin10 MCP, moomoo OpenD, DeepSeek API, Discord
   - `.env` structure (you will read the variable names; the `DEEPSEEK_API_KEY` value will be reused for Aglaea — see constraint below)
   - Any existing webhook or reporting code

4. **Hyacine source code** — locate similarly:
   ```bash
   find ~ -maxdepth 4 -name hyacine -type d 2>/dev/null
   ```
   Hyacine is a **public open-source repository**. Read:
   - Process state representation, Claude headless availability checks
   - Email generation and report sending state (counts, timestamps)
   - Existing configuration patterns
   - Anything that hints at what status fields would be valuable

5. **Repository state** — `git status`, `git log`, existing files. The repo was just created so likely close to empty.

---

## §B. Deep-interview targets

After loading context, produce clarifying questions in **batches of 3–5**, prioritized by which decisions unlock the most downstream work. Wait for the maintainer's answers before continuing to the next batch.

Topics that must be covered (not exhaustive):

### Library and tooling
- Python version (3.12? 3.13?), FastAPI version, Pydantic v2 confirmation
- Database driver: asyncpg vs psycopg3
- ORM: SQLAlchemy 2.x async vs raw asyncpg + Pydantic
- Migration tool: Alembic config (autogenerate? scripted?)
- Test framework: pytest + httpx async client
- Linting/formatting: ruff + ruff format? mypy strictness?
- Dependency management: uv? Poetry? pip-tools?
- Frontend: Next.js version, App Router (recommended) vs Pages Router
- TypeScript strictness level
- Styling: Tailwind only, or shadcn/ui on top
- Frontend state: SWR vs TanStack Query vs plain fetch + React state

### Architecture details
- Background worker execution: in-process asyncio tasks vs separate worker container
- Whether incident detector / pull prober / report generator should be one worker or three
- DeepSeek client: official SDK availability vs raw httpx
- DeepSeek prompt caching: explicit cache control headers or rely on automatic
- Session storage: in-memory (single-process), Redis, or cookie-based JWT
- Whether to add Redis to the stack (Cipher uses it; Aglaea v0.1 may not need it)

### Cerydra integration specifics
- The exact subcheck field names you observed in `/doctor` (confirm against SPEC.md §11)
- Whether `/doctor` returns structured JSON or human-readable text (parsing implication)
- Whether Cerydra has an existing async event loop you can hook into for the reporter
- Whether to add the reporter as a new module or extend an existing one

### Hyacine integration specifics
- Field set for `webhook_reporter` based on Hyacine's actual state (SPEC.md §12 list is provisional)
- Whether Hyacine's mainline already has any reporter/webhook infrastructure
- Open-source license check before submitting a PR-style change
- Whether the maintainer will commit changes themselves or wants you to push to a fork

### Frontend rendering of subchecks
- The Claude Design output: does it handle 0 / 1 / 4 / 10+ subcheck scenarios?
- If not, propose a fallback rendering
- The Cerydra `/doctor` display optimization noted as a v1.x improvement — defer or include

### Deployment specifics
- nginx config: existing `sites-available` layout maintainer uses
- TLS certificate management: Let's Encrypt via certbot? acme.sh? manual?
- nginx reload procedure (graceful vs hot reload)
- Frontend deployment: Next.js standalone build in Docker, or external (Vercel etc.)
- Container registry: build locally on VPS, or push from CI

### Operational
- Logging format: JSON structured to stdout (12-factor) vs files
- Log aggregation: rely on `docker logs` for v1 or ship to a service
- Error tracking: Sentry account exists? skip for v1?
- Monitoring of Aglaea itself: simple healthcheck endpoint + healthchecks.io ping?
- Backup of Postgres: SPEC says explicitly NO for v1 — confirm

### Bootstrap end-to-end
- Walk through cold-start from `git clone` on a fresh VPS to first admin login. Identify any step that requires manual intervention; flag whether it should be automated.

### Any ambiguity in SPEC.md
- List every place where SPEC.md left a decision implicit or open
- Flag every internal inconsistency you find

---

## §C. Implementation plan format

Once the interview converges, produce a phased plan. Suggested phases:

- **Phase 0** — repo scaffolding: `pyproject.toml`, `package.json`, `docker-compose.yml`, Alembic init, `.env.example`, `.gitignore`, CI skeleton (if any)
- **Phase 1** — database & migrations: implement schema from SPEC.md §5, Alembic migrations, basic seed script
- **Phase 2** — backend auth & security: GitHub OAuth, session middleware, bearer token auth, HMAC validation, audit logging
- **Phase 3** — service registry & heartbeat ingest: full CRUD for `services`, `api_keys`, `POST /api/v1/heartbeat`, audit on all auth failures
- **Phase 4** — workers: incident detector, pull prober (with cert expiry check), report generator (DeepSeek integration with allowlist enforcement)
- **Phase 5** — read APIs: public read endpoints (with PromQL hardcoded, host_name stripping), admin read endpoints, audit log API
- **Phase 6** — frontend: implement design output against APIs from phases 3–5, both public and admin route trees
- **Phase 7** — infrastructure: docker-compose finalization, nginx config snippet, otelcol config, ufw rules, bootstrap script
- **Phase 8** — integration: Cerydra reporter module, Hyacine open-source `webhook_reporter` PR, OTel device-side configuration docs
- **Phase 9** — hardening verification: walk the §13 checklist in SPEC.md, fix gaps

Each phase should be independently testable. Where phase ordering can be parallelized, note it.

---

## §D. Non-negotiable constraints

Enforce throughout regardless of phase:

1. **No Cipher integration.** Cipher is explicitly out of scope for v0.1. Do not add Cipher-related code, hooks, or documentation.
2. **No hardcoded Postgres password.** Generated at deploy time, lives in `.env` only.
3. **No service ports exposed to the host** except via nginx. Postgres (5432), VictoriaMetrics (8428), and OTel Collector (4317/4318) are docker-internal only.
4. **`.env` is chmod 600 and gitignored.** Provide `.env.example` with empty values.
5. **DeepSeek API key reuse from Cerydra**: copy the value manually or via `cp` of the env file. **Do not `cat`, `grep`, or otherwise display the key value.** This is a workflow constraint, not just a code constraint.
6. **Aglaea references must never appear in committed Hyacine source code.** Hyacine is public; the reporter module is generic-named, the Aglaea endpoint and token are private deployment config only.
7. **Bearer tokens** stored as argon2id hashes; plaintext returned exactly once at generation via the UI modal.
8. **Public API endpoints** must aggregate away `host.name`. The query strings are hardcoded server-side, not user-controlled.
9. **LLM context allowlist** is enforced at the data-assembly layer in `backend/aglaea/llm/context.py`. The allowlist is the only path from DB to LLM prompt — prompt templates cannot reference DB fields directly.
10. **Existing healthchecks.io and ntfy monitoring remain authoritative for critical alerting.** Aglaea is purely additive for visualization and historical record. Do not replicate or replace these.
11. **No fallback to default credentials anywhere.** A previous server of the maintainer's was hijacked for crypto mining due to default Postgres credentials. Treat this as a permanent rule.

---

## §E. Maintainer communication preferences

- **Conclusions first**: state your judgment, then the reasoning
- **Direct, structured, technical** — no fluff, no excessive caveats, no praise
- **Push back** on requests that introduce overengineering, scope creep, or premature optimization
- **Surface design holes and edge cases** proactively rather than after they bite
- **Chinese** for casual conversation, **English** for code identifiers, comments, docs
- **C++** (if any incidental snippet) defaults to C++98-compatible style
- **No mixing**: when given explicit source material to work from (like SPEC.md), work strictly from it. Don't pull in unrelated context.

---

## §F. Output expectations for this session

End this first session with:

1. ✅ Confirmation that you've read SPEC.md, the design output, and located + read Cerydra and Hyacine source
2. ✅ A bulleted list of every section of SPEC.md you found ambiguous or internally inconsistent
3. ✅ Batch 1 of interview questions (3–5 highest-priority items)
4. ✅ Brief preview of subsequent question batches by topic, so the maintainer sees the road ahead

**Do not write any code, scaffold any files, or run any build commands in this session.**

Begin.
