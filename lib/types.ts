export type CoreName =
  | "biomedcore"
  | "trialcore"
  | "drugcore"
  | "regulatorycore"
  | "genecore";

export type MilestoneKind =
  | "literature"
  | "trial"
  | "drug"
  | "regulatory"
  | "gene";

export type Milestone = {
  id: string;
  kind: MilestoneKind;
  core: CoreName;
  date: string;
  title: string;
  summary: string;
  teach: string;
  sourceLabel: string;
  sourceUrl: string;
  citationCount?: number | null;
  extra?: string;
};

export type ProteinInfo = {
  symbol: string;
  name: string;
  uniprotId: string;
  geneAmassId: string;
  summary: string;
  alphafoldPdbUrl: string;
};

export type LearnResult = {
  topic: string;
  queryUsed: string;
  cached: boolean;
  liveAmass: boolean;
  milestones: Milestone[];
  protein: ProteinInfo | null;
};

export type TeachResult = {
  answer: string;
  citedIds: string[];
  model: "claude" | "extractive";
};

export type CheckResult = {
  covered: string[];
  gaps: string[];
  question: string;
  model: "claude" | "extractive";
};
