import * as tl from "azure-pipelines-task-lib/task";
import { InvalidApiResourceVersionError } from "azure-devops-node-api/VsoClient";
import { SemVer } from "semver";
import Analysis from "../sonar/Analysis";
import Endpoint, { EndpointType } from "../sonar/Endpoint";
import Metrics from "../sonar/Metrics";
import Task, { TimeOutReachedError } from "../sonar/Task";
import TaskReport from "../sonar/TaskReport";
import * as publishTask from "../publish-task";
import * as serverUtils from "../helpers/azdo-server-utils";
import * as apiUtils from "../helpers/azdo-api-utils";
import * as request from "../helpers/request";

beforeEach(() => {
  jest.restoreAllMocks();
});

const TASK_REPORT = new TaskReport({
  ceTaskId: "111",
  ceTaskUrl: "http://taskurl1",
  dashboardUrl: "http://dashboardurl1",
  projectKey: "projectKey1",
  serverUrl: "http:/serverUrl1",
});

const SC_ENDPOINT = new Endpoint(EndpointType.SonarCloud, { url: "https://endpoint.url" });
const SQ_ENDPOINT = new Endpoint(EndpointType.SonarQube, { url: "https://endpoint.url" });
const METRICS = new Metrics([]);

it("should fail unless SONARQUBE_SCANNER_PARAMS are supplied", async () => {
  jest.spyOn(tl, "getVariable").mockImplementation(() => null);
  jest.spyOn(tl, "setResult").mockImplementation(() => null);

  await publishTask.default(EndpointType.SonarCloud);

  expect(tl.getVariable).toBeCalledWith("SONARQUBE_SCANNER_PARAMS");
  expect(tl.setResult).toBeCalledWith(
    tl.TaskResult.Failed,
    "The SonarCloud Prepare Analysis Configuration must be added."
  );
});

it("check multiple report status and set global quality gate for build properties should be ok", async () => {
  // Mock waiting for the ceTask to complete and return a Task
  const returnedTaskOk = new Task({
    analysisId: "123",
    componentKey: "key",
    status: "OK",
    type: EndpointType.SonarCloud,
    componentName: "componentName",
    warnings: [],
  });

  const taskReportArray: TaskReport[] = [];
  const taskReport = new TaskReport({
    ceTaskId: "string",
    ceTaskUrl: "string",
    dashboardUrl: "string",
    projectKey: "string",
    serverUrl: "string",
  });

  taskReportArray.push(taskReport);
  taskReportArray.push(taskReport);

  jest.spyOn(Task, "waitForTaskCompletion").mockResolvedValue(returnedTaskOk);
  jest.spyOn(TaskReport, "createTaskReportsFromFiles").mockResolvedValue(taskReportArray);

  // Mock converting the Task into an html report
  const returnedAnalysisOk = new Analysis(
    { status: "OK", conditions: [] },
    EndpointType.SonarCloud,
    [],
    "",
    null,
    null
  );

  jest.spyOn(request, "getServerVersion").mockResolvedValue(new SemVer("7.2.0"));

  jest.spyOn(Analysis, "getAnalysis").mockResolvedValue(returnedAnalysisOk);
  jest.spyOn(Analysis, "getAnalysis").mockResolvedValue(returnedAnalysisOk);

  jest.spyOn(Metrics, "getAllMetrics").mockResolvedValue(METRICS);

  jest.spyOn(returnedAnalysisOk, "getHtmlAnalysisReport").mockImplementation(() => "dummy html");

  jest.spyOn(tl, "getInput").mockImplementation(() => "100");
  jest.spyOn(tl, "debug");

  jest.spyOn(tl, "getVariable").mockImplementationOnce(() => "anything...");
  jest.spyOn(tl, "getVariable").mockImplementation(() => SC_ENDPOINT.toJson());

  jest.spyOn(apiUtils, "addBuildProperty").mockResolvedValue(null);
  jest.spyOn(apiUtils, "getAuthToken").mockImplementation(() => null);

  jest.spyOn(serverUtils, "fillBuildProperty");

  jest.spyOn(serverUtils, "publishBuildSummary").mockImplementation(() => null);

  await publishTask.default(EndpointType.SonarCloud);

  expect(tl.debug).toHaveBeenCalledWith(`Overall Quality Gate status: ok`);
  expect(tl.debug).toHaveBeenCalledWith(`Number of analyses in this build: 2`);
  expect(serverUtils.fillBuildProperty).toHaveBeenCalledWith("ok");
});

it("check multiple report status and set global quality gate for build properties should be failed", async () => {
  // Mock waiting for the ceTask to complete and return a Task
  const returnedTaskOk = new Task({
    analysisId: "123",
    componentKey: "key",
    status: "OK",
    type: EndpointType.SonarCloud,
    componentName: "componentName",
    warnings: [],
  });

  const taskReportArray: TaskReport[] = [];
  const taskReport = new TaskReport({
    ceTaskId: "string",
    ceTaskUrl: "string",
    dashboardUrl: "string",
    projectKey: "string",
    serverUrl: "string",
  });

  taskReportArray.push(taskReport);
  taskReportArray.push(taskReport);
  taskReportArray.push(taskReport);

  jest.spyOn(Task, "waitForTaskCompletion").mockResolvedValue(returnedTaskOk);

  jest.spyOn(TaskReport, "createTaskReportsFromFiles").mockResolvedValue(taskReportArray);

  // Mock converting the Task into an html report
  const returnedAnalysisOk = new Analysis(
    { status: "OK", conditions: [] },
    EndpointType.SonarCloud,
    [],
    "",
    null,
    null
  );

  const returnedAnalysisError = new Analysis(
    { status: "ERROR", conditions: [] },
    EndpointType.SonarCloud,
    [],
    "",
    null,
    null
  );
  jest.spyOn(request, "getServerVersion").mockResolvedValue(new SemVer("7.2.0"));

  jest.spyOn(Analysis, "getAnalysis").mockResolvedValueOnce(returnedAnalysisOk);
  jest.spyOn(Analysis, "getAnalysis").mockResolvedValueOnce(returnedAnalysisError);
  jest.spyOn(Analysis, "getAnalysis").mockResolvedValueOnce(returnedAnalysisOk);

  jest.spyOn(Metrics, "getAllMetrics").mockResolvedValue(METRICS);

  jest.spyOn(returnedAnalysisOk, "getHtmlAnalysisReport").mockImplementation(() => "dummy html");

  jest.spyOn(tl, "getVariable").mockImplementationOnce(() => "anything...");
  jest.spyOn(tl, "getVariable").mockImplementation(() => SC_ENDPOINT.toJson());

  jest.spyOn(tl, "getInput").mockImplementation(() => "100");
  jest.spyOn(tl, "debug");

  jest.spyOn(apiUtils, "addBuildProperty").mockResolvedValue(null);
  jest.spyOn(apiUtils, "getAuthToken").mockImplementation(() => null);

  jest.spyOn(serverUtils, "fillBuildProperty");

  jest.spyOn(serverUtils, "publishBuildSummary").mockImplementation(() => null);

  await publishTask.default(EndpointType.SonarCloud);

  expect(tl.debug).toHaveBeenCalledWith(`Overall Quality Gate status: failed`);
  expect(tl.debug).toHaveBeenCalledWith(`Number of analyses in this build: 3`);
  expect(serverUtils.fillBuildProperty).toHaveBeenCalledWith("failed");
});

it("get report string should return undefined if ceTask times out", async () => {
  // Mock the ceTask timing out
  jest.spyOn(Task, "waitForTaskCompletion").mockImplementation(() => {
    throw new TimeOutReachedError();
  });
  jest.spyOn(Analysis, "getAnalysis");
  jest.spyOn(tl, "warning").mockImplementation(() => null);

  const result = await publishTask.getReportForTask(TASK_REPORT, METRICS, SQ_ENDPOINT, 999);

  expect(result).toBe("");
  expect(Task.waitForTaskCompletion).toHaveBeenCalledWith(SQ_ENDPOINT, TASK_REPORT.ceTaskId, 999);
  expect(tl.warning).toBeCalledWith(
    "Task '111' takes too long to complete. Stopping after 999s of polling. No quality gate will be displayed on build result."
  );
  expect(Analysis.getAnalysis).not.toBeCalled();
});

it("get report string should fail for non-timeout errors", async () => {
  // Mock the ceTask timing out
  jest.spyOn(Task, "waitForTaskCompletion").mockImplementation(() => {
    throw new InvalidApiResourceVersionError("my error");
  });
  jest.spyOn(Analysis, "getAnalysis");
  jest.spyOn(tl, "warning").mockImplementation(() => null);

  expect.assertions(1);
  try {
    await publishTask.getReportForTask(TASK_REPORT, METRICS, SQ_ENDPOINT, 999);
  } catch (e) {
    expect(e).toEqual({ message: "my error", name: "Invalid resource version" });
  }
});

it("get report string for single report", async () => {
  // Mock waiting for the ceTask to complete and return a Task
  const returnedTask = new Task({
    analysisId: "123",
    componentKey: "key",
    status: "status",
    type: EndpointType.SonarQube,
    componentName: "componentName",
    warnings: [],
  });
  jest.spyOn(Task, "waitForTaskCompletion").mockResolvedValue(returnedTask);
  // Mock converting the Task into an html report
  const returnedAnalysis = new Analysis(
    { status: "", conditions: [] },
    EndpointType.SonarCloud,
    [],
    "",
    null,
    null
  );
  jest.spyOn(Analysis, "getAnalysis").mockResolvedValue(returnedAnalysis);
  jest.spyOn(returnedAnalysis, "getHtmlAnalysisReport").mockImplementation(() => "dummy html");

  const result = await publishTask.getReportForTask(TASK_REPORT, METRICS, SQ_ENDPOINT, 999);

  expect(Task.waitForTaskCompletion).toHaveBeenCalledWith(SQ_ENDPOINT, TASK_REPORT.ceTaskId, 999);
  expect(Analysis.getAnalysis).toBeCalledWith({
    analysisId: "123",
    dashboardUrl: "http://dashboardurl1",
    endpoint: SQ_ENDPOINT,
    metrics: { metrics: [] },
    projectName: "componentName",
    warnings: [],
  });

  expect(result).toBe("dummy html");
});

it("get report string should fail for non-timeout errors", async () => {
  // Mock the ceTask timing out
  jest.spyOn(Task, "waitForTaskCompletion").mockImplementation(() => {
    throw new InvalidApiResourceVersionError("my error");
  });
  jest.spyOn(Analysis, "getAnalysis");
  jest.spyOn(tl, "warning").mockImplementation(() => null);

  expect.assertions(1);
  try {
    await publishTask.getReportForTask(TASK_REPORT, METRICS, SQ_ENDPOINT, 999);
  } catch (e) {
    expect(e).toEqual({ message: "my error", name: "Invalid resource version" });
  }
});

it("task should not fail the task even if all ceTasks timeout", async () => {
  const taskReport2 = new TaskReport({
    ceTaskId: "222",
    ceTaskUrl: "http://taskurl2",
    dashboardUrl: "http://dashboardurl2",
    projectKey: "projectKey2",
    serverUrl: "http:/serverUrl2",
  });

  jest.spyOn(tl, "getInput").mockImplementation(() => "1"); // set the timeout
  jest.spyOn(tl, "setResult");
  jest.spyOn(tl, "debug").mockImplementation(() => null);
  jest.spyOn(tl, "warning").mockImplementation(() => null);

  jest.spyOn(request, "getServerVersion").mockResolvedValue(new SemVer("7.2.0"));

  tl.setVariable("SONARQUBE_SCANNER_PARAMS", "anything...");
  tl.setVariable("SONARQUBE_ENDPOINT", SC_ENDPOINT.toJson());

  // Mock finding two report files to process
  jest
    .spyOn(TaskReport, "createTaskReportsFromFiles")
    .mockResolvedValue([TASK_REPORT, taskReport2]);

  jest.spyOn(Task, "waitForTaskCompletion").mockImplementation(() => {
    throw new TimeOutReachedError();
  });
  const publishSummaryMock = jest
    .spyOn(serverUtils, "publishBuildSummary")
    .mockImplementation(() => null);

  jest.spyOn(Metrics, "getAllMetrics").mockResolvedValue(METRICS);

  jest.spyOn(apiUtils, "addBuildProperty").mockImplementation(
    () =>
      new Promise((resolve) => {
        return resolve();
      })
  );

  await publishTask.default(EndpointType.SonarCloud);

  expect(serverUtils.publishBuildSummary).toHaveBeenCalledTimes(1);
  expect(publishSummaryMock.mock.calls[0][1]).toBe(EndpointType.SonarCloud);
  expect(tl.setResult).not.toBeCalledWith(tl.TaskResult.Failed);

  expect(serverUtils.publishBuildSummary).toBeCalledWith("\r\n", EndpointType.SonarCloud);

  expect(tl.warning).toBeCalledWith(
    "Task '111' takes too long to complete. Stopping after 1s of polling. No quality gate will be displayed on build result."
  );
  expect(tl.warning).toBeCalledWith(
    "Task '222' takes too long to complete. Stopping after 1s of polling. No quality gate will be displayed on build result."
  );
});
