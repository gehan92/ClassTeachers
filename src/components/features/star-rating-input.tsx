"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRatingInput({
  value,
  onChange,
  name = "rating",
}: {
  value?: number;
  onChange?: (rating: number) => void;
  name?: string;
}) {
  const [rating, setRating] = useState(value ?? 0);
  const [hovered, setHovered] = useState(0);

  function select(next: number) {
    setRating(next);
    onChange?.(next);
  }

  return (
    <div role="radiogroup" className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const starValue = i + 1;
        const filled = (hovered || rating) >= starValue;
        return (
          <button
            key={starValue}
            type="button"
            role="radio"
            aria-checked={rating === starValue}
            aria-label={`${starValue}`}
            onMouseEnter={() => setHovered(starValue)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => select(starValue)}
            className="p-0.5"
          >
            <Star className={cn("size-5.5 transition-colors", filled ? "text-cta" : "text-border")} fill={filled ? "currentColor" : "none"} />
          </button>
        );
      })}
      <input type="hidden" name={name} value={rating} />
    </div>
  );
}
