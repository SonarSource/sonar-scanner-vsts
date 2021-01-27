import * as tl from "azure-pipelines-task-lib/task";

export const PROP_NAMES = {
  HOST_URL: "sonar.host.url",
  LOGIN: "sonar.login",
  PASSSWORD: "sonar.password",
  ORG: "sonar.organization",
  PROJECTKEY: "sonar.projectKey",
  PROJECTNAME: "sonar.projectName",
  PROJECTVERSION: "sonar.projectVersion",
  PROJECTSOURCES: "sonar.sources",
  PROJECTSETTINGS: "project.settings",
};

export function toCleanJSON(props: { [key: string]: string | undefined }) {
  return JSON.stringify(
    props,
    Object.keys(props).filter((key) => props[key] != null)
  );
}

export function setIfNotEmpty(props: { [key: string]: string }, key: string, value?: string) {
  if (value) {
    props[key] = value;
  }
}

export function isWindows() {
  return tl.getPlatform() === 0;
}
