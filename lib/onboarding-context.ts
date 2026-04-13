import { createContext, useContext } from "react";

export const OnboardingContext = createContext<{
  completed: boolean | null;
  refresh: () => Promise<void>;
}>({
  completed: null,
  refresh: async () => {},
});

export const useOnboardingFlag = () => useContext(OnboardingContext);
