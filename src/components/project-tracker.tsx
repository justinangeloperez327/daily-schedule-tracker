"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SearchCombobox, type ComboboxOption } from "@/components/ui/search-combobox";
import { ProjectTrackerPanel } from "@/components/project-tracker-panel";
import { apiRequest } from "@/lib/http";
import type { Project } from "@/lib/catalog";
import { trackerTypeForProject, trackerTypeLabels, trackerTypes, type TrackerType } from "@/lib/project-tracker";

const tabNames: Record<TrackerType, string> = {
  substation: "Substation",
  bus_shelter: "Bus Shelters",
  guardrail: "Guardrail",
};

// Cross-project tracker page: pick a subcategory tab, then a project.
// The milestone table itself is ProjectTrackerPanel, also used on project details.
export function ProjectTracker({ initialProjectId = "" }: { initialProjectId?: string }) {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [selectedType, setSelectedType] = React.useState<TrackerType>("substation");
  const [projectId, setProjectId] = React.useState(initialProjectId);
  const [loadingProjects, setLoadingProjects] = React.useState(true);
  const [error, setError] = React.useState("");
  const dirtyRef = React.useRef(false);
  const trackDirty = React.useCallback((dirty: boolean) => { dirtyRef.current = dirty; }, []);

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

  const project = projects.find((candidate) => candidate.id === projectId);
  const availableProjects = projects.filter((candidate) => trackerTypeForProject(candidate) === selectedType);
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

  function confirmNavigation() {
    return !dirtyRef.current || window.confirm(
      "You have unsaved tracker changes. Leave this project without saving them?"
    );
  }

  function selectType(nextType: TrackerType) {
    if (nextType === selectedType || !confirmNavigation()) return;
    dirtyRef.current = false;
    setSelectedType(nextType);
    setProjectId("");
    setError("");
  }

  function selectProject(id: string) {
    if (id === projectId || !confirmNavigation()) return;
    dirtyRef.current = false;
    setProjectId(id);
    setError("");
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
              Subcategory: {project.subCategory || project.mainCategory || "—"} ·{" "}
              <Link className="underline text-[#365F91]" href={"/projects/" + encodeURIComponent(project.id)}>Project details</Link>
            </p>
          )}
        </div>
      </section>

      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">{error}</p>}
      {projectId ? (
        <ProjectTrackerPanel key={projectId} projectId={projectId} trackerType={selectedType} onDirtyChange={trackDirty} />
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-white px-4 py-14 text-center text-sm text-muted-foreground">
          Choose a project to view or create its milestone tracker.
        </div>
      )}
    </main>
  );
}
