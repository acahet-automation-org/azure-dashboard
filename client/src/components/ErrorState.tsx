import { MessageBar, MessageBarBody, MessageBarTitle, Button } from "@fluentui/react-components";

export function ErrorState({
    message,
    onRetry,
}: {
    message: string;
    onRetry: () => void;
}) {
    return (
        <MessageBar intent="error">
            <MessageBarBody>
                <MessageBarTitle>Something went wrong</MessageBarTitle>
                {message}
            </MessageBarBody>
            <Button appearance="secondary" onClick={onRetry}>
                Retry
            </Button>
        </MessageBar>
    );
}
