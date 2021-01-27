import * as semver from "semver";
import Endpoint, { EndpointType } from "./Endpoint";
import * as internalRequest from "../helpers/request";

export enum Features {
  FEATURE_BRANCHES_AND_PULLREQUEST = "sonar.branchesandpullrequest",
  FEATURE_NEW_REPORT_TASK_LOCATION = "sonar.newreporttasklocation",
  FEATURE_PULL_REQUEST_PROVIDER_PROPERTY_DEPRECATED = "sonar.pullrequestprovider.deprecated",
}

const featureToggleMap = new Map();

export default class SonarInstance {
  public serverVersion: semver.SemVer;
  public endpoint: Endpoint;

  constructor(endpoint: Endpoint, serverVersion?: semver.SemVer) {
    this.endpoint = endpoint;
    if (serverVersion) {
      this.serverVersion = serverVersion;
    }
  }

  public async init() {
    if (!this.serverVersion) {
      this.serverVersion = await this.getServerVersion();
    }

    featureToggleMap.set(Features.FEATURE_BRANCHES_AND_PULLREQUEST, false);
    featureToggleMap.set(Features.FEATURE_NEW_REPORT_TASK_LOCATION, false);
    featureToggleMap.set(Features.FEATURE_PULL_REQUEST_PROVIDER_PROPERTY_DEPRECATED, false);

    this.enableBranchesAndPullRequest();
    this.enableNewReportTaskLocation();
    this.enablePullRequestProviderDeprecatedProperty();
  }

  public isEnabled(feature: string) {
    return featureToggleMap.get(feature) === true;
  }

  private getServerVersion(): Promise<semver.SemVer> {
    return internalRequest.callGet(this.endpoint, "/api/server/version", false).then(semver.coerce);
  }

  private enableBranchesAndPullRequest() {
    if (
      this.endpoint.type === EndpointType.SonarCloud ||
      this.serverVersion >= semver.parse("7.2.0")
    ) {
      featureToggleMap.set(Features.FEATURE_BRANCHES_AND_PULLREQUEST, true);
    }
  }

  private enableNewReportTaskLocation() {
    if (
      this.endpoint.type === EndpointType.SonarCloud ||
      this.serverVersion >= semver.parse("7.2.0")
    ) {
      featureToggleMap.set(Features.FEATURE_NEW_REPORT_TASK_LOCATION, true);
    }
  }

  private enablePullRequestProviderDeprecatedProperty() {
    if (
      this.endpoint.type === EndpointType.SonarQube &&
      this.serverVersion >= semver.parse("8.0.0")
    ) {
      featureToggleMap.set(Features.FEATURE_PULL_REQUEST_PROVIDER_PROPERTY_DEPRECATED, true);
    }
  }
}
