"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Crown, Eye, Hourglass, Plus, RotateCcw, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NativeSelect } from "@/components/school/native-select";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useRoleDescription, useRoleName } from "@/components/school/school-labels";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { deleteSchoolRole, resetSchoolRole, saveSchoolRole } from "@/lib/school/actions";
import {
  APPROVABLE_ACTIONS,
  CUSTOM_ROLE_TEMPLATES,
  SCHOOL_AREA_GROUPS,
  SCHOOL_AREAS,
  SCHOOL_SCOPE_KINDS,
  type PermissionGrant,
  type SchoolAction,
  type SchoolArea,
} from "@/lib/school/catalog";
import { cn } from "@/lib/utils";
import type { SchoolScopeKind } from "@/types/database";
import type { SchoolRoleRow } from "@/types/school";

type CellState = "allow" | "approval";
type PermissionState = Partial<Record<`${SchoolArea}.${SchoolAction}`, CellState>>;

type RoleDraft = {
  roleId: string | null;
  key: string;
  isSystem: boolean;
  name: string;
  description: string;
  scopeKind: SchoolScopeKind;
  permissions: PermissionState;
};

const NEW_ROLE = "__new__";

function toState(grants: PermissionGrant[]): PermissionState {
  const state: PermissionState = {};
  for (const g of grants) state[`${g.area}.${g.action}`] = g.needsApproval ? "approval" : "allow";
  return state;
}

function toGrants(state: PermissionState): PermissionGrant[] {
  return Object.entries(state).map(([key, value]) => {
    const [area, action] = key.split(".") as [SchoolArea, SchoolAction];
    return { area, action, needsApproval: value === "approval" };
  });
}

function draftFromRole(role: SchoolRoleRow): RoleDraft {
  return {
    roleId: role.id,
    key: role.key,
    isSystem: role.isSystem,
    name: role.name,
    description: role.description,
    scopeKind: role.scopeKind,
    permissions: toState(role.permissions),
  };
}

function sameDraft(a: RoleDraft, b: RoleDraft) {
  if (a.name.trim() !== b.name.trim() || a.description.trim() !== b.description.trim() || a.scopeKind !== b.scopeKind) return false;
  const ka = Object.keys(a.permissions);
  const kb = Object.keys(b.permissions);
  return ka.length === kb.length && ka.every((k) => a.permissions[k as keyof PermissionState] === b.permissions[k as keyof PermissionState]);
}

/**
 * Roles & permissions. Each role is a set of action + area pairs, each one
 * either allowed or "needs approval" (the change waits in the Approvals
 * queue). Edits are kept per role until saved, so switching between roles
 * never loses work. The database checks every pair again on save.
 */
export function SchoolRolesTab({ schoolId, roles, canEdit }: { schoolId: string; roles: SchoolRoleRow[]; canEdit: boolean }) {
  const t = useTranslations("school.roles");
  const tc = useTranslations("school.common");
  const roleName = useRoleName();
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();

  const [selectedId, setSelectedId] = useState<string>(() => roles.find((r) => r.key === "vice_principal")?.id ?? roles[0]?.id ?? NEW_ROLE);
  const [drafts, setDrafts] = useState<Record<string, RoleDraft>>({});
  const [newOpen, setNewOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<"save" | "reset" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Set after creating a role: select it as soon as the refreshed list has it.
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pendingSelect && roles.some((r) => r.id === pendingSelect)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- selecting the role the server just created, once the refreshed list includes it
      setSelectedId(pendingSelect);
      setPendingSelect(null);
    }
  }, [pendingSelect, roles]);

  const selectedRole = roles.find((r) => r.id === selectedId) ?? null;
  const baseline = selectedRole ? draftFromRole(selectedRole) : null;
  const draft = drafts[selectedId] ?? baseline;
  const dirty = Boolean(draft && (!baseline || !sameDraft(draft, baseline)));
  const isPrincipal = draft?.key === "principal";
  const editable = canEdit && !isPrincipal;

  const builtIn = roles.filter((r) => r.isSystem);
  const custom = roles.filter((r) => !r.isSystem);

  function select(id: string) {
    setSelectedId(id);
    setError(null);
    setNotice(null);
    setConfirmDelete(false);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  function updateDraft(patch: Partial<RoleDraft> | ((d: RoleDraft) => RoleDraft)) {
    if (!draft) return;
    setNotice(null);
    setDrafts((prev) => {
      const current = prev[selectedId] ?? draft;
      return { ...prev, [selectedId]: typeof patch === "function" ? patch(current) : { ...current, ...patch } };
    });
  }

  function cycle(area: SchoolArea, action: SchoolAction) {
    updateDraft((d) => {
      const key = `${area}.${action}` as const;
      const permissions = { ...d.permissions };
      const current = permissions[key];
      const next: CellState | undefined =
        current === undefined ? "allow" : current === "allow" && APPROVABLE_ACTIONS.includes(action) ? "approval" : undefined;
      if (next) permissions[key] = next;
      else delete permissions[key];
      // Doing anything in an area means seeing it; not seeing it means doing nothing in it.
      if (action !== "view" && next) permissions[`${area}.view`] = permissions[`${area}.view`] ?? "allow";
      if (action === "view" && !next) {
        for (const a of SCHOOL_AREAS[area]) delete permissions[`${area}.${a}`];
      }
      return { ...d, permissions };
    });
  }

  function setAll(mode: "clear" | "viewAll") {
    updateDraft((d) => {
      if (mode === "clear") return { ...d, permissions: {} };
      const permissions = { ...d.permissions };
      for (const area of Object.keys(SCHOOL_AREAS) as SchoolArea[]) {
        if (area === "counseling") continue; // private notes are never switched on in bulk
        permissions[`${area}.view`] = permissions[`${area}.view`] ?? "allow";
      }
      return { ...d, permissions };
    });
  }

  function discard() {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
    if (selectedId === NEW_ROLE) setSelectedId(roles[0]?.id ?? NEW_ROLE);
    setError(null);
  }

  async function save() {
    if (!draft) return;
    setBusy("save");
    setError(null);
    const result = await saveSchoolRole({
      schoolId,
      roleId: draft.roleId,
      name: draft.name,
      description: draft.description,
      scopeKind: draft.scopeKind,
      permissions: toGrants(draft.permissions),
    });
    setBusy(null);
    if (result.error || !result.roleId) {
      setError(result.error ?? tc("genericError"));
      return;
    }
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
    if (draft.roleId === null) setPendingSelect(result.roleId);
    setNotice(t("saved"));
    refresh();
  }

  async function reset() {
    if (!draft?.roleId) return;
    setBusy("reset");
    setError(null);
    const result = await resetSchoolRole(draft.roleId);
    setBusy(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    discard();
    setNotice(t("resetDone"));
    refresh();
  }

  async function remove() {
    if (!draft?.roleId) return;
    setBusy("delete");
    setError(null);
    const result = await deleteSchoolRole(draft.roleId);
    setBusy(null);
    setConfirmDelete(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
    setSelectedId(roles.find((r) => r.id !== draft.roleId)?.id ?? NEW_ROLE);
    setNotice(t("deleted"));
    refresh();
  }

  function startNew(name: string, templateKey: string | null) {
    const template = CUSTOM_ROLE_TEMPLATES.find((tpl) => tpl.key === templateKey);
    setDrafts((prev) => ({
      ...prev,
      [NEW_ROLE]: {
        roleId: null,
        key: NEW_ROLE,
        isSystem: false,
        name,
        description: template ? t(`templates.${template.key}.description`) : "",
        scopeKind: template?.scopeKind ?? "school",
        permissions: toState(template?.permissions ?? []),
      },
    }));
    setNewOpen(false);
    select(NEW_ROLE);
  }

  const counts = (state: PermissionState) => {
    const values = Object.values(state);
    return { total: values.length, approval: values.filter((v) => v === "approval").length };
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canEdit && (
          <Button type="button" onClick={() => setNewOpen(true)}>
            <Plus className="size-4" />
            {t("newRole")}
          </Button>
        )}
      </div>

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updating")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reload")}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <nav aria-label={t("listLabel")} className="flex flex-col gap-5">
          <RoleList
            title={t("builtIn")}
            roles={builtIn}
            selectedId={selectedId}
            drafts={drafts}
            onSelect={select}
            roleName={roleName}
            counts={counts}
          />
          <div>
            <RoleList
              title={t("custom")}
              roles={custom}
              selectedId={selectedId}
              drafts={drafts}
              onSelect={select}
              roleName={roleName}
              counts={counts}
              extra={
                drafts[NEW_ROLE] ? (
                  <RoleListButton
                    selected={selectedId === NEW_ROLE}
                    onClick={() => select(NEW_ROLE)}
                    title={drafts[NEW_ROLE].name || t("untitled")}
                    meta={t("notSavedYet")}
                    unsaved
                  />
                ) : null
              }
            />
            {custom.length === 0 && !drafts[NEW_ROLE] && (
              <p className="mt-1 rounded-lg border border-dashed border-border px-3 py-3 text-xs leading-relaxed text-muted-foreground">
                {canEdit ? t("noCustomYet") : t("noCustomReadOnly")}
              </p>
            )}
          </div>
        </nav>

        <div ref={editorRef} className="min-w-0 scroll-mt-20">
          {draft ? (
            <RoleEditor
              draft={draft}
              role={selectedRole}
              editable={editable}
              canEdit={canEdit}
              isPrincipal={isPrincipal}
              dirty={dirty}
              busy={busy}
              error={error}
              notice={notice}
              confirmDelete={confirmDelete}
              onChange={updateDraft}
              onCycle={cycle}
              onSetAll={setAll}
              onSave={save}
              onDiscard={discard}
              onReset={reset}
              onAskDelete={() => setConfirmDelete(true)}
              onCancelDelete={() => setConfirmDelete(false)}
              onDelete={remove}
              onPreview={() => setPreviewOpen(true)}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{t("pickRole")}</p>
          )}
        </div>
      </div>

      <NewRoleDialog open={newOpen} onOpenChange={setNewOpen} onCreate={startNew} existingNames={roles.map((r) => roleName(r).toLowerCase())} />
      {draft && <RolePreviewSheet open={previewOpen} onOpenChange={setPreviewOpen} draft={draft} />}
    </div>
  );
}

function RoleList({
  title,
  roles,
  selectedId,
  drafts,
  onSelect,
  roleName,
  counts,
  extra,
}: {
  title: string;
  roles: SchoolRoleRow[];
  selectedId: string;
  drafts: Record<string, RoleDraft>;
  onSelect: (id: string) => void;
  roleName: (role: SchoolRoleRow) => string;
  counts: (state: PermissionState) => { total: number; approval: number };
  extra?: React.ReactNode;
}) {
  const t = useTranslations("school.roles");
  if (roles.length === 0 && !extra) {
    return <h2 className="mb-2 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">{title}</h2>;
  }
  return (
    <div>
      <h2 className="mb-2 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">{title}</h2>
      <ul className="flex flex-col gap-1.5">
        {roles.map((role) => {
          const state = drafts[role.id]?.permissions ?? toState(role.permissions);
          const c = counts(state);
          const meta =
            role.key === "principal"
              ? t("fullAccess")
              : [t("permissionCount", { n: c.total }), c.approval ? t("approvalCount", { n: c.approval }) : null].filter(Boolean).join(" · ");
          return (
            <li key={role.id}>
              <RoleListButton
                selected={selectedId === role.id}
                onClick={() => onSelect(role.id)}
                title={roleName(role)}
                meta={meta}
                people={role.memberCount}
                unsaved={Boolean(drafts[role.id])}
                principal={role.key === "principal"}
              />
            </li>
          );
        })}
        {extra && <li>{extra}</li>}
      </ul>
    </div>
  );
}

function RoleListButton({
  selected,
  onClick,
  title,
  meta,
  people,
  unsaved,
  principal,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  meta: string;
  people?: number;
  unsaved?: boolean;
  principal?: boolean;
}) {
  const t = useTranslations("school.roles");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected ? "border-primary bg-primary/[0.04] ring-1 ring-primary" : "border-border bg-white hover:border-primary/40",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          {principal && <Crown className="size-3.5 shrink-0 text-accent-deep" />}
          <span className="truncate">{title}</span>
          {unsaved && <span className="size-1.5 shrink-0 rounded-full bg-cta" aria-label={t("unsaved")} />}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{meta}</span>
      </span>
      {people !== undefined && (
        <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-muted-foreground tabular-nums" title={t("peopleCount", { n: people })}>
          <Users className="size-3.5" />
          {people}
        </span>
      )}
    </button>
  );
}

function RoleEditor({
  draft,
  role,
  editable,
  canEdit,
  isPrincipal,
  dirty,
  busy,
  error,
  notice,
  confirmDelete,
  onChange,
  onCycle,
  onSetAll,
  onSave,
  onDiscard,
  onReset,
  onAskDelete,
  onCancelDelete,
  onDelete,
  onPreview,
}: {
  draft: RoleDraft;
  role: SchoolRoleRow | null;
  editable: boolean;
  canEdit: boolean;
  isPrincipal: boolean;
  dirty: boolean;
  busy: "save" | "reset" | "delete" | null;
  error: string | null;
  notice: string | null;
  confirmDelete: boolean;
  onChange: (patch: Partial<RoleDraft>) => void;
  onCycle: (area: SchoolArea, action: SchoolAction) => void;
  onSetAll: (mode: "clear" | "viewAll") => void;
  onSave: () => void;
  onDiscard: () => void;
  onReset: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const t = useTranslations("school.roles");
  const ts = useTranslations("school");
  const tc = useTranslations("school.common");
  const roleName = useRoleName();
  const roleDescription = useRoleDescription();
  const isNew = draft.roleId === null;
  const title = isNew ? draft.name || t("untitled") : roleName({ key: draft.key, name: role?.name ?? draft.name, isSystem: draft.isSystem });
  const memberCount = role?.memberCount ?? 0;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white" aria-labelledby="role-editor-title">
      <header className="flex flex-col gap-4 border-b border-border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="role-editor-title" className="flex items-center gap-2 font-display text-xl text-primary">
              {isPrincipal && <Crown className="size-5 text-accent-deep" />}
              <span className="break-words">{title}</span>
            </h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Chip>{draft.isSystem ? t("builtInTag") : t("customTag")}</Chip>
              <Chip>{t(`scopes.${draft.scopeKind}.label`)}</Chip>
              {!isNew && <Chip>{t("peopleCount", { n: memberCount })}</Chip>}
            </div>
          </div>
          {!isPrincipal && (
            <Button type="button" variant="outline" size="sm" onClick={onPreview}>
              <Eye className="size-4" />
              {t("preview")}
            </Button>
          )}
        </div>

        {editable && !draft.isSystem && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="role-name">{t("nameLabel")}</Label>
              <Input id="role-name" value={draft.name} onChange={(e) => onChange({ name: e.target.value })} maxLength={60} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="role-scope">{t("scopeLabel")}</Label>
              <NativeSelect id="role-scope" value={draft.scopeKind} onChange={(e) => onChange({ scopeKind: e.target.value as SchoolScopeKind })}>
                {SCHOOL_SCOPE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`scopes.${kind}.label`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">{t(`scopes.${draft.scopeKind}.hint`)}</p>

        {editable ? (
          <div className="grid gap-1.5">
            <Label htmlFor="role-description">{t("descriptionLabel")}</Label>
            <Textarea
              id="role-description"
              value={draft.description}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={2}
              maxLength={300}
              placeholder={roleDescription({ key: draft.key, description: "", isSystem: draft.isSystem })}
            />
          </div>
        ) : (
          <p className="text-sm text-foreground/80">{roleDescription({ key: draft.key, description: draft.description, isSystem: draft.isSystem })}</p>
        )}
      </header>

      {isPrincipal ? (
        <div className="flex gap-3 p-5">
          <Crown className="mt-0.5 size-5 shrink-0 text-accent-deep" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("principalTitle")}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("principalBody")}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 border-b border-border bg-muted/30 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <LegendItem state={undefined} label={t("legend.off")} />
              <LegendItem state="allow" label={t("legend.allow")} />
              <LegendItem state="approval" label={t("legend.approval")} />
            </div>
            {editable && (
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => onSetAll("viewAll")}>
                  {t("viewAll")}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => onSetAll("clear")}>
                  {t("clearAll")}
                </Button>
              </div>
            )}
          </div>
          {editable && <p className="px-5 pt-4 text-xs text-muted-foreground">{t("tapHint")}</p>}

          <div className="flex flex-col gap-6 p-5">
            {SCHOOL_AREA_GROUPS.map((group) => (
              <div key={group.key}>
                <h3 className="mb-2 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">{t(`groups.${group.key}`)}</h3>
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {group.areas.map((area) => (
                    <li key={area} className="flex flex-col gap-2.5 px-3.5 py-3 md:flex-row md:items-center md:gap-4">
                      <div className="min-w-0 md:w-56 md:shrink-0">
                        <div className="text-sm font-medium text-foreground">{ts(`areas.${area}.label`)}</div>
                        <div className="text-xs leading-snug text-muted-foreground">{ts(`areas.${area}.hint`)}</div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {SCHOOL_AREAS[area].map((action) => (
                          <PermissionChip
                            key={action}
                            area={area}
                            action={action}
                            state={draft.permissions[`${area}.${action}`]}
                            disabled={!editable}
                            onClick={() => onCycle(area, action)}
                          />
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {draft.permissions["roles.view"] && <p className="text-xs text-muted-foreground">{t("rolesViewNote")}</p>}
          </div>
        </>
      )}

      {(editable || error || notice) && !isPrincipal && (
        <footer className="sticky bottom-0 flex flex-col gap-3 border-t border-border bg-white/95 px-5 py-3.5 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-5 text-sm" aria-live="polite">
            {error ? (
              <span className="font-medium text-destructive">{error}</span>
            ) : notice ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-success">
                <Check className="size-4" />
                {notice}
              </span>
            ) : dirty ? (
              <span className="text-accent-deep">{t("unsavedChanges")}</span>
            ) : null}
          </div>
          {editable && (
            <div className="flex flex-wrap gap-2">
              {confirmDelete ? (
                <>
                  <span className="self-center text-sm text-foreground">{t("deleteConfirm")}</span>
                  <Button type="button" variant="outline" size="sm" onClick={onCancelDelete} disabled={busy !== null}>
                    {tc("cancel")}
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={onDelete} disabled={busy !== null}>
                    {busy === "delete" ? tc("saving") : t("deleteYes")}
                  </Button>
                </>
              ) : (
                <>
                  {draft.isSystem && !isNew && (
                    <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={busy !== null}>
                      <RotateCcw className="size-4" />
                      {busy === "reset" ? tc("saving") : t("resetDefault")}
                    </Button>
                  )}
                  {!draft.isSystem && !isNew && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onAskDelete}
                      disabled={busy !== null || memberCount > 0}
                      title={memberCount > 0 ? t("deleteInUse") : undefined}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      {t("delete")}
                    </Button>
                  )}
                  {dirty && (
                    <Button type="button" variant="outline" size="sm" onClick={onDiscard} disabled={busy !== null}>
                      {isNew ? tc("cancel") : tc("discard")}
                    </Button>
                  )}
                  <Button type="button" size="sm" onClick={onSave} disabled={busy !== null || !dirty}>
                    {busy === "save" ? tc("saving") : isNew ? t("create") : tc("save")}
                  </Button>
                </>
              )}
            </div>
          )}
        </footer>
      )}
      {!canEdit && !isPrincipal && <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">{t("readOnly")}</p>}
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{children}</span>;
}

function PermissionChip({
  area,
  action,
  state,
  disabled,
  onClick,
}: {
  area: SchoolArea;
  action: SchoolAction;
  state: CellState | undefined;
  disabled: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("school");
  const stateLabel = state === "allow" ? t("roles.legend.allow") : state === "approval" ? t("roles.legend.approval") : t("roles.legend.off");
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${t(`areas.${area}.label`)}: ${t(`actions.${action}`)} — ${stateLabel}`}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default",
        state === "allow" && "border-primary bg-primary text-primary-foreground",
        state === "approval" && "border-cta bg-cta/20 text-accent-deep",
        state === undefined && "border-dashed border-border bg-white text-muted-foreground",
        !disabled && state === undefined && "hover:border-primary/50 hover:text-foreground",
        !disabled && state === "allow" && "hover:bg-primary-light",
      )}
    >
      {state === "allow" && <Check className="size-3.5" strokeWidth={2.5} />}
      {state === "approval" && <Hourglass className="size-3.5" />}
      {t(`actions.${action}`)}
    </button>
  );
}

function LegendItem({ state, label }: { state: CellState | undefined; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex size-4 items-center justify-center rounded-full border",
          state === "allow" && "border-primary bg-primary text-primary-foreground",
          state === "approval" && "border-cta bg-cta/20 text-accent-deep",
          state === undefined && "border-dashed border-border bg-white",
        )}
      >
        {state === "allow" && <Check className="size-2.5" strokeWidth={3} />}
        {state === "approval" && <Hourglass className="size-2.5" />}
      </span>
      {label}
    </span>
  );
}

function NewRoleDialog({
  open,
  onOpenChange,
  onCreate,
  existingNames,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, templateKey: string | null) => void;
  existingNames: string[];
}) {
  const t = useTranslations("school.roles");
  const tc = useTranslations("school.common");
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const taken = existingNames.includes(name.trim().toLowerCase());

  function reset(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setTemplateKey(null);
      setName("");
    }
  }

  function pick(key: string | null) {
    setTemplateKey(key);
    const suggested = key ? t(`templates.${key}.name`) : "";
    if (!name.trim() || CUSTOM_ROLE_TEMPLATES.some((tpl) => t(`templates.${tpl.key}.name`) === name)) setName(suggested);
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("newTitle")}</DialogTitle>
          <DialogDescription>{t("newBody")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("startFrom")}>
          {[null, ...CUSTOM_ROLE_TEMPLATES.map((tpl) => tpl.key)].map((key) => (
            <button
              key={key ?? "blank"}
              type="button"
              role="radio"
              aria-checked={templateKey === key}
              onClick={() => pick(key)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                templateKey === key ? "border-primary bg-primary/[0.04] ring-1 ring-primary" : "border-border hover:border-primary/40",
              )}
            >
              <span className="block text-sm font-semibold text-foreground">{key ? t(`templates.${key}.name`) : t("blank")}</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                {key ? t(`templates.${key}.description`) : t("blankHint")}
              </span>
            </button>
          ))}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-role-name">{t("nameLabel")}</Label>
          <Input id="new-role-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t("namePlaceholder")} />
          {taken && <p className="text-xs font-medium text-destructive">{t("nameTaken")}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => reset(false)}>
            {tc("cancel")}
          </Button>
          <Button type="button" disabled={name.trim().length < 2 || taken} onClick={() => onCreate(name.trim(), templateKey)}>
            {t("continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "View as this role": what someone holding it would see and be able to do. */
function RolePreviewSheet({ open, onOpenChange, draft }: { open: boolean; onOpenChange: (open: boolean) => void; draft: RoleDraft }) {
  const t = useTranslations("school.roles");
  const ts = useTranslations("school");
  const roleName = useRoleName();
  const name = draft.roleId === null ? draft.name : roleName(draft);

  const sections = useMemo(() => {
    const visible: SchoolArea[] = [];
    const hidden: SchoolArea[] = [];
    const changes: { area: SchoolArea; actions: SchoolAction[] }[] = [];
    const approvals: { area: SchoolArea; actions: SchoolAction[] }[] = [];
    for (const area of Object.keys(SCHOOL_AREAS) as SchoolArea[]) {
      if (draft.permissions[`${area}.view`]) visible.push(area);
      else hidden.push(area);
      const free = SCHOOL_AREAS[area].filter((a) => a !== "view" && draft.permissions[`${area}.${a}`] === "allow");
      const wait = SCHOOL_AREAS[area].filter((a) => draft.permissions[`${area}.${a}`] === "approval");
      if (free.length) changes.push({ area, actions: free });
      if (wait.length) approvals.push({ area, actions: wait });
    }
    return { visible, hidden, changes, approvals };
  }, [draft.permissions]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle className="font-display text-lg text-primary">{t("previewTitle", { name })}</SheetTitle>
          <SheetDescription>{t(`scopes.${draft.scopeKind}.hint`)}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 p-5">
          <PreviewBlock title={t("previewSees")} empty={t("previewNothing")}>
            {sections.visible.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {sections.visible.map((area) => (
                  <span key={area} className="rounded-md bg-primary/[0.07] px-2 py-1 text-xs font-medium text-primary">
                    {ts(`areas.${area}.label`)}
                  </span>
                ))}
              </div>
            )}
          </PreviewBlock>
          <PreviewBlock title={t("previewChanges")} empty={t("previewNoChanges")}>
            {sections.changes.length > 0 && (
              <ul className="flex flex-col gap-1.5 text-sm">
                {sections.changes.map(({ area, actions }) => (
                  <li key={area} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    <span>
                      <span className="font-medium">{ts(`areas.${area}.label`)}:</span> {actions.map((a) => ts(`actions.${a}`).toLowerCase()).join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PreviewBlock>
          <PreviewBlock title={t("previewApprovals")} empty={t("previewNoApprovals")}>
            {sections.approvals.length > 0 && (
              <ul className="flex flex-col gap-1.5 text-sm">
                {sections.approvals.map(({ area, actions }) => (
                  <li key={area} className="flex gap-2">
                    <Hourglass className="mt-0.5 size-4 shrink-0 text-accent-deep" />
                    <span>
                      <span className="font-medium">{ts(`areas.${area}.label`)}:</span> {actions.map((a) => ts(`actions.${a}`).toLowerCase()).join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PreviewBlock>
          {sections.hidden.length > 0 && (
            <PreviewBlock title={t("previewHidden")} empty="">
              <p className="text-sm text-muted-foreground">{sections.hidden.map((area) => ts(`areas.${area}.label`)).join(", ")}</p>
            </PreviewBlock>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PreviewBlock({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      {children || <p className="text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}
