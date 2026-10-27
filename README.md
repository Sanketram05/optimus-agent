# Optimus — AI Agent Workspace

> Build focused AI agents, connect the tools they need, and turn a prompt into completed work.

**Optimus** is a full-stack AI agent workspace built as a portfolio project. Users can sign in with Google or GitHub, create dedicated agents, connect services such as Slack through Composio, conduct browser-based research in an isolated desktop, and schedule recurring routines.

## GitHub description

**A full-stack AI agent workspace with OAuth, tool integrations, browser research, scheduled routines, and persistent agent chat.**

## What it does

- Creates dedicated AI agents with a custom name, role, avatar, and activity state.
- Uses Google or GitHub OAuth for authentication.
- Gives each user a private workspace and agent dashboard.
- Lets agents use connected third-party tools through Composio.
- Keeps connected-tool writes, for example posting to Slack, inside the integration layer.
- Uses an isolated E2B desktop only for standalone, read-only browser research.
- Stores agent conversations for three days.
- Supports scheduled and recurring routines through Inngest.
- Provides a tool marketplace and per-agent tool enablement.
- Allows users to pause, resume, or delete agents and their associated data.

## Architecture

~~~text
┌─────────────────────────────────────────────────────────────┐
│                         Next.js 16 UI                        │
│ Landing · OAuth · Workspace · Agent Chat · Tool Marketplace │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                      Next.js Route Handlers                 │
│ Agent CRUD · Chat · Routines · Tool Connections · VM API    │
└───────┬──────────────────┬──────────────────┬───────────────┘
        │                  │                  │
┌───────▼───────┐  ┌───────▼────────┐  ┌─────▼───────────────┐
│ NextAuth      │  │ Drizzle +       │  │ OpenAI Agents SDK   │
│ Google/GitHub │  │ PostgreSQL      │  │ via Mixroute        │
└───────────────┘  │ users, agents, │  └─────┬───────────────┘
                   │ chat, routines │        │
                   └────────────────┘  ┌──────▼──────────────┐
                                       │ Composio             │
                                       │ Connected app tools  │
                                       │ Slack and more       │
                                       └─────────────────────┘
                                                │
                                  ┌─────────────▼─────────────┐
                                  │ E2B Desktop               │
                                  │ Read-only web research    │
                                  └───────────────────────────┘
                                                │
                                  ┌─────────────▼─────────────┐
                                  │ Inngest                   │
                                  │ Scheduled routine workers │
                                  └───────────────────────────┘
~~~

### Agent execution model

1. A user sends a request in an agent chat.
2. The server loads the agent, its enabled tools, and the user’s active connected accounts.
3. The OpenAI Agents SDK chooses the appropriate connected function tool when an integration can perform the requested action.
4. If public-web information is needed and no connected tool can provide it, the agent may use the E2B VM for a narrowly scoped, read-only research task.
5. The agent uses connected tools—not the browser VM—for external read/write actions such as sending a Slack message.
6. The response and any routine result are persisted to PostgreSQL.

## Tech stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui, Lucide icons |
| Authentication | NextAuth.js with Google and GitHub OAuth |
| Database | PostgreSQL, Drizzle ORM |
| AI orchestration | OpenAI Agents SDK using Mixroute |
| Tool integrations | Composio |
| Browser research | E2B Desktop |
| Background jobs | Inngest |

## Features

### Authentication and workspace

- Modern public landing page, sign-up, and sign-in experiences.
- OAuth login with Google or GitHub.
- Protected workspace routes.
- Personalized welcome and agent dashboard.
- Logout returns visitors to the public homepage.

### Agent management

- Create agents with a generated avatar, name, and description.
- View all agents in a persistent workspace sidebar.
- Pause or resume agents.
- Delete agents along with related chat history, routines, execution records, and VM-session records.

### Agent chat

- Persistent agent conversations stored per agent and user.
- Structured model responses for normal messages, clarifying questions, tool suggestions, routine drafts, and routine runs.
- Responsive chat bubbles with safe long-URL wrapping.
- Three-day chat history retention.

### Connected tools

- Discover available integrations in the marketplace.
- Connect accounts through Composio-managed authorization.
- Enable a connected tool globally or for a specific agent.
- Surface connection status and allow disconnecting tools.
- Enforced tool policy: integrations handle connected-app actions; the VM cannot be used to send or post on a user’s behalf.

### Browser research and VM lifecycle

- Durable E2B desktop session per agent.
- VM used only for read-only web research.
- User-controlled login when a protected website requires authentication.
- Inactive VM desktops are automatically paused by a scheduled worker.

### Routines

- Create one-time, daily, weekly, or monthly routines.
- Calculate and persist the next run time using the routine timezone.
- Queue executions through Inngest.
- Persist execution state and append results back into the agent chat.

## Getting started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Google OAuth app
- GitHub OAuth app
- Mixroute API key
- Composio API key
- E2B API key for browser-research features
- Inngest account and keys for scheduled routines

### Install

~~~bash
git clone https://github.com/<your-username>/grok-bot-agent-clone.git
cd grok-bot-agent-clone
npm install
~~~

### Environment variables

Create a .env file based on .env.example, then add the provider-specific variables below.

~~~env
# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-long-random-secret

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/optimus

# OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI and integrations
MIXROUTE_API_KEY=
COMPOSIO_API_KEY=
E2B_API_KEY=

# Background jobs / routines
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
~~~

> For deployment, replace both localhost URLs with your public HTTPS domain and register the matching Google and GitHub OAuth callback URLs.

### Database setup

~~~bash
npm run db:generate
npm run db:push
~~~

### Run locally

~~~bash
npm run dev
~~~

Open http://localhost:3000.

To run Inngest locally in a second terminal:

~~~bash
npm run inngest:dev
~~~

## Available scripts

| Command | Purpose |
| --- | --- |
| npm run dev | Start the Next.js development server |
| npm run build | Create a production build |
| npm run start | Start the production server |
| npm run db:generate | Generate Drizzle migrations |
| npm run db:push | Apply schema changes to the database |
| npm run db:studio | Open Drizzle Studio |
| npm run inngest:dev | Start the local Inngest development server |

## Demo flow

1. Open the landing page and sign in with Google or GitHub.
2. Create an agent from the workspace.
3. Connect a tool such as Slack in the marketplace or agent configuration.
4. Ask the agent to research public information and send a result through the connected tool.
5. Create a recurring routine and inspect its execution status in the agent workspace.

## Deployment notes

This is a portfolio project. Before making a public deployment, configure production OAuth callbacks and HTTPS URLs, set real Inngest keys if routines are enabled, and restrict or remove development-only event-trigger endpoints. For a public demo, set spending limits and rate limits around AI, E2B, and integration requests.

## Project status

Active portfolio project — built to demonstrate full-stack AI-agent architecture, OAuth, persistent state, external integrations, browser research, and background job orchestration.

