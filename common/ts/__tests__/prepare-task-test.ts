import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import { Guid } from "guid-typescript";
import { SemVer } from "semver";
import * as azdoApiUtils from "../helpers/azdo-api-utils";
import Endpoint, { EndpointType } from "../sonar/Endpoint";
import * as prept from "../prepare-task";
import * as request from "../helpers/request";
import Scanner, { ScannerMSBuild } from "../sonar/Scanner";
import SonarInstance from "../sonar/SonarInstance";

import GitInterfaces = require("../node_modules/azure-devops-node-api/interfaces/GitInterfaces");
import WebApi = require("../node_modules/azure-devops-node-api/WebApi");
import GitApi = require("../node_modules/azure-devops-node-api/GitApi");

beforeEach(() => {
  jest.restoreAllMocks();
});

const SQ_ENDPOINT = new Endpoint(EndpointType.SonarQube, { url: "https://sonarqube.com" });

it("should display warning for dedicated extension for Sonarcloud", async () => {
  const scannerObject = new ScannerMSBuild(__dirname, {
    projectKey: "dummyProjectKey",
    projectName: "dummyProjectName",
    projectVersion: "dummyProjectVersion",
    organization: "dummyOrganization",
  });

  jest.spyOn(tl, "getVariable").mockImplementation(() => "");
  jest.spyOn(tl, "warning").mockImplementation(() => null);
  jest.spyOn(Scanner, "getPrepareScanner").mockImplementation(() => scannerObject);
  jest.spyOn(scannerObject, "runPrepare").mockImplementation(() => null);
  jest.spyOn(request, "getServerVersion").mockResolvedValue(new SemVer("7.2.0"));

  jest.spyOn(prept, "getDefaultBranch").mockResolvedValue("refs/heads/master");

  await prept.default(SQ_ENDPOINT, __dirname);

  expect(tl.warning).toHaveBeenCalledWith(
    "There is a dedicated extension for SonarCloud: https://marketplace.visualstudio.com/items?itemName=SonarSource.sonarcloud"
  );
});

it("should build report task path from variables", () => {
  const reportDirectory = path.join("C:", "temp", "dir");
  const sonarSubDirectory = "sonar";
  const buildNumber = "20250909.1";

  const guid = Guid.create();

  jest.spyOn(Guid, "create").mockImplementation(() => guid);

  const reportFullPath = path.join(
    reportDirectory,
    sonarSubDirectory,
    buildNumber,
    guid.toString(),
    "report-task.txt"
  );

  jest.spyOn(tl, "getVariable").mockImplementationOnce(() => reportDirectory);
  jest.spyOn(tl, "getVariable").mockImplementationOnce(() => buildNumber);

  const actual = prept.reportPath();

  expect(actual).toEqual(reportFullPath);
});

describe("getBranchName", () => {
  it("should substring branch name", () => {
    const branchName = "refs/heads/master";

    const actual = prept.branchName(branchName);

    expect(actual).toBe("master");
  });

  it("should return AS-IS already substred branch name", () => {
    const branchName = "simplebranchname";

    const actual = prept.branchName(branchName);

    expect(actual).toBe("simplebranchname");
  });
});

describe("getDefaultBranch", () => {
  it("should return default branch other than master", async () => {
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => "reponame");
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => "teamproject");

    const gitRepo: GitInterfaces.GitRepository = { defaultBranch: "refs/heads/defaulbranch" };
    const gitApi = new GitApi.GitApi("http://mock", null, null);

    jest.spyOn(gitApi, "getRepository").mockResolvedValue(gitRepo);

    const webApi = new WebApi.WebApi("http://mock", null);

    jest.spyOn(webApi, "getGitApi").mockResolvedValue(gitApi);
    jest.spyOn(azdoApiUtils, "getWebApi").mockReturnValue(webApi);

    const defaultBranch = await prept.getDefaultBranch("https://mock");

    expect(defaultBranch).toEqual("refs/heads/defaulbranch");
  });

  it("should throw error and return default default master", async () => {
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => "reponame");
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => "teamproject");

    jest.spyOn(tl, "warning").mockImplementation(() => null);

    const gitApi = new GitApi.GitApi("http://mock", null, null);

    jest.spyOn(gitApi, "getRepository").mockRejectedValue("failing for some reason");

    const webApi = new WebApi.WebApi("http://mock", null);

    jest.spyOn(webApi, "getGitApi").mockResolvedValue(gitApi);
    jest.spyOn(azdoApiUtils, "getWebApi").mockReturnValue(webApi);

    const defaultBranch = await prept.getDefaultBranch("https://mock");

    expect(defaultBranch).toEqual("refs/heads/master");

    expect(tl.warning).toHaveBeenCalledWith(
      "Unable to get default branch, defaulting to 'master': failing for some reason"
    );
  });
});

describe("reportPath", () => {
  it("should build report task path from variables", () => {
    const reportDirectory = path.join("C:", "temp", "dir");
    const sonarSubDirectory = "sonar";
    const buildNumber = "20250909.1";

    const guid = Guid.create();

    jest.spyOn(Guid, "create").mockImplementation(() => guid);

    const reportFullPath = path.join(
      reportDirectory,
      sonarSubDirectory,
      buildNumber,
      guid.toString(),
      "report-task.txt"
    );

    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => reportDirectory);
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => buildNumber);

    const actual = prept.reportPath();

    expect(actual).toEqual(reportFullPath);
  });
});

describe("populateBranchAndPrProps", () => {
  it("with pr id , should populate VSTS props with not deprecated provider property", async () => {
    //System.TeamFoundationCollectionUri
    const collectionUrl = "http://mock";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => collectionUrl);

    //System.PullRequest.PullRequestId
    const prId = "18";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => prId);

    //Build.Repository.Provider
    const repoProvider = "TfsGit";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => repoProvider);

    //System.PullRequest.TargetBranch
    const targetBranch = "master";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => targetBranch);

    //System.PullRequest.SourceBranch
    const sourceBranch = "develop";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => sourceBranch);

    //System.TeamProject
    const teamProject = "TeamProject";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => teamProject);

    //Build.Repository.Name
    const repoName = "myRepo";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => repoName);

    const endpoint = new Endpoint(EndpointType.SonarCloud, {
      url: null,
      token: null,
      username: null,
      password: null,
      organization: null,
    });

    const sonarInstance = new SonarInstance(endpoint, new SemVer("8.0.0"));

    const props: { [key: string]: string } = {};

    jest.spyOn(sonarInstance, "isEnabled").mockReturnValue(false);

    prept.setSonarInstance(sonarInstance);
    await prept.populateBranchAndPrProps(props);

    expect(props["sonar.pullrequest.key"]).toBe(prId);
    expect(props["sonar.pullrequest.provider"]).toBe("vsts");

    expect(props["sonar.pullrequest.base"]).toBe(targetBranch);
    expect(props["sonar.pullrequest.branch"]).toBe(sourceBranch);

    expect(props["sonar.pullrequest.vsts.instanceUrl"]).toBe(collectionUrl);
    expect(props["sonar.pullrequest.vsts.project"]).toBe(teamProject);
    expect(props["sonar.pullrequest.vsts.repository"]).toBe(repoName);
  });

  it("with pr id , should populate VSTS props with deprecated provider property", async () => {
    //System.TeamFoundationCollectionUri
    const collectionUrl = "http://mock";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => collectionUrl);

    //System.PullRequest.PullRequestId
    const prId = "18";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => prId);

    //Build.Repository.Provider
    const repoProvider = "TfsGit";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => repoProvider);

    //System.PullRequest.TargetBranch
    const targetBranch = "master";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => targetBranch);

    //System.PullRequest.SourceBranch
    const sourceBranch = "develop";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => sourceBranch);

    const endpoint = new Endpoint(EndpointType.SonarQube, {
      url: null,
      token: null,
      username: null,
      password: null,
      organization: null,
    });

    const sonarInstance = new SonarInstance(endpoint, new SemVer("8.1.0"));
    sonarInstance.init();

    const props: { [key: string]: string } = {};

    jest.spyOn(sonarInstance, "isEnabled").mockReturnValue(true);

    prept.setSonarInstance(sonarInstance);
    await prept.populateBranchAndPrProps(props);

    expect(props["sonar.pullrequest.provider"]).toBeUndefined();
  });

  it("with pr id , should populate GitHub props with not deprecated provider property", async () => {
    //System.TeamFoundationCollectionUri
    const collectionUrl = "http://mock";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => collectionUrl);

    //System.PullRequest.PullRequestId
    const prId = "18";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => prId);

    //Build.Repository.Provider
    const repoProvider = "GitHub";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => repoProvider);

    //System.PullRequest.TargetBranch
    const targetBranch = "master";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => targetBranch);

    //System.PullRequest.SourceBranch
    const sourceBranch = "develop";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => sourceBranch);

    //System.PullRequest.PullRequestNumber
    const prNumber = "18206";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => prNumber);

    //Build.Repository.Name
    const repoName = "myRepo";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => repoName);

    const endpoint = new Endpoint(EndpointType.SonarQube, {
      url: null,
      token: null,
      username: null,
      password: null,
      organization: null,
    });

    const sonarInstance = new SonarInstance(endpoint, new SemVer("7.9.1"));

    const props: { [key: string]: string } = {};

    jest.spyOn(sonarInstance, "isEnabled").mockReturnValue(false);

    prept.setSonarInstance(sonarInstance);
    await prept.populateBranchAndPrProps(props);

    expect(props["sonar.pullrequest.key"]).toBe(prNumber);
    expect(props["sonar.pullrequest.provider"]).toBe("github");
    expect(props["sonar.pullrequest.github.repository"]).toBe(repoName);
  });

  it("with pr id , should populate GitHub props with deprecated provider property", async () => {
    //System.TeamFoundationCollectionUri
    const collectionUrl = "http://mock";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => collectionUrl);

    //System.PullRequest.PullRequestId
    const prId = "18";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => prId);

    //Build.Repository.Provider
    const repoProvider = "GitHub";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => repoProvider);

    //System.PullRequest.TargetBranch
    const targetBranch = "master";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => targetBranch);

    //System.PullRequest.SourceBranch
    const sourceBranch = "develop";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => sourceBranch);

    //System.PullRequest.PullRequestNumber
    const prNumber = "18206";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => prNumber);

    //Build.Repository.Name
    const repoName = "myRepo";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => repoName);

    const endpoint = new Endpoint(EndpointType.SonarQube, {
      url: null,
      token: null,
      username: null,
      password: null,
      organization: null,
    });

    const sonarInstance = new SonarInstance(endpoint, new SemVer("8.1.0"));
    sonarInstance.init();

    const props: { [key: string]: string } = {};

    jest.spyOn(sonarInstance, "isEnabled").mockReturnValue(true);

    prept.setSonarInstance(sonarInstance);
    await prept.populateBranchAndPrProps(props);

    expect(props["sonar.pullrequest.key"]).toBe(prNumber);
    expect(props["sonar.pullrequest.provider"]).toBeUndefined();
    expect(props["sonar.pullrequest.github.repository"]).toBe(repoName);
  });

  it("with pr id , should populate BBC props with not deprecated provider property", async () => {
    //System.TeamFoundationCollectionUri
    const collectionUrl = "http://mock";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => collectionUrl);

    //System.PullRequest.PullRequestId
    const prId = "18";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => prId);

    //Build.Repository.Provider
    const repoProvider = "Bitbucket";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => repoProvider);

    //System.PullRequest.TargetBranch
    const targetBranch = "master";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => targetBranch);

    //System.PullRequest.SourceBranch
    const sourceBranch = "develop";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => sourceBranch);

    const endpoint = new Endpoint(EndpointType.SonarQube, {
      url: null,
      token: null,
      username: null,
      password: null,
      organization: null,
    });

    const sonarInstance = new SonarInstance(endpoint, new SemVer("7.9.1"));

    const props: { [key: string]: string } = {};

    jest.spyOn(sonarInstance, "isEnabled").mockReturnValue(false);

    prept.setSonarInstance(sonarInstance);
    await prept.populateBranchAndPrProps(props);

    expect(props["sonar.pullrequest.provider"]).toBe("bitbucketcloud");
  });

  it("with pr id , should populate Bitbucket props with deprecated provider property", async () => {
    //System.TeamFoundationCollectionUri
    const collectionUrl = "http://mock";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => collectionUrl);

    //System.PullRequest.PullRequestId
    const prId = "18";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => prId);

    //Build.Repository.Provider
    const repoProvider = "Bitbucket";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => repoProvider);

    //System.PullRequest.TargetBranch
    const targetBranch = "master";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => targetBranch);

    //System.PullRequest.SourceBranch
    const sourceBranch = "develop";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => sourceBranch);

    const endpoint = new Endpoint(EndpointType.SonarQube, {
      url: null,
      token: null,
      username: null,
      password: null,
      organization: null,
    });

    const sonarInstance = new SonarInstance(endpoint, new SemVer("8.1.0"));
    sonarInstance.init();

    const props: { [key: string]: string } = {};

    jest.spyOn(sonarInstance, "isEnabled").mockReturnValue(true);

    prept.setSonarInstance(sonarInstance);
    await prept.populateBranchAndPrProps(props);

    expect(props["sonar.pullrequest.provider"]).toBeUndefined();
  });

  it("with pr id , unknown provider", async () => {
    jest.spyOn(tl, "warning").mockImplementation(() => null);

    //System.TeamFoundationCollectionUri
    const collectionUrl = "http://mock";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => collectionUrl);

    //System.PullRequest.PullRequestId
    const prId = "18";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => prId);

    //Build.Repository.Provider
    const repoProvider = "GitLab";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => repoProvider);

    //System.PullRequest.TargetBranch
    const targetBranch = "master";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => targetBranch);

    //System.PullRequest.SourceBranch
    const sourceBranch = "develop";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => sourceBranch);

    const props: { [key: string]: string } = {};

    await prept.populateBranchAndPrProps(props);

    expect(props["sonar.scanner.skip"]).toBe("true");
    expect(tl.warning).toHaveBeenCalledWith("Unsupported PR provider 'GitLab'");
  });

  it("without pr id , should populate AzDo props, current branch is default branch", async () => {
    //System.TeamFoundationCollectionUri
    const collectionUrl = "https://mock.com";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => collectionUrl);

    //System.PullRequest.PullRequestId
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => undefined);

    //Build.Repository.Provider
    const repoProvider = "TfsGit";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => repoProvider);

    //Build.SourceBranch
    const sourceBranch = "refs/heads/develop";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => sourceBranch);

    const props: { [key: string]: string } = {};

    const gitRepo: GitInterfaces.GitRepository = { defaultBranch: "refs/heads/develop" };
    const gitApi = new GitApi.GitApi("http://mock", null, null);

    jest.spyOn(gitApi, "getRepository").mockResolvedValue(gitRepo);

    const webApi = new WebApi.WebApi("http://mock", null);

    jest.spyOn(webApi, "getGitApi").mockResolvedValue(gitApi);
    jest.spyOn(azdoApiUtils, "getWebApi").mockReturnValue(webApi);

    await prept.populateBranchAndPrProps(props);

    expect(props["sonar.branch.name"]).toBeUndefined();
  });

  it("without pr id , should populate AzDo props, current branch is NOT default branch", async () => {
    //System.TeamFoundationCollectionUri
    const collectionUrl = "https://mock.com";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => collectionUrl);

    //System.PullRequest.PullRequestId
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => undefined);

    //Build.Repository.Provider
    const repoProvider = "TfsGit";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => repoProvider);

    //Build.SourceBranch
    const sourceBranch = "refs/heads/develop";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => sourceBranch);

    const props: { [key: string]: string } = {};

    const gitRepo: GitInterfaces.GitRepository = { defaultBranch: "refs/heads/master" };
    const gitApi = new GitApi.GitApi("http://mock", null, null);

    jest.spyOn(gitApi, "getRepository").mockResolvedValue(gitRepo);

    const webApi = new WebApi.WebApi("http://mock", null);

    jest.spyOn(webApi, "getGitApi").mockResolvedValue(gitApi);
    jest.spyOn(azdoApiUtils, "getWebApi").mockReturnValue(webApi);

    await prept.populateBranchAndPrProps(props);

    expect(props["sonar.branch.name"]).toBe("develop");
  });

  it("without pr id , should populate GitHub props, current branch is NOT default branch", async () => {
    //System.TeamFoundationCollectionUri
    const collectionUrl = "https://mock.com";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => collectionUrl);

    //System.PullRequest.PullRequestId
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => undefined);

    //Build.Repository.Provider
    const repoProvider = "GitHub";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => repoProvider);

    //Build.SourceBranch
    const sourceBranch = "refs/heads/develop";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => sourceBranch);

    const props: { [key: string]: string } = {};

    await prept.populateBranchAndPrProps(props);

    expect(props["sonar.branch.name"]).toBe("develop");
  });

  it("without pr id , should populate Bitbucket props, current branch is NOT default branch", async () => {
    //System.TeamFoundationCollectionUri
    const collectionUrl = "https://mock.com";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => collectionUrl);

    //System.PullRequest.PullRequestId
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => undefined);

    //Build.Repository.Provider
    const repoProvider = "Bitbucket";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => repoProvider);

    //Build.SourceBranch
    const sourceBranch = "refs/heads/develop";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => sourceBranch);

    const props: { [key: string]: string } = {};

    await prept.populateBranchAndPrProps(props);

    expect(props["sonar.branch.name"]).toBe("develop");
  });

  it("without pr id , should populate SVN props, current branch is NOT default branch", async () => {
    //System.TeamFoundationCollectionUri
    const collectionUrl = "https://mock.com";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => collectionUrl);

    //System.PullRequest.PullRequestId
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => undefined);

    //Build.Repository.Provider
    const repoProvider = "Svn";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => repoProvider);

    //Build.SourceBranch
    const sourceBranch = "refs/heads/develop";
    jest.spyOn(tl, "getVariable").mockImplementationOnce(() => sourceBranch);

    const props: { [key: string]: string } = {};

    await prept.populateBranchAndPrProps(props);

    expect(props["sonar.branch.name"]).toBe("develop");
  });
});
