import type { Metadata } from "next";
import OnCall from "@/components/duty/OnCall";

export const metadata: Metadata = { title: "On call" };

export default function Page() {
  return <OnCall />;
}
