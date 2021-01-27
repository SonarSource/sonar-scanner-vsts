import * as measuresObj from "../measures";

describe("shortIntFormatter", () => {
  it("is equal or above 1e9", () => {
    const value = 1e9;

    const actual = measuresObj.shortIntFormatter(value);

    expect(actual).toBe("1G");
  });

  it("is equal or above 1e6", () => {
    const value = 1e6;

    const actual = measuresObj.shortIntFormatter(value);

    expect(actual).toBe("1M");
  });

  it("is equal or above 1e4", () => {
    const value = 1e4;

    const actual = measuresObj.shortIntFormatter(value);

    expect(actual).toBe("10k");
  });

  it("is equal or above 1e3", () => {
    const value = 1e3;

    const actual = measuresObj.shortIntFormatter(value);

    expect(actual).toBe("1k");
  });

  it("is something else", () => {
    const value = 189;

    const actual = measuresObj.shortIntFormatter(value);

    expect(actual).toBe("189");
  });
});

describe("comparatorFormatter", () => {
  it("should return known enum result", () => {
    const value = "EQ";

    const actual = measuresObj.comparatorFormatter(value);

    expect(actual).toBe("&#61;");
  });

  it("should return passed value", () => {
    const value = "ZZ";

    const actual = measuresObj.comparatorFormatter(value);

    expect(actual).toBe("ZZ");
  });
});

describe("levelFormatter", () => {
  it("should return known enum result", () => {
    const value = "ERROR";

    const actual = measuresObj.levelFormatter(value);

    expect(actual).toBe("Failed");
  });

  it("should return passed value", () => {
    const value = "ZZ";

    const actual = measuresObj.levelFormatter(value);

    expect(actual).toBe("ZZ");
  });
});

describe("millisecondsFormatter", () => {
  it("should return minutes", () => {
    const value = 78000;

    const actual = measuresObj.millisecondsFormatter(value);

    expect(actual).toBe("1min");
  });

  it("should return seconds", () => {
    const value = 1289;

    const actual = measuresObj.millisecondsFormatter(value);

    expect(actual).toBe("1s");
  });

  it("should return milliseconds", () => {
    const value = 987;

    const actual = measuresObj.millisecondsFormatter(value);

    expect(actual).toBe("987ms");
  });
});

describe("shouldDisplayDays", () => {
  it("should return true", () => {
    const days = 2;

    const actual = measuresObj.shouldDisplayDays(days);

    expect(actual).toBe(true);
  });
  it("should return false", () => {
    const days = 0;

    const actual = measuresObj.shouldDisplayDays(days);

    expect(actual).toBe(false);
  });
});

describe("shouldDisplayDaysInShortFormat", () => {
  it("should return true", () => {
    const days = 1.2;

    const actual = measuresObj.shouldDisplayDaysInShortFormat(days);

    expect(actual).toBe(true);
  });
  it("should return false", () => {
    const days = 0.8;

    const actual = measuresObj.shouldDisplayDaysInShortFormat(days);

    expect(actual).toBe(false);
  });
});

describe("shouldDisplayHours", () => {
  it("should return true", () => {
    const days = 8;
    const hour = 12;

    const actual = measuresObj.shouldDisplayHours(days, hour);

    expect(actual).toBe(true);
  });
  it("should return false", () => {
    const days = 12;
    const hour = 12;

    const actual = measuresObj.shouldDisplayHours(days, hour);

    expect(actual).toBe(false);
  });
});

describe("shouldDisplayMinutes", () => {
  it("should return true", () => {
    const days = 0;
    const hour = 8;
    const minutes = 37;

    const actual = measuresObj.shouldDisplayMinutes(days, hour, minutes);

    expect(actual).toBe(true);
  });
  it("should return false", () => {
    const days = 12;
    const hour = 12;
    const minutes = 0;

    const actual = measuresObj.shouldDisplayMinutes(days, hour, minutes);

    expect(actual).toBe(false);
  });
});

describe("addSpaceIfNeeded", () => {
  it("should add extra space", () => {
    const input = "hello";

    const actual = measuresObj.addSpaceIfNeeded(input);

    expect(actual).toBe("hello ");
  });
  it("should not add extra space", () => {
    const input = "";

    const actual = measuresObj.addSpaceIfNeeded(input);

    expect(actual).toBe("");
  });
});

describe("formatDuration", () => {
  it("should display days and hours", () => {
    const days = 3;
    const hours = 12;
    const minutes = 37;

    const actual = measuresObj.formatDuration(false, days, hours, minutes);

    expect(actual).toBe("3d 12h");
  });
  it("should display hours and minutes", () => {
    const days = 0;
    const hours = 9;
    const minutes = 37;

    const actual = measuresObj.formatDuration(false, days, hours, minutes);

    expect(actual).toBe("9h 37min");
  });
  it("should display with negative", () => {
    const days = 2;
    const hours = 9;
    const minutes = 37;

    const actual = measuresObj.formatDuration(true, days, hours, minutes);

    expect(actual).toBe("-2d 9h");
  });
});

describe("formatDurationShort", () => {
  it("should display days and hours", () => {
    const days = 1.2;
    const hours = 12;
    const minutes = 37;

    const actual = measuresObj.formatDurationShort(false, days, hours, minutes);

    expect(actual).toBe("1d");
  });
  it("should display hours", () => {
    const days = 0;
    const hours = 9;
    const minutes = 37;

    const actual = measuresObj.formatDurationShort(false, days, hours, minutes);

    expect(actual).toBe("9h");
  });
  it("should display minutes", () => {
    const days = 0;
    const hours = 0;
    const minutes = 37;

    const actual = measuresObj.formatDurationShort(false, days, hours, minutes);

    expect(actual).toBe("37min");
  });
  it("should display with negative", () => {
    const days = 2;
    const hours = 9;
    const minutes = 37;

    const actual = measuresObj.formatDurationShort(true, days, hours, minutes);

    expect(actual).toBe("-2d");
  });
});

describe("durationFormatter", () => {
  it("should return 0", () => {
    const value = 0;

    let actual = measuresObj.durationFormatter(value);

    expect(actual).toBe("0");

    const valueStr = "0";

    actual = measuresObj.durationFormatter(valueStr);

    expect(actual).toBe("0");
  });
  it("should return value formatted", () => {
    const value = "373832";

    const actual = measuresObj.durationFormatter(value);

    expect(actual).toBe("778d");
  });
});

describe("shortDurationFormatter", () => {
  it("should return 0", () => {
    const value = 0;

    let actual = measuresObj.shortDurationFormatter(value);

    expect(actual).toBe("0");

    const valueStr = "0";

    actual = measuresObj.shortDurationFormatter(valueStr);

    expect(actual).toBe("0");
  });
  it("should return value formatted", () => {
    const value = "1892";

    const actual = measuresObj.shortDurationFormatter(value);

    expect(actual).toBe("4d");
  });
});

describe("ratingFormatter", () => {
  it("should parse string and return value", () => {
    const value = "13";

    const actual = measuresObj.ratingFormatter(value);

    expect(actual).toBe("M");
  });
});

describe("percentFormatter", () => {
  it("should parse string and format value without decimals", () => {
    const value = "13";

    const actual = measuresObj.percentFormatter(value);

    expect(actual).toBe("13.0%");
  });

  it("should return 100%", () => {
    const value = 100;

    const actual = measuresObj.percentFormatter(value);

    expect(actual).toBe("100%");
  });

  it("should return percentage with decimals", () => {
    const value = 15.789556;

    const actual = measuresObj.percentFormatter(value, { decimals: 3 });

    expect(actual).toBe("15.790%");
  });
});

describe("noFormatter", () => {
  it("should return value as-is", () => {
    const value = "13";

    const actual = measuresObj.noFormatter(value);

    expect(actual).toBe("13");
  });
});

describe("floatFormatter", () => {
  it("should round decimals", () => {
    const value = 13.999888777444555;

    const actual = measuresObj.floatFormatter(value);

    expect(actual).toBe("13.99989");
  });
});
