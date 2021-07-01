import * as path from "path";
import * as _ from "lodash";
import * as semver from "semver";
import * as fs from "fs-extra";
import * as tl from "azure-pipelines-task-lib/task";
import * as toolLib from "azure-pipelines-tool-lib/tool";
import { ToolRunner } from "azure-pipelines-task-lib/toolrunner";
import { getNoSonar } from "../helpers/request";
import { PROP_NAMES, isWindows } from "../helpers/utils";

export enum ScannerMode {
  MSBuild = "MSBuild",
  CLI = "CLI",
  Other = "Other",
}

interface IScannerDotNetRelease {
  url: string;
  version: string;
  fileName: string;
}

export default class Scanner {
  constructor(public rootPath: string, public mode: ScannerMode) {}

  //MMF-2035
  private static isSonarCloud: boolean;

  public static setIsSonarCloud(value: boolean) {
    this.isSonarCloud = value;
  }

  public static getIsSonarCloud(): boolean {
    return this.isSonarCloud;
  }
  //MMF-2035

  public toSonarProps() {
    return {};
  }

  public async runPrepare() {}

  public async runAnalysis() {}

  public static getScanner(rootPath: string) {
    return new Scanner(rootPath, ScannerMode.Other);
  }

  public static getPrepareScanner(rootPath: string, mode: ScannerMode) {
    switch (mode) {
      case ScannerMode.Other:
        return Scanner.getScanner(rootPath);
      case ScannerMode.MSBuild:
        return ScannerMSBuild.getScanner(rootPath);
      case ScannerMode.CLI:
        return ScannerCLI.getScanner(rootPath);
      default:
        throw new Error(`[SQ] Unknown scanner mode: ${mode}`);
    }
  }

  public static getAnalyzeScanner(rootPath: string, mode: ScannerMode) {
    switch (mode) {
      case ScannerMode.Other:
        tl.warning(
          `[SQ] When using Maven or Gradle, don't use the analyze task but instead tick the ` +
            `'SonarQube' option in the Maven/Gradle task to run the scanner as part of the build.`
        );
        return Scanner.getScanner(rootPath);
      case ScannerMode.MSBuild:
        return new ScannerMSBuild(rootPath, {});
      case ScannerMode.CLI:
        return new ScannerCLI(rootPath, {});
      default:
        throw new Error(`[SQ] Unknown scanner mode: ${mode}`);
    }
  }

  logIssueOnBuildSummaryForStdErr(tool) {
    tool.on("stderr", (data) => {
      if (data == null) {
        return;
      }
      data = data.toString().trim();
      if (data.indexOf("WARNING: An illegal reflective access operation has occurred") !== -1) {
        //bypass those warning showing as error because they can't be catched for now by Scanner.
        tl.debug(data);
        return;
      }
      tl.command("task.logissue", { type: "error" }, data);
    });
  }

  //Temporary warning message for Java version (MMF-2035)
  logIssueAsWarningForStdOut(tool) {
    tool.on("stdout", (data) => {
      if (data == null) {
        return;
      }
      data = data.toString().trim();
      if (data.indexOf("Please update to at least Java 11") !== -1 && Scanner.getIsSonarCloud()) {
        tl.command("task.logissue", { type: "warning" }, data);
      }
    });
  }
  //Temporary warning message for Java version (MMF-2035)

  isDebug() {
    return tl.getVariable("system.debug") === "true";
  }
}

interface ScannerCLIData {
  projectSettings?: string;
  projectKey?: string;
  projectName?: string;
  projectVersion?: string;
  projectSources?: string;
}

export class ScannerCLI extends Scanner {
  constructor(rootPath: string, private readonly data: ScannerCLIData, private cliMode?: string) {
    super(rootPath, ScannerMode.CLI);
  }

  public toSonarProps() {
    if (this.cliMode === "file") {
      return { [PROP_NAMES.PROJECTSETTINGS]: this.data.projectSettings };
    }
    return {
      [PROP_NAMES.PROJECTKEY]: this.data.projectKey,
      [PROP_NAMES.PROJECTNAME]: this.data.projectName,
      [PROP_NAMES.PROJECTVERSION]: this.data.projectVersion,
      [PROP_NAMES.PROJECTSOURCES]: this.data.projectSources,
    };
  }

  public async runAnalysis() {
    let scannerCliScript = tl.resolve(this.rootPath, "sonar-scanner", "bin", "sonar-scanner");

    if (isWindows()) {
      scannerCliScript += ".bat";
    } else {
      await fs.chmod(scannerCliScript, "777");
    }
    const scannerRunner = tl.tool(scannerCliScript);
    this.logIssueOnBuildSummaryForStdErr(scannerRunner);
    this.logIssueAsWarningForStdOut(scannerRunner);
    if (this.isDebug()) {
      scannerRunner.arg("-X");
    }
    await scannerRunner.exec();
  }

  public static getScanner(rootPath: string) {
    const mode = tl.getInput("configMode");
    if (mode === "file") {
      return new ScannerCLI(rootPath, { projectSettings: tl.getInput("configFile", true) }, mode);
    }
    return new ScannerCLI(
      rootPath,
      {
        projectKey: tl.getInput("cliProjectKey", true),
        projectName: tl.getInput("cliProjectName"),
        projectVersion: tl.getInput("cliProjectVersion"),
        projectSources: tl.getInput("cliSources"),
      },
      mode
    );
  }
}

interface ScannerMSData {
  projectKey?: string;
  projectName?: string;
  projectVersion?: string;
  organization?: string;
}

export class ScannerMSBuild extends Scanner {
  readonly SCANNER_LATEST_RELEASE_URL = "repos/SonarSource/sonar-scanner-msbuild/releases/latest";
  readonly SCANNER_LATEST_RELEASE_BASEPATH = "https://api.github.com";
  readonly SCANNER_PATH = "SONAR_SCANNER_DOTNET_PATH";
  readonly SCANNER_USE_DLL_VERSION = "SONAR_SCANNER_DOTNET_USE_DLL_VERSION";
  readonly SCANNER_DOTNET_PROVIDED_VERSION = "SONAR_SCANNER_DOTNET_MAJOR_VERSION";
  readonly MIN_DOTNET_MAJOR_VERSION = 2;
  //Update this max once a new major release of dotnet / S4DN is made
  readonly MAX_DOTNET_MAJOR_VERSION = 5;
  readonly SCANNER_TOOL_NAME = "sonar-scanner-dotnet";

  readonly SCANNER_DOTNET_VERSION_MATRIX = new Map([
    [2, "netcoreapp2.0"],
    [3, "netcoreapp3.0"],
    [5, "net5.0"],
  ]);

  constructor(rootPath: string, private readonly data: ScannerMSData) {
    super(rootPath, ScannerMode.MSBuild);
  }

  public toSonarProps() {
    return {
      [PROP_NAMES.PROJECTKEY]: this.data.projectKey,
      [PROP_NAMES.PROJECTNAME]: this.data.projectName,
      [PROP_NAMES.PROJECTVERSION]: this.data.projectVersion,
    };
  }

  public async runPrepare() {
    let scannerRunner;
    const useDllVersion = tl.getVariable(this.SCANNER_USE_DLL_VERSION);
    if (isWindows() && !useDllVersion) {
      const release = await this.getLatestRelease("net46");
      tl.debug(`Fetched latest release : ${JSON.stringify(release)}`);
      const scannerExePath = await this.checkCacheOrDownloadScanner(release, "net46");
      tl.debug(`Using scanner at ${scannerExePath}`);
      tl.setVariable(this.SCANNER_PATH, scannerExePath);
      scannerRunner = this.getScannerRunner(scannerExePath, true);
    } else {
      scannerRunner = await this.getDotNetScannerRunner();
    }

    scannerRunner.arg("begin");
    scannerRunner.arg("/k:" + this.data.projectKey);
    if (this.data.organization) {
      scannerRunner.arg("/o:" + this.data.organization);
    }
    this.logIssueOnBuildSummaryForStdErr(scannerRunner);
    this.logIssueAsWarningForStdOut(scannerRunner);
    if (this.isDebug()) {
      scannerRunner.arg("/d:sonar.verbose=true");
    }
    await scannerRunner.exec();
  }

  private async getDotNetScannerRunner() {
    let dotnetMajorVersion = this.getAndParseProvidedDotnetMajor();
    if (!dotnetMajorVersion) {
      dotnetMajorVersion = this.getDotnetMajorVersion();
    }

    const tfm = this.SCANNER_DOTNET_VERSION_MATRIX.get(dotnetMajorVersion);
    if (!tfm) {
      throw new Error(`Failed to retrieve TFM for version ${dotnetMajorVersion}`);
    }

    const release = await this.getLatestRelease(tfm);
    tl.debug(`Fetched latest release : ${JSON.stringify(release)}`);
    const scannerPath = await this.checkCacheOrDownloadScanner(release, tfm);
    tl.debug(`Using scanner at ${scannerPath}`);
    tl.setVariable(this.SCANNER_PATH, scannerPath);
    // Need to set executable flag on the embedded scanner CLI
    await this.makeShellScriptExecutable(scannerPath);
    return this.getScannerRunner(scannerPath, false);
  }

  private async checkCacheOrDownloadScanner(release: any, tfm: string): Promise<string> {
    tl.debug(`Trying to find local installation of Scanner for .NET v${release.version}`);
    let toolPath = toolLib.findLocalTool(this.SCANNER_TOOL_NAME, release.version, tfm);
    if (!toolPath) {
      tl.debug(`Scanner for .NET v${release.version} was not found in cache, downloading...`);
      const downloadPath: string = await toolLib.downloadTool(release.url);
      tl.assertAgent("2.115.0");
      let extPath = tl.getVariable("Agent.TempDirectory");
      if (!extPath) {
        throw new Error("Expected Agent.TempDirectory to be set");
      }

      extPath = path.join(extPath, this.SCANNER_TOOL_NAME, release.version, tfm);
      extPath = await toolLib.extractZip(downloadPath, extPath);

      toolPath = await toolLib.cacheDir(extPath, this.SCANNER_TOOL_NAME, release.version, tfm);
    }

    return toolPath;
  }

  private getLatestRelease(tfm: string): Promise<IScannerDotNetRelease> {
    return getNoSonar(this.SCANNER_LATEST_RELEASE_BASEPATH, this.SCANNER_LATEST_RELEASE_URL).then(
      (githubRelease) => {
        tl.debug(JSON.stringify(githubRelease));

        const assetFound = _.find(githubRelease.assets, (asset) => asset.name.includes(tfm));

        if (assetFound) {
          const toReturn = {
            url: assetFound.browser_download_url,
            version: githubRelease.name,
            fileName: assetFound.name,
          };
          return toReturn;
        }

        tl.warning("Could not fetch latest release url from GitHub.");
        return null;
      }
    );
  }

  private getDotnetMajorVersion(): number {
    tl.debug("Trying to fetch used dotnet version using dotnet --version.");
    const dotnetVersionRunner = this.getDotnetToolRunner();
    dotnetVersionRunner.arg("--version");
    try {
      const stdOut = dotnetVersionRunner.execSync().stdout;
      const version = semver.parse(stdOut);
      if (version == null) {
        tl.warning("Could not fetch dotnet version.");
        return null;
      }
      tl.debug(`Found dotnet version ${version.major}`);
      return version.major;
    } catch (e) {
      throw new Error(
        "An error has occured while trying to execute or parse dotnet --version command output : " +
          e
      );
    }
  }

  private getAndParseProvidedDotnetMajor(): number {
    const providedDotnetMajorVersion = tl.getVariable(this.SCANNER_DOTNET_PROVIDED_VERSION);
    if (providedDotnetMajorVersion) {
      tl.debug(
        `Found a provided ${this.SCANNER_DOTNET_PROVIDED_VERSION} variable, trying to parse it.`
      );
      const intMajorversion = parseInt(providedDotnetMajorVersion, 10);
      //Increase the max version each time a new major release of dotnet/ S4DN is done
      if (
        isNaN(intMajorversion) ||
        intMajorversion < this.MIN_DOTNET_MAJOR_VERSION ||
        intMajorversion > this.MAX_DOTNET_MAJOR_VERSION
      ) {
        tl.warning(`Failed to parse '${providedDotnetMajorVersion}' as a major version.
        It should be a number between ${this.MIN_DOTNET_MAJOR_VERSION} and ${this.MAX_DOTNET_MAJOR_VERSION}.`);
        return null;
      }
      return intMajorversion;
    }
    tl.debug(`No provided ${this.SCANNER_DOTNET_PROVIDED_VERSION} variable found`);
    return null;
  }

  private async makeShellScriptExecutable(scannerExecutablePath: string) {
    const scannerCliShellScripts = tl.findMatch(
      scannerExecutablePath,
      path.join("sonar-scanner-*", "bin", "sonar-scanner*")
    );

    for (const scannerCliShellScript of scannerCliShellScripts) {
      await fs.chmod(scannerCliShellScript, "777");
    }
  }

  private getScannerRunner(scannerPath: string, isExeScanner: boolean) {
    if (isExeScanner) {
      return tl.tool(path.join(scannerPath, "SonarScanner.MSBuild.exe"));
    }

    const scannerRunner = this.getDotnetToolRunner();
    scannerRunner.arg(path.join(scannerPath, "SonarScanner.MSBuild.dll"));
    return scannerRunner;
  }

  private getDotnetToolRunner(): ToolRunner {
    const dotnetToolPath = tl.which("dotnet", true);
    return tl.tool(dotnetToolPath);
  }

  public async runAnalysis() {
    const scannerRunner = isWindows()
      ? this.getScannerRunner(this.SCANNER_PATH, true)
      : this.getScannerRunner(this.SCANNER_PATH, false);

    scannerRunner.arg("end");
    this.logIssueOnBuildSummaryForStdErr(scannerRunner);
    this.logIssueAsWarningForStdOut(scannerRunner);
    await scannerRunner.exec();
  }

  public static getScanner(rootPath: string) {
    return new ScannerMSBuild(rootPath, {
      projectKey: tl.getInput("projectKey", true),
      projectName: tl.getInput("projectName"),
      projectVersion: tl.getInput("projectVersion"),
      organization: tl.getInput("organization"),
    });
  }
}
