import { create } from "zustand";

interface WakeWordState {
  isActive: boolean;
  wakePrompt: string | null;
  enable: () => void;
  disable: () => void;
  setWakePrompt: (text: string) => void;
  clearWakePrompt: () => void;
}

// ELD 전용. UC-01a/01b(녹음·대화) 세션 진입 시 disable(), 이탈 시 enable() 호출.
export const useWakeWordStore = create<WakeWordState>((set) => ({
  isActive: true,
  wakePrompt: null,
  enable: () => set({ isActive: true }),
  disable: () => set({ isActive: false }),
  setWakePrompt: (text) => set({ wakePrompt: text }),
  clearWakePrompt: () => set({ wakePrompt: null }),
}));
