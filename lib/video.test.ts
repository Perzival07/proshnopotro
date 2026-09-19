import { describe, it, expect } from "vitest";
import { videoEmbed } from "./video";

describe("videoEmbed", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=90", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90"],
    ["https://youtube.com/shorts/abcDEF12345", "https://www.youtube-nocookie.com/embed/abcDEF12345"],
    ["https://drive.google.com/file/d/1AbCdEfGhIjK/view", "https://drive.google.com/file/d/1AbCdEfGhIjK/preview"],
  ])("embeds %s", (url, embed) => expect(videoEmbed(url)?.embed).toBe(embed));

  it("links anything else it cannot embed", () =>
    expect(videoEmbed("https://vimeo.com/123")).toEqual({ embed: null, href: "https://vimeo.com/123" }));

  it("refuses what is not an https link", () => {
    expect(videoEmbed("not a link")).toBeNull();
    expect(videoEmbed("http://youtu.be/dQw4w9WgXcQ")).toBeNull();
    expect(videoEmbed("javascript:alert(1)")).toBeNull();
  });
});
