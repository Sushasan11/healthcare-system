"use client";

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";

export type CartLine = {
  drugId: number;
  name: string;
  unitPrice: string; // Decimal as string, matches backend
  quantity: number; // 1..10
};

type CartState = {
  userId: number | null;
  lines: CartLine[];
  hydrated: boolean;
  setUser: (id: number | null) => void;
  addItem: (line: CartLine) => void;
  updateQty: (drugId: number, qty: number) => void;
  remove: (drugId: number) => void;
  clear: () => void;
  _setHydrated: () => void;
};

const BASE_KEY = "healthconnect-cart-v1";

// Per-user storage: we override the persist `name` at rehydrate time by using a
// thin wrapper over window.localStorage that routes reads/writes to a key
// derived from the currently-set userId.
function storageKeyFor(userId: number | null): string {
  return userId ? `${BASE_KEY}-${userId}` : `${BASE_KEY}-anon`;
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      userId: null,
      lines: [],
      hydrated: false,
      setUser: (id) => {
        const current = get().userId;
        if (current === id) return;
        // Clear in-memory lines so the newly-loaded user starts fresh.
        // Their actual cart will be rehydrated from their localStorage key
        // on next mount via persist middleware (page transition or refresh).
        set({ userId: id, lines: [] });
        if (typeof window !== "undefined") {
          // Eagerly load the new user's cart lines from their key, so badge
          // updates without waiting for a page reload.
          try {
            const raw = window.localStorage.getItem(storageKeyFor(id));
            if (raw) {
              const parsed = JSON.parse(raw) as { state?: Partial<CartState> };
              const lines = parsed.state?.lines ?? [];
              set({ lines });
            }
          } catch {
            // Corrupt storage — ignore, leave empty cart.
          }
        }
      },
      addItem: (line) =>
        set((s) => {
          const existing = s.lines.find((l) => l.drugId === line.drugId);
          if (existing) {
            return {
              lines: s.lines.map((l) =>
                l.drugId === line.drugId
                  ? { ...l, quantity: Math.min(10, l.quantity + line.quantity) }
                  : l,
              ),
            };
          }
          return {
            lines: [
              ...s.lines,
              {
                ...line,
                quantity: Math.min(10, Math.max(1, line.quantity)),
              },
            ],
          };
        }),
      updateQty: (drugId, qty) =>
        set((s) => ({
          lines: s.lines.map((l) =>
            l.drugId === drugId
              ? { ...l, quantity: Math.min(10, Math.max(1, qty)) }
              : l,
          ),
        })),
      remove: (drugId) =>
        set((s) => ({ lines: s.lines.filter((l) => l.drugId !== drugId) })),
      clear: () => set({ lines: [] }),
      _setHydrated: () => set({ hydrated: true }),
    }),
    {
      // Name is a fallback; actual reads/writes are routed per-user via the
      // custom storage wrapper below.
      name: BASE_KEY,
      storage: createJSONStorage<CartState>(() => {
        if (typeof window === "undefined") return noopStorage;
        const wrapper: StateStorage = {
          getItem: (_name) => {
            const state = useCart.getState();
            return window.localStorage.getItem(storageKeyFor(state.userId));
          },
          setItem: (_name, value) => {
            const state = useCart.getState();
            window.localStorage.setItem(storageKeyFor(state.userId), value);
          },
          removeItem: (_name) => {
            const state = useCart.getState();
            window.localStorage.removeItem(storageKeyFor(state.userId));
          },
        };
        return wrapper;
      }),
      partialize: (s) =>
        ({ userId: s.userId, lines: s.lines } as unknown as CartState),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated();
      },
    },
  ),
);

// Cross-tab sync: when localStorage changes for the active user's key in
// another tab, re-read the cart into this tab.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    const state = useCart.getState();
    if (event.key !== storageKeyFor(state.userId)) return;
    if (!event.newValue) {
      useCart.setState({ lines: [] });
      return;
    }
    try {
      const parsed = JSON.parse(event.newValue) as { state?: Partial<CartState> };
      const lines = parsed.state?.lines ?? [];
      useCart.setState({ lines });
    } catch {
      // ignore
    }
  });
}

export const useCartCount = () =>
  useCart((s) => s.lines.reduce((n, l) => n + l.quantity, 0));

export const useCartTotal = () =>
  useCart((s) =>
    s.lines.reduce((n, l) => n + Number(l.unitPrice) * l.quantity, 0),
  );

export const clearCart = () => useCart.getState().clear();
