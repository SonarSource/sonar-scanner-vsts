import * as tl from "azure-pipelines-task-lib/task";
import Endpoint from "./Endpoint";
import { getJSON } from "../helpers/request";

interface ITask {
  analysisId: string;
  componentKey: string;
  organization?: string;
  status: string;
  errorMessage?: string;
  type: string;
  componentName: string;
  warnings: string[];
}

export default class Task {
  constructor(private readonly task: ITask) {}

  public get analysisId() {
    return this.task.analysisId;
  }

  public get componentName() {
    return this.task.componentName;
  }

  public get warnings() {
    return this.task.warnings;
  }

  public static waitForTaskCompletion(
    endpoint: Endpoint,
    taskId: string,
    tries: number,
    delay = 1000
  ): Promise<Task> {
    tl.debug(`[SQ] Waiting for task '${taskId}' to complete.`);
    return getJSON(endpoint, `/api/ce/task`, { id: taskId, additionalFields: "warnings" }).then(
      ({ task }: { task: ITask }) => {
        tl.debug(`[SonarScanner] Task status:` + task.status);
        if (tries <= 0) {
          throw new TimeOutReachedError();
        }
        const errorInfo = task.errorMessage ? `, Error message: ${task.errorMessage}` : "";
        switch (task.status.toUpperCase()) {
          case "CANCEL":
          case "FAILED":
            throw new Error(`[SonarScanner] Task failed with status ${task.status}${errorInfo}`);
          case "SUCCESS":
            tl.debug(`[SonarScanner] Task complete: ${JSON.stringify(task)}`);
            return new Task(task);
          default:
            return new Promise<Task>((resolve, reject) =>
              setTimeout(() => {
                Task.waitForTaskCompletion(endpoint, taskId, tries, delay).then(resolve, reject);
                tries--;
              }, delay)
            );
        }
      },
      (err) => {
        if (err && err.message) {
          tl.error(err.message);
        } else if (err) {
          tl.error(JSON.stringify(err));
        }
        throw new Error(`[SonarScanner] Could not fetch task for ID '${taskId}'`);
      }
    );
  }
}

export class TimeOutReachedError extends Error {
  constructor() {
    super();
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, TimeOutReachedError.prototype);
  }
}
