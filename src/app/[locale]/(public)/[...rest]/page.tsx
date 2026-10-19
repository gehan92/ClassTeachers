import { notFound } from "next/navigation";

/**
 * Any address that matches no page lands here, so it gets the site's own
 * "page not found" screen (../not-found.tsx, with header and footer) rather
 * than the plain built-in one. Real pages always win over this catch-all.
 */
export default function UnknownPage() {
  notFound();
}
