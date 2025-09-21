"use client";

import { LLMProvider } from "@/hooks/use-llm";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { PropsWithChildren } from "react";

export const queryClient = new QueryClient();

export function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <LLMProvider>{children}</LLMProvider>
    </QueryClientProvider>
  );
}
