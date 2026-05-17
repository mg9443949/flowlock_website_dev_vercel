import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export async function GET() {
  try {
    const platform = process.platform
    let apps: { name: string; identifier: string }[] = []

    if (platform === "win32") {
      // Use PowerShell to list start menu apps ending with .exe
      const { stdout } = await execAsync(`powershell -NoProfile -Command "Get-StartApps | Where-Object {$_.AppID -like '*.exe'} | Select-Object -ExpandProperty AppID"`)
      const lines = stdout.split(/\r?\n/).filter(Boolean)
      apps = lines.map(line => ({
        name: line.replace(/\.exe$/i, ""),
        identifier: line.trim()
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
