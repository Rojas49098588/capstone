// npm run dist: builds the Windows installer into releaseDir() (see releaseDir.js).
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { releaseDir } = require('./releaseDir');

const out = releaseDir();
const result = spawnSync('npx', ['electron-builder', '--win', 'nsis', `--config.directories.output=${out}`], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  shell: true,
});
if (result.status === 0) console.log(`\nInstaller: ${path.join(out, 'Studium Setup <version>.exe')}`);
process.exit(result.status ?? 1);
