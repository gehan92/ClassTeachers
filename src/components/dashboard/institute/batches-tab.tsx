"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClassBatchCard } from "@/components/features/class-batch-card";
import { instituteBatches } from "@/lib/mock-data/dashboard-institute";
import type { ClassBatch } from "@/types/class-batch";

export function BatchesTab() {
  const t = useTranslations("instituteDashboard.batches");
  const [batches, setBatches] = useState<ClassBatch[]>(instituteBatches);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [schedule, setSchedule] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [priceInterval, setPriceInterval] = useState<"hr" | "mo">("hr");
  const [added, setAdded] = useState(false);

  function resetForm() {
    setTitle("");
    setTeacherName("");
    setSchedule("");
    setPriceAmount("");
    setPriceInterval("hr");
  }

  function handleAdd() {
    if (!title.trim() || !teacherName.trim()) return;

    const newBatch: ClassBatch = {
      id: `b-${Date.now()}`,
      title: title.trim(),
      teacherName: teacherName.trim(),
      teacherHref: "#",
      status: "upcoming",
      scheduleChips: schedule
        .split(",")
        .map((chip) => chip.trim())
        .filter(Boolean),
      priceAmount: Number(priceAmount) || 0,
      priceInterval,
      studentIds: [],
    };

    setBatches((prev) => [...prev, newBatch]);
    resetForm();
    setShowForm(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {added && <span className="text-sm font-medium text-success">{t("added")}</span>}
          <Button onClick={() => setShowForm(true)}>{t("addBatch")}</Button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-4 text-lg">{t("form.title")}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="batch-title">{t("form.titleLabel")}</Label>
              <Input
                id="batch-title"
                placeholder={t("form.titlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="batch-teacher">{t("form.teacherLabel")}</Label>
              <Input
                id="batch-teacher"
                placeholder={t("form.teacherPlaceholder")}
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="batch-schedule">{t("form.scheduleLabel")}</Label>
              <Input
                id="batch-schedule"
                placeholder={t("form.schedulePlaceholder")}
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="batch-price">{t("form.priceLabel")}</Label>
                <Input
                  id="batch-price"
                  type="number"
                  inputMode="numeric"
                  placeholder="1500"
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="batch-interval">{t("form.intervalLabel")}</Label>
                <Select value={priceInterval} onValueChange={(value) => setPriceInterval(value as "hr" | "mo")}>
                  <SelectTrigger id="batch-interval" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hr">{t("form.intervalHour")}</SelectItem>
                    <SelectItem value="mo">{t("form.intervalMonth")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <Button onClick={handleAdd}>{t("form.submit")}</Button>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {batches.map((batch) => (
          <ClassBatchCard key={batch.id} batch={batch} />
        ))}
      </div>
    </div>
  );
}
