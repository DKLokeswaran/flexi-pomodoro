import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { DebugFlagsProvider } from "./providers/DebugFlagsProvider";
import { ToastProvider } from "./providers/ToastProvider";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

/** Mount the app with React Query, debug flags, and toasts. */
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
