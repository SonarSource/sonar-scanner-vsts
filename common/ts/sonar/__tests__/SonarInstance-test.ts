import { SemVer } from "semver";
import SonarInstance, { Features } from "../SonarInstance";
import Endpoint, { EndpointType } from "../Endpoint";

it("should enable FEATURE_BRANCHES_AND_PULLREQUEST, FEATURE_NEW_REPORT_TASK_LOCATION", () => {
  const endpoint = new Endpoint(EndpointType.SonarQube, {
    url: null,
    token: null,
    username: null,
    password: null,
    organization: null,
  });
  const sonarInstance = new SonarInstance(endpoint, new SemVer("7.2.0"));
  sonarInstance.init();
  expect(sonarInstance.isEnabled(Features.FEATURE_BRANCHES_AND_PULLREQUEST)).toEqual(true);
  expect(sonarInstance.isEnabled(Features.FEATURE_NEW_REPORT_TASK_LOCATION)).toEqual(true);
});

it("should enable no features", () => {
  const endpoint = new Endpoint(EndpointType.SonarQube, {
    url: null,
    token: null,
    username: null,
    password: null,
    organization: null,
  });
  const sonarInstance = new SonarInstance(endpoint, new SemVer("6.0.0"));
  sonarInstance.init();
  expect(sonarInstance.isEnabled(Features.FEATURE_BRANCHES_AND_PULLREQUEST)).toEqual(false);
  expect(sonarInstance.isEnabled(Features.FEATURE_NEW_REPORT_TASK_LOCATION)).toEqual(false);
  expect(
    sonarInstance.isEnabled(Features.FEATURE_PULL_REQUEST_PROVIDER_PROPERTY_DEPRECATED)
  ).toEqual(false);
});

it("should enable FEATURE_PULL_REQUEST_PROVIDER_PROPERTY_DEPRECATED", () => {
  const endpoint = new Endpoint(EndpointType.SonarQube, {
    url: null,
    token: null,
    username: null,
    password: null,
    organization: null,
  });
  const sonarInstance = new SonarInstance(endpoint, new SemVer("8.1.0"));
  sonarInstance.init();
  expect(
    sonarInstance.isEnabled(Features.FEATURE_PULL_REQUEST_PROVIDER_PROPERTY_DEPRECATED)
  ).toEqual(true);
});
