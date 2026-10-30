// Starting with the computer. On by default; Studium's Settings has a checkbox to turn it off.

/** For app.setLoginItemSettings: start hidden in the tray, so logging in doesn't open a window. */
function loginItemSettings(startWithComputer, exePath) {
  return { openAtLogin: startWithComputer, path: exePath, args: ['--hidden'] };
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

module.exports = { loginItemSettings, startWithComputerFrom };
