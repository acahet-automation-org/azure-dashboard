import { Dropdown, Option, Input, Field, makeStyles, tokens } from "@fluentui/react-components";
import { ChevronDownRegular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

export interface DashboardFilters {
    area: string;
    suite: string;
    priority: string;
    search: string;
}

const useStyles = makeStyles({
    bar: {
        display: "flex",
        flexWrap: "wrap",
        gap: tokens.spacingHorizontalM,
        alignItems: "flex-end",
    },
    field: {
        minWidth: "180px",
        flex: "1 1 180px",
    },
    chevron: {
        color: tokens.colorBrandForeground1,
        fontSize: "18px",
    },
    dropdownButton: {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
});

export function FilterBar({
    areaPaths,
    suiteOptions,
    priorities,
    filters,
    onChange,
}: {
    areaPaths: string[];
    suiteOptions: string[];
    priorities: number[];
    filters: DashboardFilters;
    onChange: (next: DashboardFilters) => void;
}) {
    const styles = useStyles();
    const { t } = useTranslation();
    const allAreas = t("filterBar.allAreas");
    const allSuites = t("filterBar.allSuites");
    const allPriorities = t("filterBar.allPriorities");

    return (
        <div className={styles.bar}>
            <Field label={t("filterBar.areaPath")} className={styles.field}>
                <Dropdown
                    expandIcon={<ChevronDownRegular className={styles.chevron} />}
                    button={{ className: styles.dropdownButton }}
                    value={filters.area || allAreas}
                    selectedOptions={filters.area ? [filters.area] : [""]}
                    onOptionSelect={(_, data) =>
                        onChange({
                            ...filters,
                            area: data.optionValue ?? "",
                            suite: "",
                        })
                    }
                >
                    <Option value="">{allAreas}</Option>
                    {areaPaths.map((p) => (
                        <Option key={p} value={p}>
                            {p}
                        </Option>
                    ))}
                </Dropdown>
            </Field>

            <Field label={t("filterBar.suite")} className={styles.field}>
                <Dropdown
                    expandIcon={<ChevronDownRegular className={styles.chevron} />}
                    button={{ className: styles.dropdownButton }}
                    value={filters.suite || allSuites}
                    selectedOptions={filters.suite ? [filters.suite] : [""]}
                    onOptionSelect={(_, data) =>
                        onChange({ ...filters, suite: data.optionValue ?? "" })
                    }
                >
                    <Option value="">{allSuites}</Option>
                    {suiteOptions.map((s) => (
                        <Option key={s} value={s}>
                            {s}
                        </Option>
                    ))}
                </Dropdown>
            </Field>

            <Field label={t("filterBar.priority")} className={styles.field}>
                <Dropdown
                    expandIcon={<ChevronDownRegular className={styles.chevron} />}
                    button={{ className: styles.dropdownButton }}
                    value={
                        filters.priority
                            ? t("dashboardPage.priority", { value: filters.priority })
                            : allPriorities
                    }
                    selectedOptions={filters.priority ? [filters.priority] : [""]}
                    onOptionSelect={(_, data) =>
                        onChange({
                            ...filters,
                            priority: data.optionValue ?? "",
                        })
                    }
                >
                    <Option value="">{allPriorities}</Option>
                    {priorities.map((p) => (
                        <Option
                            key={p}
                            value={String(p)}
                            text={t("dashboardPage.priority", { value: p })}
                        >
                            {t("dashboardPage.priority", { value: p })}
                        </Option>
                    ))}
                </Dropdown>
            </Field>

            <Field label={t("filterBar.search")} className={styles.field}>
                <Input
                    value={filters.search}
                    onChange={(_, data) =>
                        onChange({ ...filters, search: data.value })
                    }
                    placeholder={t("filterBar.searchPlaceholder")}
                />
            </Field>
        </div>
    );
}
