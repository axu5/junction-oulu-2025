import { webmChunksToWav } from "@/lib/wav";
import {
  useMutation,
  UseMutationOptions,
} from "@tanstack/react-query";

export function useTranscribe(
  opts: UseMutationOptions<
    {
      transcript: string;
    },
    Error,
    Blob[],
    unknown
  >
) {
  return useMutation({
    async mutationFn(audioChunks: Blob[]) {
      const wavBlob = await webmChunksToWav(audioChunks);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: wavBlob,
      });

      return res.json();
    },
    ...opts,
  });
}
