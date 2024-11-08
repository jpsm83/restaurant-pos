import { create } from "zustand";

export type User = {
    username: string;
    businessId: string;
    randomNumber?: number;
};

export type Actions = {
    setUserData: (username: string, businessId: string) => void;
    resetUserData: () => void;
    increaseRandomNumber: () => void;
};

export const useUserStore = create<User & Actions>((set) => ({
    username: "",
    businessId: "",
    randomNumber: 0,
    setUserData: (username: string, businessId: string) => set(() => ({ username, businessId })),
    resetUserData: () => set({ username: null, businessId: null }),
    increaseRandomNumber: () => set((state) => ({ randomNumber: state.randomNumber! + 1 })),
}));
