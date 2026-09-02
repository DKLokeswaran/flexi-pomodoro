import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { DebugFlagsProvider } from "./browserFlags/debug";
import { UiFlagsProvider } from "./browserFlags/ui";
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

/** Mount the app with React Query, UI/debug flag stores, and toasts. */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <UiFlagsProvider>
        <DebugFlagsProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </DebugFlagsProvider>
      </UiFlagsProvider>
    </QueryClientProvider>
  </StrictMode>,
);
