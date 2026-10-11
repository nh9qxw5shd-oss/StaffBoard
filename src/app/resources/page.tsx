import type { Metadata } from "next";
import Resources from "@/components/duty/Resources";

export const metadata: Metadata = { title: "Route resources" };

export default function Page() {
  return <Resources />;
}
