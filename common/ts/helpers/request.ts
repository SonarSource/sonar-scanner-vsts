import * as request from "request";
import * as semver from "semver";
import * as tl from "azure-pipelines-task-lib/task";
import Endpoint from "../sonarqube/Endpoint";

interface RequestData {
  [x: string]: any;
}

function get(endpoint: Endpoint, path: string, isJson: boolean, query?: RequestData): Promise<any> {
  tl.debug(`[SQ] API GET: '${path}' with query "${JSON.stringify(query)}"`);
  return new Promise((resolve, reject) => {
    const options: request.CoreOptions = {
      auth: endpoint.auth,
    };
    if (query) {
      options.qs = query;
      options.useQuerystring = true;
    }
    request.get(
      {
        method: "GET",
        baseUrl: endpoint.url,
        uri: path,
        json: isJson,
        ...options,
      },
      (error, response, body) => {
        if (error) {
          return logAndReject(
            reject,
            `[SQ] API GET '${path}' failed, error was: ${JSON.stringify(error)}`
          );
        }
        tl.debug(
          `Response: ${response.statusCode} Body: "${isString(body) ? body : JSON.stringify(body)}"`
        );
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return logAndReject(
            reject,
            `[SQ] API GET '${path}' failed, status code was: ${response.statusCode}`
          );
        }
        return resolve(body || (isJson ? {} : ""));
      }
    );
  });
}

export function getNoSonar(baseUrl: string, path: string): Promise<any> {
  tl.debug(`GET request against ${baseUrl}${path}`);
  return new Promise((resolve, reject) => {
    request.get(
      {
        method: "GET",
        baseUrl,
        uri: path,
        json: true,
        headers: { "user-agent": "sonar-azdo-extension" },
      },
      (error, response, body) => {
        if (error) {
          return logAndReject(
            reject,
            `Request to '${path}' failed, error was: ${JSON.stringify(error)}`
          );
        }
        tl.debug(
          `Response: ${response.statusCode} Body: "${isString(body) ? body : JSON.stringify(body)}"`
        );
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return logAndReject(
            reject,
            `Request to '${path}' failed, status code was: ${response.statusCode}`
          );
        }
        return resolve(body);
      }
    );
  });
}

function isString(x) {
  return Object.prototype.toString.call(x) === "[object String]";
}

export function getJSON(endpoint: Endpoint, path: string, query?: RequestData): Promise<any> {
  return get(endpoint, path, true, query);
}

export function getServerVersion(endpoint: Endpoint): Promise<semver.SemVer> {
  return get(endpoint, "/api/server/version", false).then(semver.coerce);
}

function logAndReject(reject, errMsg) {
  tl.debug(errMsg);
  return reject(new Error(errMsg));
}
