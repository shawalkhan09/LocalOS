import { bricolage } from "./fonts";
import { SiteShell } from "./_components/SiteShell";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${bricolage.variable} site`}>
      <SiteShell>{children}</SiteShell>
    </div>
  );
}
