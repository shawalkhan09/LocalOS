import { Sidebar } from "@/components/Sidebar";
import { bricolage } from "../app-fonts";
import styles from "./layout.module.css";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${bricolage.variable} app`}>
      <div className={styles.shell}>
        <Sidebar />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
