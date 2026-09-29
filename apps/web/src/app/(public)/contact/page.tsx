"use client";

import { useEffect, useState } from "react";
import type { ClientConfig, Weekday } from "@localos/config-schema";
import { ApiRequestError, getCatalog } from "@/lib/api";
import { PublicButton } from "../_components/PublicButton";
import { PublicPanel } from "../_components/PublicPanel";
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

  if (error) {
    return (
      <div className={styles.wrap}>
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  if (!config) {
    return <div className={styles.wrap} />;
  }

  const hoursByDay = new Map(config.businessHours.map((h) => [h.day, h]));

  // No contact-submission API exists in this app — this opens the visitor's
  // own email client with the message pre-filled, rather than silently
  // submitting somewhere that doesn't process it.
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = `Message from ${name || "the website"}`;
    const body = `${message}\n\n— ${name} (${email})`;
    window.location.href = `mailto:${config!.contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <p className="pubIndexLabel">04 / CONTACT</p>
        <h1 className={styles.title}>Get in touch</h1>
        <p className={styles.subtitle}>{config.business.name}</p>
      </header>

      <div className={styles.grid}>
        <PublicPanel className={styles.infoPanel}>
          <h2 className={styles.panelHeading}>Contact</h2>
          <p className={styles.contactLine}>
            <a href={`mailto:${config.contact.email}`}>{config.contact.email}</a>
          </p>
          <p className={styles.contactLine}>
            <a href={`tel:${config.contact.phone}`}>{config.contact.phone}</a>
          </p>
          {config.contact.website && (
            <p className={styles.contactLine}>
              <a href={config.contact.website} target="_blank" rel="noreferrer">
                {config.contact.website}
              </a>
            </p>
          )}
          <address className={styles.address}>
            {config.contact.address.street}
            <br />
            {config.contact.address.city}, {config.contact.address.state} {config.contact.address.zip}
            <br />
            {config.contact.address.country}
          </address>

          <h2 className={styles.panelHeading}>Business hours</h2>
          <table className={styles.hoursTable}>
            <tbody>
              {WEEKDAYS.map((day) => {
                const slot = hoursByDay.get(day);
                return (
                  <tr key={day}>
                    <td>{capitalize(day)}</td>
                    <td className={styles.hoursValue}>{slot ? `${slot.openTime}–${slot.closeTime}` : "Closed"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PublicPanel>

        <PublicPanel className={styles.formPanel}>
          <h2 className={styles.panelHeading}>Send a message</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="contact-name">Name</label>
              <input id="contact-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label htmlFor="contact-email">Email</label>
              <input
                id="contact-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="contact-message">Message</label>
              <textarea id="contact-message" required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <PublicButton type="submit" variant="primary" className={styles.submitButton}>
              Send message
            </PublicButton>
          </form>
        </PublicPanel>
      </div>
    </div>
  );
}
