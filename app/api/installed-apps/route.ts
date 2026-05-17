import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import path from "path"

const execAsync = promisify(exec)

export async function GET() {
  try {
    const platform = process.platform
    let apps: { name: string; identifier: string }[] = []

    if (platform === "win32") {
      // Use Windows 'where' command to locate .exe files in common program directories
      const programFiles = process.env["ProgramFiles"] || "C:\\Program Files"
      const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)"

      const execCmd = async (dir: string) => {
        try {
          const { stdout } = await execAsync(`where /R "${dir}" *.exe`)
          return stdout
        } catch {
          return ""
        }
      }

      const [stdout1, stdout2] = await Promise.all([execCmd(programFiles), execCmd(programFilesX86)])
      const lines = (stdout1 + "\n" + stdout2).split(/\r?\n/).filter(Boolean)
      apps = lines.map(line => ({
        name: path.basename(line, ".exe"),
        identifier: line
      }))
    } else if (platform === "darwin") {
      const { stdout } = await execAsync('ls /Applications')
      const lines = stdout.split(/\r?\n/).filter(Boolean)
      apps = lines
        .filter(name => name.endsWith('.app'))
        .map(name => ({
          name: name.replace(/\.app$/i, ""),
          identifier: name.replace(/\.app$/i, "")
        }))
    } else {
      // Assume Linux or other Unix-like
      const { stdout } = await execAsync('ls /usr/share/applications')
      const lines = stdout.split(/\r?\n/).filter(Boolean)
      apps = lines
        .filter(name => name.endsWith('.desktop'))
        .map(name => ({
          name: name.replace('.desktop', ''),
          identifier: name.replace('.desktop', '')
        }))
    }

    return NextResponse.json({ apps })
  } catch (error) {
    console.error('Error detecting installed apps:', error)
    return NextResponse.json({ apps: [] }, { status: 500 })
  }
}
