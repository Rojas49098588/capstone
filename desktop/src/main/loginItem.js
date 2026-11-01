// Starting with the computer. On by default; Studium's Settings can turn it off, and can choose a
// quiet start (in the tray, window hidden) instead of opening the window.

/** For app.setLoginItemSettings. A quiet start passes --hidden. */
function loginItemSettings(startWithComputer, exePath, quiet = false) {
  return { openAtLogin: startWithComputer, path: exePath, args: quiet ? ['--hidden'] : [] };
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

module.exports = { loginItemSettings, startQuietlyFrom, startWithComputerFrom };
