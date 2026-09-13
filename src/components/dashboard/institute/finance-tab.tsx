"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/stat-card";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import {
  createFeeCharge,
  createFeePayment,
  deleteFeeCharge,
  deleteFeePayment,
  createFeePlanTemplate,
  deleteFeePlanTemplate,
  createBulkFeeCharges,
} from "@/lib/dashboard/finance-actions";

export type FeeChargeRow = {
  id: string;
  studentId: string;
  studentName: string;
  batchLabel: string | null;
  description: string;
  amount: number;
  chargedAtLabel: string;
};
export type FeePaymentRow = {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  method: "cash" | "bank_transfer" | "card" | "other";
  paidAtLabel: string;
  note: string | null;
};
export type FeeBalanceRow = { studentId: string; studentName: string; totalCharged: number; totalPaid: number; balance: number };
export type FeeStudentOption = { id: string; name: string };
export type FeeBatchOption = { id: string; title: string };
export type FeePlanTemplate = { id: string; name: string; description: string | null; amount: number };

function formatRs(amount: number) {
  return `Rs. ${amount.toLocaleString()}`;
}

export function FinanceTab({
  totalCharged,
  totalCollected,
  outstandingTotal,
  thisMonthCollected,
  balances,
  charges,
  payments,
  students,
  batches,
  templates,
}: {
  totalCharged: number;
  totalCollected: number;
  outstandingTotal: number;
  thisMonthCollected: number;
  balances: FeeBalanceRow[];
  charges: FeeChargeRow[];
  payments: FeePaymentRow[];
  students: FeeStudentOption[];
  batches: FeeBatchOption[];
  templates: FeePlanTemplate[];
}) {
  const t = useTranslations("instituteDashboard.finance");
  const { refresh } = useDashboardRefresh();
  const [showChargeForm, setShowChargeForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showBulkChargeForm, setShowBulkChargeForm] = useState(false);

  async function handleDeleteCharge(id: string) {
    if (!window.confirm(t("confirmDeleteCharge"))) return;
    await deleteFeeCharge(id);
    refresh();
  }

  async function handleDeletePayment(id: string) {
    if (!window.confirm(t("confirmDeletePayment"))) return;
    await deleteFeePayment(id);
    refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" onClick={() => setShowPaymentForm((v) => !v)}>
            {t("recordPayment")}
          </Button>
          <Button variant="outline" onClick={() => setShowBulkChargeForm((v) => !v)}>
            {t("bulkCharge.button")}
          </Button>
          <Button onClick={() => setShowChargeForm((v) => !v)}>{t("recordCharge")}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("stats.totalCharged")} value={formatRs(totalCharged)} />
        <StatCard label={t("stats.totalCollected")} value={formatRs(totalCollected)} />
        <StatCard label={t("stats.outstanding")} value={formatRs(outstandingTotal)} />
        <StatCard label={t("stats.thisMonth")} value={formatRs(thisMonthCollected)} />
      </div>

      {showChargeForm && (
        <ChargeForm
          students={students}
          batches={batches}
          onSaved={() => {
            setShowChargeForm(false);
            refresh();
          }}
          onCancel={() => setShowChargeForm(false)}
        />
      )}
      {showPaymentForm && (
        <PaymentForm
          students={students}
          onSaved={() => {
            setShowPaymentForm(false);
            refresh();
          }}
          onCancel={() => setShowPaymentForm(false)}
        />
      )}
      {showBulkChargeForm && (
        <BulkChargeForm
          students={students}
          templates={templates}
          onSaved={() => {
            setShowBulkChargeForm(false);
            refresh();
          }}
          onCancel={() => setShowBulkChargeForm(false)}
        />
      )}

      <TemplatesPanel templates={templates} />

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("balances.title")}</h3>
        {balances.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("balances.empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("balances.student")}</TableHead>
                <TableHead>{t("balances.charged")}</TableHead>
                <TableHead>{t("balances.paid")}</TableHead>
                <TableHead>{t("balances.balance")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map((row) => (
                <TableRow key={row.studentId}>
                  <TableCell className="font-medium text-foreground">{row.studentName}</TableCell>
                  <TableCell className="text-muted-foreground">{formatRs(row.totalCharged)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatRs(row.totalPaid)}</TableCell>
                  <TableCell className={row.balance > 0 ? "font-medium text-lock" : "text-success"}>{formatRs(row.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-4 text-lg">{t("chargesTitle")}</h3>
          {charges.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noCharges")}</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {charges.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-2.5 rounded-md border border-border p-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{c.studentName}</p>
                    <p className="text-muted-foreground">
                      {c.description}
                      {c.batchLabel ? ` · ${c.batchLabel}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.chargedAtLabel}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="font-medium text-foreground">{formatRs(c.amount)}</span>
                    <button type="button" className="text-xs font-medium text-lock hover:underline" onClick={() => handleDeleteCharge(c.id)}>
                      {t("delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-4 text-lg">{t("paymentsTitle")}</h3>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noPayments")}</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {payments.map((p) => (
                <div key={p.id} className="flex items-start justify-between gap-2.5 rounded-md border border-border p-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{p.studentName}</p>
                    <p className="text-muted-foreground">
                      {t(`method.${p.method}`)}
                      {p.note ? ` · ${p.note}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.paidAtLabel}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="font-medium text-success">{formatRs(p.amount)}</span>
                    <button type="button" className="text-xs font-medium text-lock hover:underline" onClick={() => handleDeletePayment(p.id)}>
                      {t("delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChargeForm({
  students,
  batches,
  onSaved,
  onCancel,
}: {
  students: FeeStudentOption[];
  batches: FeeBatchOption[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("instituteDashboard.finance");
  const tc = useTranslations("instituteDashboard.common");
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [batchId, setBatchId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await createFeeCharge({
      studentId,
      batchId: batchId || null,
      description,
      amount: Number(amount),
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <h3 className="mb-4 text-lg">{t("chargeForm.title")}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>{t("chargeForm.student")}</Label>
          <Select value={studentId} onValueChange={(value) => setStudentId(value ?? "")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>{t("chargeForm.batch")}</Label>
          <Select value={batchId} onValueChange={(value) => setBatchId(value ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder={t("chargeForm.batchNone")} />
            </SelectTrigger>
            <SelectContent>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="charge-description">{t("chargeForm.description")}</Label>
          <Input id="charge-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("chargeForm.descriptionPlaceholder")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="charge-amount">{t("chargeForm.amount")}</Label>
          <Input id="charge-amount" type="number" min="0" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      {error && <p className="mt-2 text-sm font-medium text-destructive">{error}</p>}
      <div className="mt-4 flex gap-3">
        <Button onClick={handleSave} disabled={saving || !studentId || !description.trim() || !amount}>
          {t("chargeForm.submit")}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          {tc("cancel")}
        </Button>
      </div>
    </div>
  );
}

function PaymentForm({ students, onSaved, onCancel }: { students: FeeStudentOption[]; onSaved: () => void; onCancel: () => void }) {
  const t = useTranslations("instituteDashboard.finance");
  const tc = useTranslations("instituteDashboard.common");
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "bank_transfer" | "card" | "other">("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await createFeePayment({ studentId, chargeId: null, amount: Number(amount), method, note });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <h3 className="mb-4 text-lg">{t("paymentForm.title")}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>{t("paymentForm.student")}</Label>
          <Select value={studentId} onValueChange={(value) => setStudentId(value ?? "")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>{t("paymentForm.method")}</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">{t("method.cash")}</SelectItem>
              <SelectItem value="bank_transfer">{t("method.bank_transfer")}</SelectItem>
              <SelectItem value="card">{t("method.card")}</SelectItem>
              <SelectItem value="other">{t("method.other")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="payment-amount">{t("paymentForm.amount")}</Label>
          <Input id="payment-amount" type="number" min="0" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="payment-note">{t("paymentForm.note")}</Label>
          <Input id="payment-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("paymentForm.notePlaceholder")} />
        </div>
      </div>
      {error && <p className="mt-2 text-sm font-medium text-destructive">{error}</p>}
      <div className="mt-4 flex gap-3">
        <Button onClick={handleSave} disabled={saving || !studentId || !amount}>
          {t("paymentForm.submit")}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          {tc("cancel")}
        </Button>
      </div>
    </div>
  );
}

function BulkChargeForm({
  students,
  templates,
  onSaved,
  onCancel,
}: {
  students: FeeStudentOption[];
  templates: FeePlanTemplate[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("instituteDashboard.finance");
  const tc = useTranslations("instituteDashboard.common");
  const [templateId, setTemplateId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleTemplateChange(id: string) {
    setTemplateId(id);
    const template = templates.find((tpl) => tpl.id === id);
    if (template) {
      setDescription(template.description || template.name);
      setAmount(String(template.amount));
    }
  }

  function toggleStudent(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = students.length > 0 && selectedIds.size === students.length;

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(students.map((s) => s.id)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await createBulkFeeCharges({
      studentIds: [...selectedIds],
      batchId: null,
      description,
      amount: Number(amount),
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <h3 className="mb-1 text-lg">{t("bulkCharge.title")}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{t("bulkCharge.subtitle")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {templates.length > 0 && (
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>{t("bulkCharge.template")}</Label>
            <Select value={templateId} onValueChange={(value) => handleTemplateChange(value ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder={t("bulkCharge.templateNone")} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.name} — {formatRs(tpl.amount)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="bulk-charge-description">{t("chargeForm.description")}</Label>
          <Input
            id="bulk-charge-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("chargeForm.descriptionPlaceholder")}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bulk-charge-amount">{t("chargeForm.amount")}</Label>
          <Input
            id="bulk-charge-amount"
            type="number"
            min="0"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <Label>{t("bulkCharge.students", { count: selectedIds.size })}</Label>
          <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={toggleAll}>
            {allSelected ? t("bulkCharge.deselectAll") : t("bulkCharge.selectAll")}
          </button>
        </div>
        <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto rounded-md border border-border p-2.5">
          {students.map((s) => (
            <label key={s.id} className="flex items-center gap-2 rounded-sm px-1.5 py-1 text-sm hover:bg-secondary/50">
              <input
                type="checkbox"
                className="size-3.5 accent-primary"
                checked={selectedIds.has(s.id)}
                onChange={() => toggleStudent(s.id)}
              />
              {s.name}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="mt-2 text-sm font-medium text-destructive">{error}</p>}
      <div className="mt-4 flex gap-3">
        <Button onClick={handleSave} disabled={saving || selectedIds.size === 0 || !description.trim() || !amount}>
          {t("bulkCharge.submit", { count: selectedIds.size })}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          {tc("cancel")}
        </Button>
      </div>
    </div>
  );
}

function TemplatesPanel({ templates }: { templates: FeePlanTemplate[] }) {
  const t = useTranslations("instituteDashboard.finance");
  const tc = useTranslations("instituteDashboard.common");
  const { refresh } = useDashboardRefresh();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    const result = await createFeePlanTemplate({ name, description, amount: Number(amount) });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setName("");
    setDescription("");
    setAmount("");
    setAdding(false);
    refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t("templates.confirmDelete"))) return;
    await deleteFeePlanTemplate(id);
    refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg">{t("templates.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("templates.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAdding((v) => !v)}>
          {t("templates.add")}
        </Button>
      </div>

      {adding && (
        <div className="mb-4 grid gap-3 rounded-md border border-border p-3.5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="template-name">{t("templates.name")}</Label>
            <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("templates.namePlaceholder")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="template-amount">{t("chargeForm.amount")}</Label>
            <Input id="template-amount" type="number" min="0" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="template-description">{t("chargeForm.description")}</Label>
            <Input
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("templates.descriptionPlaceholder")}
            />
          </div>
          {error && <p className="text-sm font-medium text-destructive sm:col-span-2">{error}</p>}
          <div className="flex gap-3 sm:col-span-2">
            <Button size="sm" onClick={handleCreate} disabled={saving || !name.trim() || !amount}>
              {t("templates.save")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(false)} disabled={saving}>
              {tc("cancel")}
            </Button>
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("templates.empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {templates.map((tpl) => (
            <div key={tpl.id} className="flex items-center justify-between gap-2.5 rounded-md border border-border p-2.5 text-sm">
              <div>
                <p className="font-medium text-foreground">{tpl.name}</p>
                <p className="text-muted-foreground">
                  {formatRs(tpl.amount)}
                  {tpl.description ? ` · ${tpl.description}` : ""}
                </p>
              </div>
              <button type="button" className="text-xs font-medium text-lock hover:underline" onClick={() => handleDelete(tpl.id)}>
                {t("delete")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
