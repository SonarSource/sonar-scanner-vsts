import * as path from 'path';
import * as fs from 'fs-extra';
import * as tl from 'vsts-task-lib/task';
import { PROP_NAMES, isWindows } from '../helpers/utils';

export enum ScannerMode {
  MSBuild = 'MSBuild',
  CLI = 'CLI',
  Other = 'Other'
}

export default class Scanner {
  constructor(public rootPath: string, public mode: ScannerMode) {}

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
        return new ScannerMSBuild(rootPath);
      case ScannerMode.CLI:
        return new ScannerCLI(rootPath);
      default:
        throw new Error(`[SQ] Unknown scanner mode: ${mode}`);
    }
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
  constructor(rootPath: string, private cliMode?: string, private data?: ScannerCLIData) {
    super(rootPath, ScannerMode.CLI);
  }

  public toSonarProps() {
    if (this.cliMode === 'file') {
      return { [PROP_NAMES.PROJECTSETTINGS]: this.data.projectSettings };
    }
    return {
      [PROP_NAMES.PROJECTKEY]: this.data.projectKey,
      [PROP_NAMES.PROJECTNAME]: this.data.projectName,
      [PROP_NAMES.PROJECTVERSION]: this.data.projectVersion,
      [PROP_NAMES.PROJECTSOURCES]: this.data.projectSources
    };
  }

  public async runAnalysis() {
    let scannerExe = tl.resolve(this.rootPath, 'sonar-scanner', 'bin', 'sonar-scanner');
    if (isWindows()) {
      scannerExe += '.bat';
    } else {
      await fs.chmod(scannerExe, '777');
    }
    const scannerRunner = tl.tool(scannerExe);
    await scannerRunner.exec();
  }

  public static getScanner(rootPath: string) {
    const mode = tl.getInput('configMode');
    if (mode === 'file') {
      return new ScannerCLI(rootPath, mode, { projectSettings: tl.getInput('configFile', true) });
    }
    return new ScannerCLI(rootPath, mode, {
      projectKey: tl.getInput('cliProjectKey', true),
      projectName: tl.getInput('cliProjectName'),
      projectVersion: tl.getInput('cliProjectVersion'),
      projectSources: tl.getInput('cliSources')
    });
  }
}

interface ScannerMSData {
  projectKey: string;
  projectName?: string;
  projectVersion?: string;
}

export class ScannerMSBuild extends Scanner {
  constructor(rootPath: string, private data?: ScannerMSData) {
    super(rootPath, ScannerMode.MSBuild);
  }

  public toSonarProps() {
    return {
      [PROP_NAMES.PROJECTKEY]: this.data.projectKey,
      [PROP_NAMES.PROJECTNAME]: this.data.projectName,
      [PROP_NAMES.PROJECTVERSION]: this.data.projectVersion
    };
  }

  public async runPrepare() {
    let scannerRunner;
    
    if (isWindows()) {
      const scannerExePath = this.findFrameworkScannerPath()
      tl.setVariable('SONARQUBE_SCANNER_MSBUILD_EXE', scannerExePath);
      scannerRunner = this.getScannerRunner(scannerExePath, true)
    } else {
      const scannerDllPath = this.findDotnetScannerPath()
      tl.setVariable('SONARQUBE_SCANNER_MSBUILD_DLL', scannerDllPath);
      scannerRunner = this.getScannerRunner(scannerDllPath, false);

      // Need to set executable flag on the embedded scanner CLI
      await this.makeShellScriptExecutable(scannerDllPath);
    }
    scannerRunner.arg('begin');
    scannerRunner.arg('/k:' + this.data.projectKey);
    await scannerRunner.exec();
  }

  private async makeShellScriptExecutable(scannerPath : string) {
    const scannerCliShellScripts = tl.findMatch(
      scannerPath,
      path.join('sonar-scanner-*', 'bin', 'sonar-scanner')
    )[0];
    await fs.chmod(scannerCliShellScripts, '777');
  }

  private getScannerRunner(scannerPath : string, isExeScanner : boolean) {
    if (isExeScanner) {
      return tl.tool(scannerPath);
    }

    const dotnetToolPath = tl.which('dotnet', true);
    let scannerRunner = tl.tool(dotnetToolPath);
    scannerRunner.arg(scannerPath);
    return scannerRunner;
  }

  private findFrameworkScannerPath() : string {
    return tl.resolve(
      this.rootPath,
      'classic-sonar-scanner-msbuild',
      'SonarQube.Scanner.MSBuild.exe'
    );
  }

  private findDotnetScannerPath() : string  {
    return tl.resolve(
      this.rootPath,
      'dotnet-sonar-scanner-msbuild',
      'SonarQube.Scanner.MSBuild.dll'
    );
  }

  public async runAnalysis() {
    let scannerRunner = isWindows()
      ? this.getScannerRunner(tl.getVariable('SONARQUBE_SCANNER_MSBUILD_EXE'), true)
      : this.getScannerRunner(tl.getVariable('SONARQUBE_SCANNER_MSBUILD_DLL'), false);

    scannerRunner.arg('end');
    await scannerRunner.exec();
  }

  public static getScanner(rootPath: string) {
    return new ScannerMSBuild(rootPath, {
      projectKey: tl.getInput('projectKey', true),
      projectName: tl.getInput('projectName'),
      projectVersion: tl.getInput('projectVersion')
    });
  }
}
