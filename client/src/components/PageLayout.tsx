import type { ReactNode } from "react";
import { makeStyles, tokens, Title1 } from "@fluentui/react-components";
import { NavBar } from "./NavBar";

const useStyles = makeStyles({
    page: {
        minHeight: "100vh",
        backgroundColor: tokens.colorNeutralBackground2,
    },
    content: {
        maxWidth: "1200px",
        margin: "0 auto",
        padding: tokens.spacingHorizontalL,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalL,
    },
});

export function PageLayout({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    const styles = useStyles();

    return (
        <div className={styles.page}>
            <NavBar />

            <div className={styles.content}>
                <Title1 as="h1">{title}</Title1>
                {children}
            </div>
        </div>
    );
}
