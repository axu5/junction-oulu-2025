import { OpenAI } from "openai";

if (!process.env["OPENAI_API_KEY"]) {
  throw new Error("OPENAI_API_KEY missing from .env");
}

export const ai = new OpenAI();
