import { Dropdown, Option, Input, Field, makeStyles, tokens } from "@fluentui/react-components";

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

    return (
        <div className={styles.bar}>
            <Field label="Area Path" className={styles.field}>
                <Dropdown
                    value={filters.area || "All Areas"}
                    selectedOptions={filters.area ? [filters.area] : [""]}
                    onOptionSelect={(_, data) =>
                        onChange({
                            ...filters,
                            area: data.optionValue ?? "",
                            suite: "",
                        })
                    }
                >
                    <Option value="">All Areas</Option>
                    {areaPaths.map((p) => (
                        <Option key={p} value={p}>
                            {p}
                        </Option>
                    ))}
                </Dropdown>
            </Field>

            <Field label="Suite" className={styles.field}>
                <Dropdown
                    value={filters.suite || "All Suites"}
                    selectedOptions={filters.suite ? [filters.suite] : [""]}
                    onOptionSelect={(_, data) =>
                        onChange({ ...filters, suite: data.optionValue ?? "" })
                    }
                >
                    <Option value="">All Suites</Option>
                    {suiteOptions.map((s) => (
                        <Option key={s} value={s}>
                            {s}
                        </Option>
                    ))}
                </Dropdown>
            </Field>

            <Field label="Priority" className={styles.field}>
                <Dropdown
                    value={
                        filters.priority
                            ? `Priority ${filters.priority}`
                            : "All Priorities"
                    }
                    selectedOptions={filters.priority ? [filters.priority] : [""]}
                    onOptionSelect={(_, data) =>
                        onChange({
                            ...filters,
                            priority: data.optionValue ?? "",
                        })
                    }
                >
                    <Option value="">All Priorities</Option>
                    {priorities.map((p) => (
                        <Option
                            key={p}
                            value={String(p)}
                            text={`Priority ${p}`}
                        >
                            Priority {p}
                        </Option>
                    ))}
                </Dropdown>
            </Field>

            <Field label="Search" className={styles.field}>
                <Input
                    value={filters.search}
                    onChange={(_, data) =>
                        onChange({ ...filters, search: data.value })
                    }
                    placeholder="Search test case title..."
                />
            </Field>
        </div>
    );
}
