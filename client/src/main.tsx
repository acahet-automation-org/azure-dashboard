import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EventType } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import "./i18n";
import { msalInstance } from "./msalInstance";
import { ThemeModeProvider } from "./hooks/ThemeModeProvider";
import { ThemedFluentProvider } from "./components/ThemedFluentProvider";
import App from "./App";

const queryClient = new QueryClient();

msalInstance.addEventCallback((event) => {
    if (
        event.eventType === EventType.LOGIN_SUCCESS &&
        event.payload &&
        "account" in event.payload &&
        event.payload.account
    ) {
        msalInstance.setActiveAccount(event.payload.account);
    }
});

await msalInstance.initialize();

const redirectResponse = await msalInstance.handleRedirectPromise();

if (redirectResponse?.account) {
    msalInstance.setActiveAccount(redirectResponse.account);
} else if (!msalInstance.getActiveAccount()) {
    const [firstAccount] = msalInstance.getAllAccounts();

    if (firstAccount) {
        msalInstance.setActiveAccount(firstAccount);
    }
}

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <MsalProvider instance={msalInstance}>
            <ThemeModeProvider>
                <ThemedFluentProvider>
                    <QueryClientProvider client={queryClient}>
                        <BrowserRouter basename={import.meta.env.BASE_URL}>
                            <App />
                        </BrowserRouter>
                    </QueryClientProvider>
                </ThemedFluentProvider>
            </ThemeModeProvider>
        </MsalProvider>
    </StrictMode>
);
