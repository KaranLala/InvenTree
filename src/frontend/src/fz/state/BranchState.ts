import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Branch {
  pk: number;
  name: string;
  code: string | null;
  is_active: boolean;
}

interface BranchStateProps {
  activeBranchId: number | null;
  setActiveBranch: (id: number | null) => void;
}

/**
 * Active branch selection for the FZ app.
 * Persisted per-browser; validated against the active branch list on load.
 */
export const useBranchState = create<BranchStateProps>()(
  persist(
    (set) => ({
      activeBranchId: null,
      setActiveBranch: (id) => set({ activeBranchId: id })
    }),
    {
      name: 'fz-branch'
    }
  )
);
