import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Button,
    Dropdown,
    Field,
    Option,
    makeStyles,
    tokens,
} from "@fluentui/react-components";
import { ChevronDownRegular, EditRegular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { fetchAreaPaths, fetchIterations, fetchProjects } from "../../api/client";
import { useScope } from "../../hooks/useScope";

const useStyles = makeStyles({
    bar: {
        borderBottomWidth: "1px",
        borderBottomStyle: "solid",
        borderBottomColor: tokens.colorNeutralStroke2,
        backgroundColor: tokens.colorNeutralBackground1,
        padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
        display: "flex",
        alignItems: "flex-end",
        flexWrap: "wrap",
        gap: tokens.spacingHorizontalM,
    },
    field: {
        minWidth: "200px",
        flex: "1 1 200px",
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
    doneButton: {
        marginLeft: "auto",
    },
    summary: {
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: tokens.spacingHorizontalS,
        padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalL}`,
        borderBottomWidth: "1px",
        borderBottomStyle: "solid",
        borderBottomColor: tokens.colorNeutralStroke2,
        backgroundColor: tokens.colorNeutralBackground1,
        fontSize: tokens.fontSizeBase200,
    },
    chip: {
        backgroundColor: tokens.colorBrandBackground2,
        color: tokens.colorBrandForeground2,
        borderRadius: tokens.borderRadiusCircular,
        padding: `2px ${tokens.spacingHorizontalS}`,
        fontWeight: tokens.fontWeightSemibold,
    },
    sep: {
        color: tokens.colorNeutralForeground3,
    },
    changeButton: {
        marginLeft: "auto",
    },
});

// Sits directly under TopBar in PageLayout (see PageLayout.tsx) - every page
// shares this one instance rather than each owning its own copy, so scope
// stays consistent across navigation without any page needing to know about
// it beyond reading useScope().
export function ScopeBar() {
    const styles = useStyles();
    const { t } = useTranslation();
    const scope = useScope();
    const [editing, setEditing] = useState(!scope.isComplete);

    const { data: projects } = useQuery({
        queryKey: ["projects"],
        queryFn: fetchProjects,
    });

    const { data: areaPathOptions } = useQuery({
        queryKey: ["areapaths", scope.project],
        queryFn: () => fetchAreaPaths(scope.project ?? undefined),
        enabled: !!scope.project,
    });

    const { data: iterationOptions } = useQuery({
        queryKey: ["iterations", scope.project],
        queryFn: () => fetchIterations(scope.project ?? undefined),
        enabled: !!scope.project,
    });

    const { project, setProject } = scope;

    // If the signed-in account only has one accessible project, there's
    // nothing to actually choose between - select it automatically instead
    // of making every user click through a one-option dropdown.
    useEffect(() => {
        if (!project && projects?.length === 1) {
            setProject(projects[0]);
        }
    }, [project, projects, setProject]);

    if (!editing) {
        return (
            <div className={styles.summary}>
                <span className={styles.chip}>{scope.project}</span>
                <span className={styles.sep}>&middot;</span>
                <span>
                    {scope.areaPaths.length > 0
                        ? t("scopeBar.areaPathCount", { count: scope.areaPaths.length })
                        : t("scopeBar.allAreaPaths")}
                </span>
                <span className={styles.sep}>&middot;</span>
                <span>
                    {scope.iterations.length > 0
                        ? t("scopeBar.iterationCount", { count: scope.iterations.length })
                        : t("scopeBar.allIterations")}
                </span>
                <Button
                    appearance="subtle"
                    size="small"
                    icon={<EditRegular />}
                    className={styles.changeButton}
                    onClick={() => setEditing(true)}
                >
                    {t("scopeBar.change")}
                </Button>
            </div>
        );
    }

    return (
        <div className={styles.bar}>
            <Field label={t("scopeBar.project")} className={styles.field}>
                <Dropdown
                    expandIcon={<ChevronDownRegular className={styles.chevron} />}
                    button={{ className: styles.dropdownButton }}
                    value={scope.project ?? t("scopeBar.selectProject")}
                    selectedOptions={scope.project ? [scope.project] : []}
                    onOptionSelect={(_, data) => {
                        if (data.optionValue) {
                            scope.setProject(data.optionValue);
                        }
                    }}
                >
                    {(projects ?? []).map((project) => (
                        <Option key={project} value={project}>
                            {project}
                        </Option>
                    ))}
                </Dropdown>
            </Field>

            <Field label={t("scopeBar.areaPaths")} className={styles.field}>
                <Dropdown
                    multiselect
                    disabled={!scope.project}
                    expandIcon={<ChevronDownRegular className={styles.chevron} />}
                    button={{ className: styles.dropdownButton }}
                    value={
                        scope.areaPaths.length > 0
                            ? t("scopeBar.areaPathCount", { count: scope.areaPaths.length })
                            : t("scopeBar.allAreaPaths")
                    }
                    selectedOptions={scope.areaPaths}
                    onOptionSelect={(_, data) => scope.setAreaPaths(data.selectedOptions)}
                >
                    {(areaPathOptions ?? []).map((area) => (
                        <Option key={area.id} value={area.path}>
                            {area.name}
                        </Option>
                    ))}
                </Dropdown>
            </Field>

            <Field label={t("scopeBar.iterations")} className={styles.field}>
                <Dropdown
                    multiselect
                    disabled={!scope.project}
                    expandIcon={<ChevronDownRegular className={styles.chevron} />}
                    button={{ className: styles.dropdownButton }}
                    value={
                        scope.iterations.length > 0
                            ? t("scopeBar.iterationCount", { count: scope.iterations.length })
                            : t("scopeBar.allIterations")
                    }
                    selectedOptions={scope.iterations}
                    onOptionSelect={(_, data) => scope.setIterations(data.selectedOptions)}
                >
                    {(iterationOptions ?? []).map((iteration) => (
                        <Option key={iteration.id} value={iteration.path}>
                            {iteration.name}
                        </Option>
                    ))}
                </Dropdown>
            </Field>

            {scope.isComplete && (
                <Button
                    appearance="primary"
                    size="small"
                    className={styles.doneButton}
                    onClick={() => setEditing(false)}
                >
                    {t("scopeBar.done")}
                </Button>
            )}
        </div>
    );
}
