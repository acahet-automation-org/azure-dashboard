import { Badge, type BadgeProps } from "@fluentui/react-components";
import {
    CheckmarkCircleFilled,
    DismissCircleFilled,
    ErrorCircleFilled,
    SubtractCircleFilled,
} from "@fluentui/react-icons";
import type { Outcome } from "../types";

const outcomeConfig: Record<
    Outcome,
    { color: BadgeProps["color"]; icon: BadgeProps["icon"] }
> = {
    Passed: { color: "success", icon: <CheckmarkCircleFilled /> },
    Failed: { color: "danger", icon: <DismissCircleFilled /> },
    Blocked: { color: "severe", icon: <ErrorCircleFilled /> },
    NotRun: { color: "subtle", icon: <SubtractCircleFilled /> },
};

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
    const config = outcomeConfig[outcome];

    return (
        <Badge
            color={config.color}
            icon={config.icon}
            appearance="filled"
            aria-label={`Outcome: ${outcome}`}
        >
            {outcome}
        </Badge>
    );
}
