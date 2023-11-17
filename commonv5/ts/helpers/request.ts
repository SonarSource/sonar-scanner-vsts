import * as tl from "azure-pipelines-task-lib/task";
import fetch from "node-fetch";
import * as semver from "semver";
import Endpoint from "../sonarqube/Endpoint";

interface RequestData {
  [x: string]: any;
}

export async function get<T>(
  endpoint: Endpoint,
  path: string,
  isJson: boolean,
  query?: RequestData,
): Promise<T | string> {
  const hasQuery = query && Object.keys(query).length > 0;
  const fullUrl =
    endpoint.url + path + (hasQuery ? "?" + new URLSearchParams(query).toString() : "");
  tl.debug(
    `[SQ] API GET: '${path}' with full URL "${fullUrl}" and query "${JSON.stringify(query)}"`,
  );

  try {
    const response = await fetch(fullUrl, endpoint.toFetchOptions(fullUrl));
    if (isJson) {
      return await response.json();
    } else {
      return await response.text();
    }
  } catch (error) {
    if (error.response) {
      tl.debug(`[SQ] API GET '${path}' failed, status code was: ${error.response.status}`);
    } else {
      tl.debug(`[SQ] API GET '${path}' failed, error is ${error.message}`);
    }
    throw new Error(`[SQ] API GET '${path}' failed, error is ${error.message}`);
  }
}

export function startIgnoringCertificate() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED_BACKUP = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export function stopIgnoringCertificate() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED_BACKUP;
}

export async function getServerVersion(endpoint: Endpoint): Promise<semver.SemVer> {
  return semver.coerce(await get<string>(endpoint, "/api/server/version", false));
}
