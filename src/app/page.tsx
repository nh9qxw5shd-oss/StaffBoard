import { Suspense } from "react";
import DutyBoard from "@/components/duty/DutyBoard";
import { PageSkeleton } from "@/components/ui";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton kind="cards" />}>
      <DutyBoard />
    </Suspense>
  );
}
