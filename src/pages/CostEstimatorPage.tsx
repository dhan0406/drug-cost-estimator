import { useState, type FormEvent } from "react";
import { CostResult } from "../components/CostResult";
import { DiagnosisSearch } from "../components/DiagnosisSearch";
import { DrugPicker, type DrugDraft } from "../components/DrugPicker";
import { EligibilitySummary, EligibilitySurvey } from "../components/EligibilitySurvey";
import { PlanPicker, type PlanDraft } from "../components/PlanPicker";
import { getSurvey, type Verdict } from "../eligibility/survey";
import { useDrugsForDiagnosis, useEstimate } from "../hooks/queries";
import type { Diagnosis } from "../types";

export function CostEstimatorPage() {
  const [diagnosis, setDiagnosis] = useState<Diagnosis>();
  const [plan, setPlan] = useState<PlanDraft>({});
  const [drug, setDrug] = useState<DrugDraft>({});
  const [eligibility, setEligibility] = useState<Verdict[]>();
  const estimate = useEstimate();
  const { data: drugs = [] } = useDrugsForDiagnosis(diagnosis?.icd10);

  const ready =
    diagnosis && plan.insurer && plan.coverageType && plan.formularyId && drug.rxcui && drug.strength && drug.quantity;

  // Prior auth needed and we have that plan's criteria: walk through them before showing prices.
  const survey =
    estimate.data?.coverage.priorAuth && plan.insurer ? getSurvey(plan.insurer, estimate.data.drug.rxcui) : undefined;

  function resetEstimate() {
    estimate.reset();
    setEligibility(undefined);
  }

  function runEstimate(d: DrugDraft) {
    if (!diagnosis || !plan.insurer || !plan.coverageType || !plan.formularyId) return;
    setEligibility(undefined);
    estimate.mutate({
      diagnosis,
      plan: { insurer: plan.insurer, coverageType: plan.coverageType, formularyId: plan.formularyId },
      drug: { rxcui: d.rxcui!, strength: d.strength!, quantity: d.quantity! },
    });
  }

  function onDiagnosisChange(d?: Diagnosis) {
    setDiagnosis(d);
    setDrug({}); // drug list depends on diagnosis
    resetEstimate();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (ready) runEstimate(drug);
  }

  function onTryAlternative(rxcui: string) {
    const alt = drugs.find((d) => d.rxcui === rxcui);
    if (!alt) return;
    const next = { rxcui, strength: alt.strengths[0], quantity: drug.quantity ?? 10 };
    setDrug(next);
    runEstimate(next);
  }

  return (
    <main className="page">
      <header className="masthead">
        <h1>Drug Cost Estimator</h1>
        <p>See whether your plan covers a prescription and roughly what you'll pay.</p>
      </header>

      <form className="steps" onSubmit={onSubmit}>
        <section className="card">
          <h2><span className="num">1</span> Diagnosis</h2>
          <DiagnosisSearch value={diagnosis} onChange={onDiagnosisChange} />
        </section>

        <section className="card">
          <h2><span className="num">2</span> Insurance</h2>
          <PlanPicker
            value={plan}
            onChange={(p) => {
              setPlan(p);
              resetEstimate();
            }}
          />
        </section>

        <section className="card">
          <h2><span className="num">3</span> Drug</h2>
          <DrugPicker
            icd10={diagnosis?.icd10}
            value={drug}
            onChange={(d) => {
              setDrug(d);
              resetEstimate();
            }}
          />
        </section>

        <button type="submit" className="primary" disabled={!ready || estimate.isPending}>
          {estimate.isPending ? "Estimating…" : "Estimate cost"}
        </button>
      </form>

      {estimate.isError && <p className="error">Couldn't get an estimate: {estimate.error.message}</p>}
      {estimate.data && survey && !eligibility && (
        <EligibilitySurvey
          key={estimate.submittedAt}
          survey={survey}
          onFinish={setEligibility}
          onTryAlternative={onTryAlternative}
          canPrice={(rxcui) => drugs.some((d) => d.rxcui === rxcui)}
        />
      )}
      {estimate.data && (!survey || eligibility) && (
        <div className="result-stack">
          {eligibility && <EligibilitySummary verdicts={eligibility} onRetake={() => setEligibility(undefined)} />}
          <CostResult result={estimate.data} />
        </div>
      )}
    </main>
  );
}
