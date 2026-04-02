import { useMemo, useRef } from 'react';
import { useNotesStore } from '../useNotes';
import { buildMonthlyRecap, type MonthlyRecap } from '../../services/monthlyRecap';

export interface UseMonthlyRecapOptions {
  referenceDate?: Date;
  timeZone?: string;
}

export interface UseMonthlyRecapResult {
  recap: MonthlyRecap;
  loading: boolean;
  year: number;
  month: number;
  monthKey: string;
  timeZone: string;
}

export function useMonthlyRecap(options: UseMonthlyRecapOptions = {}): UseMonthlyRecapResult {
  const { notes, loading } = useNotesStore();
  const initialDateRef = useRef<Date | null>(null);

  if (!initialDateRef.current) {
    initialDateRef.current = new Date();
  }

  const effectiveReferenceDate = options.referenceDate ?? initialDateRef.current;
  const timeZone = options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';

  return useMemo(() => {
    const year = effectiveReferenceDate.getFullYear();
    const month = effectiveReferenceDate.getMonth();
    const recap = buildMonthlyRecap(notes, { year, month, timeZone });

    return {
      recap,
      loading,
      year,
      month,
      monthKey: recap.month.monthKey,
      timeZone,
    };
  }, [effectiveReferenceDate, loading, notes, timeZone]);
}
