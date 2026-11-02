// The "Build installers" workflow's last step: puts the installers on a draft GitHub Release
// v<version> (version from desktop/package.json). Run from the repo root with gh signed in:
//   node desktop/scripts/release.js <folder with the installers>
// A draft for this version gets its files replaced; a published one is never changed (bump the
// version instead); only main is released.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

/** What to do: 'create' a draft, 'update' a draft's files, or 'refuse' (with the reason). */
function releaseAction({ ref, existing, version }) {
  if (ref !== 'refs/heads/main') return { action: 'refuse', reason: `Releases are made from main only (this run is on ${ref}).` };
  if (!existing) return { action: 'create' };
  if (existing.isDraft) return { action: 'update' };
  return { action: 'refuse', reason: `v${version} is already published. Bump the version in desktop/package.json (and its lockfile) for a new release.` };
}

function gh(args, { allowFail = false } = {}) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.status !== 0 && !allowFail) {
    console.error(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result;
}

function main() {
  const dir = process.argv[2];
  const files = fs.readdirSync(dir).map((f) => path.join(dir, f));
  const { version } = require('../package.json');
  const tag = `v${version}`;
  const sha = process.env.GITHUB_SHA;

  const view = gh(['release', 'view', tag, '--json', 'isDraft', '-q', '.isDraft'], { allowFail: true });
  let existing = null;
  if (view.status === 0) existing = { isDraft: view.stdout.trim() === 'true' };
  else if (!/release not found/i.test(view.stderr)) {
    console.error(`Could not check for release ${tag}:\n${view.stderr}`);
    process.exit(1);
  }

  const { action, reason } = releaseAction({ ref: process.env.GITHUB_REF, existing, version });
  if (action === 'refuse') {
    console.error(reason);
    process.exit(1);
  }
  if (action === 'update') {
    gh(['release', 'upload', tag, ...files, '--clobber']);
    gh(['release', 'edit', tag, '--target', sha]);
    console.log(`Replaced the files on draft release ${tag}.`);
  } else {
    gh(['release', 'create', tag, ...files, '--draft', '--title', `Studium ${version}`, '--notes-file', '.github/release-notes.md', '--target', sha]);
    console.log(`Created draft release ${tag}. Open it on the Releases page and click Publish release.`);
  }
}

if (require.main === module) main();

module.exports = { releaseAction };
