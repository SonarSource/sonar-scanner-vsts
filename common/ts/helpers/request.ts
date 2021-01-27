import * as request from "request";
import * as semver from "semver";
import * as tl from "azure-pipelines-task-lib/task";
import Endpoint from "../sonar/Endpoint";

export interface RequestData {
  [x: string]: any;
}

export function callGet(
  endpoint: Endpoint,
  path: string,
  isJson: boolean,
  query?: RequestData
): Promise<any> {
  tl.debug(`[SonarScanner] API GET: '${path}' with query '${JSON.stringify(query)}'`);
  return new Promise((resolve, reject) => {
    const options: request.CoreOptions = {};
    if (endpoint.auth && endpoint.auth.user) {
      options.auth = endpoint.auth;
    }
    if (query) {
      options.qs = query;
      options.useQuerystring = true;
    }
    request.get(
      {
        baseUrl: endpoint.url,
        uri: path,
        json: isJson,
        ...options,
      },
      (error, response, body) => {
        if (error) {
          tl.debug(`[SonarScanner] API GET '${path}' failed, error was: ${JSON.stringify(error)}`);
          return reject(isJson ? {} : "");
        }
        tl.debug(
          `Response: ${response.statusCode} Body: "${isString(body) ? body : JSON.stringify(body)}"`
        );
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const errorMessage = `[SonarScanner] API GET '${path}' failed, status code was: ${response.statusCode}`;
          tl.debug(errorMessage);
          return reject(isJson ? {} : "");
        }
        return resolve(body || (isJson ? {} : ""));
      }
    );
  });
}

export function isString(x) {
  return Object.prototype.toString.call(x) === "[object String]";
}

export function getJSON(endpoint: Endpoint, path: string, query?: RequestData): Promise<any> {
  return callGet(endpoint, path, true, query);
}

export function getServerVersion(endpoint: Endpoint): Promise<semver.SemVer> {
  return callGet(endpoint, "/api/server/version", false).then(semver.coerce);
}
