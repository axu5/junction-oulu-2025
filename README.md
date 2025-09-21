# Installation

**Environment variables** can be set in a `.env` file.

```.env
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
TURSO_AUTH_TOKEN=
TURSO_DATABASE_URL=
```

- Get OpenAI API key from [here](https://platform.openai.com/).
- Elevenlabs API key from [here](https://elevnlabs.io)
- Turso API keys from [here](https://app.turso.tech/login)

**Local development**

```
pnpm i && pnpm dev
```

# Architecture

![Architecture for Junction Oulu 2025](/public/architecture.png)

# Technical Takeaways

- OpenAI whisper API is too slow for real time transcriptions
- Should switch to [WASM Whisper bindings](https://huggingface.co/spaces/Xenova/realtime-whisper-webgpu)
- Streaming tokens from OpenAI -> Elevenlabs is ok for real time applications. However, it should be noted that Elevenlabs API's text "chars" output doesn't always correspond with what is being said.
- [Rhubarb Lip Sync](https://github.com/DanielSWolf/rhubarb-lip-sync) is too slow for real-time human interactions, and our approach of grapheme2phoneme2viseme worked well enough.
- Turso's similarity search querying combined with OpenAI's small embedding model was too slow for a realtime application cache. (around 700 ms for a DB query, which leads to a slower time to first byte than with gpt's 4o-mini model + elevenlabs turbo flash output streaming).

# Future developments

- Adding webcam stream for better emotional and contextual understanding
- Tool calling & Agentic UI
- Testing + Supporting more languages
- Localized cultural queues + understanding
- Webcam for Sign-Language interpretation
- RAG with product locations/availability for stores
