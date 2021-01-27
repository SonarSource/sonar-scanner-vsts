import * as tl from "azure-pipelines-task-lib/task";
import Endpoint, { EndpointType } from "../../../../../common/ts/sonar/Endpoint";
import prepareTask from "../../../../../common/ts/prepare-task";

async function run() {
  try {
    const endpoint = Endpoint.getEndpoint(
      tl.getInput(EndpointType.SonarQube, true),
      EndpointType.SonarQube
    );
    await prepareTask(endpoint, __dirname);
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
