"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchCombobox, type ComboboxOption } from "@/components/ui/search-combobox";
import { apiRequest } from "@/lib/http";
import type { Project } from "@/lib/catalog";
import {
  milestones, trackerProgress, trackerTypeForProject, trackerTypeLabels,
  trackerTypes, wirStatuses, type TrackerItem, type TrackerType, type WirStatus,
} from "@/lib/project-tracker";

type TrackerResponse = {
  project: Pick<Project, "id" | "name" | "jobNo" | "clientName" | "mainCategory" | "subCategory">;
  trackerType: TrackerType | null;
  items: TrackerItem[];
};

type TrackerDraft = {
  label: string;
  locationReference: string;
  plannedLengthLm: string;
  siteMeasurementDate: string;
  drawingToProductionDate: string;
  deliveryDate: string;
  installationDate: string;
  wirDate: string;
  wirStatus: WirStatus;
  wirReference: string;
  remarks: string;
};

function draftFromItem(item: TrackerItem): TrackerDraft {
  return {
    label: item.label,
    locationReference: item.locationReference || "",
    plannedLengthLm: item.plannedLengthLm ?? "",
    siteMeasurementDate: item.siteMeasurementDate || "",
    drawingToProductionDate: item.drawingToProductionDate || "",
    deliveryDate: item.deliveryDate || "",
    installationDate: item.installationDate || "",
    wirDate: item.wirDate || "",
    wirStatus: item.wirStatus,
    wirReference: item.wirReference || "",
    remarks: item.remarks || "",
  };
}

const tabNames: Record<TrackerType, string> = {
  substation: "Substation",
  bus_shelter: "Bus Shelters",
  guardrail: "Guardrail",
};

export function ProjectTracker({ initialProjectId = "" }: { initialProjectId?: string }) {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [selectedType, setSelectedType] = React.useState<TrackerType>("substation");
  const [projectId, setProjectId] = React.useState(initialProjectId);
  const [items, setItems] = React.useState<TrackerItem[]>([]);
  const [drafts, setDrafts] = React.useState<Record<string, TrackerDraft>>({});
  const [count, setCount] = React.useState("1");
  const [loadingProjects, setLoadingProjects] = React.useState(true);
  const [loadingItems, setLoadingItems] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    apiRequest<Project[]>("/api/projects").then((result) => {
      if (!alive) return;
      setProjects(result);
      const initial = result.find((project) => project.id === initialProjectId);
      if (initial) setSelectedType(trackerTypeForProject(initial) ?? "substation");
    }).catch((cause) => {
      if (alive) setError(cause instanceof Error ? cause.message : "Unable to load projects.");
    }).finally(() => { if (alive) setLoadingProjects(false); });
    return () => { alive = false; };
  }, [initialProjectId]);

  React.useEffect(() => {
    if (!projectId) return;
    let alive = true;
    apiRequest<TrackerResponse>("/api/trackers?projectId=" + encodeURIComponent(projectId))
      .then((result) => {
        if (!alive) return;
        setItems(result.items);
        setDrafts(Object.fromEntries(result.items.map((item) => [item.id, draftFromItem(item)])));
      })
      .catch((cause) => {
        if (alive) {
          setError(cause instanceof Error ? cause.message : "Unable to load tracker.");
          setItems([]);
        }
      }).finally(() => { if (alive) setLoadingItems(false); });
    return () => { alive = false; };
  }, [projectId]);

  const project = projects.find((candidate) => candidate.id === projectId);
  const availableProjects = projects.filter((candidate) =>
    trackerTypeForProject(candidate) === selectedType
  );
  const projectOptions: ComboboxOption[] = availableProjects.map((candidate) => ({
    value: candidate.id,
    label: (candidate.jobNo || "No Job No.") + " — " + (candidate.name || candidate.clientName),
    searchText: [candidate.jobNo, candidate.name, candidate.clientName, candidate.soNo].filter(Boolean).join(" "),
    project: {
      jobNo: candidate.jobNo || "No Job No.",
      projectName: candidate.name,
      clientName: candidate.clientName,
      soNo: candidate.soNo || "—",
      hasName: !!candidate.name && !/^unnamed project$/i.test(candidate.name),
    },
  }));
  const approved = items.filter((item) => item.wirStatus === "Approved").length;
  const completed = items.filter((item) => trackerProgress(item) === 5).length;

  function hasUnsavedChanges() {
    return items.some((item) =>
      JSON.stringify(drafts[item.id] ?? draftFromItem(item)) !== JSON.stringify(draftFromItem(item))
    );
  }

  function confirmNavigation() {
    return !hasUnsavedChanges() || window.confirm(
      "You have unsaved tracker changes. Leave this project without saving them?"
    );
  }

  function selectType(nextType: TrackerType) {
    if (nextType === selectedType || !confirmNavigation()) return;
    setSelectedType(nextType);
    setProjectId("");
    setItems([]);
    setDrafts({});
    setError("");
    setNotice("");
    setCount("1");
  }

  function selectProject(id: string) {
    if (id === projectId || !confirmNavigation()) return;
    setProjectId(id);
    setItems([]);
    setDrafts({});
    setError("");
    setNotice("");
    setLoadingItems(!!id);
  }

  function updateDraft(id: string, changes: Partial<TrackerDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? draftFromItem(items.find((item) => item.id === id)!)), ...changes },
    }));
  }

  async function addItems() {
    if (!projectId || adding) return;
    const amount = selectedType === "substation" ? 1 : Number(count);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
      setError("Enter a whole number between 1 and 100.");
      return;
    }
    setAdding(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<{ items: TrackerItem[] }>("/api/trackers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, count: amount }),
      });
      setItems(result.items);
      // Preserve unsaved edits to existing rows when adding more assets.
      setDrafts((previous) => Object.fromEntries(result.items.map((item) => [
        item.id, previous[item.id] ?? draftFromItem(item),
      ])));
      setNotice(selectedType === "substation"
        ? "The four Substation components are ready."
        : amount + " " + (selectedType === "bus_shelter" ? "shelter(s)" : "guardrail section(s)") + " added.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add tracker items.");
    } finally { setAdding(false); }
  }

  async function saveItem(item: TrackerItem) {
    if (savingId) return;
    const draft = drafts[item.id] ?? draftFromItem(item);
    setSavingId(item.id);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<TrackerItem>("/api/trackers/" + encodeURIComponent(item.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      setItems((current) => current.map((entry) => entry.id === item.id ? result : entry));
      setDrafts((current) => ({ ...current, [item.id]: draftFromItem(result) }));
      setNotice(result.label + " saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save milestone row.");
    } finally { setSavingId(null); }
  }

  async function deleteItem(item: TrackerItem) {
    if (savingId || !window.confirm("Remove " + item.label + " and its milestone history? This cannot be undone.")) return;
    setSavingId(item.id);
    setError("");
    try {
      await apiRequest<{ success: boolean }>("/api/trackers/" + encodeURIComponent(item.id), { method: "DELETE" });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setDrafts((current) => {
        const copy = { ...current };
        delete copy[item.id];
        return copy;
      });
      setNotice(item.label + " removed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to remove item.");
    } finally { setSavingId(null); }
  }

  return (
    <main className="min-h-[calc(100vh-64px)] min-w-0 px-3 pb-16 pt-8 sm:px-6 lg:px-8 2xl:px-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="technical-eyebrow mb-1">PROJECTS / SUBCATEGORY TRACKER</p>
          <h1 className="text-[28px] font-semibold tracking-tight text-primary">Project Milestone Tracker</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Track individual work items from site measurement through production, delivery,
            installation and WIR approval. Progress is saved per project.
          </p>
        </div>
        <Button variant="outline" asChild><Link href="/projects">Projects register</Link></Button>
      </div>

      <div role="tablist" aria-label="Tracker subcategories" className="mb-4 flex flex-wrap gap-2">
        {trackerTypes.map((type) => (
          <button
            key={type}
            role="tab"
            type="button"
            aria-selected={selectedType === type}
            className={"rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 " +
              (selectedType === type
                ? "border-[#365F91] bg-[#EAF2FC] text-primary"
                : "border-border bg-white text-muted-foreground hover:bg-accent hover:text-primary")}
            onClick={() => selectType(type)}
          >
            {tabNames[type]}
          </button>
        ))}
      </div>

      <section className="mb-5 rounded-xl border border-border bg-white p-4 sm:p-5">
        <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="min-w-0 space-y-2">
            <label className="text-sm font-medium">Select {trackerTypeLabels[selectedType]} project</label>
            <SearchCombobox
              label={trackerTypeLabels[selectedType] + " project"}
              value={projectId}
              onValueChange={selectProject}
              options={projectOptions}
              placeholder="Search job no., project name, SO no. or client..."
              disabled={loadingProjects}
            />
            {!loadingProjects && availableProjects.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No projects have this subcategory yet. Set it in the <Link className="underline text-[#365F91]" href="/projects">Projects register</Link>.
              </p>
            )}
            {project && (
              <p className="text-xs text-muted-foreground">
                Client: {project.clientName || "—"} · Job No.: {project.jobNo || "—"} ·
                Subcategory: {project.subCategory || project.mainCategory || "—"}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {selectedType !== "substation" && (
              <div className="space-y-1">
                <label htmlFor="tracker-count" className="block text-xs font-medium">
                  {selectedType === "bus_shelter" ? "Shelters to add" : "Sections to add"}
                </label>
                <Input
                  id="tracker-count"
                  type="number" min={1} max={100} step={1}
                  value={count}
                  onChange={(event) => setCount(event.target.value)}
                  className="w-28"
                  disabled={!projectId || adding}
                />
              </div>
            )}
            <Button disabled={!projectId || loadingItems || adding} onClick={addItems}>
              {selectedType === "substation" ? <RotateCcw className="size-4" /> : <Plus className="size-4" />}
              {adding ? "Adding..." : selectedType === "substation" ? "Create / restore 4 items" :
                selectedType === "bus_shelter" ? "Add shelters" : "Add sections"}
            </Button>
          </div>
        </div>
        {selectedType === "guardrail" && (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Guardrail is tracked by section or chainage. Record the location and planned length (lm) for each section,
            then update its milestones and WIR separately.
          </p>
        )}
      </section>

      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-lg border border-[#C6DCD0] bg-[#F3F8F4] px-4 py-3 text-sm text-[#315C43]">{notice}</p>}
      {projectId && !loadingItems && (
        <div className="mb-4 flex flex-wrap items-center gap-5 rounded-lg border border-border bg-white px-4 py-3">
          <p className="text-sm"><span className="font-semibold text-primary">{items.length}</span> <span className="text-muted-foreground">tracked items</span></p>
          <p className="text-sm"><span className="font-semibold text-primary">{approved}</span> <span className="text-muted-foreground">WIR approved</span></p>
          <p className="text-sm"><span className="font-semibold text-primary">{completed}</span> <span className="text-muted-foreground">fully completed</span></p>
        </div>
      )}

      {loadingItems && <div className="rounded-xl border bg-white px-4 py-12 text-center text-sm text-muted-foreground">Loading tracker...</div>}
      {!projectId && <div className="rounded-xl border border-dashed border-border bg-white px-4 py-14 text-center text-sm text-muted-foreground">Choose a project to view or create its milestone tracker.</div>}
      {projectId && !loadingItems && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-white px-4 py-14 text-center text-sm text-muted-foreground">
          No tracker items yet. {selectedType === "substation"
            ? "Create the four default Substation components."
            : "Enter how many assets or sections you want to track, then select Add."}
        </div>
      )}
      {projectId && !loadingItems && items.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-primary">
              {trackerTypeLabels[selectedType]} — Milestone Register
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Dates and remarks are editable. Save each row to update the project tracker.
              An approved WIR counts as the final milestone.
            </p>
          </div>
          <div className="w-full overflow-x-auto" tabIndex={0} aria-label="Tracker table, scroll horizontally">
            <table className={"w-full table-fixed text-left text-xs " +
              (selectedType === "guardrail" ? "min-w-[1830px]" : "min-w-[1560px]")}>
              <thead className="border-b border-border bg-[#F8FAFD] text-[11px] font-medium text-[#506781]">
                <tr>
                  <th scope="col" className="w-[175px] px-3 py-3">Item / Asset</th>
                  {selectedType === "guardrail" && <>
                    <th scope="col" className="w-[150px] px-3 py-3">Location / Chainage</th>
                    <th scope="col" className="w-[115px] px-3 py-3">Length (lm)</th>
                  </>}
                  {milestones.map((milestone) => (
                    <th scope="col" key={milestone.key} className="w-[151px] px-3 py-3">{milestone.label}</th>
                  ))}
                  <th scope="col" className="w-[160px] px-3 py-3">WIR status</th>
                  <th scope="col" className="w-[140px] px-3 py-3">WIR No. / Ref.</th>
                  <th scope="col" className="w-[215px] px-3 py-3">Remarks</th>
                  <th scope="col" className="w-[116px] px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => {
                  const draft = drafts[item.id] ?? draftFromItem(item);
                  const dirty = JSON.stringify(draft) !== JSON.stringify(draftFromItem(item));
                  const saving = savingId === item.id;
                  return (
                    <tr key={item.id} className="align-top hover:bg-[#FBFDFF]">
                      <td className="px-3 py-3">
                        <p className="mb-1 font-mono text-[10px] text-[#365F91]">{item.code}</p>
                        <Input
                          aria-label={"Item name for " + item.code}
                          value={draft.label}
                          maxLength={150}
                          onChange={(event) => updateDraft(item.id, { label: event.target.value })}
                          disabled={!!savingId}
                          className="h-9 min-w-0 px-2 text-xs font-medium"
                        />
                        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                          {trackerProgress(item)} / 5 milestones
                        </p>
                      </td>
                      {selectedType === "guardrail" && <>
                        <td className="px-3 py-3">
                          <Input
                            aria-label={"Location or chainage for " + item.label}
                            placeholder="e.g. CH 0+120–0+180"
                            value={draft.locationReference}
                            maxLength={200}
                            onChange={(event) => updateDraft(item.id, { locationReference: event.target.value })}
                            disabled={!!savingId}
                            className="h-9 px-2 text-xs"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <Input
                            aria-label={"Planned length in linear metres for " + item.label}
                            placeholder="0.00"
                            inputMode="decimal"
                            value={draft.plannedLengthLm}
                            onChange={(event) => updateDraft(item.id, { plannedLengthLm: event.target.value })}
                            disabled={!!savingId}
                            className="h-9 px-2 text-xs"
                          />
                        </td>
                      </>}
                      {milestones.map(({ key, label }) => (
                        <td key={key} className="px-3 py-3">
                          <Input
                            type="date"
                            aria-label={label + " for " + item.label}
                            value={draft[key]}
                            onChange={(event) => updateDraft(item.id, { [key]: event.target.value })}
                            disabled={!!savingId}
                            className="h-9 min-w-0 px-1.5 text-[11px] tabular-nums"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        <select
                          aria-label={"WIR status for " + item.label}
                          value={draft.wirStatus}
                          onChange={(event) => updateDraft(item.id, { wirStatus: event.target.value as WirStatus })}
                          disabled={!!savingId}
                          className="h-9 w-full rounded-md border border-input bg-white px-2 text-xs text-foreground"
                        >
                          {wirStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <Input
                          aria-label={"WIR reference for " + item.label}
                          placeholder="WIR-..."
                          value={draft.wirReference}
                          onChange={(event) => updateDraft(item.id, { wirReference: event.target.value })}
                          maxLength={120}
                          disabled={!!savingId}
                          className="h-9 px-2 text-xs"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Textarea
                          aria-label={"Remarks for " + item.label}
                          placeholder="Comments, issues or next steps..."
                          rows={2}
                          value={draft.remarks}
                          maxLength={5000}
                          onChange={(event) => updateDraft(item.id, { remarks: event.target.value })}
                          disabled={!!savingId}
                          className="min-h-[60px] resize-y text-xs leading-5"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-end gap-2">
                          <Button size="sm" className="w-full" disabled={!!savingId || !dirty} onClick={() => saveItem(item)}>
                            <Save className="size-3.5" /> {saving ? "Saving" : "Save"}
                          </Button>
                          {selectedType !== "substation" && (
                            <Button
                              size="sm" variant="ghost"
                              className="w-full text-destructive hover:text-destructive"
                              disabled={!!savingId}
                              onClick={() => deleteItem(item)}
                            >
                              <Trash2 className="size-3.5" /> Remove
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Dates are site-local calendar dates. An empty date means the stage has not yet been recorded.
        The tracker does not automatically mark a stage complete or approve a WIR.
      </p>
    </main>
  );
}
