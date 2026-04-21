import { describe, expect, it } from "vitest";
import { timeAgo } from "./time.js";

function ago(seconds) {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

describe("timeAgo", () => {
  it("returns 'just now' for < 60 s", () => {
    expect(timeAgo(ago(30))).toBe("just now");
    expect(timeAgo(ago(0))).toBe("just now");
  });

  it("returns minutes for 1 m – 59 m", () => {
    expect(timeAgo(ago(60))).toBe("1m ago");
    expect(timeAgo(ago(90))).toBe("1m ago");
    expect(timeAgo(ago(3599))).toBe("59m ago");
  });

  it("returns hours for 1 h – 23 h", () => {
    expect(timeAgo(ago(3600))).toBe("1h ago");
    expect(timeAgo(ago(7200))).toBe("2h ago");
    expect(timeAgo(ago(86399))).toBe("23h ago");
  });

  it("returns days for 1 d – 6 d", () => {
    expect(timeAgo(ago(86400))).toBe("1d ago");
    expect(timeAgo(ago(172800))).toBe("2d ago");
    expect(timeAgo(ago(604799))).toBe("6d ago");
  });

  it("returns locale date for >= 7 d", () => {
    const result = timeAgo(ago(604800));
    // Should be a date string, not an "ago" string
    expect(result).not.toMatch(/ago/);
    expect(result.length).toBeGreaterThan(0);
  });
});
