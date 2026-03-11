import { describe, expect, it } from "vitest";

import {
  countArtistWorldTextCoreAnswers,
  ensureArtistWorldVisualBoards,
  hasArtistWorldTextCore,
  hasArtistWorldVisualContent
} from "./artist-world";

describe("artist-world helpers", () => {
  it("always returns the two canonical visual boards and keeps source urls", () => {
    const boards = ensureArtistWorldVisualBoards([
      {
        slug: "fashion",
        name: "Custom name that should be normalized",
        sourceUrl: "https://www.pinterest.com/artist/fashion-board/",
        images: [{ imageUrl: "/uploads/fashion.jpg" }]
      }
    ]);

    expect(boards).toEqual([
      {
        id: null,
        slug: "aesthetics",
        name: "Эстетика",
        sourceUrl: null,
        images: []
      },
      {
        id: null,
        slug: "fashion",
        name: "Фэшн",
        sourceUrl: "https://www.pinterest.com/artist/fashion-board/",
        images: [{ id: null, imageUrl: "/uploads/fashion.jpg" }]
      }
    ]);
  });

  it("counts the required creative text core groups", () => {
    const count = countArtistWorldTextCoreAnswers({
      mission: "Стать узнаваемым исполнителем",
      identityStatement: "Артист тревожной нежности",
      favoriteArtists: ["A", "B", "C"],
      lifeValues: "Саморазвитие",
      coreThemes: ["Ночь", "Память"]
    });

    expect(count).toBe(4);
    expect(
      hasArtistWorldTextCore({
        mission: "Стать узнаваемым исполнителем",
        identityStatement: "Артист тревожной нежности",
        favoriteArtists: ["A", "B", "C"],
        lifeValues: "Саморазвитие",
        coreThemes: ["Ночь", "Память"]
      })
    ).toBe(true);
  });

  it("requires mission for text core readiness", () => {
    expect(
      hasArtistWorldTextCore({
        identityStatement: "Артист тревожной нежности",
        lifeValues: "Саморазвитие",
        coreThemes: ["Ночь", "Память"]
      })
    ).toBe(false);
  });

  it("detects visual content from images or external board links", () => {
    expect(
      hasArtistWorldVisualContent({
        visualBoards: [
          {
            slug: "aesthetics",
            name: "Эстетика",
            images: [{ imageUrl: "/uploads/aesthetics.jpg" }]
          },
          {
            slug: "fashion",
            name: "Фэшн",
            images: []
          }
        ]
      })
    ).toBe(true);

    expect(
      hasArtistWorldVisualContent({
        visualBoards: [
          {
            slug: "aesthetics",
            name: "Эстетика",
            sourceUrl: "https://www.pinterest.com/artist/aesthetics-board/",
            images: []
          },
          {
            slug: "fashion",
            name: "Фэшн",
            images: []
          }
        ]
      })
    ).toBe(true);

    expect(hasArtistWorldVisualContent({ visualBoards: [] })).toBe(false);
  });
});
