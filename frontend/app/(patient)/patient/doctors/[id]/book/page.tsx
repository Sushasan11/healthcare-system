import { Suspense } from "react";
import BookingConfirmation from "./BookingConfirmation";

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ slot?: string }>;
}) {
  const { id } = await params;
  const { slot } = await searchParams;
  return (
    <Suspense fallback={<div className="flex justify-center p-12">Loading...</div>}>
      <BookingConfirmation doctorId={id} slotIso={slot || ""} />
    </Suspense>
  );
}
