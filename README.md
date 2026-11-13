# Prescription Drug Cost Estimator: getmydrug

https://getmydrug.vercel.app/

**Find out what your insurer needs before it covers your medicine — before the pharmacy counter, not after.**

A clinic drops its insurers' drug coverage policy PDFs onto one web page. Claude reads each policy once and turns it into a short set of plain-language questions. A patient answers them on the clinic's device and gets:

- the plan's actual requirements, each with the sentence from the policy it comes from
- a checklist of which requirements they appear to meet, which they don't, and what to confirm
- a plain-language summary to discuss with their prescriber
- a **clinic checklist** the office can paste straight into the prior-authorization request
- links to cash-price and assistance options if the plan says no

No EHR integration, no account, no install. Works for any drug policy PDF, from any insurer.

> This is coverage information, not medical advice. The plan and the prescriber make the final decision. Confirm anything the tool shows against the policy document itself.

## For a clinic: using it

1. Open the link your team gave you (for example `https://getmydrug.vercel.app`).
2. Drag your insurers' prior-authorization / step-therapy policy PDFs onto **Your policies**. Each one is read once (takes 20–40 seconds) and then stays in that browser.
3. Hand the patient the device, or walk through it together: pick the plan, the medicine, answer the questions, copy the clinic checklist.

That's it. To add an insurer or a drug class, drop another PDF. To remove one, click ✕.

Where to find the PDFs: every major insurer publishes them on its provider site — UnitedHealthcare "Prior Authorization/Medical Necessity" drug policies, Cigna "Drug Coverage Policy", CVS Caremark "Prior Authorization Criteria", Washington Apple Health "Prior Authorization" drug policies. Search the insurer's provider portal for the drug name plus "prior authorization".

## Hosting your own copy (one time, ~5 minutes, free)

The page is static; the only server piece is `api/claude.js`, which holds the Claude API key so the browser never sees it.

1. Fork this repository on GitHub.
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, **Add New → Project**, pick the fork, keep all defaults, **Deploy**.
3. In the Vercel project, **Settings → Environment Variables**, add `ANTHROPIC_API_KEY` with a key from [console.anthropic.com](https://console.anthropic.com). Optional: `CLAUDE_MODEL` (default `claude-sonnet-5-5`).
4. **Deployments → Redeploy** so the key takes effect. Your copy is live at `https://<project>.vercel.app`.

Vercel's free Hobby plan covers a pilot. Running costs are the Claude API calls: one per PDF added, one per patient check — cents.

Local development: `vercel dev` (needs the Vercel CLI) serves the page and the function together at http://localhost:3000. Or open the page from any static server and set `localStorage.setItem('getmydrug_api', 'https://<your-deploy>.vercel.app/api/claude')` in the console to point it at a deployed function.

## How it works

```
index.html        the whole front end: policies panel, chat, interview, results
api/claude.js     Vercel serverless function; three fixed tasks, Claude API key lives here
legacy.html       the earlier hand-written-YAML version (migraine only), kept for reference
data/             YAML used by legacy.html
```

1. **Extract** — when a PDF is dropped, the browser sends it to `/api/claude` with `task: "extract"`. Claude returns a structured *policy card* (payer, drugs, each criterion with a verbatim quote, the questions to ask, renewal/quantity notes) as JSON validated against a schema. The card and the PDF are stored in the browser's IndexedDB. This card is the beginning of a structured rules library: one JSON per policy.
2. **Interview** — the page asks only the questions tied to the chosen drug and use. Answers live in a JavaScript variable.
3. **Check** — answers + the same PDF go to Claude with `task: "check"`. It returns met / not met / confirm per criterion with the supporting quote, a patient summary, and a clinic checklist. The model is instructed to use only the document and never give treatment advice.
4. **Ask** — the text box sends free-text questions grounded in the selected policy.

Prompt caching is turned on for the PDF block, so repeat calls on the same policy are cheap.

## Privacy

- Policy PDFs and the extracted cards stay in the clinic's browser (IndexedDB). Nothing is stored on the server.
- A patient's answers are sent to the proxy and on to the Claude API only to run the check, and are not logged or retained by this app.
- No cookies, no analytics, no accounts.
- If you run this under a clinic contract, treat it as a HIPAA business-associate setup: sign Anthropic's BAA in the Claude Console and use a HIPAA-eligible host plan. If patients use it on their own, Washington's My Health My Data Act and the FTC Health Breach Notification Rule apply to the operator — publish a consumer health data privacy policy before a public launch.

## Limits

- PDFs up to 4 MB and 100 pages per policy (split larger documents).
- The extraction is as good as the PDF: scanned images without text, or policies that defer to unlinked lists, will produce weaker cards. Spot-check the first card for each insurer against the PDF.
- Patient-specific copays are not available to an independent app (that requires a real-time benefit partnership). The tool shows plan rules and public price links, not a personal copay.
- Policies change. Re-drop a PDF when the insurer publishes a new version; the effective date on the card tells you which one you have.

## Roadmap

- Shared policy library across devices (clinic login) so patients can use a link from home.
- Automatic fetch of policies from insurer sites and versioning by effective date.
- Deterministic rule evaluation from the extracted card, with the model used only for extraction and explanation.
- Medicare Part D formulary flags from CMS public files, so the tool can say "no PA needed" without a PDF.
