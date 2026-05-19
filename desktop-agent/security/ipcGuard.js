// Secure IPC guard middleware for Electron
// Validates the origin of IPC calls and optionally validates payloads.

/**
 * Checks whether the IPC event originates from a trusted context.
 * For this app we only allow calls from a file:// origin (preload bridge).
 * @param {Electron.IpcMainInvokeEvent} event
 * @returns {boolean}
 */
function isValidOrigin(event) {
  if (!event || !event.sender) return false;
  const url = typeof event.sender.getURL === 'function' ? event.sender.getURL() : '';
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    // Allow only the file protocol (preload scripts) or any custom protocol you explicitly trust.
    return protocol === 'file:';
  } catch (_) {
    return false;
  }
}

/**
 * Wrap an IPC handler with security checks.
 * @param {(event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<any>} handler
 * @returns {(event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<any>}
 */
function guardIpc(handler) {
  return async (event, ...args) => {
    if (!isValidOrigin(event)) {
      console.warn('Blocked unauthorized IPC call from', event.sender?.getURL?.());
      throw new Error('Unauthorized IPC origin');
    }
    // Payload validation can be added here if needed.
    return handler(event, ...args);
  };
}

module.exports = { guardIpc };
