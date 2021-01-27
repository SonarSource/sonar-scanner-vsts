import * as tl from "azure-pipelines-task-lib/task";
import Endpoint, { EndpointType } from "./Endpoint";
import Metrics from "./Metrics";
import { formatMeasure } from "../helpers/measures";
import { getJSON } from "../helpers/request";

interface IAnalysis {
  status: string;
  conditions: Condition[];
}

interface Condition {
  status: string;
  metricKey: string;
  actualValue?: string;
  comparator?: string;
  periodIndex?: number;
  errorThreshold?: string;
  warningThreshold?: string;
}

export default class Analysis {
  constructor(
    private readonly analysis: IAnalysis,
    private readonly endpointType: EndpointType,
    private readonly warnings: string[],
    private readonly dashboardUrl?: string,
    private readonly metrics?: Metrics,
    private readonly projectName?: string
  ) {}

  public get status() {
    return this.analysis.status.toUpperCase();
  }

  public get conditions() {
    return this.analysis.conditions;
  }

  public getFailedConditions() {
    return this.conditions.filter((condition) =>
      ["WARN", "ERROR"].includes(condition.status.toUpperCase())
    );
  }

  public getHtmlAnalysisReport() {
    tl.debug(`[SonarScanner] Generate analysis report.`);
    return [
      this.getQualityGateSection(),
      this.getQualityGateDetailSection(),
      this.getDashboardLink(),
      this.getWarnings(),
    ]
      .join(" \r\n")
      .trim();
  }

  private getQualityGateSection() {
    const qgStyle = `background-color: ${this.getQualityGateColor()};
      padding: 4px 12px;
      color: #fff;
      letter-spacing: 0.02em;
      line-height: 24px;
      font-weight: 600;
      font-size: 12px;
      margin-left: 15px;`;
    return `<div style="padding-top: 8px;">
      <span>${this.projectName ? this.projectName + " " : ""}Quality Gate</span>
      <span style="${qgStyle}">
        ${formatMeasure(this.status, "LEVEL")}
      </span>
    </div>`;
  }

  private getQualityGateDetailSection() {
    const failedConditions = this.getFailedConditions();
    if (!this.metrics || !["WARN", "ERROR"].includes(this.status) || failedConditions.length <= 0) {
      return "";
    }

    const rows = failedConditions.map((condition) => {
      const metric = this.metrics && this.metrics.getMetricByKey(condition.metricKey);
      if (!metric) {
        return null;
      }

      const threshold =
        condition.status === "WARN" ? condition.warningThreshold : condition.errorThreshold;
      return `<tr>
        <td><span style="padding-right:4px;">${metric.name}</span></td>
        <td style="text-align:center; color:#fff; background-color:${this.getQualityGateColor()};">
          <span style="padding:0px 4px; line-height:20px;">${formatMeasure(
            condition.actualValue,
            metric.type
          )}</span>
        </td>
        <td>
          <span style="padding-left:4px">${formatMeasure(condition.comparator, "COMPARATOR")}</span>
          <span style="padding-left:4px">${formatMeasure(threshold, metric.type)}</span>
        </td>
      </tr>`;
    });

    const tableStyle = `
      margin-top: 8px;
      border-top: 1px solid #eee;
      border-collapse: separate;
      border-spacing: 0 4px;
    `;
    return `<table border="0" style="${tableStyle}">
      <tbody>
        ${rows.join(" \r\n").trim()}
      </tbody>
    </table>\r\n\r\n`; // 2 carriage returns to prevent any malformed summary results
  }

  private getDashboardLink() {
    if (!this.dashboardUrl) {
      return "";
    }
    const linkText = `Detailed ${this.endpointType} report &gt;`;
    return `[${linkText}](${this.dashboardUrl})`;
  }

  public getWarnings() {
    if (this.warnings.some((w) => w.includes("Please update to at least Java 11"))) {
      return `<br><span>&#9888;</span><b>${this.warnings.find((w) =>
        w.includes("Please update to at least Java 11")
      )}</b>`;
    } else {
      return "";
    }
  }

  private getQualityGateColor() {
    switch (this.status) {
      case "OK":
        return "#00aa00";
      case "WARN":
        return "#ed7d20";
      case "ERROR":
        return "#d4333f";
      case "NONE":
        return "#b4b4b4";
      default:
        return "#b4b4b4";
    }
  }

  public static getAnalysis({
    analysisId,
    projectName,
    endpoint,
    metrics,
    dashboardUrl,
    warnings,
  }: {
    analysisId: string;
    dashboardUrl?: string;
    endpoint: Endpoint;
    projectName?: string;
    metrics?: Metrics;
    warnings: string[];
  }): Promise<Analysis> {
    tl.debug(`[SonarScanner] Retrieve Analysis id "${analysisId}."`);
    return getJSON(endpoint, "/api/qualitygates/project_status", { analysisId }).then(
      ({ projectStatus }: { projectStatus: IAnalysis }) =>
        new Analysis(projectStatus, endpoint.type, warnings, dashboardUrl, metrics, projectName),
      (err) => {
        if (err && err.message) {
          tl.error(`[SonarScanner] Error retrieving analysis: ${err.message}`);
        } else if (err) {
          tl.error(`[SonarScanner] Error retrieving analysis: ${JSON.stringify(err)}`);
        }
        throw new Error(`[SonarScanner] Could not fetch analysis for ID "${analysisId}"`);
      }
    );
  }
}
