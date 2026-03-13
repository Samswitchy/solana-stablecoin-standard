# Example Frontend

This is a static operator-facing demo for the Solana Stablecoin Standard.

## What it does

- builds preset-driven CLI and SDK snippets
- talks to the backend service stack for mint, burn, blacklist, and seize actions
- polls the indexer and compliance services for live status, holder, blacklist, and audit views

## Run

Start the backend stack:

```bash
docker compose up --build
```

Start the frontend preview:

```bash
npm run frontend:serve
```

Then open:

```text
http://127.0.0.1:4173
```
