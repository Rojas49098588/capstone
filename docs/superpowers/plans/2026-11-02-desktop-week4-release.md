# Desktop Week 4: Mac build and release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classmates on Windows and Mac can download Studium from the repo's Releases page and install it, using one button in GitHub that builds both installers.

**Architecture:** A `workflow_dispatch` GitHub Actions workflow builds and checks the Windows `.exe` on `windows-latest` and a universal (Apple chip + Intel), ad-hoc-signed `.dmg` on `macos-latest`. A third job puts both on a draft Release that the user publishes. The main process gets the few Mac behaviors the Windows build never needed: opening the window from the Dock, start at login, the menu bar icon, and pets over full-screen apps. Each one is a small pure function with a unit test, wired in `main.js`.

**Tech Stack:** Electron 45, electron-builder 26, Vitest 5, Playwright 1.64 `_electron`, GitHub Actions (`actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`, `actions/download-artifact@v4`, the runner's `gh`).

**Spec:** `docs/superpowers/specs/2026-10-28-desktop-app-design.md` (Must-haves 7; Non-goals: signing, auto-update; "Building and handing out"; Week 4 in "Order of work").

## Global Constraints

- Branch `feature/desktop-week4-release`, cut from `main` (which has everything through PR #17).
- **User decisions (2026-11-02):**
  - The repo becomes **public** so anyone can download from Releases. The user flips this switch, and only after Task 1's scan is clean.
  - The Mac build is **universal** (arm64 + x64), one `.dmg`.
  - Builds run **on demand**, from the Actions tab's "Run workflow" button (`workflow_dispatch`). Nothing builds on every push.
  - The workflow builds **both** the Windows `.exe` and the Mac `.dmg`.
- **Unsigned** (spec Non-goals): no Apple developer account, no Windows certificate. The Mac app is ad-hoc signed (`identity: "-"`), which is free. It only keeps Apple-chip Macs from calling the app "damaged"; it doesn't stop the Gatekeeper warning.
- No auto-update (spec Non-goals). Testers install new builds by hand.
- Version `0.8.0` for the first release (`desktop/package.json`). Release tag `v<version>`.
- Never `--publish` from electron-builder. The release job uploads the files itself.
- Tests first for every code change. At the end of every task that touches code, run `npm test` and `npm run test:e2e` in `desktop/`, and `npx vitest run --maxWorkers=4` and `npm run build` in `web/`. In Git Bash, prefix commands with `export PATH="/c/Program Files/nodejs:/c/Program Files/Git/cmd:$PATH"` and unset `ELECTRON_RUN_AS_NODE`.
- Windows behavior must not change. Every Mac branch is keyed on `process.platform === 'darwin'`, passed in as a parameter so tests can cover both.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A Mac tester downloads the `.dmg` and opens the app on an Apple-chip Mac.** It must not say "Studium is damaged". The CI check: `codesign --verify --deep --strict` passes and `lipo -archs` lists both `x86_64` and `arm64` (Task 4). README fallback: `xattr -cr` (Task 5).
2. **The user closes the Studium window on a Mac, then clicks the Dock icon.** The window comes back. On a Mac this is the `activate` event, not a second instance (Task 2 e2e test).
3. **A Mac starts at login with "start quietly" on.** The window stays hidden; a normal launch opens it. macOS login items can't pass `--hidden` (Task 2 `startHidden` tests).
4. **A pet on a Mac while another app is full screen, or on another desktop (Space).** Pets stay visible (Task 2 overlay test).
5. **The workflow runs a second time for the same version.** The release job replaces the files on the existing draft instead of failing (Task 4 release step, checked in Task 6).

---

### Task 1: Check the repo is safe to make public

Making the repo public shows every commit ever made, not just today's files.

**Files:**
- Modify: `HANDOFF.md` (record the result)

- [ ] **Step 1: Scan the whole history for secrets.** Run from the repo root:
  ```bash
  git log --all -p | grep -n -E "eyJ[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|github_pat_|service_role|BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|password\s*[:=]\s*['\"][^'\"]{6,}"
  git log --all --name-only --format= | sort -u | grep -i -E "(^|/)\.env|secret|credential|\.pem$|\.p12$|\.key$"
  ```
  Expected: no output from either (test fixtures with obviously fake values are fine; list them). A preview run on 2026-11-02 found one hit, a false positive: an `"integrity": "sha512-..."` line in a `package-lock.json` whose hash happens to contain `eyJ`.
- [ ] **Step 2: Check for large or private files** that weren't meant to be shared: `git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | awk '$1=="blob" && $3 > 5000000'`. Expected: nothing over 5 MB.
- [ ] **Step 3: Tell the user what becomes public** besides the code:
  - Commit author emails: 177 commits use `abigailr@smu.edu`.
  - The images in `assets/`.
  - The `docs/` folder (specs, plans, HANDOFF).
  - The README.

  If anything in Steps 1–2 is found, **stop**. Removing it from history is destructive and the user's call.
- [ ] **Step 4: Record** in `HANDOFF.md` under a new "Week 4" bullet: `Public-repo check (date): no secrets or large files in history` (or what was found). Commit: `docs: public-repo check before Week 4 release`.

### Task 2: Mac behaviors in the main process

**Files:**
- Modify: `desktop/src/main/loginItem.js`, `desktop/src/main/tray.js`, `desktop/src/main/overlayWindow.js`, `desktop/src/main/store.js`, `desktop/src/main/main.js`
- Test: `desktop/test/loginItem.test.js`, `desktop/test/tray.test.js`, `desktop/test/overlayWindow.test.js`, `desktop/test/store.test.js` (existing files; add cases), `desktop/e2e/app.spec.js`

**Interfaces:**
- Produces:
  - `loginItemSettings(startWithComputer: boolean, exePath: string, quiet = false, platform = process.platform) -> object`. On Windows it's unchanged. On `darwin` it returns `{ openAtLogin: startWithComputer }` only (macOS ignores `path`/`args`).
  - `startHidden({ platform, argvHidden: boolean, openedAtLogin: boolean, quietSaved: boolean }) -> boolean`. Windows: `argvHidden`. `darwin`: `argvHidden || (openedAtLogin && quietSaved)`.
  - `trayOpensOnClick(platform) -> boolean`. `false` on `darwin`, where a click opens the menu, which already has Open Studium. `true` elsewhere.
  - `overlayPlatformSetup(win, platform) -> void`. On `darwin` it calls `win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` and `win.setAlwaysOnTop(true, 'floating')`. Elsewhere it does nothing.
  - Store key `loginQuiet: boolean`: saved on `darwin` each time the login item is applied, so the next login knows whether to start quietly.

- [ ] **Step 1: Write the failing unit tests.**
  - `loginItem.test.js`:
    - `loginItemSettings(true, '/x', true, 'darwin')` equals `{ openAtLogin: true }`.
    - `loginItemSettings(true, 'C:\\S.exe', true, 'win32')` equals `{ openAtLogin: true, path: 'C:\\S.exe', args: ['--hidden'] }`.
    - `startHidden`:
      - `win32`: argvHidden true → true; argvHidden false with openedAtLogin and quietSaved → false.
      - `darwin`: openedAtLogin + quietSaved → true; openedAtLogin without quietSaved → false; quietSaved without openedAtLogin (opened by hand) → false.
  - `tray.test.js`: `trayOpensOnClick('darwin')` is false; `trayOpensOnClick('win32')` is true.
  - `overlayWindow.test.js`, with a fake win recording calls:
    - `darwin` records `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` and `setAlwaysOnTop(true, 'floating')`.
    - `win32` records nothing.
- [ ] **Step 2: Write the failing e2e test** in `app.spec.js`: "clicking the Dock icon brings the closed window back". Launch, close the Studium window (it hides), then `app.evaluate(({ app }) => app.emit('activate'))`. Expect `studiumTest.win.isVisible()` to be true. This runs on Windows too, since the event is the same.
- [ ] **Step 3: Run them.** Expected: FAIL (`startHidden`, `trayOpensOnClick`, `overlayPlatformSetup` are not functions; no `activate` handler).
- [ ] **Step 4: Implement.**
  - `loginItem.js`: the platform parameter and `startHidden`.
  - `tray.js`: `if (trayOpensOnClick(process.platform)) tray.on('click', ...)`.
  - `overlayWindow.js`: call `overlayPlatformSetup(win, process.platform)` in `createOverlayWindow` after creating the window.
  - `main.js`:
    - `app.on('activate', () => showStudium(win))`, registered next to `second-instance`.
    - `show: !startHidden({ platform: process.platform, argvHidden: args.hidden, openedAtLogin: process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin === true, quietSaved: store.get().loginQuiet === true })`.
    - `applyLoginItem` also does `store.set({ loginQuiet: quiet })` on `darwin`.

    - `store.js` keeps only `STATE_KEYS`. Add `'loginQuiet'` to it, with a `store.test.js` case that `set({ loginQuiet: true })` survives a reload.
- [ ] **Step 5: Run all suites** (Global Constraints). Expected: PASS, and existing tests unchanged.
- [ ] **Step 6: Commit:** `feat(desktop): Mac Dock, login item, menu bar icon and full-screen pets`.

### Task 3: Build the Mac app and find either build's unpacked app

**Files:**
- Modify: `desktop/electron-builder.yml`, `desktop/scripts/dist.js`, `desktop/scripts/releaseDir.js`, `desktop/e2e/packaged.spec.js`, `desktop/package.json` (`"version": "0.8.0"`)
- Test: `desktop/test/releaseDir.test.js` (exists; add cases)

**Interfaces:**
- Produces:
  - `unpackedExe(dir: string, platform = process.platform) -> string`:
    - `win32`: `<dir>/win-unpacked/Studium.exe`.
    - `darwin`: `<dir>/mac-universal/Studium.app/Contents/MacOS/Studium`.
  - `distArgs(platform: 'win' | 'mac', out: string) -> string[]`:
    - win: `['electron-builder', '--win', 'nsis', '--publish', 'never', '--config.directories.output=' + out]`.
    - mac: `['electron-builder', '--mac', 'dmg', '--universal', '--publish', 'never', '--config.directories.output=' + out]`.
  - `npm run dist` builds for the current OS (`darwin` → mac, otherwise win).
  - Output names, set by `artifactName`:
    - `Studium-Setup-${version}.exe`
    - `Studium-${version}-mac.dmg`

    These have no spaces, so release links and the README stay simple. The README and `dist.js`'s closing message use these names.

- [ ] **Step 1: Write the failing tests** in `releaseDir.test.js`:
  - `unpackedExe('/r', 'darwin')` and `unpackedExe('C:\\r', 'win32')` equal the paths above. Compare with `path.join` for the platform under test, or build the expected path with the same separator.
  - `distArgs('mac', '/o')` contains `'--universal'` and `'never'`.
  - `distArgs('win', 'C:\\o')` contains `'nsis'` and not `'--universal'`.
- [ ] **Step 2: Run.** Expected: FAIL (not functions).
- [ ] **Step 3: Implement.**
  - `releaseDir.js`: `unpackedExe` and `distArgs`.
  - `dist.js`: uses them.
  - `packaged.spec.js`: `exe = () => unpackedExe(releaseDir())`.
  - `electron-builder.yml` gains:
    ```yaml
    mac:
      target: dmg
      category: public.app-category.productivity
      identity: "-"          # ad-hoc signature: free, keeps Apple-chip Macs from calling the app "damaged"
      hardenedRuntime: false
      artifactName: Studium-${version}-mac.${ext}
    dmg:
      title: Studium ${version}
    nsis:
      artifactName: Studium-Setup-${version}.${ext}
    ```
    Keep the existing `nsis` keys. Update the file's top comment: it builds Windows and Mac.

  If electron-builder 26 rejects `identity: "-"`, use `identity: null` plus a workflow step `codesign --force --deep --sign - <app>` before making the dmg. Ledger this as a ruling.
- [ ] **Step 4: Run** the unit tests, then `npm run dist` on this PC. Expected: `Studium-Setup-0.8.0.exe` in `~/StudiumBuilds`. Then run `STUDIUM_PACKAGED=1 npx playwright test packaged`. Expected: 3 passed.
- [ ] **Step 5: Commit:** `build(desktop): universal Mac dmg target; one dist script for both`.

### Task 4: The build workflow

**Files:**
- Create: `.github/workflows/build.yml`

**Interfaces:**
- Consumes: `npm run dist` (Task 3), `unpackedExe` (via `packaged.spec.js`), and env var `STUDIUM_RELEASE_DIR`.
- Produces:
  - Workflow name **"Build installers"**, run from the Actions tab.
  - Artifacts `studium-windows` (the `.exe`) and `studium-mac` (the `.dmg`).
  - A **draft** Release `v<version>` with both files.

- [ ] **Step 1: Write the workflow.**
  - Triggers:
    - `workflow_dispatch`.
    - A temporary `push: branches: [feature/desktop-week4-release]`. The Run workflow button only appears once the file is on `main`, so this lets the branch be tested first. Task 6 removes it.
  - `permissions: contents: read` at the top. The release job overrides it with `contents: write`.
  - Job `build`:
    - Matrix `os: [windows-latest, macos-latest]`, `fail-fast: false`.
    - Steps:
      1. Checkout.
      2. `setup-node` with `node-version: 24` and `cache: npm`, with `cache-dependency-path` listing `web/package-lock.json` and `desktop/package-lock.json`.
      3. `npm ci` in `web` and in `desktop`.
      4. `npx vitest run` in `web`.
      5. `npm test` in `desktop`.
      6. `npm run dist` in `desktop`, with `STUDIUM_RELEASE_DIR: ${{ runner.temp }}/release`.
      7. `npx playwright test packaged` in `desktop`, with `STUDIUM_PACKAGED: '1'` and the same `STUDIUM_RELEASE_DIR`.
      8. Mac only (`if: runner.os == 'macOS'`): `codesign --verify --deep --strict "$STUDIUM_RELEASE_DIR/mac-universal/Studium.app"`, then `lipo -archs "$STUDIUM_RELEASE_DIR/mac-universal/Studium.app/Contents/MacOS/Studium"`, with an output check that fails unless it has both `x86_64` and `arm64`.
      9. `upload-artifact`:
         - Windows: name `studium-windows`, path `*.exe`.
         - Mac: name `studium-mac`, path `*.dmg`.
         - `if-no-files-found: error`.
  - Job `release`:
    - `needs: build`, and only on `workflow_dispatch` (`if: github.event_name == 'workflow_dispatch'`).
    - Runs on `ubuntu-latest` with `permissions: contents: write`.
    - Steps:
      1. Checkout.
      2. Read the version with `node -p "require('./desktop/package.json').version"`.
      3. `download-artifact` with `merge-multiple: true`.
      4. If `gh release view v$VERSION` succeeds, run `gh release upload v$VERSION <files> --clobber`. Otherwise run `gh release create v$VERSION <files> --draft --title "Studium $VERSION" --notes-file .github/release-notes.md --target ${{ github.sha }}`.
    - `GH_TOKEN: ${{ github.token }}`.
- [ ] **Step 2: Create `.github/release-notes.md`.** It holds the download and install steps for testers, a short copy of Task 5's README section: which file is for which computer, the Windows warning steps, the Mac warning steps, and the `xattr` fallback.
- [ ] **Step 3: Check the YAML parses.** Run in `desktop/`: `node -e "require('js-yaml').load(require('fs').readFileSync('../.github/workflows/build.yml','utf8')); console.log('ok')"` (js-yaml comes with electron-builder). Expected: `ok`.
- [ ] **Step 4: Commit and push the branch:** `ci: build Windows and universal Mac installers on demand`. The push triggers the temporary `push` run. Expected: both `build` jobs green, and both artifacts on the run's page; the release job is skipped. Read failures with the user, or through the API using the saved git login: `GET /repos/Rojas49098588/capstone/actions/runs`, then the jobs' logs. Fix and push until green, then commit.

### Task 5: README, release notes, HANDOFF

**Files:**
- Modify: `README.md`, `HANDOFF.md`, `.github/release-notes.md` (keep in step)

- [ ] **Step 1: README.**
  - The "Desktop app (in progress)" heading becomes "Desktop app". Its first line says the desktop app is the way to run Studium, and that the browser version and the extension are retired (spec, "Retiring").
  - Add an **"Installing"** section near the top:
    - Download from the repo's **Releases** page: Windows `Studium-Setup-<version>.exe`, Mac `Studium-<version>-mac.dmg` (Apple chip and Intel).
    - Windows: "Windows protected your PC" → **More info → Run anyway**.
    - Mac:
      - Open the dmg and drag Studium to Applications.
      - Open it. When macOS blocks it, go to **System Settings → Privacy & Security** and click **Open Anyway** (macOS 15 and later). On macOS 14 or earlier, you can instead right-click the app → **Open**.
      - If it says the app is damaged, run `xattr -cr /Applications/Studium.app` in Terminal.
    - On a Mac, Studium's icon is in the menu bar at the top right, and pets walk along the top of the Dock.
    - Updating: install the new version over the old one. Your projects and pets stay.
  - Building it yourself stays below (`npm run dist`, now for either OS), plus a line on the **Build installers** workflow.
- [ ] **Step 2: HANDOFF.** Under Week 4, record:
  - the workflow and how to run it;
  - the draft-release flow;
  - `loginQuiet` and why it exists;
  - the ad-hoc signing;
  - that the repo is public once the user flips it.
- [ ] **Step 3: Commit:** `docs: Installing section for Windows and Mac; Week 4 handoff`.

### Task 6: First release and the Mac install test (user, with the agent's help)

- [ ] **Step 1: Remove the temporary `push` trigger** from `build.yml`. Commit (`ci: build installers only on demand`), push, and open the PR into `main`. The user merges it.
- [ ] **Step 2: The user makes the repo public.** GitHub → repo → Settings → General → Danger Zone → Change visibility → Public. Only after Task 1 came back clean. The agent doesn't do this.
- [ ] **Step 3: The user runs the workflow:** Actions → **Build installers** → Run workflow on `main`. Expected: a draft Release `v0.8.0` with both files. Running it again replaces the files and doesn't fail (Review Focus 5). The user opens the draft and clicks **Publish release**.
- [ ] **Step 4: Windows check (user):** download the `.exe` from the Release page (not `StudiumBuilds`), install over 0.7.0, and confirm the existing projects and pets are still there.
- [ ] **Step 5: Mac check (a classmate), each line pass/fail:**
  1. Downloads the dmg from the Release page, drags it to Applications, and gets past the warning with README's steps. No "damaged" message.
  2. Setup shows. Make a project and finish a task, so the egg hatches (or use the example data).
  3. The pet walks along the top of the Dock, on top of other apps. Clicks next to it reach the app underneath.
  4. Drag, click, and right-click → each menu item works. Open project opens Studium at the project.
  5. The menu bar icon's menu works: Open Studium, Hide/Show pets, Quit.
  6. Closing the window keeps the app running; clicking the Dock icon brings it back. Cmd+Q quits.
  7. A full-screen app (for example Safari full screen) still shows the pets.
  8. "Start Studium when your computer starts", after logging out and back in: Studium is running. With quiet start, there's no window.
  9. On Moderate, pet sounds and notes work.
  10. Which Mac (Apple chip or Intel) and which macOS version.
- [ ] **Step 6: Record results** in `HANDOFF.md`. Each failure becomes a Task 7 item. Commit.

### Task 7: Tester fixes

One loop per issue reported in Task 6 (or later by testers):

- [ ] Write it down in `HANDOFF.md` under "Week 4 tester reports", with the date, who reported it, and what they saw.
- [ ] Use superpowers:systematic-debugging to find the cause. Write a failing test, fix, and run all suites.
- [ ] Bump the patch version (`0.8.1`, …). Run **Build installers**, publish the release, and ask the tester to re-check that line.
- [ ] Mark it fixed in `HANDOFF.md` with the commit.

Issues that need paid signing (for example a corporate Mac that blocks unsigned apps entirely) are recorded as "needs Apple developer account (user's call)" rather than worked around.
