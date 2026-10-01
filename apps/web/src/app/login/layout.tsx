import { bricolage } from "../app-fonts";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${bricolage.variable} app`}>{children}</div>;
}
