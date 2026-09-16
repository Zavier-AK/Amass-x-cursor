import type { Milestone, ProteinInfo } from "./types";
import { searchCore } from "./amass";

function pubmedUrl(pmid?: string | null, doi?: string | null): string {
  if (pmid) return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
  if (doi) return `https://doi.org/${doi}`;
  return "https://pubmed.ncbi.nlm.nih.gov/";
}

function asDate(...cands: Array<string | null | undefined>): string | null {
  for (const c of cands) {
    if (c && /^\d{4}/.test(c)) return c.slice(0, 10);
  }
  return null;
}

export async function learnFromAmass(topic: string, apiKey: string) {
  const [papers, trials, drugs, genes, regs] = await Promise.all([
    searchCore<Record<string, unknown>>(
      "biomedcore",
      topic,
      apiKey,
      { minJournalQualityJufo: "2" },
      10,
    ),
    searchCore<Record<string, unknown>>("trialcore", topic, apiKey, {}, 8),
    searchCore<Record<string, unknown>>("drugcore", topic, apiKey, {}, 6),
    searchCore<Record<string, unknown>>(
      "genecore",
      topic,
      apiKey,
      { geneType: "PROTEIN_CODING", include: "protein" },
      5,
    ),
    searchCore<Record<string, unknown>>("regulatorycore", topic, apiKey, {}, 6),
  ]);

  const milestones: Milestone[] = [];

  for (const p of papers) {
    const date = asDate(p.publicationDate as string);
    if (!date) continue;
    const pmid = (p.pmid as string) ?? null;
    const title = (p.title as string) || "Untitled publication";
    const abs = ((p.abstract as string) || "").slice(0, 600);
    milestones.push({
      id: String(p.amassId),
      kind: "literature",
      core: "biomedcore",
      date,
      title,
      summary: abs || title,
      teach: abs
        ? `From the abstract: ${abs.slice(0, 420)}`
        : "This paper is in the retrieved BioMedCore set; open the source for the full record.",
      sourceLabel: pmid
        ? `PMID ${pmid}${p.journal ? ` · ${p.journal}` : ""}`
        : String(p.doi ?? p.amassId),
      sourceUrl: pubmedUrl(pmid, p.doi as string),
      citationCount: (p.citationCount as number) ?? null,
    });
  }

  for (const t of trials) {
    const date = asDate(
      t.startDate as string,
      t.completionDate as string,
      t.lastUpdateDate as string,
    );
    if (!date) continue;
    const nct = (t.nctId as string) || (t.registryId as string) || "";
    const title =
      (t.acronym as string)
        ? `${t.acronym}: ${t.briefTitle}`
        : String(t.briefTitle || t.officialTitle || "Clinical trial");
    const summary = String(t.briefSummary || title).slice(0, 600);
    milestones.push({
      id: String(t.amassId),
      kind: "trial",
      core: "trialcore",
      date,
      title,
      summary,
      teach: `Trial ${nct || t.amassId} (${t.phase ?? "phase n/a"}, ${t.overallStatus ?? "status n/a"}). ${summary.slice(0, 360)}`,
      sourceLabel: nct || String(t.amassId),
      sourceUrl:
        (t.sourceUrl as string) ||
        (nct.startsWith("NCT")
          ? `https://clinicaltrials.gov/study/${nct}`
          : "https://clinicaltrials.gov/"),
      extra: [t.phase, t.overallStatus].filter(Boolean).join(" · ") || undefined,
    });
  }

  for (const d of drugs) {
    const name = String(d.name || "Drug");
    milestones.push({
      id: String(d.amassId),
      kind: "drug",
      core: "drugcore",
      date: "2018-01-01",
      title: `${name}${d.tradeNames && Array.isArray(d.tradeNames) && d.tradeNames[0] ? ` (${d.tradeNames[0]})` : ""}`,
      summary: String(d.description || `${name} — ${d.maxClinicalStage ?? ""}`).slice(
        0,
        600,
      ),
      teach: `${name} is a ${d.drugType ?? "molecule"} in DrugCore at stage ${d.maxClinicalStage ?? "unknown"}. ${String(d.description || "").slice(0, 280)}`,
      sourceLabel: (d.chemblId as string) || String(d.amassId),
      sourceUrl: d.chemblId
        ? `https://www.ebi.ac.uk/chembl/compound_report_card/${d.chemblId}/`
        : "https://www.ebi.ac.uk/chembl/",
      extra: [d.drugType, d.maxClinicalStage].filter(Boolean).join(" · ") || undefined,
    });
  }

  for (const r of regs) {
    const date = asDate(
      r.authorizationDate as string,
      r.decisionDate as string,
    );
    if (!date) continue;
    const title = String(
      r.productName || r.inventedName || r.activeSubstance || "Authorization",
    );
    milestones.push({
      id: String(r.amassId),
      kind: "regulatory",
      core: "regulatorycore",
      date,
      title: `${r.agency ?? "Regulator"}: ${title}`,
      summary: String(
        r.indication || r.authorizationStatus || "Regulatory authorization",
      ).slice(0, 600),
      teach: `A ${r.agency ?? "regulatory"} record for ${title}. Status: ${r.authorizationStatus ?? "n/a"}.`,
      sourceLabel: String(r.agency || r.amassId),
      sourceUrl: (r.sourceUrl as string) || "https://www.fda.gov/",
    });
  }

  milestones.sort((a, b) => a.date.localeCompare(b.date));

  let protein: ProteinInfo | null = null;
  const gene = genes[0];
  if (gene) {
    const uniprot =
      (Array.isArray(gene.uniprotIds) && (gene.uniprotIds[0] as string)) ||
      ((gene.protein as { identity?: { canonicalAccession?: string } } | null)
        ?.identity?.canonicalAccession ??
        null);
    if (uniprot) {
      protein = {
        symbol: String(gene.symbol || "GENE"),
        name: String(gene.name || gene.symbol || "Protein"),
        uniprotId: uniprot,
        geneAmassId: String(gene.amassId),
        summary: String(gene.summary || "").slice(0, 800),
        alphafoldPdbUrl: `https://alphafold.ebi.ac.uk/files/AF-${uniprot}-F1-model_v6.pdb`,
      };
      milestones.unshift({
        id: String(gene.amassId),
        kind: "gene",
        core: "genecore",
        date: "1992-01-01",
        title: `${protein.symbol} — ${protein.name}`,
        summary: protein.summary || "GeneCore protein-coding gene.",
        teach: `${protein.symbol} maps to UniProt ${protein.uniprotId}. That accession is the AlphaFold lookup key.`,
        sourceLabel: `UniProt ${protein.uniprotId}`,
        sourceUrl: `https://www.uniprot.org/uniprotkb/${protein.uniprotId}`,
        extra: protein.symbol,
      });
    }
  }

  return { milestones: milestones.slice(0, 24), protein };
}
