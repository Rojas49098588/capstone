// npm run dist: builds this computer's installer into releaseDir() (see releaseDir.js): the Windows
// .exe on Windows, the universal (Apple chip + Intel) .dmg on a Mac, the .deb on Linux.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { releaseDir, distArgs } = require('./releaseDir');

const platform = { darwin: 'mac', linux: 'linux' }[process.platform] ?? 'win';
const out = releaseDir();
const result = spawnSync('npx', distArgs(platform, out), {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  shell: true,
});
const { version } = require('../package.json');
const files = {
  mac: [`Studium-${version}-mac.dmg`],
  linux: [`Studium-${version}-amd64.deb`],
  win: [`Studium-Setup-${version}.exe`],
}[platform];
if (result.status === 0) for (const file of files) console.log(`\nInstaller: ${path.join(out, file)}`);
process.exit(result.status ?? 1);
