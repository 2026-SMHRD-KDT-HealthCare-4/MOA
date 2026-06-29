import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type CycleType = "daily" | "weekly" | "custom_days";
export type Weekday = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
export type MedicationStatus = "pending" | "completed" | "reminder_scheduled";

export type MedicationItem = {
  id: string;
  medicineName: string;
  cycleType: CycleType;
  scheduleType: CycleType;
  daysOfWeek: Weekday[];
  times: string[];
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  status: MedicationStatus;
  reminderCount: number;
  completedAt?: string;
  notificationId?: string;
  createdAt: string;
  updatedAt: string;
  // Existing reminder conversation uses this as the primary scheduled time.
  scheduledTime: string;
};

export type HospitalSchedule = {
  id: string;
  hospitalName: string;
  visitDate: string;
  visitTime: string;
  memo?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MedicationInput = Pick<MedicationItem, "medicineName" | "cycleType" | "scheduleType" | "daysOfWeek" | "times" | "startDate" | "endDate" | "isActive">;
type HospitalInput = Pick<HospitalSchedule, "hospitalName" | "visitDate" | "visitTime" | "memo" | "enabled">;

type MedicationState = {
  medications: MedicationItem[];
  hospitalSchedules: HospitalSchedule[];
  addMedication: (input: MedicationInput) => string;
  updateMedication: (id: string, input: MedicationInput) => void;
  toggleMedication: (id: string, isActive: boolean) => void;
  removeMedication: (id: string) => void;
  deleteMedication: (id: string) => void;
  markPending: (id: string) => void;
  setNotificationId: (id: string, notificationId?: string) => void;
  respond: (id: string, answer: string) => "completed" | "reminder_scheduled" | "unknown";
  addHospitalSchedule: (input: HospitalInput) => string;
  updateHospitalSchedule: (id: string, input: HospitalInput) => void;
  removeHospitalSchedule: (id: string) => void;
};

const now = new Date().toISOString();
const makeMedication = (id: string, medicineName: string, times: string[], status: MedicationStatus): MedicationItem => ({
  id, medicineName, cycleType: "daily", scheduleType: "daily", daysOfWeek: [], times, startDate: now.slice(0, 10), endDate: null, scheduledTime: times[0], isActive: true, status, reminderCount: 0, createdAt: now, updatedAt: now,
});

const negative = ["안먹었어", "아직", "나중에", "까먹었어", "안했어"];

const medicationStorage = createJSONStorage(() => ({
  getItem: (key: string) => typeof localStorage === "undefined" ? null : localStorage.getItem(key),
  setItem: (key: string, value: string) => { if (typeof localStorage !== "undefined") localStorage.setItem(key, value); },
  removeItem: (key: string) => { if (typeof localStorage !== "undefined") localStorage.removeItem(key); },
}));

export const useMedicationStore = create<MedicationState>()(persist((set, get) => ({
  medications: [
    makeMedication("med-blood-pressure", "혈압약", ["08:00"], "completed"),
    makeMedication("med-diabetes", "당뇨약", ["08:00", "13:00", "19:00"], "pending"),
    makeMedication("med-vitamin", "종합비타민", ["19:00"], "reminder_scheduled"),
  ],
  hospitalSchedules: [
    { id: "hospital-hyundai", hospitalName: "남양주 현대병원", visitDate: "2026-06-20", visitTime: "10:00", memo: "정기 검진", enabled: true, createdAt: now, updatedAt: now },
    { id: "hospital-asan", hospitalName: "서울아산병원", visitDate: "2026-07-03", visitTime: "14:00", memo: "정기 검사", enabled: true, createdAt: now, updatedAt: now },
  ],
  addMedication: (input) => {
    const id = `med-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; const updatedAt = new Date().toISOString();
    set((state) => ({ medications: [...state.medications, { ...input, id, scheduledTime: input.times[0], status: "pending", reminderCount: 0, createdAt: updatedAt, updatedAt }] }));
    return id;
  },
  updateMedication: (id, input) => set((state) => ({ medications: state.medications.map((item) => item.id === id ? { ...item, ...input, scheduledTime: input.times[0], updatedAt: new Date().toISOString() } : item) })),
  toggleMedication: (id, isActive) => set((state) => ({ medications: state.medications.map((item) => item.id === id ? { ...item, isActive, updatedAt: new Date().toISOString() } : item) })),
  removeMedication: (id) => set((state) => ({ medications: state.medications.filter((item) => item.id !== id) })),
  deleteMedication: (id) => set((state) => ({ medications: state.medications.filter((item) => item.id !== id) })),
  markPending: (id) => set((state) => ({ medications: state.medications.map((item) => item.id === id ? { ...item, status: "pending", reminderCount: 0, completedAt: undefined } : item) })),
  setNotificationId: (id, notificationId) => set((state) => ({ medications: state.medications.map((item) => item.id === id ? { ...item, notificationId } : item) })),
  respond: (id, rawAnswer) => {
    const answer = rawAnswer.replace(/\s/g, "").toLowerCase(); const item = get().medications.find((medication) => medication.id === id);
    if (!item) return "unknown";
    if (negative.some((word) => answer.includes(word)) && item.reminderCount < 1) { set((state) => ({ medications: state.medications.map((medication) => medication.id === id ? { ...medication, status: "reminder_scheduled", reminderCount: 1 } : medication) })); return "reminder_scheduled"; }
    return "unknown";
  },
  addHospitalSchedule: (input) => { const id = `hospital-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; const createdAt = new Date().toISOString(); set((state) => ({ hospitalSchedules: [...state.hospitalSchedules, { ...input, id, createdAt, updatedAt: createdAt }] })); return id; },
  updateHospitalSchedule: (id, input) => set((state) => ({ hospitalSchedules: state.hospitalSchedules.map((item) => item.id === id ? { ...item, ...input, updatedAt: new Date().toISOString() } : item) })),
  removeHospitalSchedule: (id) => set((state) => ({ hospitalSchedules: state.hospitalSchedules.filter((item) => item.id !== id) })),
}), {
  name: "moa-medications-v1",
  storage: medicationStorage,
  partialize: (state) => ({ medications: state.medications }),
}));
