import * as tl from "azure-pipelines-task-lib/task";
import { Operation } from "azure-devops-node-api/interfaces/common/VSSInterfaces";
import * as vm from "azure-devops-node-api";
import * as azdoApiUtils from "../azdo-api-utils";

it("should build jsonpath body properly", () => {
  jest.spyOn(tl, "getEndpointAuthorization").mockImplementation(() => null);
  jest.spyOn(azdoApiUtils, "getAuthToken").mockImplementation(() => null);

  const webApi = new vm.WebApi("http://vsts.net", null);

  jest.spyOn(tl, "debug").mockImplementation(() => null);
  jest.spyOn(azdoApiUtils, "getWebApi").mockImplementation(() => webApi);

  const jsonAsString = `[{"op":${Operation.Add},"path":"/sonarglobalqualitygate","value":"test"}]`;

  const properties: azdoApiUtils.IPropertyBag[] = [];

  properties.push({
    propertyName: "sonarglobalqualitygate",
    propertyValue: "test",
  });

  azdoApiUtils
    .addBuildProperty(properties)
    .then(() => {})
    .catch(() => {});

  expect(tl.debug).toHaveBeenCalledWith(jsonAsString);
});

describe("getAuthToken", () => {
  it("should throw error", () => {
    const expected = "Bearer 1234";
    const params: { [key: string]: string } = {};
    params["AccessToken"] = expected;

    const auth: tl.EndpointAuthorization = { scheme: "basic", parameters: params };

    jest.spyOn(tl, "getEndpointAuthorization").mockReturnValue(auth);

    try {
      azdoApiUtils.getAuthToken();
    } catch (error) {
      expect(error).toBe("[Unable to get credential to perform rest API calls]");
    }
  });
});

describe("getWebApi", () => {
  it("should return webapi object", () => {
    jest.spyOn(azdoApiUtils, "getAuthToken").mockReturnValue("Bearer 4567");

    jest.mock("azure-devops-node-api/interfaces/common/VsoBaseInterfaces", () => ({}));

    const actual = azdoApiUtils.getWebApi("https://mock");
    expect(actual).toBeInstanceOf(vm.WebApi);
  });
});
