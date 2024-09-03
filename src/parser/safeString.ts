export function safeString(value: string): string {
    return value
        .replaceAll("\\", "\\\\")
        .replaceAll('"', '\\"')
        .replaceAll("\n", "\\n");
}

