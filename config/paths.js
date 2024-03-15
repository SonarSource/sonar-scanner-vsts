const path = require("path");
const fs = require("fs-extra");

// Make sure any symlinks in the project folder are resolved:
// https://github.com/facebookincubator/create-react-app/issues/637
const appDirectory = fs.realpathSync(process.cwd());

function resolveRelativePath(relativePath) {
  return path.resolve(appDirectory, relativePath);
}
exports.resolveRelativePath = resolveRelativePath;

exports.pathAllFiles = function (...paths) {
  return path.join(...paths, "**", "*");
};

const buildPath = resolveRelativePath("build");
const commonPath = resolveRelativePath("common");
const commonv5Path = resolveRelativePath("commonv5");
const extensionsPath = resolveRelativePath("extensions");

exports.paths = {
  root: appDirectory,
  build: {
    root: buildPath,
    extensions: {
      root: path.join(buildPath, "extensions"),
      tasks: path.join(buildPath, "extensions", "**", "tasks"),
      sonarqubeTasks: path.join(buildPath, "extensions", "sonarqube", "tasks"),
      sonarcloudTasks: path.join(buildPath, "extensions", "sonarcloud", "tasks"),
    },
    classicScanner: path.join(buildPath, "tmp", "classic-sonar-scanner-msbuild"),
    dotnetScanner: path.join(buildPath, "tmp", "dotnet-sonar-scanner-msbuild"),
  },
  common: path.join(commonPath, "ts"),
  commonv5: path.join(commonv5Path, "ts"),
  extensions: {
    root: extensionsPath,
    tasks: {
      root: path.join(extensionsPath, "**", "tasks"),
      scv1: path.join(extensionsPath, "**", "tasks", "**", "v1"),
      v4: path.join(extensionsPath, "**", "tasks", "**", "v4"),
      v5: path.join(extensionsPath, "**", "tasks", "**", "v5"),
    },
  },
};
