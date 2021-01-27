import * as tl from "azure-pipelines-task-lib/task";
import * as analyze from "../../ts/analyze-task";
import Scanner, { ScannerCLI, ScannerMode } from "../sonar/Scanner";

it("should not have SONARQUBE_SCANNER_MODE property filled", async () => {
  jest.spyOn(tl, "getVariable").mockImplementation(() => undefined);

  const expectedError = new Error(
    "[SonarScanner] The 'Prepare Analysis Configuration' task was not executed prior to this task"
  );
  try {
    await analyze.default(__dirname);
  } catch (e) {
    expect(e).toEqual(expectedError);
  }
});

it("should run scanner", async () => {
  jest.spyOn(tl, "getVariable").mockImplementation(() => "CLI");

  const scanner = new ScannerCLI(__dirname, { projectSettings: "scanner.properties" });

  jest.spyOn(Scanner, "getAnalyzeScanner").mockImplementation(() => scanner);

  jest.spyOn(scanner, "runAnalysis").mockImplementation(() => null);

  await analyze.default(__dirname);

  expect(Scanner.getAnalyzeScanner).toHaveBeenCalledWith(__dirname, ScannerMode.CLI);

  expect(scanner.runAnalysis).toBeCalled();
});
