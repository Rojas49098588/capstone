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

module.exports = { loginItemSettings, startHidden, startQuietlyFrom, startWithComputerFrom };
