import { Button, Text, makeStyles, tokens } from "@fluentui/react-components";
import { ChevronLeftRegular, ChevronRightRegular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

const useStyles = makeStyles({
    root: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        marginTop: tokens.spacingVerticalS,
    },
});

export function Pagination({
    page,
    pageCount,
    onPageChange,
}: {
    page: number;
    pageCount: number;
    onPageChange: (page: number) => void;
}) {
    const styles = useStyles();
    const { t } = useTranslation();

    if (pageCount <= 1) {
        return null;
    }

    return (
        <div className={styles.root}>
            <Button
                icon={<ChevronLeftRegular />}
                appearance="subtle"
                size="small"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                aria-label={t("pagination.previous")}
            />
            <Text size={200}>
                {t("pagination.pageOf", { page, pageCount })}
            </Text>
            <Button
                icon={<ChevronRightRegular />}
                appearance="subtle"
                size="small"
                disabled={page >= pageCount}
                onClick={() => onPageChange(page + 1)}
                aria-label={t("pagination.next")}
            />
        </div>
    );
}
