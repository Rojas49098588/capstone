// Starting with the computer. On by default; Studium's Settings has a checkbox to turn it off.

/** For app.setLoginItemSettings: Studium opens with its window showing, so it's clear it started. */
function loginItemSettings(startWithComputer, exePath) {
  return { openAtLogin: startWithComputer, path: exePath, args: [] };
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
