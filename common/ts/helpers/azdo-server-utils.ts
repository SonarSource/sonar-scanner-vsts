import * as path from "path";
import * as fs from "fs-extra";
import * as tl from "azure-pipelines-task-lib/task";
import * as azdoApiUtils from "./../helpers/azdo-api-utils";

export function publishBuildSummary(summary: string, endpointType = "SonarQube") {
  uploadBuildSummary(saveBuildSummary(summary), `${endpointType} Analysis Report`);
}

export function saveBuildSummary(summary: string): string {
  const filePath = path.join(getStagingDirectory(), "SonarQubeBuildSummary.md");
  fs.writeFileSync(filePath, summary);
  tl.debug(`[SonarScanner] Summary saved at: ${filePath}`);
  return filePath;
}

export function getStagingDirectory(): string {
  const dir = path.join(tl.getVariable("build.artifactStagingDirectory"), ".sqAnalysis");
  fs.ensureDirSync(dir);
  return dir;
}

export function uploadBuildSummary(summaryPath: string, title: string): void {
  tl.debug(`[SonarScanner] Uploading build summary from ${summaryPath}`);
  tl.command(
    "task.addattachment",
    {
      type: "Distributedtask.Core.Summary",
      name: title,
    },
    summaryPath
  );
}

export async function fillBuildProperty(sonarQualityGateStatus: string) {
  const properties: azdoApiUtils.IPropertyBag[] = [];

  properties.push({
    propertyName: "sonarglobalqualitygate",
    propertyValue: sonarQualityGateStatus,
  });

  await azdoApiUtils.addBuildProperty(properties);
}
