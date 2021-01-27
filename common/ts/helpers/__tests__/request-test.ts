import * as tl from "azure-pipelines-task-lib/task";
import { SemVer } from "semver";
import Endpoint, { EndpointType } from "../../sonar/Endpoint";
import * as request from "../request";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("isString", () => {
  it("should return true", () => {
    const errMessage = "this is the error message";

    const actual = request.isString(errMessage);

    expect(actual).toBe(true);
  });
  it("should return false", () => {
    const value = 28;

    const actual = request.isString(value);

    expect(actual).toBe(false);
  });
});

describe("getServerVersion", () => {
  it("should return server version", () => {
    const endpointData = { url: "https://sonarcloud.io/" };

    const endpoint = new Endpoint(EndpointType.SonarCloud, endpointData);

    request.getServerVersion(endpoint).then((actual) => {
      expect(actual).toBe(new SemVer("8.0.0"));
    });
  });
});

describe("getJSON", () => {
  it("should return json", () => {
    const endpointData = { url: "http://httpbin.org" };

    const endpoint = new Endpoint(EndpointType.SonarCloud, endpointData);

    const query: request.RequestData = { username: "mickael", location: "geneva" };

    request.getJSON(endpoint, "/get", query).then((actual) => {
      const actualJson = JSON.parse(actual);
      expect(actualJson.args.location).toBe("geneva");
    });
  });
});

describe("get", () => {
  it("should return query params", () => {
    jest.spyOn(tl, "debug");

    const endpointData = { url: "http://httpbin.org" };

    const endpoint = new Endpoint(EndpointType.SonarCloud, endpointData);

    const query: request.RequestData = { username: "mickael", location: "geneva" };

    request.callGet(endpoint, "/get", true, query).then((response) => {
      const actualJson = JSON.parse(response);
      expect(actualJson.args.location).toBe("geneva");
    });

    expect(tl.debug).toHaveBeenCalledTimes(1);
    expect(tl.debug).toHaveBeenNthCalledWith(
      1,
      `[SonarScanner] API GET: '/get' with query '{"username":"mickael","location":"geneva"}'`
    );
  });

  it("should handle > 300 status code", () => {
    jest.spyOn(tl, "debug");

    const endpointData = { url: "http://httpbin.org" };

    const endpoint = new Endpoint(EndpointType.SonarCloud, endpointData);

    request.callGet(endpoint, "/status/304", true).then((actual) => {
      expect(actual).toContain(
        "[Error: [SonarScanner] API GET '/status/304' failed, status code was: 304]"
      );
    });

    expect(tl.debug).toHaveBeenCalledTimes(1);
    expect(tl.debug).toHaveBeenNthCalledWith(
      1,
      `[SonarScanner] API GET: '/status/304' with query 'undefined'`
    );
  });

  it("should handle auth", () => {
    jest.spyOn(tl, "debug");

    const endpointData = { url: "http://httpbin.org" };

    const endpoint = new Endpoint(EndpointType.SonarCloud, endpointData);

    endpoint.auth.user = "admin";

    request.callGet(endpoint, "/headers", true).then((response) => {
      const actualJson = JSON.parse(response);
      expect(actualJson.headers.Authorization).toBe("Basic YWRtaW46");
    });
  });
});
