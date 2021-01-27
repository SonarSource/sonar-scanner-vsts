import * as tl from "azure-pipelines-task-lib/task";
import publishTask from "../../../../../common/ts/publish-task";
import { EndpointType } from "../../../../../common/ts/sonar/Endpoint";

async function run() {
  try {
    await publishTask(EndpointType.SonarCloud);
  } catch (err) {
    tl.debug("[SonarScanner] Publish task error: " + err.message);
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
