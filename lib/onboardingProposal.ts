import type { SwipeCardPayload } from "./types";

let current: SwipeCardPayload | null = null;

export const onboardingProposal = {
  set(payload: SwipeCardPayload) {
    current = payload;
  },
  get(): SwipeCardPayload | null {
    return current;
  },
  clear() {
    current = null;
  },
};
