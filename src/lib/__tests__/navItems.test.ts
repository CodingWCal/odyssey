import { describe, it, expect } from "vitest";
import { splitDesktopNav, type TripNavState } from "@/components/trips/navItems";

const FRESH: TripNavState = { hasPoll: false, hasPlaces: false, memberCount: 1 };
const nothingActive = () => false;
const hrefs = (items: { href: string }[]) => items.map((i) => i.href);

describe("splitDesktopNav (ODY-075 progressive reveal)", () => {
  it("a fresh solo trip shows only the four core tabs, rest under More", () => {
    const { primary, more } = splitDesktopNav(FRESH, nothingActive);
    // Core order is preserved from NAV_ITEMS.
    expect(hrefs(primary)).toEqual(["itinerary", "collections", "map", "budget"]);
    expect(hrefs(more)).toEqual(["schedule", "explore", "members"]);
  });

  it("keeps the four core tabs primary no matter what", () => {
    const { primary } = splitDesktopNav(FRESH, nothingActive);
    for (const core of ["itinerary", "collections", "map", "budget"]) {
      expect(hrefs(primary)).toContain(core);
    }
  });

  it("reveals Schedule once a poll exists", () => {
    const { primary, more } = splitDesktopNav({ ...FRESH, hasPoll: true }, nothingActive);
    expect(hrefs(primary)).toContain("schedule");
    expect(hrefs(more)).not.toContain("schedule");
  });

  it("reveals Explore once a place is saved", () => {
    const { primary, more } = splitDesktopNav({ ...FRESH, hasPlaces: true }, nothingActive);
    expect(hrefs(primary)).toContain("explore");
    expect(hrefs(more)).not.toContain("explore");
  });

  it("reveals Members once a second person is on the trip", () => {
    const soloMore = hrefs(splitDesktopNav(FRESH, nothingActive).more);
    expect(soloMore).toContain("members");
    const grouped = splitDesktopNav({ ...FRESH, memberCount: 2 }, nothingActive);
    expect(hrefs(grouped.primary)).toContain("members");
    expect(hrefs(grouped.more)).not.toContain("members");
  });

  it("never hides the active tab, even when its reveal condition is unmet", () => {
    // On the Schedule page with no poll yet — you must still see where you are.
    const onSchedule = (href: string) => href === "schedule";
    const { primary, more } = splitDesktopNav(FRESH, onSchedule);
    expect(hrefs(primary)).toContain("schedule");
    expect(hrefs(more)).not.toContain("schedule");
  });

  it("a fully-engaged trip collapses More entirely", () => {
    const engaged: TripNavState = { hasPoll: true, hasPlaces: true, memberCount: 3 };
    const { primary, more } = splitDesktopNav(engaged, nothingActive);
    expect(more).toHaveLength(0);
    expect(primary).toHaveLength(7);
  });

  it("preserves NAV_ITEMS ordering within the primary group", () => {
    // Schedule (revealed) should sit before Itinerary, matching array order.
    const { primary } = splitDesktopNav({ ...FRESH, hasPoll: true }, nothingActive);
    expect(hrefs(primary)).toEqual(["schedule", "itinerary", "collections", "map", "budget"]);
  });
});
