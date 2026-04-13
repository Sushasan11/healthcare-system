"use client";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 10,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="inline-flex items-center border border-[#E2E8F0] rounded-md">
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="px-3 py-1 text-[#64748B] hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none"
      >
        −
      </button>
      <span className="px-3 py-1 text-sm min-w-[2rem] text-center select-none">
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="px-3 py-1 text-[#64748B] hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none"
      >
        +
      </button>
    </div>
  );
}
