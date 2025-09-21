import { ELEVENLABS_WS_URL, VOICE_CHAT_TEXT_MODEL } from "@/consts";
import { ai } from "@/lib/ai";
import { VOICE_CHAT_SYSTEM_PROMPT } from "@/prompts";
import { NextRequest, NextResponse } from "next/server";
import WebSocket from "ws";
import { ZodError, z } from "zod";

const requestBodySchema = z.object({
  // text: z.string().min(1).max(1024),
  history: z.array(
    z.object({
      role: z.literal(["assistant", "user"]),
      content: z.string().min(1).max(1024),
    })
  ),
});

export async function POST(req: NextRequest) {
  const abortSignal = req.signal;
  let ws: WebSocket | null = null;

  try {
    const { history } = requestBodySchema.parse(await req.json());

    // const t1 = performance.now();
    // const embedding = await getEmbedding(text);

    // const t2 = performance.now();
    // const embeddingLiteral = sql.raw(embedding.join(","));
    // const { rows } = (await db.run(
    //   sql`
    //     SELECT
    //       qc.*,
    //       1 - vector_distance_cos(
    //         qc.embedding,
    //         vector('[${embeddingLiteral}]')
    //       ) AS similarity
    //     FROM query_cache qc
    //     WHERE qc.version = ${QUERY_CACHE_VERSION}
    //   `
    // )) as unknown as {
    //   rows: (InferSelectModel<typeof queryCache> & {
    //     similarity: number;
    //   })[];
    // };
    // const t3 = performance.now();

    // console.log("embedding", (t2 - t1).toFixed(1) + "ms");
    // console.log("similarity search", (t3 - t2).toFixed(1) + "ms");

    // const cached = rows.find(
    //   r => r.similarity >= QUERY_CACHE_SIMILARITY_THRESHOLD
    // );

    // if (cached) {
    //   if (cached.output) {
    //     console.log("CACHE HIT", cached.id);
    //     // Return cached NDJSON stream directly
    //     return new Response(new Uint8Array(cached.output).buffer, {
    //       status: 200,
    //       headers: {
    //         "Content-Type": "audio/x-ndjson",
    //         "Cache-Control": "no-store",
    //         "X-Cache": "HIT",
    //       },
    //     });
    //   }
    // }

    // const cacheBuffers: Uint8Array[] = [];
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const wsUrl = new URL(ELEVENLABS_WS_URL);
    wsUrl.searchParams.set("sync_alignment", "true");

    ws = new WebSocket(wsUrl);

    abortSignal.addEventListener("abort", () => {
      try {
        ws?.close();
        writer.abort(new Error("Aborted by client"));
      } catch {}
    });

    // Promise that resolves when WS is open
    const wsReady = new Promise<void>((resolve, reject) => {
      if (!ws) {
        throw new Error(
          "This should never happen, ws is not defined"
        );
      }

      ws.onopen = () => {
        resolve();
      };
      ws.onerror = err =>
        reject(new Error("WebSocket error: " + String(err)));
      abortSignal.addEventListener("abort", () =>
        reject(new Error("Aborted before websocket open"))
      );
    });

    // Stream audio from ElevenLabs -> client
    ws.onmessage = async event => {
      try {
        const msg = JSON.parse(event.data.toString());
        if (msg.audio) {
          const words = charsToWords(
            msg.normalizedAlignment?.chars ?? [],
            msg.normalizedAlignment?.charStartTimesMs ?? [],
            msg.normalizedAlignment?.charDurationsMs ?? []
          );

          const payload = {
            audio: msg.audio,
            words,
          };

          const line = JSON.stringify(payload) + "\n";
          writer.write(new TextEncoder().encode(line));
          // cacheBuffers.push(new TextEncoder().encode(line));
        }
        if (msg.isFinal) {
          writer.close();
          ws?.close();

          // const outputBlob = Buffer.concat(
          //   cacheBuffers.map(b => Buffer.from(b))
          // );
          // await db.insert(queryCache).values({
          //   embedding: embedding,
          //   output: outputBlob,
          //   version: QUERY_CACHE_VERSION,
          // });
        }
      } catch (err) {
        console.error(err);
        writer.abort(err);
        ws?.close();
      }
    };

    ws.onerror = err => {
      writer.abort(new Error("WS error: " + String(err)));
      ws?.close();
    };

    (async () => {
      try {
        await wsReady;

        const t4 = performance.now();

        const gptStream = await ai.chat.completions.create(
          {
            model: VOICE_CHAT_TEXT_MODEL,
            messages: [
              { role: "system", content: VOICE_CHAT_SYSTEM_PROMPT },
              // { role: "user", content: text },
              ...history,
            ],
            stream: true,
          },
          { signal: abortSignal }
        );

        let first = true;
        for await (const part of gptStream) {
          if (abortSignal.aborted) break;
          const delta = part.choices?.[0]?.delta?.content;
          if (delta) {
            const body: {
              text: string;
              try_trigger_generation: boolean;
              xi_api_key?: string;
            } = {
              text: delta,
              try_trigger_generation: true,
            };
            if (first) {
              body["xi_api_key"] = process.env.ELEVENLABS_API_KEY;
              first = false;
            }
            ws?.send(JSON.stringify(body));
          }
        }

        const t5 = performance.now();

        if (!abortSignal.aborted) {
          ws?.send(
            JSON.stringify({
              text: "",
              try_trigger_generation: false,
            })
          );
        }

        console.log(
          "establishing streams",
          (t5 - t4).toFixed(1) + "ms"
        );
      } catch (err) {
        writer.abort(err);
        ws?.close();
      }
    })();

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "audio/x-ndjson",
        "Cache-Control": "no-store",
        "X-Cache": "MISS",
      },
    });
  } catch (e) {
    console.error(e);
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      try {
        if (!abortSignal.aborted) {
          ws.send(
            JSON.stringify({
              text: "",
              try_trigger_generation: false,
            })
          );
        }
        ws.close();
      } catch {}
    }

    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid body" },
        { status: 400 }
      );
    }
    if (abortSignal.aborted) {
      return NextResponse.json(
        { error: "Aborted by client" },
        { status: 499 }
      );
    }
    console.error(e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

function charsToWords(
  chars: string[],
  starts: number[],
  durations: number[]
) {
  const words: { text: string; start: number; end: number }[] = [];
  let currentWord = "";
  let wordStart: number | null = null;
  let wordEnd: number | null = null;

  chars.forEach((ch, i) => {
    if (ch === " ") {
      if (currentWord && wordStart !== null && wordEnd !== null) {
        words.push({
          text: currentWord + " ",
          start: wordStart,
          end: wordEnd,
        });
      }
      currentWord = "";
      wordStart = null;
      wordEnd = null;
    } else {
      if (wordStart === null) wordStart = starts[i];
      wordEnd = starts[i] + durations[i];
      currentWord += ch;
    }
  });

  if (currentWord && wordStart !== null && wordEnd !== null) {
    words.push({ text: currentWord, start: wordStart, end: wordEnd });
  }

  return words;
}

// const embeddingCache = new Map<string, number[]>();

// async function getEmbedding(text: string) {
//   if (embeddingCache.has(text)) return embeddingCache.get(text)!;

//   const embeddingResponse = await ai.embeddings.create({
//     input: text.trim(),
//     model: QUERY_CACHE_MODEL,
//   });
//   const embedding = embeddingResponse.data[0].embedding;
//   embeddingCache.set(text, embedding);
//   return embedding;
// }
