"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import App from "next/app";
import AppShell from "../components/AppShell";

type Client = {
  id: string;
  typeClient: "entreprise" | "particulier";
  nomRaisonSociale: string;
  ice: string | null;
  ifFiscal: string | null;
  rc: string | null;
  adresse: string | null;
  ville: string | null;
  telephone: string | null;
  email: string | null;
};

type TypeClient = Client["typeClient"];

type Notice = { type: "success" | "error"; text: string };

const emptyForm = {
  typeClient: "entreprise" as TypeClient,
  nomRaisonSociale: "",
  ice: "",
  ifFiscal: "",
  rc: "",
  adresse: "",
  ville: "",
  telephone: "",
  email: "",
};

const inputClass =
  "w-full rounded-lg border border-[#dce1e7] bg-white px-3 py-2 text-sm text-[#18212f] placeholder:text-[#a0a7b1] outline-none transition focus:border-[#456f9f] focus:ring-2 focus:ring-[#456f9f]/20 disabled:cursor-not-allowed disabled:bg-[#f3f5f8] disabled:text-[#9aa2ad]";

const plural = (count: number, word: string) =>
  `${count} ${word}${count > 1 ? "s" : ""}`;

function Field({
  label,
  htmlFor,
  required,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-medium text-[#3e4855]"
      >
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [formError, setFormError] = useState("");

  async function loadClients() {
    try {
      setLoading(true);

      const response = await fetch("/api/clients");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Erreur de chargement");
      }

      setClients(data.clients);
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Erreur lors du chargement des clients",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  // Fermeture du formulaire avec la touche Échap.
  useEffect(() => {
    if (!showForm) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeForm();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showForm]);

  function handleChange(field: keyof typeof emptyForm, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setNotice(null);
    setFormError("");
    setShowForm(true);
  }

  function openEditForm(client: Client) {
    setEditingId(client.id);

    setForm({
      typeClient: client.typeClient,
      nomRaisonSociale: client.nomRaisonSociale,
      ice: client.ice || "",
      ifFiscal: client.ifFiscal || "",
      rc: client.rc || "",
      adresse: client.adresse || "",
      ville: client.ville || "",
      telephone: client.telephone || "",
      email: client.email || "",
    });

    setNotice(null);
    setFormError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!form.nomRaisonSociale.trim()) {
      setFormError("Le nom ou la raison sociale est obligatoire.");
      return;
    }

    if (form.typeClient === "entreprise" && !form.ice.trim()) {
      setFormError("L’ICE est obligatoire pour une entreprise.");
      return;
    }

    try {
      setSaving(true);

      const url = editingId ? `/api/clients/${editingId}` : "/api/clients";
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ice: form.ice || null,
          ifFiscal: form.ifFiscal || null,
          rc: form.rc || null,
          adresse: form.adresse || null,
          ville: form.ville || null,
          telephone: form.telephone || null,
          email: form.email || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Erreur lors de l’enregistrement");
      }

      closeForm();
      setNotice({
        type: "success",
        text: editingId
          ? "Client modifié avec succès."
          : "Client ajouté avec succès.",
      });
      await loadClients();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Erreur lors de l’enregistrement"
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteClient(client: Client) {
    const confirmed = window.confirm(
      `Supprimer le client "${client.nomRaisonSociale}" ?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Erreur lors de la suppression");
      }

      setNotice({ type: "success", text: "Client supprimé avec succès." });
      await loadClients();
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Erreur lors de la suppression",
      });
    }
  }

  const filteredClients = useMemo(() => {
    const value = search.trim().toLowerCase();

    return clients
      .filter(
        (client) =>
          !value ||
          client.nomRaisonSociale.toLowerCase().includes(value) ||
          (client.ice || "").toLowerCase().includes(value) ||
          (client.ifFiscal || "").toLowerCase().includes(value) ||
          (client.ville || "").toLowerCase().includes(value)
      )
      .sort((a, b) =>
        a.nomRaisonSociale.localeCompare(b.nomRaisonSociale, "fr", {
          sensitivity: "base",
        })
      );
  }, [clients, search]);

  const isEntreprise = form.typeClient === "entreprise";

  return (
    <AppShell>
        {/* ------------------------------ Titre ----------------------------- */}

        <section className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
            <p className="mt-1 text-sm text-[#6d7682]">
              {loading
                ? "Chargement..."
                : `${plural(clients.length, "client")} enregistré${
                    clients.length > 1 ? "s" : ""
                  }`}
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center rounded-lg bg-[#456f9f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#395f8a]"
          >
            + Nouveau client
          </button>
        </section>

        {/* ----------------------------- Notification ----------------------- */}

        {notice && (
          <div
            role="status"
            className={`mb-5 flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${
              notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Fermer la notification"
              className="text-base leading-none opacity-60 transition hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* ------------------------ Liste des clients ----------------------- */}

        <section className="rounded-2xl border border-[#e1e6ec] bg-white shadow-sm">
          {/* Barre de recherche */}

          <div className="flex flex-col gap-3 border-b border-[#e8ebef] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa2ad]"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>

              <input
                type="search"
                aria-label="Rechercher un client"
                placeholder="Rechercher par nom, ICE, IF ou ville"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={`${inputClass} pl-9`}
              />
            </div>

            {!loading && search.trim() && (
              <p className="text-sm text-[#7b8490]">
                {plural(filteredClients.length, "résultat")}
              </p>
            )}
          </div>

          {/* Tableau */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-[#e8ebef] bg-[#fafbfc]">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-[#7b8490]">
                    Client
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-[#7b8490]">
                    ICE
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-[#7b8490]">
                    IF
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-[#7b8490]">
                    Ville
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-[#7b8490]">
                    Téléphone
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#7b8490]">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-sm text-[#89919d]"
                    >
                      Chargement des clients...
                    </td>
                  </tr>
                ) : filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <p className="font-semibold text-[#273241]">
                        {clients.length === 0
                          ? "Aucun client"
                          : "Aucun résultat"}
                      </p>
                      <p className="mt-1 text-sm text-[#89919d]">
                        {clients.length === 0
                          ? "Ajoutez votre premier client pour commencer."
                          : "Modifiez votre recherche pour élargir les résultats."}
                      </p>
                      {clients.length === 0 && (
                        <button
                          type="button"
                          onClick={openCreateForm}
                          className="mt-5 inline-flex rounded-lg bg-[#456f9f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#395f8a]"
                        >
                          Ajouter un client
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => (
                    <tr
                      key={client.id}
                      className="border-b border-[#edf0f3] last:border-b-0 hover:bg-[#fafbfc]"
                    >
                      <td className="px-6 py-3.5">
                        <div className="text-sm font-semibold text-[#273241]">
                          {client.nomRaisonSociale}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#89919d]">
                          <span
                            className={`rounded-full border px-2 py-0.5 font-medium ${
                              client.typeClient === "entreprise"
                                ? "border-[#d3e0ec] bg-[#edf3f8] text-[#456f9f]"
                                : "border-gray-200 bg-gray-100 text-gray-600"
                            }`}
                          >
                            {client.typeClient === "entreprise"
                              ? "Entreprise"
                              : "Particulier"}
                          </span>
                          {client.email && <span>{client.email}</span>}
                        </div>
                      </td>

                      <td className="px-6 py-3.5 text-sm tabular-nums text-[#3e4855]">
                        {client.ice || "-"}
                      </td>

                      <td className="px-6 py-3.5 text-sm tabular-nums text-[#3e4855]">
                        {client.ifFiscal || "-"}
                      </td>

                      <td className="px-6 py-3.5 text-sm text-[#3e4855]">
                        {client.ville || "-"}
                      </td>

                      <td className="px-6 py-3.5 text-sm tabular-nums text-[#3e4855]">
                        {client.telephone || "-"}
                      </td>

                      <td className="px-6 py-3.5">
                        <div className="flex justify-end gap-4 text-sm font-semibold">
                          <button
                            type="button"
                            onClick={() => openEditForm(client)}
                            className="text-[#456f9f] hover:underline"
                          >
                            Modifier
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteClient(client)}
                            className="text-red-700 hover:underline"
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      

      {/* ------------------------------------------------------------------ */}
      {/* Formulaire (fenêtre modale)                                        */}
      {/* ------------------------------------------------------------------ */}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#18212f]/40 p-4 sm:p-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <form
            onSubmit={handleSubmit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-form-title"
            className="w-full max-w-2xl rounded-2xl bg-white shadow-xl"
          >
            {/* Titre */}

            <div className="flex items-center justify-between border-b border-[#e8ebef] px-6 py-4">
              <h2 id="client-form-title" className="text-lg font-bold">
                {editingId ? "Modifier le client" : "Nouveau client"}
              </h2>

              <button
                type="button"
                onClick={closeForm}
                aria-label="Fermer"
                className="rounded-lg px-2 py-1 text-[#7b8490] transition hover:bg-[#f0f3f7] hover:text-[#18212f]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 px-6 py-5">
              {formError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  {formError}
                </div>
              )}

              {/* Identité */}

              <fieldset>
                <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#456f9f]">
                  Identité
                </legend>

                <div className="mb-4 inline-flex rounded-lg border border-[#dce1e7] bg-[#f6f8fb] p-0.5 text-sm font-medium">
                  {(
                    [
                      ["entreprise", "Entreprise"],
                      ["particulier", "Particulier"],
                    ] as [TypeClient, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={form.typeClient === value}
                      onClick={() => handleChange("typeClient", value)}
                      className={`rounded-md px-4 py-1.5 transition ${
                        form.typeClient === value
                          ? "bg-white text-[#456f9f] shadow-sm"
                          : "text-[#6d7682] hover:text-[#18212f]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label={isEntreprise ? "Raison sociale" : "Nom complet"}
                    htmlFor="nomRaisonSociale"
                    required
                    className="md:col-span-2"
                  >
                    <input
                      id="nomRaisonSociale"
                      required
                      value={form.nomRaisonSociale}
                      onChange={(event) =>
                        handleChange("nomRaisonSociale", event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="ICE" htmlFor="ice" required={isEntreprise}>
                    <input
                      id="ice"
                      value={form.ice}
                      onChange={(event) =>
                        handleChange("ice", event.target.value)
                      }
                      disabled={!isEntreprise}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Identifiant fiscal (IF)" htmlFor="ifFiscal" >
                    <input
                      id="ifFiscal"
                      value={form.ifFiscal}
                      onChange={(event) =>
                        handleChange("ifFiscal", event.target.value)
                      }
                      disabled={!isEntreprise}
                      className={inputClass}
                    />
                  </Field>

                  <Field
                    label="Registre de commerce (RC)"
                    htmlFor="rc"
                    className="md:col-span-2"
                  >
                    <input
                      id="rc"
                      value={form.rc}
                      onChange={(event) =>
                        handleChange("rc", event.target.value)
                      }
                      disabled={!isEntreprise}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </fieldset>

              {/* Coordonnées */}

              <fieldset>
                <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#456f9f]">
                  Coordonnées
                </legend>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Adresse"
                    htmlFor="adresse"
                    className="md:col-span-2"
                  >
                    <textarea
                      id="adresse"
                      rows={2}
                      value={form.adresse}
                      onChange={(event) =>
                        handleChange("adresse", event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Ville" htmlFor="ville">
                    <input
                      id="ville"
                      value={form.ville}
                      onChange={(event) =>
                        handleChange("ville", event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Téléphone" htmlFor="telephone">
                    <input
                      id="telephone"
                      type="tel"
                      value={form.telephone}
                      onChange={(event) =>
                        handleChange("telephone", event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field
                    label="Email"
                    htmlFor="email"
                    className="md:col-span-2"
                  >
                    <input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        handleChange("email", event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>
              </fieldset>
            </div>

            {/* Actions */}

            <div className="flex justify-end gap-3 rounded-b-2xl border-t border-[#e8ebef] bg-[#fafbfc] px-6 py-4">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg border border-[#dce1e7] bg-white px-4 py-2 text-sm font-medium text-[#4c5663] transition hover:bg-[#f6f8fb]"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#456f9f] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#395f8a] disabled:opacity-50"
              >
                {saving
                  ? "Enregistrement..."
                  : editingId
                    ? "Enregistrer"
                    : "Ajouter le client"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}