// npm run dist: builds this computer's installer into releaseDir() (see releaseDir.js): the Windows
// .exe on Windows, the universal (Apple chip + Intel) .dmg on a Mac.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { releaseDir, distArgs } = require('./releaseDir');

const platform = process.platform === 'darwin' ? 'mac' : 'win';
const out = releaseDir();
const result = spawnSync('npx', distArgs(platform, out), {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  shell: true,
});
const { version } = require('../package.json');
const file = platform === 'mac' ? `Studium-${version}-mac.dmg` : `Studium-Setup-${version}.exe`;
if (result.status === 0) console.log(`\nInstaller: ${path.join(out, file)}`);
process.exit(result.status ?? 1);
