# Aitlas AI Toolbox v7 — 16 tools, smoother animations

## Open without installing anything

Extract this folder and double-click `index.html`. The **16-tool** interface, search, favorites, light/dark theme, and Image Converter work directly in Chrome or Edge. You do **not** need `npm start` for the standalone website.

**Tools:** 7 writing tools (Email Generator, Paragraph Rewriter, Grammar Fixer, Summarizer, AI Translator, Tone Changer, Title Generator); 1 image tool (Image Converter); 4 developer tools (Code Explainer, JSON Fixer, Regex Generator, SQL Generator); 4 student tools (Notes Summarizer, Flashcard Generator, Quiz Generator, Study-plan Generator).

Image Enhancer, Background Remover and Resume Writer were removed from the website and backend. Favorites and recent-tool entries for these retired tools are no longer shown.

## Free text AI in your browser

The 15 writing, developer, and student utilities can use a small local Qwen model on **compatible WebGPU computers**. The first run downloads model files and requires an internet connection; model inference happens on your computer, without an API key. Browser permissions, device memory, local-file restrictions, or network blocks may prevent model loading. For a more capable model, choose Qwen 1.5B in AI Settings if your hardware supports it. Results from small models may contain errors.

## Optional server AI

If you prefer a hosted model, with Node.js 20+ run `npm start` inside this folder and visit `http://localhost:3000`. The large AI Settings button includes secure owner-only settings for Gemini, Groq, OpenRouter, OpenAI, or local Ollama. Hosted providers may require an API key and have their own usage limits or costs. Never place cloud API keys in the public HTML or frontend JavaScript.

## Animation fix in v7

The old tool-card entrance animation and the jelly hover animation controlled the same card, which could cause a brief disappear/reappear effect. The card now stays fully opaque and in its original hit area; a gentle CSS spring moves it only a few pixels while its **icon** performs a tiny jelly bounce. Reduced-motion browser preferences are respected. The loading animation, larger AI Settings button, redesigned colors, and theme switch are all retained.

The Image Converter works without AI or internet. It converts PNG/JPG/WebP, downscaling any side over 2,600 pixels. JPEG transparencies are flattened against white. This is genuine browser image conversion, not AI processing.

To run checks with Node.js 20+: `npm test`.
