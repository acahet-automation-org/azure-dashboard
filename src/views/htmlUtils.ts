export function escapeAttr(value: unknown): string {
    return String(value ?? "").replace(
        /[&<>"']/g,
        (c) =>
        ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        }[c] as string)
    );
}
