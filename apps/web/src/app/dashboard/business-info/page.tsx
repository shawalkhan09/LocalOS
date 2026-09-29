"use client";

import { useEffect, useState } from "react";
import type { ClientConfig } from "@localos/config-schema";
import { ApiRequestError, getCatalog, getMe, updateBusinessInfo } from "@/lib/api";
import { useToast } from "@/components/Toast";
import formStyles from "@/components/FormField.module.css";
import { Button, Card, Input } from "@/components";
import pageStyles from "../page.module.css";

type FormState = {
  name: string;
  legalName: string;
  description: string;
  logoUrl: string;
  contactEmail: string;
  contactPhone: string;
  contactWebsite: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

function formFromCatalog(config: ClientConfig): FormState {
  return {
    name: config.business.name,
    legalName: config.business.legalName ?? "",
    description: config.business.description ?? "",
    logoUrl: config.business.logoUrl ?? "",
    contactEmail: config.contact.email,
    contactPhone: config.contact.phone,
    contactWebsite: config.contact.website ?? "",
    street: config.contact.address.street,
    city: config.contact.address.city,
    state: config.contact.address.state,
    zip: config.contact.address.zip,
    country: config.contact.address.country,
  };
}

export default function BusinessInfoPage() {
  const { showToast } = useToast();

  const [form, setForm] = useState<FormState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getCatalog(), getMe()])
      .then(([catalogRes, meRes]) => {
        // Same defense-in-depth reasoning as Business hours: the nav link
        // is hidden for staff logins, but a staff user navigating here
        // directly by URL would otherwise see the management UI, even
        // though PATCH /business-info is requireOwner-gated server-side
        // and 403s regardless.
        if (meRes.role !== "owner") {
          setForbidden(true);
          return;
        }
        setForm(formFromCatalog(catalogRes));
      })
      .catch((err) => {
        setLoadError(err instanceof ApiRequestError ? err.message : "Could not load business info.");
      });
  }, []);

  function updateField(patch: Partial<FormState>) {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) {
      return;
    }
    setSubmitting(true);
    try {
      await updateBusinessInfo({
        name: form.name.trim(),
        legalName: form.legalName.trim() || undefined,
        description: form.description.trim() || undefined,
        logoUrl: form.logoUrl.trim() || undefined,
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim(),
        contactWebsite: form.contactWebsite.trim() || undefined,
        address: {
          street: form.street.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          zip: form.zip.trim(),
          country: form.country.trim(),
        },
      });
      showToast("Business info saved.", "success");
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : "Could not save business info.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (forbidden) {
    return (
      <div>
        <h1 className={pageStyles.heading}>Business info</h1>
        <p className={`${pageStyles.error} ${pageStyles.section}`}>
          Only the account owner can manage business info.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <h1 className={pageStyles.heading}>Business info</h1>
        <p className={`${pageStyles.error} ${pageStyles.section}`}>{loadError}</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div>
        <h1 className={pageStyles.heading}>Business info</h1>
      </div>
    );
  }

  return (
    <div>
      <h1 className={pageStyles.heading}>Business info</h1>
      <p className={pageStyles.subheading}>Branding and contact details shown on the public booking site.</p>

      <Card className={pageStyles.section}>
        <form className={formStyles.form} onSubmit={handleSave} style={{ maxWidth: "none" }}>
          <div className={formStyles.field}>
            <label htmlFor="business-name">Business name</label>
            <Input id="business-name" value={form.name} onChange={(e) => updateField({ name: e.target.value })} required />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="business-legal-name">Legal name</label>
            <Input
              id="business-legal-name"
              value={form.legalName}
              onChange={(e) => updateField({ legalName: e.target.value })}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="business-description">Description</label>
            <Input
              id="business-description"
              value={form.description}
              onChange={(e) => updateField({ description: e.target.value })}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="business-logo-url">Logo URL</label>
            <Input
              id="business-logo-url"
              type="url"
              value={form.logoUrl}
              onChange={(e) => updateField({ logoUrl: e.target.value })}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="contact-email">Contact email</label>
            <Input
              id="contact-email"
              type="email"
              value={form.contactEmail}
              onChange={(e) => updateField({ contactEmail: e.target.value })}
              required
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="contact-phone">Contact phone</label>
            <Input
              id="contact-phone"
              value={form.contactPhone}
              onChange={(e) => updateField({ contactPhone: e.target.value })}
              required
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="contact-website">Website</label>
            <Input
              id="contact-website"
              type="url"
              value={form.contactWebsite}
              onChange={(e) => updateField({ contactWebsite: e.target.value })}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="address-street">Street</label>
            <Input id="address-street" value={form.street} onChange={(e) => updateField({ street: e.target.value })} required />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="address-city">City</label>
            <Input id="address-city" value={form.city} onChange={(e) => updateField({ city: e.target.value })} required />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="address-state">State</label>
            <Input id="address-state" value={form.state} onChange={(e) => updateField({ state: e.target.value })} required />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="address-zip">ZIP</label>
            <Input id="address-zip" value={form.zip} onChange={(e) => updateField({ zip: e.target.value })} required />
          </div>
          <div className={formStyles.field}>
            <label htmlFor="address-country">Country</label>
            <Input
              id="address-country"
              value={form.country}
              onChange={(e) => updateField({ country: e.target.value })}
              required
            />
          </div>
          <Button type="submit" className={formStyles.submit} disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
