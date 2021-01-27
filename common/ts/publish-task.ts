import * as tl from "azure-pipelines-task-lib/task";
import Analysis from "./sonar/Analysis";
import Endpoint, { EndpointType, EndpointData } from "./sonar/Endpoint";
import Metrics from "./sonar/Metrics";
import Task, { TimeOutReachedError } from "./sonar/Task";
import TaskReport from "./sonar/TaskReport";
import { publishBuildSummary, fillBuildProperty } from "./helpers/azdo-server-utils";
import { getServerVersion } from "./helpers/request";

let globalQualityGateStatus = "";

export default async function publishTask(endpointType: EndpointType) {
  const params = tl.getVariable("SONARQUBE_SCANNER_PARAMS");
  if (!params) {
    tl.setResult(
      tl.TaskResult.Failed,
      `The ${endpointType} Prepare Analysis Configuration must be added.`
    );
    return;
  }

  const endpointData: { type: EndpointType; data: EndpointData } = JSON.parse(
    tl.getVariable("SONARQUBE_ENDPOINT")
  );
  const endpoint = new Endpoint(endpointData.type, endpointData.data);
  const metrics = await Metrics.getAllMetrics(endpoint);

  const timeoutSec = timeoutInSeconds();
  const serverVersion = await getServerVersion(endpoint);
  const taskReports = await TaskReport.createTaskReportsFromFiles(endpoint, serverVersion);

  const analyses = await Promise.all(
    taskReports.map((taskReport) => getReportForTask(taskReport, metrics, endpoint, timeoutSec))
  );

  if (globalQualityGateStatus === "") {
    globalQualityGateStatus = "ok";
  }

  if (!taskReports.length) {
    tl.warning("No analyses found in this build! Please check your build configuration.");
  } else {
    tl.debug(`Number of analyses in this build: ${taskReports.length}`);
  }

  tl.debug(`Overall Quality Gate status: ${globalQualityGateStatus}`);

  await fillBuildProperty(globalQualityGateStatus);

  publishBuildSummary(analyses.join("\r\n"), endpoint.type);
}

function timeoutInSeconds(): number {
  return Number.parseInt(tl.getInput("pollingTimeoutSec", true), 10);
}

export async function getReportForTask(
  taskReport: TaskReport,
  metrics: Metrics,
  endpoint: Endpoint,
  timeoutSec: number
): Promise<string> {
  try {
    const task = await Task.waitForTaskCompletion(endpoint, taskReport.ceTaskId, timeoutSec);
    const analysis = await Analysis.getAnalysis({
      analysisId: task.analysisId,
      dashboardUrl: taskReport.dashboardUrl,
      endpoint,
      metrics,
      projectName: task.componentName,
      warnings: task.warnings,
    });

    if (analysis.status === "ERROR" || analysis.status === "WARN" || analysis.status === "NONE") {
      globalQualityGateStatus = "failed";
    }

    return analysis.getHtmlAnalysisReport();
  } catch (e) {
    if (e instanceof TimeOutReachedError) {
      tl.warning(
        `Task '${taskReport.ceTaskId}' takes too long to complete. Stopping after ${timeoutSec}s of polling. No quality gate will be displayed on build result.`
      );
    } else {
      throw e;
    }
  }

  return "";
}
