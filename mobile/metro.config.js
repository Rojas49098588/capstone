// The phone app uses the web app's own code (web/src, through the @shared alias) and its pet art
// (web/public/pets). Packages those files import (firebase, ...) must come from mobile/node_modules,
// never web/node_modules, so the app has one copy of each (two Firebases would not share sign-in).
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const webRoot = path.resolve(__dirname, "../web");
const sharedRoot = path.join(webRoot, "src");

config.watchFolders = [...(config.watchFolders ?? []), sharedRoot, path.join(webRoot, "public/pets")];

const appEntry = path.join(__dirname, "package.json"); // any file in the app: resolves packages from mobile/node_modules
const previous = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = previous ?? context.resolveRequest;
  if (moduleName.startsWith("@shared/")) {
    return resolve(context, path.join(sharedRoot, moduleName.slice("@shared/".length)), platform);
  }
  const bare = !moduleName.startsWith(".") && !path.isAbsolute(moduleName);
  if (bare && context.originModulePath.startsWith(webRoot)) {
    return resolve({ ...context, originModulePath: appEntry }, moduleName, platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
