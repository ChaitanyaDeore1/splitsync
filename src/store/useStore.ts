import { create } from 'zustand';

// Browser-side state is only "who is signed in", the tour and the unread-notification count. All money data lives on the server.
interface State {
  user: { id: string; name: string } | null;
  tourOpen: boolean;
  unread: number;
  setUnread: (n: number) => void;
  signIn: (user: { id: string; name: string }) => void;
  openTour: () => void;
  closeTour: () => void;
}

const flag = (id: string) => `splitsync:tour-seen:${id}`;
const wasSeen = (id: string) => {
  try {
    return localStorage.getItem(flag(id)) !== null;
  } catch {
    return false;
  }
};

export const useStore = create<State>()((set, get) => ({
  user: null,
  tourOpen: false,
  unread: 0,
  setUnread: (unread) => set({ unread }),
  signIn: (user) => set({ user: { id: user.id, name: user.name }, tourOpen: !wasSeen(user.id) }),
  openTour: () => set({ tourOpen: true }),
  closeTour: () => {
    const user = get().user;
    try {
      if (user) localStorage.setItem(flag(user.id), '1');
    } catch {
      /* private mode: the tour may show again, which is harmless */
    }
    set({ tourOpen: false });
  },
}));
