// Starting with the computer. On by default; Studium's Settings can turn it off, and can choose a
// quiet start (in the tray, window hidden) instead of opening the window.

/**
 * For app.setLoginItemSettings. On Windows a quiet start passes --hidden. macOS ignores path and
 * args, so there the quiet choice is saved instead (store key loginQuiet; see startHidden).
 */
function loginItemSettings(startWithComputer, exePath, quiet = false, platform = process.platform) {
  if (platform === 'darwin') return { openAtLogin: startWithComputer };
  return { openAtLogin: startWithComputer, path: exePath, args: quiet ? ['--hidden'] : [] };
}

/**
 * Linux has no login-item API in Electron: starting with the computer is a desktop entry in the
 * user's autostart folder (the freedesktop.org standard most Linux desktops follow). Returns the file
 * and what to write, or content null to remove it. An AppImage runs from a temporary folder, so the
 * entry starts the AppImage file itself (APPIMAGE).
 */
function linuxAutostart(startWithComputer, exePath, quiet = false, env = process.env) {
  const config = env.XDG_CONFIG_HOME || `${env.HOME}/.config`;
  const file = `${config}/autostart/studium.desktop`;
  if (!startWithComputer) return { file, content: null };
  const exe = env.APPIMAGE || exePath;
  const lines = [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Studium',
    'Comment=Studium and its project pets',
    `Exec="${exe}"${quiet ? ' --hidden' : ''}`,
    'X-GNOME-Autostart-enabled=true',
  ];
  return { file, content: `${lines.join('\n')}\n` };
}

/** Whether to start with the window hidden: --hidden, or on a Mac a login start with quiet start saved. */
function startHidden({ platform, argvHidden, openedAtLogin, quietSaved }) {
  if (argvHidden) return true;
  return platform === 'darwin' && openedAtLogin && quietSaved;
}

/** Reads startWithComputer from Studium's saved settings (JSON text). Missing or damaged means on. */
function startWithComputerFrom(raw) {
  try {
    const value = JSON.parse(raw);
    return !(value && typeof value === 'object' && value.startWithComputer === false);
  } catch {
    return true;
  }
}

/** Reads startQuietly from Studium's saved settings (JSON text). Missing or damaged means open the window. */
function startQuietlyFrom(raw) {
  try {
    const value = JSON.parse(raw);
    return Boolean(value && typeof value === 'object' && value.startQuietly === true);
  } catch {
    return false;
  }
}

module.exports = { linuxAutostart, loginItemSettings, startHidden, startQuietlyFrom, startWithComputerFrom };
