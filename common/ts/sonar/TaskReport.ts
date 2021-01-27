import * as path from "path";
import * as fs from "fs-extra";
import * as tl from "azure-pipelines-task-lib/task";
import * as semver from "semver";
import { findMatch } from "../helpers/temp-find-method";
import Endpoint, { EndpointType } from "./Endpoint";

export const REPORT_TASK_NAME = "report-task.txt";
export const SONAR_TEMP_DIRECTORY_NAME = "sonar";

interface ITaskReport {
  ceTaskId: string;
  ceTaskUrl?: string;
  dashboardUrl?: string;
  projectKey: string;
  serverUrl: string;
}

export default class TaskReport {
  private readonly report: ITaskReport;
  constructor(report: Partial<ITaskReport>) {
    for (const field of ["projectKey", "ceTaskId", "serverUrl"]) {
      if (!report[field as keyof ITaskReport]) {
        throw TaskReport.throwMissingField(field);
      }
    }
    this.report = report as ITaskReport;
  }

  public get projectKey() {
    return this.report.projectKey;
  }

  public get ceTaskId() {
    return this.report.ceTaskId;
  }

  public get serverUrl() {
    return this.report.serverUrl;
  }

  public get dashboardUrl() {
    return this.report.dashboardUrl;
  }

  public static findTaskFileReport(endpoint: Endpoint, serverVersion: semver.SemVer): string[] {
    let taskReportGlob: string;
    let taskReportGlobResult: string[];

    if (endpoint.type === EndpointType.SonarQube && serverVersion < semver.parse("7.2.0")) {
      tl.debug(
        "SonarQube version < 7.2.0 detected, falling back to default location(s) for report-task.txt file."
      );
      taskReportGlob = path.join("**", REPORT_TASK_NAME);
      taskReportGlobResult = findMatch(tl.getVariable("Agent.BuildDirectory"), taskReportGlob);
    } else {
      taskReportGlob = path.join(
        SONAR_TEMP_DIRECTORY_NAME,
        tl.getVariable("Build.BuildNumber"),
        "**",
        REPORT_TASK_NAME
      );
      taskReportGlobResult = findMatch(tl.getVariable("Agent.TempDirectory"), taskReportGlob);
    }

    tl.debug(
      `[SonarScanner] Searching for ${taskReportGlob} - found ${taskReportGlobResult.length} file(s)`
    );
    return taskReportGlobResult;
  }

  public static createTaskReportsFromFiles(
    endpoint: Endpoint,
    serverVersion: semver.SemVer,
    filePaths = TaskReport.findTaskFileReport(endpoint, serverVersion)
  ): Promise<TaskReport[]> {
    return Promise.all(
      filePaths.map((filePath) => {
        if (!filePath) {
          return Promise.reject(
            TaskReport.throwInvalidReport(
              `[SonarScanner] Could not find '${REPORT_TASK_NAME}'.` +
                ` Possible cause: the analysis did not complete successfully.`
            )
          );
        }
        tl.debug(`[SonarScanner] Read Task report file: ${filePath}`);
        return fs.access(filePath, fs.constants.R_OK).then(
          () => this.parseReportFile(filePath),
          () => {
            return Promise.reject(
              TaskReport.throwInvalidReport(`[SonarScanner] Task report not found at: ${filePath}`)
            );
          }
        );
      })
    );
  }

  private static parseReportFile(filePath: string): Promise<TaskReport> {
    return fs.readFile(filePath, "utf-8").then(
      (fileContent) => {
        tl.debug(`[SonarScanner] Parse Task report file: ${fileContent}`);
        if (!fileContent || fileContent.length <= 0) {
          return Promise.reject(
            TaskReport.throwInvalidReport(`[SonarScanner] Error reading file: ${fileContent}`)
          );
        }
        try {
          const settings = TaskReport.createTaskReportFromString(fileContent);
          const taskReport = new TaskReport({
            ceTaskId: settings.get("ceTaskId"),
            ceTaskUrl: settings.get("ceTaskUrl"),
            dashboardUrl: settings.get("dashboardUrl"),
            projectKey: settings.get("projectKey"),
            serverUrl: settings.get("serverUrl"),
          });
          return Promise.resolve(taskReport);
        } catch (err) {
          if (err && err.message) {
            tl.error(`[SonarScanner] Parse Task report error: ${err.message}`);
          } else if (err) {
            tl.error(`[SonarScanner] Parse Task report error: ${JSON.stringify(err)}`);
          }
          return Promise.reject(err);
        }
      },
      (err) =>
        Promise.reject(
          TaskReport.throwInvalidReport(
            `[SonarScanner] Error reading file: ${err.message || JSON.stringify(err)}`
          )
        )
    );
  }

  private static createTaskReportFromString(fileContent: string): Map<string, string> {
    const lines: string[] = fileContent.replace(/\r\n/g, "\n").split("\n"); // proofs against xplat line-ending issues
    const settings = new Map<string, string>();
    lines.forEach((line: string) => {
      const splitLine = line.split("=");
      if (splitLine.length > 1) {
        settings.set(splitLine[0], splitLine.slice(1, splitLine.length).join("="));
      }
    });
    return settings;
  }

  private static throwMissingField(field: string): Error {
    return new Error(`Failed to create TaskReport object. Missing field: ${field}`);
  }

  private static throwInvalidReport(debugMsg: string): Error {
    tl.error(debugMsg);
    return new Error(
      "Invalid or missing task report. Check that the analysis finished successfully."
    );
  }
}
