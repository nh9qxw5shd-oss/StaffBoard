import type { Metadata } from "next";
import { Suspense } from "react";
import Phonebook from "@/components/duty/Phonebook";
import { PageSkeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Phonebook" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton kind="table" />}>
      <Phonebook />
    </Suspense>
  );
}
