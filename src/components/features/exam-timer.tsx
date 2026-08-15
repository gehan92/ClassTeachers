"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Countdown timer for an in-progress exam attempt. `startedAt` is a
 * `Date.now()`-style timestamp; `durationMin` is the exam's total time.
 * Calls `onExpire` exactly once, the moment remaining time hits zero, so
 * callers can auto-submit.
 */
export function ExamTimer({
  startedAt,
  durationMin,
  onExpire,
}: {
  startedAt: number;
  durationMin: number;
  onExpire: () => void;
}) {
  const endsAt = startedAt + durationMin * 60_000;
  const [remaining, setRemaining] = useState(() => endsAt - Date.now());
  const expiredRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = endsAt - Date.now();
      setRemaining(next);
      if (next <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(interval);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt, onExpire]);

  const lowTime = remaining <= 60_000;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-sm font-semibold tabular-nums",
        lowTime ? "border-lock/30 bg-lock/10 text-lock" : "border-border bg-white text-primary",
      )}
    >
      {formatRemaining(remaining)}
    </span>
  );
}
