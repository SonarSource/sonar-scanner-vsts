import * as tl from "azure-pipelines-task-lib/task";
import * as vm from "azure-devops-node-api";
import {
  JsonPatchDocument,
  JsonPatchOperation,
  Operation,
} from "azure-devops-node-api/interfaces/common/VSSInterfaces";

export interface IPropertyBag {
  propertyName: string;
  propertyValue: string;
}

export async function addBuildProperty(properties: IPropertyBag[]) {
  const collectionUri = `${tl.getVariable("System.TeamFoundationCollectionUri")}/`;
  const teamProjectId = `${tl.getVariable("System.TeamProjectId")}/`;
  const buildId = tl.getVariable("Build.BuildId");

  const patchBody: JsonPatchOperation[] = [];

  properties.forEach((property: IPropertyBag) => {
    patchBody.push({
      op: Operation.Add,
      path: `/${property.propertyName}`,
      value: `${property.propertyValue}`,
    });
  });

  tl.debug(JSON.stringify(patchBody));

  const customHeader = { Authorization: `Bearer ${getAuthToken()}` };

  const azdoWebApi = getWebApi(collectionUri);
  const jsonPatchBody: JsonPatchDocument[] = patchBody;

  try {
    tl.debug("Acquiring a build API object.");
    const buildApi = await azdoWebApi.getBuildApi();
    tl.debug("Creating a new build property with global Quality Gate Status");
    await buildApi.updateBuildProperties(customHeader, jsonPatchBody, teamProjectId, +buildId);
  } catch (exception) {
    tl.warning(
      `Failed to create a build property. Not blocking unless you are using the Sonar Pre-Deployment gate in Release Pipelines. Exception : ${exception}`
    );
  }
}

export function getWebApi(collectionUrl: string): vm.WebApi {
  const accessToken = getAuthToken();
  const credentialHandler = vm.getBearerHandler(accessToken);
  return new vm.WebApi(collectionUrl, credentialHandler);
}

export function getAuthToken() {
  const auth = tl.getEndpointAuthorization("SYSTEMVSSCONNECTION", false);
  if (auth.scheme.toLowerCase() === "oauth") {
    return auth.parameters["AccessToken"];
  } else {
    throw new Error("Unable to get credential to perform rest API calls");
  }
}
