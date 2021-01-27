import Analysis from "../Analysis";
import { getJSON } from "../../helpers/request";
import Metrics from "../Metrics";
import Endpoint, { EndpointType } from "../Endpoint";

jest.mock("../../helpers/request", () => ({
  getJSON: jest.fn(() =>
    Promise.resolve({
      projectStatus: {
        status: "ERROR",
        conditions: [
          {
            status: "ERROR",
            metricKey: "bugs",
            comparator: "GT",
            errorThreshold: "0",
            actualValue: "1",
          },
        ],
      },
    })
  ),
}));

jest.mock("azure-pipelines-task-lib/task", () => ({
  debug: jest.fn(),
  error: jest.fn(),
}));

const METRICS = new Metrics([{ key: "bugs", name: "Bugs", type: "INT" }]);
const ENDPOINT = new Endpoint(EndpointType.SonarQube, { url: "https://endpoint.url" });
const GET_ANALYSIS_DATA = {
  analysisId: "analysisId",
  dashboardUrl: "https://dashboard.url",
  endpoint: ENDPOINT,
  metrics: METRICS,
  warnings: [],
};

beforeEach(() => {
  (getJSON as jest.Mock<any>).mockClear();
});

it("should generate an analysis status with error", async () => {
  const analysis = await Analysis.getAnalysis(GET_ANALYSIS_DATA);
  expect(getJSON).toHaveBeenCalledWith(ENDPOINT, "/api/qualitygates/project_status", {
    analysisId: "analysisId",
  });
  expect(analysis.status).toBe("ERROR");
  expect(analysis.getFailedConditions()).toHaveLength(1);
  expect(analysis.getHtmlAnalysisReport()).toMatchSnapshot();
});

it("should generate a green analysis status", async () => {
  (getJSON as jest.Mock<any>).mockImplementationOnce(() =>
    Promise.resolve({ projectStatus: { status: "SUCCESS", conditions: [] } })
  );

  const analysis = await Analysis.getAnalysis(GET_ANALYSIS_DATA);
  expect(getJSON).toHaveBeenCalledWith(ENDPOINT, "/api/qualitygates/project_status", {
    analysisId: "analysisId",
  });
  expect(analysis.status).toBe("SUCCESS");
  expect(analysis.getFailedConditions()).toHaveLength(0);
  expect(analysis.getHtmlAnalysisReport()).toMatchSnapshot();
});

it("should not fail when metrics are missing", async () => {
  const analysis = await Analysis.getAnalysis({
    ...GET_ANALYSIS_DATA,
    dashboardUrl: undefined,
    metrics: undefined,
  });
  expect(getJSON).toHaveBeenCalledWith(ENDPOINT, "/api/qualitygates/project_status", {
    analysisId: "analysisId",
  });
  expect(analysis.status).toBe("ERROR");
  expect(analysis.getFailedConditions()).toHaveLength(1);
  expect(analysis.getHtmlAnalysisReport()).toMatchSnapshot();
});

it("should display the project name", async () => {
  const analysis = await Analysis.getAnalysis({
    ...GET_ANALYSIS_DATA,
    projectName: "project_name",
  });
  expect(analysis.getHtmlAnalysisReport()).toMatchSnapshot();
});

it("should display Java 11 warning", async () => {
  const analysis = await Analysis.getAnalysis({
    ...GET_ANALYSIS_DATA,
    warnings: [
      "The version of Java (1.8.0_221) you have used to run this analysis is deprecated and we will stop accepting it from October 2020. Please update to at least Java 11.",
    ],
  });
  expect(analysis.getWarnings()).toStrictEqual(
    "<br><span>&#9888;</span><b>The version of Java (1.8.0_221) you have used to run this analysis is deprecated and we will stop accepting it from October 2020. Please update to at least Java 11.</b>"
  );
});
