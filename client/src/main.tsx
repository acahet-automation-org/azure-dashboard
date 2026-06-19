import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./i18n";
import { ThemeModeProvider } from "./hooks/ThemeModeProvider";
import { ThemedFluentProvider } from "./components/ThemedFluentProvider";
import App from "./App";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ThemeModeProvider>
            <ThemedFluentProvider>
                <QueryClientProvider client={queryClient}>
                    <BrowserRouter>
                        <App />
                    </BrowserRouter>
                </QueryClientProvider>
            </ThemedFluentProvider>
        </ThemeModeProvider>
    </StrictMode>
);
