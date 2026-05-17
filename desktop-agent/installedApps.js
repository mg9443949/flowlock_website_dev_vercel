const { exec } = require('child_process')
const { promisify } = require('util')
const path = require('path')
const os = require('os')

const execAsync = promisify(exec)

/**
 * Detect installed applications on the host OS.
 * Returns an array of objects containing optional icon data.
 */
async function getInstalledApps() {
  const platform = process.platform
  const apps = []

  if (platform === 'win32') {
    // Use PowerShell Get-StartApps for a quick list of start‑menu shortcuts.
    try {
      const cmd = `powershell -NoProfile -Command "Get-StartApps | Where-Object {$_.AppID -like '*.exe'} | Select-Object Name,AppID | ConvertTo-Json -Compress"`
      const { stdout } = await execAsync(cmd)
      const parsed = JSON.parse(stdout)
      const entries = Array.isArray(parsed) ? parsed : [parsed]
      entries.forEach(entry => {
        const name = entry.Name?.trim()
        const identifier = entry.AppID?.trim()
        if (name && identifier) {
          const lower = name.toLowerCase()
          if (!/(uninstall|updater|runtime|helper|driver|install)/.test(lower)) {
            apps.push({ name, identifier })
          }
        }
      })
    } catch (e) {
      console.error('Windows app detection error:', e)
    }
  } else if (platform === 'darwin') {
    try {
      const { stdout } = await execAsync('ls /Applications')
      const lines = stdout.split(/\r?\n/).filter(Boolean)
      lines
        .filter(name => name.endsWith('.app'))
        .forEach(name => {
          const clean = name.replace(/\.app$/i, '')
          const lower = clean.toLowerCase()
          if (!/(uninstall|updater|runtime|helper|driver|install)/.test(lower)) {
            apps.push({ name: clean, identifier: `/Applications/${name}` })
          }
        })
    } catch (e) {
      console.error('macOS app detection error:', e)
    }
  } else {
    // Linux/Unix – read .desktop entries from system and user locations.
    const dirs = ['/usr/share/applications', `${os.homedir()}/.local/share/applications`]
    for (const dir of dirs) {
      try {
        const { stdout } = await execAsync(`ls "${dir}"`)
        const files = stdout.split(/\r?\n/).filter(Boolean)
        files.forEach(file => {
          if (!file.endsWith('.desktop')) return
          const name = file.replace('.desktop', '')
          const lower = name.toLowerCase()
          if (!/(uninstall|updater|runtime|helper|driver|install)/.test(lower)) {
            apps.push({ name, identifier: `${dir}/${file}` })
          }
        })
      } catch {
        // ignore missing directories or read errors
      }
    }
  }

  return apps
}

module.exports = { getInstalledApps }
