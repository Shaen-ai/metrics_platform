import { redirect } from "next/navigation";
import { getLandingUrl } from "@/lib/landingUrl";

/** Post-login redirect target: marketing `/pricing` to choose a plan. */
export default function GoPricingPage() {
  redirect(`${getLandingUrl()}/pricing`);
}
