# PsyDigiHealth — Information Security, Personal Data and Research Ethics Framework

**A condensed governance account of how personal data is minimised, protected and audited in a bilingual well-being assessment platform.**

Document class: Controlled — Internal / Ethics Submission · Version 2.0 · PsyDigiHealth · Deployment: Supabase / PostgreSQL

---

## 1. Purpose, Scope and Method

PsyDigiHealth is a private, invitation-only web platform that administers validated psychological and behavioural self-report instruments to enrolled participants and aggregates the results for well-being research and support programming. It is operated by a single authorised research team; it is not a public service and is not open to self-registration.

Because the platform records data about mental state — well-being, empathy, compulsive internet use, personality traits, mood, hopelessness and anger — it handles the most ethically demanding class of personal information a civilian research system can hold. Any perception that a participant's disclosure of distress could be attributed back to them would not merely be a privacy failure; it would invalidate the science by systematically suppressing honest response.

This document states (a) precisely what personal data the platform does and does not process, (b) how its controls map onto the statutory, ethical and technical frameworks that govern such processing, and (c) the residual risks that remain after those controls, with the remediation an ethics committee should require.

Claims marked **Implemented** are traceable to a named artefact in the deployed codebase — a migration, a row-level security policy, or an edge function — so that an auditor can verify them independently. Claims marked **Required** describe controls that are absent or partial at the time of writing. A governance document that cannot distinguish its aspirations from its implementation is of no use to a committee.

---

## 2. Architecture and Trust Boundaries

Security is not delegated to a single layer. The architecture assumes the client is fully hostile — that an adversary controls the browser, can read all application source, can extract the publishable API key embedded in it, and can issue arbitrary requests directly to the database endpoint. Under that assumption, **no control enforced only in the interface is a control at all.** Authorisation is enforced in the database; every participant-facing read and write is enforced in a server-side function the client cannot bypass.

**Database principals.** Three exist, with strictly nested capabilities expressed in SQL grants rather than application logic:

| Principal | How obtained | Capability | Explicit denial |
|---|---|---|---|
| `anon` | Publishable key shipped in the client bundle | `SELECT` on published instrument content only | No read of any response data; no access to participant tables |
| `authenticated` | A valid session | Substantive access gated on the `super_admin` role, not on mere authentication | Without `super_admin`, cannot read responses or audit logs |
| `service_role` | Secret held only in the edge-function environment | Full access; bypasses RLS | Never transmitted to a browser; absent from the deployed bundle |

**Participants are not database principals.** A participant holds no account, no password and no database grant. Access is by a private, single-purpose link confirmed against the participant's own phone number; the platform then issues a short-lived, hashed session token. Every participant read and write travels through the `family-access` edge function running as `service_role`, which resolves that token to exactly one case and scopes every query to it. "A participant can only ever see their own assessment" is therefore a structural property, not a policy.

**The single write path.** An early revision allowed anonymous clients to `INSERT` directly into the response tables under a policy that merely checked the instrument was published. That design was indefensible: an unauthenticated, unbounded, unthrottled public write endpoint against tables storing mental-health data. Those grants and policies were revoked (`20260714150000_analytics_and_hardening.sql`). Every submission now traverses a server-side function — the single point at which validation, bounding and rate-limiting can be enforced with no possibility of client-side circumvention. This is a textbook application of complete mediation (Saltzer & Schroeder, 1975): the check cannot be avoided because there is no second route to the resource.

---

## 3. Data Inventory and Minimisation

**What is recorded with a response:** a random UUID primary key; the instrument reference; the language of administration; start and submission timestamps; a truncated user-agent string; a hash of the client IP address (rate-limiting only); and the answer values themselves.

**What the platform deliberately does not collect** — minimisation is demonstrated more persuasively by absence than by policy:

- Any employer, organisational, service or membership identifier
- Date of birth, exact age, or any national identity number (Aadhaar, PAN, licence)
- Precise geolocation (the browser geolocation API is never invoked)
- Raw IP address — hashed at the edge; the plaintext is never persisted
- Third-party analytics, advertising pixels or cross-site tracking

Administrative contact details (name, phone, district) are held **only** for the small number of authorised operators, confined by row-level policy. The platform's confidentiality claim attaches to participants; conflating the two would be misleading.

**Sensitive classification.** Items eliciting mood, hopelessness or distress are "mental health condition" data — expressly enumerated as sensitive personal data under the SPDI Rules 2011 Rule 3, and a special category under GDPR Article 9(1), processed under the scientific-research derogation at Article 9(2)(j) with Article 89(1) safeguards.

**Pseudonymisation, stated exactly.** The IP hash is *pseudonymisation, not anonymisation*. The IPv4 space is smaller than 2³²; an adversary holding the hash column can compute every possible digest in hours and invert the mapping completely. The hash removes the address from ordinary view — a genuine gain — but because the transform is unkeyed it offers obscurity, not cryptographic protection. **Required (A-1):** replace with a keyed HMAC-SHA-256 under a rotated secret, truncated, which preserves the rate limiter exactly while making the pseudonym genuinely non-reversible.

---

## 4. Frameworks Applied

- **Digital Personal Data Protection Act, 2023** — processing rests on free, specific, informed consent captured before any item is presented, for a narrowly stated purpose. §8(7) (erasure) is the obligation least well served; see A-4.
- **IT Act, 2000 §43A and SPDI Rules, 2011** — Rule 8 names ISO/IEC 27001 as evidence of reasonable security practice; alignment below is the route by which the statutory reasonableness test is evidenced.
- **ICMR National Ethical Guidelines, 2017** — voluntariness (no incentive, no penalty), non-exploitation, confidentiality by architecture, and risk minimisation.
- **Declaration of Helsinki; Belmont Report** — respect for persons (voluntary, comprehending consent in the participant's own language), beneficence, and justice, which the bilingual and low-literacy-tolerant delivery addresses directly.
- **ISO/IEC 27001:2022** (A.5.15, A.5.18, A.8.2, A.8.3, A.8.24, A.8.28), **ISO/IEC 27701**, **NIST CSF 2.0**, **OWASP ASVS 4.0.3**.
- **GDPR** is applied as a benchmark rather than as binding law; demonstrating alignment with Articles 5, 9, 25, 32 and 89 substantially exceeds the domestic requirement.

**Privacy by Design** is not a configuration here. The central design decision — that participants hold no accounts — simultaneously produced the usability advantage and the privacy guarantee.

---

## 5. Technical and Organisational Controls

**Identity and authorisation.** Credentials are salted-bcrypt hashed by the auth provider; the application never handles a plaintext password. Authorisation is deliberately decoupled from authentication: role membership lives in a dedicated `user_roles` table, not a column on a profile or a JWT claim, so privilege cannot be escalated by a user editing their own row — a defect class responsible for repeated real-world breaches. Role checks run through a `SECURITY DEFINER` function pinning `search_path` to defeat schema-shadowing. Public sign-up is disabled; elevation is a deliberate act by an existing administrator.

**Row-level security is the authoritative control.** Every table in the public schema has RLS enabled. Read access to response data is confined to a single predicate: the caller holds `super_admin`. An adversary who extracts the publishable key and queries the response tables directly receives an empty set — not an error that would confirm the data exists, but nothing. Participant tables revoke `anon` and `authenticated` entirely.

**The submission boundary.** Because the edge function bypasses RLS, its input handling carries the full weight of the trust boundary. It treats the payload as hostile: request size is rejected above a fixed ceiling before parsing; the instrument must exist and be published; answer counts are capped; timestamps must fall within a plausible window; every question identifier is intersected against the set actually belonging to that instrument; and values are bounded by type. Failures return a uniform generic message, with the underlying exception logged server-side only, so error text cannot be used to enumerate schema.

**Abuse resistance protects scientific validity, not merely availability** — an automated flood of fabricated responses would silently bias every distribution the study reports. Check-and-increment happens inside a single database function holding a transaction-scoped advisory lock, eliminating the time-of-check/time-of-use window that defeats naive limiters. Participant sign-in is separately throttled per case and per network origin, with lockout after repeated failures.

**Audit.** Administrative actions are recorded with actor, action, entity and metadata. The policy set is asymmetric by design: an actor may insert only entries attributed to themselves, and only an administrator may read. Participant activity is deliberately **not** logged per-person — a per-participant audit trail would reintroduce exactly the linkage the architecture exists to prevent. This is a considered trade of forensic capability for privacy, and it is the correct trade here.

**AI-assisted instrument import.** The only transfer to a third-party processor. What is transmitted: instrument text extracted from an administrator-supplied PDF. What is never transmitted: no participant answer, no response row, no IP hash, no administrator data. The function cannot write to the database — its output must pass a human review screen before anything is persisted, so a model error cannot silently enter an instrument. **Required (A-7):** record the provider's data-processing terms and disable the feature for any instrument whose licence restricts third-party transmission.

**Export controls.** Export is available only to an authenticated administrator, and the exported shape is materially narrower than the stored row: it carries timestamp, language and answers, and carries neither the IP hash nor the user-agent. The two most re-identifying attributes are structurally excluded from the artefact most likely to be copied to a laptop or retained after the study closes.

---

## 6. Measurement Ethics

The platform encodes validated instruments (WHO-5, IRI, CIUS, PID-5-BF, BDI, trait anger, hopelessness and impulsiveness items). Response anchors are reproduced verbatim rather than flattened into a shared agreement scale; subscale labels are hidden from participants, because a visible construct heading cues the answer and inflates response consistency; reverse-scored items are carried in metadata so scoring stays auditable.

**Screening is not diagnosis.** No individual score, risk band or interpretive statement is ever returned to a participant. Reporting is aggregate. An automated "you appear to be depressed" message delivered with no clinician attached, no history and no follow-up is capable of causing harm and incapable of providing care.

**Duty of care — the highest-priority action.** Where modules touch suicidality or severe distress, a participant may disclose ideation that the platform's confidentiality makes it structurally unable to follow up. This is not an argument against confidentiality — identified collection would suppress precisely the disclosures that matter most — but it obliges a compensating control. **Required (A-2):** before any such module is published, the instrument must display **unconditional, always-visible** crisis resources (Tele-MANAS 14416; KIRAN 1800-599-0019; the study's own counselling contact), shown to every participant regardless of their answers. Universal presentation is essential: a panel that appears only after a high-risk answer is itself a disclosure signal to anyone who can see the screen.

**Translation.** Item prompts carry Telugu where a responsible translation exists and fall back to English otherwise; the platform does not fabricate clinical Telugu. A mistranslated clinical item silently measures a different construct, and no downstream statistic can detect it. **Required (A-8):** certify any Telugu instrument text used for scored analysis through documented forward–backward translation, and test measurement invariance across language groups before pooling.

**Licensing.** Status differs per instrument and must be established in writing before publication of results **(A-9)**.

---

## 7. Consent, Residual Risk and Required Actions

**Consent is a gate, not a notice.** No item is rendered until the participant affirmatively agrees — a distinct action, not a pre-ticked box and not an inference from continued use. Four disclosures are presented in both languages: participation is voluntary and may stop at any time; answers are confidential and stored securely; answers are used only for well-being research and support; and there are no right or wrong answers.

**The withdrawal paradox, stated honestly.** Before submission, withdrawal is complete and costless. After submission the platform cannot resolve which stored response belongs to a requester, so erasure is not refused — it is impossible. This is a recognised consequence of confidential research design, but it is material information a person needs *before* they answer. **Required (A-3):** state it explicitly, in both languages, on the consent screen.

### Risk register and required actions

| # | Risk | Residual after controls | Required action |
|---|---|---|---|
| R1 | Direct read of response data via the public key | **Low** — RLS returns an empty set | — |
| R2 | Reversal of the IP hash | **Medium** — unsalted digest is invertible | **A-1** keyed HMAC + rotation |
| R3 | Re-identification by timestamp correlation | **Medium** | **A-10** round timestamps in exports |
| R4 | Self-identification in free-text answers | **Medium** | **A-11** screen free text before analysis |
| R5 | Device fingerprinting via retained user-agent | **Low-Med** | **A-12** drop the column; no current purpose |
| R6 | Recovery of a partial draft on a shared device | **Medium** | **A-5** add an explicit "clear my answers" control |
| R7 | Corpus corruption by mass automated submission | **Low** — atomic limiter | — |
| R8 | Small-cell disclosure in published subgroup findings | **Medium** | **A-13** suppress cells below a minimum count |

**Priority order:** A-2 (crisis resources) before any distress module is published; then A-1, A-3 and A-4 (a defined retention period with an automated job, for DPDP §8(7)); then the remainder.

**Limitation.** Conclusions on statistical disclosure risk are analytical rather than empirical: no production response corpus was available for re-identification testing at the time of assessment.

---

*PsyDigiHealth · Controlled document · Version 2.0*
