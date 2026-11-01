// "Quit Studium" in the menu you get by right-clicking Studium's taskbar button (a Windows jump list
// task). It starts Studium again with --quit; the running copy gets that as a second instance and quits.
// Windows hides new tray icons under the ^ arrow, so the tray's Quit is easy to miss.

function quitTask(exePath) {
  return {
    program: exePath,
    arguments: '--quit',
    title: 'Quit Studium',
    description: 'Close Studium and stop it running in the background',
    iconPath: exePath,
    iconIndex: 0,
  };
}

module.exports = { quitTask };
