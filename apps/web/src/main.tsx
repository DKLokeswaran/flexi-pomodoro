import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { DebugFlagsProvider } from "./debug/DebugFlagsProvider";
import { ToastProvider } from "./toast/ToastProvider";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DebugFlagsProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </DebugFlagsProvider>
    </QueryClientProvider>
  </StrictMode>,
);
