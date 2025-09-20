import { OpenAI } from "openai";

const errors = [];

if (!process.env["OPENAI_API_KEY"]) {
  errors.push("OPENAI_API_KEY missing from .env");
}

if (!process.env["ELEVENLABS_API_KEY"]) {
  errors.push("ELEVENLABS_API_KEY missing from .env");
}

if (errors.length > 0) {
  for (const err of errors) {
    console.error(err);
  }
  process.exit(1);
}

export const ai = new OpenAI();
