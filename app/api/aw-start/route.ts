import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import * as os from "os"

const execAsync = promisify(exec)

export async function POST() {
    try {
        const platform = os.platform()
        let command: string

        if (platform === "win32") {
            // Windows: Try common ActivityWatch installation paths.
            // ActivityWatch installs to %LOCALAPPDATA%\Programs\ActivityWatch by default.
            // Using 'cmd /c start /B "" ...' launches it detached so exec doesn't hang.
            command = [
                `cmd /c start /B "" "%LOCALAPPDATA%\\Programs\\ActivityWatch\\aw-qt.exe"`,
            ].join(" || ")
        } else if (platform === "darwin") {
            // macOS: Use the 'open' command
            command = `open -a ActivityWatch || open "/Applications/ActivityWatch.app"`
        } else {
            // Linux: Try launching aw-qt directly
            command = `aw-qt &`
        }

        await execAsync(command)
        return NextResponse.json({ success: true, message: "ActivityWatch starting..." })
    } catch (error: any) {
        // execAsync may throw if the binary is not found at the expected path.
        console.error("Failed to start ActivityWatch:", error)
        return NextResponse.json(
            {
                success: false,
                error: "ActivityWatch binary not found. Please start it manually from your Start Menu or Applications folder.",
            },
            { status: 500 }
        )
    }
}

