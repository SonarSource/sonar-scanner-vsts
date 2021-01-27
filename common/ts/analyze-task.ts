import * as tl from "azure-pipelines-task-lib/task";
import Scanner, { ScannerMode } from "./sonar/Scanner";
import JavaVersionResolver from "./helpers/java-version-resolver";

const JAVA_11_PATH_ENV_NAME = "JAVA_HOME_11_X64";

export default async function analyzeTask(rootPath: string, isSonarCloud: boolean = false) {
  const scannerMode: ScannerMode = ScannerMode[tl.getVariable("SONARQUBE_SCANNER_MODE")];
  if (!scannerMode) {
    throw new Error(
      "[SonarScanner] The 'Prepare Analysis Configuration' task was not executed prior to this task"
    );
  }
  Scanner.setIsSonarCloud(isSonarCloud);
  JavaVersionResolver.setJavaHomeToIfAvailable(JAVA_11_PATH_ENV_NAME);
  const scanner = Scanner.getAnalyzeScanner(rootPath, scannerMode);
  await scanner.runAnalysis();
  JavaVersionResolver.revertJavaHomeToOriginal();
}
