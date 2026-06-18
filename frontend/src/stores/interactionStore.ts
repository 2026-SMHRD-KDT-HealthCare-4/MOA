import { create } from "zustand";

interface InteractionState {
  hasUserInteracted: boolean;
  markUserInteracted: () => void;
}

export const useInteractionStore = create<InteractionState>((set) => ({
  hasUserInteracted: false,
  markUserInteracted: () => set({ hasUserInteracted: true }),
}));
