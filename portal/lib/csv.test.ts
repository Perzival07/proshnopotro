import { describe, it, expect } from "vitest";
import { escapeCsvField, toCsv } from "./csv";

describe("escapeCsvField", () => {
  it("quotes plain values", () => {
    expect(escapeCsvField("Rahul")).toBe('"Rahul"');
  });

  it("doubles embedded quotes", () => {
    // Regression: a name containing " produced unbalanced quotes and split
    // the row apart in Excel.
    expect(escapeCsvField('Rahul "Raj" Sharma')).toBe('"Rahul ""Raj"" Sharma"');
  });

  it("keeps commas inside the field", () => {
    expect(escapeCsvField("Sharma, Rahul")).toBe('"Sharma, Rahul"');
  });

  it("keeps newlines inside the field", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("preserves '#', which the old data: URI download truncated at", () => {
    expect(escapeCsvField("10#A")).toBe('"10#A"');
  });

  it("renders null and undefined as empty", () => {
    expect(escapeCsvField(null)).toBe('""');
    expect(escapeCsvField(undefined)).toBe('""');
  });

  it("renders numbers, including zero", () => {
    expect(escapeCsvField(0)).toBe('"0"');
    expect(escapeCsvField(45.5)).toBe('"45.5"');
  });
});

describe("toCsv", () => {
  it("joins rows with CRLF and quotes every field", () => {
    expect(toCsv(["Email", "Score"], [["a@b.com", 45], ["c@d.com", null]])).toBe(
      '"Email","Score"\r\n"a@b.com","45"\r\n"c@d.com",""'
    );
  });

  it("survives a row that would otherwise break the format", () => {
    const csv = toCsv(["Name", "Class"], [['Rahul "Raj", Jr.', "10#A"]]);
    expect(csv).toBe('"Name","Class"\r\n"Rahul ""Raj"", Jr.","10#A"');
    // one header line + one data line, not three
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("emits just the header for an empty roster", () => {
    expect(toCsv(["Email"], [])).toBe('"Email"');
  });
});
