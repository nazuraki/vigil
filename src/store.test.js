import { describe, expect, it } from "vitest";
import { newAccountId, sortRepos } from "./store.js";

describe("sortRepos", () => {
  it("sorts alphabetically by owner/repo", () => {
    const input = [
      { owner: "z-org", repo: "alpha" },
      { owner: "a-org", repo: "zebra" },
      { owner: "a-org", repo: "alpha" },
    ];
    expect(sortRepos(input)).toEqual([
      { owner: "a-org", repo: "alpha" },
      { owner: "a-org", repo: "zebra" },
      { owner: "z-org", repo: "alpha" },
    ]);
  });

  it("is case-insensitive", () => {
    const input = [
      { owner: "B-org", repo: "repo" },
      { owner: "a-org", repo: "repo" },
    ];
    expect(sortRepos(input)[0].owner).toBe("a-org");
  });

  it("does not mutate the input", () => {
    const input = [
      { owner: "z", repo: "z" },
      { owner: "a", repo: "a" },
    ];
    const copy = [...input];
    sortRepos(input);
    expect(input).toEqual(copy);
  });

  it("handles empty array", () => {
    expect(sortRepos([])).toEqual([]);
  });
});

describe("newAccountId", () => {
  it("returns a non-empty string", () => {
    expect(typeof newAccountId()).toBe("string");
    expect(newAccountId().length).toBeGreaterThan(0);
  });

  it("returns unique values", () => {
    const ids = new Set(Array.from({ length: 20 }, () => newAccountId()));
    expect(ids.size).toBe(20);
  });
});
