# LaunchPromptly SDK Demo

Interactive demo scripts showing how to use the `launchpromptly` SDK.

## Setup

```bash
# From repo root
cd examples/sdk-demo
npm install

# Start the API (in another terminal)
cd apps/api && npm run dev
```

## Prerequisites

1. Create an account at `http://localhost:3000`
2. Create a project
3. Go to **Settings → Environments** and copy an API key
4. Create a prompt with slug `demo-prompt` and content like:
   ```
   You are a helpful {{role}} assistant for {{company}}.
   ```
5. Deploy the prompt to your environment

```bash
export LAUNCHPROMPTLY_API_KEY=lp_live_...
```

## Demos

### Full walkthrough

```bash
npm run demo
```

Covers: prompt fetch, template variables, caching, A/B testing, error handling.

### Prompt management only

```bash
npm run demo:prompt
```

Focuses on fetching, caching, and variable interpolation — no LLM calls.

### OpenAI integration

```bash
export OPENAI_API_KEY=sk-...
npm run demo:wrap
```

Shows the full flow: fetch prompt → wrap OpenAI → tracked LLM calls.
