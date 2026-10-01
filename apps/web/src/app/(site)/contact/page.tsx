"use client";

import { useEffect, useState } from "react";
import type { ClientConfig, Weekday } from "@localos/config-schema";
import { ApiRequestError, getCatalog } from "@/lib/api";
import { PageHeader } from "../_components/PageHeader";
import { formatHHMM, isOpenNow } from "../_components/home/helpers";
import { localWeekday, todayInTimezone } from "@/lib/time";
import styles from "./page.module.css";

const WEEKDAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export default function ContactPage() {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    getCatalog()
      .then(setConfig)
      .catch((err) => {
        setError(err instanceof ApiRequestError ? err.message : "Could not load contact information.");
      });
  }, []);

  if (!config && !error) return <div className={styles.page} style={{ minHeight: "60vh" }} />;

  if (!config) {
    return (
      <div className={styles.page}>
        <PageHeader eyebrow="Contact" title="Get in touch" />
        <div className={styles.body}>
          <p className={styles.note}>{error}</p>
        </div>
      </div>
    );
  }

  const tz = config.business.timezone;
  const today = localWeekday(todayInTimezone(tz), tz);
  const open = isOpenNow(config);
  const { email: mail, phone, address: a, website } = config.contact;
  const cityLine = [a?.city, [a?.state, a?.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const addressLines = [a?.street, cityLine, a?.country].filter(Boolean);

  const hoursByDay = new Map(config.businessHours.map((h) => [h.day, h]));

  // No contact-submission API exists in this app — this opens the visitor's
  // own email client with the message pre-filled, rather than silently
  // submitting somewhere that doesn't process it.
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = `Message from ${name || "the website"}`;
    const body = `${message}\n\n— ${name} (${email})`;
    window.location.href = `mailto:${mail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div className={styles.page}>
      <PageHeader eyebrow="Contact" title="Get in touch" subtitle={config.business.name} />
      <div className={styles.body}>
        {(addressLines.length > 0 || phone || mail) && (
          <div className={styles.cards}>
            {addressLines.length > 0 && (
              <div className={styles.card}>
                <span className={styles.label}>Address</span>
                <address className={styles.value}>
                  {addressLines.map((l, i) => (
                    <span key={i}>
                      {i > 0 && <br />}
                      {l}
                    </span>
                  ))}
                </address>
              </div>
            )}
            {phone && (
              <div className={styles.card}>
                <span className={styles.label}>Phone</span>
                <a className={styles.value} href={`tel:${phone}`}>{phone}</a>
              </div>
            )}
            {mail && (
              <div className={styles.card}>
                <span className={styles.label}>Email</span>
                <a className={styles.value} href={`mailto:${mail}`}>{mail}</a>
              </div>
            )}
          </div>
        )}

        <div className={styles.split}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.h2}>Opening hours</h2>
              <span className={styles.pill}>
                <span className={styles.dot} style={{ background: open ? "#16a34a" : "#9a9a92" }} />
                {open ? "Open now" : "Closed"}
              </span>
            </div>
            <ul className={styles.hours}>
              {WEEKDAYS.map((day) => {
                const slot = hoursByDay.get(day);
                return (
                  <li key={day} className={`${styles.row} ${day === today ? styles.today : ""}`} aria-current={day === today ? "date" : undefined}>
                    <span>{capitalize(day)}</span>
                    <span>{slot ? `${formatHHMM(slot.openTime)} – ${formatHHMM(slot.closeTime)}` : "Closed"}</span>
                  </li>
                );
              })}
            </ul>
            {website && (
              <a className={styles.value} href={website} target="_blank" rel="noreferrer">
                {website}
              </a>
            )}
          </section>

          <section className={styles.panel}>
            <h2 className={styles.h2}>Send a message</h2>
            <form onSubmit={handleSubmit} className={styles.form}>
              <label className={styles.field}>
                Name
                <input id="contact-name" required value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className={styles.field}>
                Email
                <input id="contact-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className={styles.field}>
                Message
                <textarea id="contact-message" required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
              </label>
              <button type="submit" className={styles.submit}>
                Send message
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
