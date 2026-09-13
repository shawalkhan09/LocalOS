import { Sidebar } from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";
import styles from "./layout.module.css";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className={styles.shell}>
        <Sidebar />
        <main className={styles.content}>{children}</main>
      </div>
    </ToastProvider>
  );
}
