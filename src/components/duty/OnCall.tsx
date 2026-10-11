"use client";

import { PhoneCall } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export default function OnCall() {
  return (
    <>
      <PageHeader eyebrow="Booking On Board" title="On call" subtitle="Rostered on-call cover, escalation notes and quick contacts." />
      <Card>
        <EmptyState icon={PhoneCall} title="To follow" hint="This view will carry rostered on-call coverage, escalation notes and quick contacts." />
      </Card>
    </>
  );
}
