import { execSync } from "node:child_process";

if (process.platform === "win32") {
    // Match only actual vite invocations (the vite.js entry script, or a cmd.exe
    // shim running "vite" as its command) - a plain substring match on "vite"
    // also catches unrelated shells whose command line happens to mention vite,
    // e.g. the very "npm run kill:vite" invocation that runs this script.
    const command =
        "Get-CimInstance Win32_Process | " +
        "Where-Object { " +
        "$_.Name -in @('node.exe', 'cmd.exe') -and (" +
        "($_.CommandLine -match '[\\\\/]vite[\\\\/]bin[\\\\/]vite\\.js') -or " +
        "($_.CommandLine -match '/c\\s+vite(\\s|$)')" +
        ") } | " +
        "ForEach-Object { " +
        "Write-Output \"Killing PID $($_.ProcessId): $($_.CommandLine)\"; " +
        "Stop-Process -Id $_.ProcessId -Force " +
        "}";

    execSync(`powershell -NoProfile -Command "${command}"`, {
        stdio: "inherit",
    });
} else {
    try {
        execSync("pkill -f 'vite/bin/vite.js'", { stdio: "inherit" });
    } catch (error) {
        if (error.status !== 1) {
            throw error;
        }
    }
}
