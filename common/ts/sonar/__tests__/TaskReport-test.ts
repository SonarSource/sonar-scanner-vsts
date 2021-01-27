import * as path from "path";
import { writeFileSync } from "fs";
import { fileSync } from "tmp"; // eslint-disable-line import/no-extraneous-dependencies
import * as tl from "azure-pipelines-task-lib/task";
import * as semver from "semver";
import TaskReport from "../TaskReport";
import Endpoint, { EndpointType } from "../Endpoint";
import * as tempFindMethods from "../../helpers/temp-find-method";

beforeEach(() => {
  jest.restoreAllMocks();
});

it("should parse report-task.txt and preserve equals sign in url", async () => {
  const tmpReport = fileSync();
  writeFileSync(
    tmpReport.fd,
    `dashboardUrl=http://sonar/bar?toto=titi&foo=%2Esomething
projectKey=myProjectKey
ceTaskId=12345
serverUrl=http://sonar`,
    {
      encoding: "utf-8",
    }
  );

  const endpoint = new Endpoint(EndpointType.SonarCloud, null);

  const reports = await TaskReport.createTaskReportsFromFiles(
    endpoint,
    new semver.SemVer("7.2.0"),
    [tmpReport.name]
  );

  expect(reports).toHaveLength(1);
  const report = reports[0];
  expect(report.dashboardUrl).toBe("http://sonar/bar?toto=titi&foo=%2Esomething");

  tmpReport.removeCallback();
});

it("should parse all reports", async () => {
  const tmpReport = fileSync();
  writeFileSync(
    tmpReport.fd,
    `dashboardUrl=http://sonar/bar?toto=titi&foo=%2Esomething
projectKey=projectKey1
ceTaskId=12345
serverUrl=http://sonar`,
    {
      encoding: "utf-8",
    }
  );

  const tmpReport2 = fileSync();
  writeFileSync(
    tmpReport2.fd,
    `dashboardUrl=http://sonar/bar?toto=titi&foo=%2Esomething
projectKey=projectKey2
ceTaskId=12345
serverUrl=http://sonar`,
    {
      encoding: "utf-8",
    }
  );

  const endpoint = new Endpoint(EndpointType.SonarCloud, null);

  const reports = await TaskReport.createTaskReportsFromFiles(
    endpoint,
    new semver.SemVer("7.2.0"),
    [tmpReport.name, tmpReport2.name]
  );

  expect(reports).toHaveLength(2);
  expect(reports[0].projectKey).toBe("projectKey1");
  expect(reports[1].projectKey).toBe("projectKey2");

  tmpReport.removeCallback();
  tmpReport2.removeCallback();
});

it("should find report files for SonarCloud", async () => {
  // using spyOn so we can reset the original behaviour
  jest.spyOn(tl, "getVariable").mockImplementation(() => "mock root search path");
  jest.spyOn(tempFindMethods, "findMatch").mockImplementation(() => ["path1", "path2"]);

  const endpoint = new Endpoint(EndpointType.SonarCloud, null);

  const reportFiles = await TaskReport.findTaskFileReport(endpoint, new semver.SemVer("7.2.0"));

  expect(reportFiles.length).toBe(2);
  expect(reportFiles[0]).toBe("path1");
  expect(reportFiles[1]).toBe("path2");

  expect(tl.getVariable).toHaveBeenCalledTimes(2);
  expect(tl.getVariable).toBeCalledWith("Agent.TempDirectory");

  // Calculate the expected path to take account of different
  // path separators in Windows/non-Windows
  const expectedSearchPath = path.join(
    "sonar",
    tl.getVariable("Build.BuildNumber"),
    "**",
    "report-task.txt"
  );
  expect(tempFindMethods.findMatch).toHaveBeenCalledTimes(1);
  expect(tempFindMethods.findMatch).toHaveBeenCalledWith(
    "mock root search path",
    expectedSearchPath
  );
});

it("should find report files for SonarQube above 7.2.0", async () => {
  // using spyOn so we can reset the original behaviour
  jest.spyOn(tl, "getVariable").mockImplementation(() => "mock root search path");
  jest.spyOn(tempFindMethods, "findMatch").mockImplementation(() => ["path1", "path2"]);

  const endpoint = new Endpoint(EndpointType.SonarQube, null);

  const reportFiles = await TaskReport.findTaskFileReport(endpoint, new semver.SemVer("7.9.0"));

  expect(reportFiles.length).toBe(2);
  expect(reportFiles[0]).toBe("path1");
  expect(reportFiles[1]).toBe("path2");

  expect(tl.getVariable).toHaveBeenCalledTimes(2);
  expect(tl.getVariable).toBeCalledWith("Agent.TempDirectory");

  // Calculate the expected path to take account of different
  // path separators in Windows/non-Windows
  const expectedSearchPath = path.join(
    "sonar",
    tl.getVariable("Build.BuildNumber"),
    "**",
    "report-task.txt"
  );
  expect(tempFindMethods.findMatch).toHaveBeenCalledTimes(1);
  expect(tempFindMethods.findMatch).toHaveBeenCalledWith(
    "mock root search path",
    expectedSearchPath
  );
});

it("should find report files for SonarQube below 7.2.0", async () => {
  // using spyOn so we can reset the original behaviour
  jest.spyOn(tl, "getVariable").mockImplementation(() => "mock root search path");
  jest.spyOn(tempFindMethods, "findMatch").mockImplementation(() => ["path1", "path2"]);

  const endpoint = new Endpoint(EndpointType.SonarQube, null);

  const reportFiles = await TaskReport.findTaskFileReport(endpoint, new semver.SemVer("7.0.0"));

  expect(reportFiles.length).toBe(2);
  expect(reportFiles[0]).toBe("path1");
  expect(reportFiles[1]).toBe("path2");

  expect(tl.getVariable).toHaveBeenCalledTimes(1);
  expect(tl.getVariable).toBeCalledWith("Agent.BuildDirectory");

  // Calculate the expected path to take account of different
  // path separators in Windows/non-Windows
  const expectedSearchPath = path.join("**", "report-task.txt");

  expect(tempFindMethods.findMatch).toHaveBeenCalledTimes(1);
  expect(tempFindMethods.findMatch).toHaveBeenCalledWith(
    "mock root search path",
    expectedSearchPath
  );
});
