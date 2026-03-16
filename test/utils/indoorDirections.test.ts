import { findIndoorRoute } from "../../utils/indoorDirections";

describe("indoorDirections", () => {
  test("builds natural directions that match the displayed Hall 9 route", () => {
    const route = findIndoorRoute("H", "919", "962");
    expect(route).not.toBeNull();
    expect(route?.steps.map((step) => step.instruction)).toEqual([
      "Start at room H-919.",
      "Continue straight for about 17 m.",
      "Turn left and continue for about 7 m.",
      "Turn right and continue for about 7 m.",
      "Turn left and continue for about 4 m.",
      "Room H-962 will be on your right.",
    ]);
  });
});
