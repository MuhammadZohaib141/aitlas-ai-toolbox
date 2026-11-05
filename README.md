# Aitlas AI Toolbox v8 — Vercel Ready

A polished 16-tool AI website with smooth loaders, theme switching, stable hover/jelly animations, free Browser AI fallback, local image conversion, and optional hosted AI.

## Deploy on Vercel

1. Upload this folder/ZIP to a Git repository or import the folder into Vercel.
2. Vercel will serve `index.html` as the site and the files in `api/` as Serverless Functions.
3. No build command is required.
4. Node is pinned to `24.x` in `package.json` to avoid the `>=20` auto-upgrade warning.

### Optional server AI

For the best experience for all visitors, open **Vercel → Project → Settings → Environment Variables** and add at least one:

- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `OPENAI_API_KEY`

Optional:

- `TEXT_AI_PROVIDER=auto` (or `gemini`, `groq`, `openrouter`, `openai`)
- `FREE_AI_MODEL=`
- `OPENAI_MODEL=gpt-4.1-mini`

Redeploy after changing environment variables.

## Automatic free AI

If no hosted server key is configured, **Automatic** mode falls back to free Browser AI on compatible Chrome/Edge devices with WebGPU. The first request downloads the selected model. Image Converter works locally with no AI key.

## AI Settings inside the website

The large **AI Settings** button lets a user choose:

- Automatic — server AI first, then Browser AI
- Browser AI only
- Vercel server AI only
- Personal API key

A personal API key is not written into the website source. If “Remember this key” is enabled, it is stored in that browser's local storage; otherwise it is kept only for the browser session. For a public production site, use Vercel Environment Variables instead.

## Direct file use

You can still double-click `index.html`. In `file:///` mode the text tools use Browser AI where supported, and Image Converter remains local.

## Tools

AI Writing: Email Generator, Paragraph Rewriter, Grammar Fixer, Summarizer, AI Translator, Tone Changer, Title Generator.

AI Images: Image Converter.

AI Developer: Code Explainer, JSON Fixer, Regex Generator, SQL Generator.

AI Student: Notes Summarizer, Flashcard Generator, Quiz Generator, Study-plan Generator.
