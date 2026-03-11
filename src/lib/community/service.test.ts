import { CommunityAchievementType, CommunityEventStatus, FriendshipStatus, UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  attendCommunityEvent,
  getCommunityEvents,
  getCommunityFriendAchievements,
  getCommunityOverview,
  getCommunityProfile,
  leaveCommunityEvent
} from "@/lib/community/service";

function createDbMock() {
  return {
    friendship: {
      findMany: vi.fn(),
      count: vi.fn()
    },
    communityAchievement: {
      findMany: vi.fn(),
      count: vi.fn()
    },
    communityLike: {
      findMany: vi.fn(),
      count: vi.fn()
    },
    communityEvent: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn()
    },
    communityEventAttendance: {
      count: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    },
    track: {
      findFirst: vi.fn()
    }
  } as any;
}

function makeUser(id: string, safeId: string, nickname: string) {
  return {
    id,
    safeId,
    nickname,
    avatarUrl: null,
    role: UserRole.ARTIST,
    pathStage: null
  };
}

describe("community service", () => {
  it("returns only visible milestone types in friend achievements", async () => {
    const db = createDbMock();
    db.friendship.findMany.mockResolvedValue([
      {
        requesterUserId: "viewer",
        addresseeUserId: "friend-1"
      }
    ]);
    db.communityAchievement.findMany.mockResolvedValue([
      {
        id: "ach-1",
        userId: "friend-1",
        type: CommunityAchievementType.TRACK_CREATED,
        title: "Новый трек",
        body: "Начал новый трек.",
        metadata: null,
        createdAt: new Date("2026-03-10T09:00:00.000Z"),
        user: makeUser("friend-1", "SAFE1", "Друг")
      }
    ]);
    db.communityLike.findMany.mockResolvedValue([]);

    const result = await getCommunityFriendAchievements(db, "viewer", 10);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.content.type).toBe("ACHIEVEMENT");
    expect(db.communityAchievement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: {
            in: expect.arrayContaining([
              CommunityAchievementType.TRACK_CREATED,
              CommunityAchievementType.DEMO_UPLOADED,
              CommunityAchievementType.PATH_STAGE_REACHED,
              CommunityAchievementType.TRACK_RETURNED,
              CommunityAchievementType.DEMO_COMPLETED,
              CommunityAchievementType.RELEASE_READY
            ])
          }
        })
      })
    );
    expect(db.communityAchievement.findMany.mock.calls[0]?.[0]?.where?.type?.in).not.toContain(CommunityAchievementType.FEEDBACK_REQUESTED);
    expect(db.communityAchievement.findMany.mock.calls[0]?.[0]?.where?.type?.in).not.toContain(CommunityAchievementType.ARTIST_HELPED);
  });

  it("returns RSVP-aware event cards", async () => {
    const db = createDbMock();
    db.communityEvent.findMany.mockResolvedValue([
      {
        id: "event-1",
        slug: "creator-meetup",
        title: "Creator Meetup",
        description: "Оффлайн встреча.",
        startsAt: new Date("2026-03-20T18:00:00.000Z"),
        endsAt: null,
        city: "Москва",
        isOnline: false,
        hostLabel: "ART SAFE PLACE",
        coverImageUrl: null,
        attendances: [{ id: "attendance-1" }],
        _count: { attendances: 8 }
      }
    ]);
    db.communityLike.findMany.mockResolvedValue([]);

    const result = await getCommunityEvents(db, "viewer", 6);

    expect(result.items[0]).toMatchObject({
      id: "event-1",
      attendeeCount: 8,
      viewerIsAttending: true,
      city: "Москва"
    });
  });

  it("joins published future events idempotently and rejects past events", async () => {
    const db = createDbMock();
    db.communityEvent.findUnique.mockResolvedValue({
      id: "event-1",
      status: CommunityEventStatus.PUBLISHED,
      startsAt: new Date("2026-03-20T18:00:00.000Z")
    });
    db.communityEventAttendance.upsert.mockResolvedValue({});
    db.communityEvent.findFirst.mockResolvedValue({
      id: "event-1",
      slug: "creator-meetup",
      title: "Creator Meetup",
      description: "Оффлайн встреча.",
      startsAt: new Date("2026-03-20T18:00:00.000Z"),
      endsAt: null,
      city: "Москва",
      isOnline: false,
      hostLabel: "ART SAFE PLACE",
      coverImageUrl: null,
      attendances: [{ id: "attendance-1" }],
      _count: { attendances: 3 }
    });
    db.communityLike.findMany.mockResolvedValue([]);

    const joined = await attendCommunityEvent(db, "viewer", "event-1");

    expect(joined.viewerIsAttending).toBe(true);
    expect(db.communityEventAttendance.upsert).toHaveBeenCalledWith({
      where: {
        eventId_userId: {
          eventId: "event-1",
          userId: "viewer"
        }
      },
      create: {
        eventId: "event-1",
        userId: "viewer"
      },
      update: {}
    });

    db.communityEvent.findUnique.mockResolvedValue({
      id: "event-old",
      status: CommunityEventStatus.PUBLISHED,
      startsAt: new Date("2026-03-01T18:00:00.000Z")
    });

    await expect(attendCommunityEvent(db, "viewer", "event-old")).rejects.toThrow(
      "Запись доступна только на опубликованные будущие ивенты."
    );
  });

  it("cancels event attendance without leaving dangling RSVP state", async () => {
    const db = createDbMock();
    db.communityEventAttendance.deleteMany.mockResolvedValue({ count: 1 });
    db.communityEvent.findFirst.mockResolvedValue({
      id: "event-1",
      slug: "creator-meetup",
      title: "Creator Meetup",
      description: "Оффлайн встреча.",
      startsAt: new Date("2026-03-20T18:00:00.000Z"),
      endsAt: null,
      city: "Москва",
      isOnline: false,
      hostLabel: "ART SAFE PLACE",
      coverImageUrl: null,
      attendances: [],
      _count: { attendances: 2 }
    });
    db.communityLike.findMany.mockResolvedValue([]);

    const left = await leaveCommunityEvent(db, "viewer", "event-1");

    expect(left.viewerIsAttending).toBe(false);
    expect(db.communityEventAttendance.deleteMany).toHaveBeenCalledWith({
      where: {
        eventId: "event-1",
        userId: "viewer"
      }
    });
  });

  it("builds overview counts around events and friend wins", async () => {
    const db = createDbMock();
    db.friendship.findMany.mockResolvedValue([
      {
        requesterUserId: "viewer",
        addresseeUserId: "friend-1"
      }
    ]);
    db.communityEvent.findMany.mockResolvedValue([]);
    db.communityLike.findMany.mockResolvedValue([]);
    db.friendship.count.mockResolvedValue(4);
    db.communityEvent.count.mockResolvedValue(6);
    db.communityEventAttendance.count.mockResolvedValue(2);
    db.communityAchievement.count.mockResolvedValue(5);

    const result = await getCommunityOverview(db, "viewer");

    expect(result.counts).toEqual({
      friends: 4,
      upcomingEvents: 6,
      myEvents: 2,
      friendWinsThisWeek: 5
    });
  });

  it("returns achievement-only profile activity with event participation stats", async () => {
    const db = createDbMock();
    db.user.findUnique.mockResolvedValue({
      id: "friend-1",
      safeId: "SAFE1",
      nickname: "Друг",
      avatarUrl: null,
      role: UserRole.ARTIST,
      links: null,
      pathStage: null,
      specialistProfile: null,
      identityProfile: {
        identityStatement: "Делаю песни.",
        mission: null,
        philosophy: null,
        visualDirection: null,
        audienceCore: null,
        differentiator: null,
        aestheticKeywords: [],
        coreThemes: [],
        fashionSignals: [],
        currentFocusTitle: null,
        currentFocusDetail: null,
        seekingSupportDetail: null,
        supportNeedTypes: []
      }
    });
    db.friendship.findMany.mockResolvedValue([]);
    db.friendship.count.mockResolvedValue(3);
    db.communityAchievement.findMany
      .mockResolvedValueOnce([
        {
          id: "ach-1",
          userId: "friend-1",
          type: CommunityAchievementType.RELEASE_READY,
          title: "Релизный этап",
          body: "Трек вышел на релизный контур.",
          metadata: null,
          createdAt: new Date("2026-03-10T09:00:00.000Z"),
          user: makeUser("friend-1", "SAFE1", "Друг")
        }
      ])
      .mockResolvedValueOnce([{ id: "ach-1" }, { id: "ach-2" }]);
    db.communityEventAttendance.count.mockResolvedValue(2);
    db.track.findFirst.mockResolvedValue(null);
    db.communityLike.findMany.mockResolvedValue([]);
    db.communityLike.count.mockResolvedValue(7);

    const result = await getCommunityProfile(db, "viewer", "SAFE1");

    expect(result.stats).toEqual({
      friendsCount: 3,
      achievementsCount: 2,
      goingEventsCount: 2,
      totalLikesReceived: 7
    });
    expect(result.recentActivity).toHaveLength(1);
    expect(result.recentActivity[0]?.content.type).toBe("ACHIEVEMENT");
  });
});
