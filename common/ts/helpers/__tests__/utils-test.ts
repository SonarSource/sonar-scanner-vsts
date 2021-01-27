import * as tl from "azure-pipelines-task-lib/task";
import { setIfNotEmpty, toCleanJSON, isWindows } from "../utils";

describe("toCleanJSON", () => {
  it("should jsonify", () => {
    expect(toCleanJSON({ foo: "a", bar: "b" })).toBe('{"foo":"a","bar":"b"}');
  });
  it("should clean the jsonified object", () => {
    expect(toCleanJSON({ foo: "a", bar: undefined, baz: "" })).toBe('{"foo":"a","baz":""}');
  });
});

describe("setIfNotEmpty", () => {
  it("should correctly set a property", () => {
    const test = {};
    setIfNotEmpty(test, "foo", "");
    expect(test).toEqual({});
    setIfNotEmpty(test, "foo", undefined);
    expect(test).toEqual({});
    setIfNotEmpty(test, "foo", "bar");
    expect(test).toEqual({ foo: "bar" });
  });
});

describe("isOsWindows", () => {
  it("should return 2", () => {
    jest.spyOn(tl, "getPlatform").mockReturnValue(2);
    const actual = isWindows();
    expect(actual).toEqual(false);
  });
});
