"use client";

interface TypingIndicatorProps {
  name: string;
  isVisible: boolean;
}

export function TypingIndicator({ name, isVisible }: TypingIndicatorProps) {
  if (!isVisible) return null;

  return (
    <div className="flex items-center gap-1 px-2 py-1">
      <span className="text-[12px] font-normal text-[#64748B]">
        {name} is typing
      </span>
      <span className="flex items-end gap-[2px] mb-[1px]">
        <span
          className="inline-block w-[4px] h-[4px] rounded-full bg-[#64748B]"
          style={{ animation: "typing-bounce 1.2s ease-in-out 0s infinite" }}
        />
        <span
          className="inline-block w-[4px] h-[4px] rounded-full bg-[#64748B]"
          style={{ animation: "typing-bounce 1.2s ease-in-out 0.2s infinite" }}
        />
        <span
          className="inline-block w-[4px] h-[4px] rounded-full bg-[#64748B]"
          style={{ animation: "typing-bounce 1.2s ease-in-out 0.4s infinite" }}
        />
      </span>
      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
