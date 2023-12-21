import * as tl from "azure-pipelines-task-lib/task";
import { fetchMetrics, fetchProjectStatus } from "./helpers/api";
import { fillBuildProperty, publishBuildSummary } from "./helpers/azdo-server-utils";
import { TASK_MISSING_VARIABLE_ERROR_HINT, TaskVariables } from "./helpers/constants";
import { getServerVersion } from "./helpers/request";
import Endpoint, { EndpointData, EndpointType } from "./sonarqube/Endpoint";
import HtmlAnalysisReport from "./sonarqube/HtmlAnalysisReport";
import Task, { TimeOutReachedError } from "./sonarqube/Task";
import TaskReport from "./sonarqube/TaskReport";
import { Metric } from "./sonarqube/types";

let globalQualityGateStatus = "";

export default async function publishTask(_endpointType: EndpointType) {
  const missingVariables = [
    TaskVariables.SonarQubeScannerParams,
    TaskVariables.SonarQubeEndpoint,
  ].filter((variable) => typeof tl.getVariable(variable) === "undefined");
  if (missingVariables.length > 0) {
    tl.setResult(
      tl.TaskResult.Failed,
      `Variables are missing. Please make sure that you are running the Prepare and Analyze tasks before running the Publish task.\n${TASK_MISSING_VARIABLE_ERROR_HINT}`,
    );
    return;
  }

  const endpointData: { type: EndpointType; data: EndpointData } = JSON.parse(
    tl.getVariable(TaskVariables.SonarQubeEndpoint),
  );
  const endpoint = new Endpoint(endpointData.type, endpointData.data);
  const metrics = await fetchMetrics(endpoint);

  const timeoutSec = timeoutInSeconds();
  const serverVersion = await getServerVersion(endpoint);
  const taskReports = await TaskReport.createTaskReportsFromFiles(endpoint, serverVersion);

  const analyses = await Promise.all(
    taskReports.map((taskReport) => getReportForTask(taskReport, metrics, endpoint, timeoutSec)),
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

  await fillBuildProperty("sonarglobalqualitygate", globalQualityGateStatus);

  publishBuildSummary(analyses.join("\r\n"), endpoint.type);
}

function timeoutInSeconds(): number {
  return Number.parseInt(tl.getInput("pollingTimeoutSec", true), 10);
}

export async function getReportForTask(
  taskReport: TaskReport,
  metrics: Metric[],
  endpoint: Endpoint,
  timeoutSec: number,
): Promise<string> {
  try {
    const task = await Task.waitForTaskCompletion(endpoint, taskReport.ceTaskId, timeoutSec);
    const projectStatus = await fetchProjectStatus(endpoint, task.analysisId);
    const analysis = HtmlAnalysisReport.getInstance(projectStatus, {
      dashboardUrl: taskReport.dashboardUrl,
      metrics,
      projectName: task.componentName,
      warnings: task.warnings,
    });

    if (
      projectStatus.status === "ERROR" ||
      projectStatus.status === "WARN" ||
      projectStatus.status === "NONE"
    ) {
      globalQualityGateStatus = "failed";
    }

    return analysis.getHtmlAnalysisReport();
  } catch (e) {
    if (e instanceof TimeOutReachedError) {
      tl.warning(
        `Task '${taskReport.ceTaskId}' takes too long to complete. Stopping after ${timeoutSec}s of polling. No quality gate will be displayed on build result.`,
      );
    } else {
      throw e;
    }
  }
}
