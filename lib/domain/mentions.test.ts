import { describe, expect, it } from "vitest";
import { ALLOWED_FILE, mentionedIds, parts, plain } from "./mentions";

describe("mentions", () => {
  const body = "@[Mona Adel](5) please check, and @[Nour](7) / @[Mona Adel](5)";
  it("finds each person once", () => expect(mentionedIds(body)).toEqual([5, 7]));
  it("splits text and mentions", () => {
    expect(parts("hi @[Nour](7)!")).toEqual([{ text: "hi " }, { mention: "Nour", id: 7 }, { text: "!" }]);
    expect(parts("no mention")).toEqual([{ text: "no mention" }]);
  });
  it("reads as plain text", () => expect(plain("hi @[Nour](7)")).toBe("hi @Nour"));
  it("never allows a file a browser would run", () => {
    expect(ALLOWED_FILE.test("drawing.pdf")).toBe(true);
    expect(ALLOWED_FILE.test("part.STEP")).toBe(true);
    expect(ALLOWED_FILE.test("x.html")).toBe(false);
    expect(ALLOWED_FILE.test("x.svg")).toBe(false);
    expect(ALLOWED_FILE.test("x.pdf.exe")).toBe(false);
  });
});
