import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import path from "path"

const execAsync = promisify(exec)

export async function GET() {
  // This endpoint is only useful during local development. In production the
  // desktop‑agent provides the data via IPC, so we intentionally return an empty list.
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ apps: [] })
  }

  try {
    const platform = process.platform
    let apps: { name: string; identifier: string }[] = []

    if (platform === "win32") {
      // Scan common program directories for .exe files – fast enough for dev.
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

      const [out1, out2] = await Promise.all([execCmd(programFiles), execCmd(programFilesX86)])
      const lines = (out1 + "\n" + out2).split(/\r?\n/).filter(Boolean)
      apps = lines.map(line => ({
        name: path.basename(line, ".exe"),
        identifier: line,
      }))
    } else if (platform === "darwin") {
      const { stdout } = await execAsync('ls /Applications')
      const lines = stdout.split(/\r?\n/).filter(Boolean)
      apps = lines
        .filter(name => name.endsWith('.app'))
        .map(name => ({
          name: name.replace(/\.app$/i, ''),
          identifier: `/Applications/${name}`,
        }))
    } else {
      // Linux – read .desktop entries from system and user locations
      const dirs = ['/usr/share/applications', `${process.env.HOME}/.local/share/applications`]
      for (const dir of dirs) {
        try {
          const { stdout } = await execAsync(`ls "${dir}"`)
          const files = stdout.split(/\r?\n/).filter(Boolean)
          for (const file of files) {
            if (!file.endsWith('.desktop')) continue
            const name = file.replace('.desktop', '')
            apps.push({ name, identifier: `${dir}/${file}` })
          }
        } catch {
          // ignore missing dir
        }
      }
    }

    // Basic filtering – remove obvious uninstallers / updaters etc.
    const filtered = apps.filter(app => {
      const lower = app.name.toLowerCase()
      return !/(uninstall|updater|runtime|helper|driver|install)/.test(lower)
    })

    return NextResponse.json({ apps: filtered })
  } catch (error) {
    console.error('Error detecting installed apps:', error)
    return NextResponse.json({ apps: [] }, { status: 500 })
  }
}
