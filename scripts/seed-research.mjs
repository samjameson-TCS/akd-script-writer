import { readFileSync } from "fs";
import { createConnection } from "mysql2/promise";
import { config } from "dotenv";

config({ path: ".env" });

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL not set");

const docs = [
  {
    lawsuitKey: "Hernia Mesh",
    title: "Hernia Mesh Mass-Tort Digital Acquisition Marketing Brief",
    file: "/home/ubuntu/upload/DR_HM.md",
    summary: "Hernia mesh litigation (MDL 2846/3029/2753/2782). Key complications: pain, infection, recurrence, adhesions, mesh migration/shrinkage. 23,695 Bard/Davol actions pending. Targets: revision surgery patients, chronic pain patients, caregivers. Key manufacturers: Bard/Davol, Covidien/Medtronic, Atrium C-Qur, Ethicon Physiomesh. SOL: 2-4 years depending on state. FDA adverse event reports >55,000.",
  },
  {
    lawsuitKey: "PowerPort",
    title: "PowerPort (Bard/BD) MDL 3081 Marketing Brief",
    file: "/home/ubuntu/upload/DR_PP.md",
    summary: "PowerPort implantable port catheter litigation (MDL 3081, D. Arizona). Allegations: barium sulfate concentration too high in catheter material causes fracture, migration, infection, thrombosis. 2,828 actions pending (March 2026). First bellwether trial (Cook) April 21, 2026. Targets: cancer patients who had chemo port, IV therapy patients, wrongful death families. Defendants: Becton Dickinson, C.R. Bard.",
  },
  {
    lawsuitKey: "NY Juvenile Detention",
    title: "New York Juvenile Detention Abuse Lawsuit Research Brief",
    file: "/home/ubuntu/upload/DR_NY.md",
    summary: "NYC juvenile detention sexual abuse litigation. Facilities: Horizon (Bronx), Crossroads (Brooklyn), Spofford/Bridges. New 18-month filing window opened January 29, 2026 under NYC Admin Code §10-1104.1 (deadline ~July 29, 2027). 539+ cases filed. 450+ previously dismissed cases can be refiled. Targets: former detainees (now adults), families. Defendants: City of New York, ACS, DOC.",
  },
  {
    lawsuitKey: "Depo-Provera",
    title: "Depo-Provera Meningioma Lawsuit Marketing Brief",
    file: "/home/ubuntu/upload/DR_DEPO.md",
    summary: "Depo-Provera (DMPA injection) linked to intracranial meningioma (brain tumor). MDL 3140, N.D. Florida. FDA added meningioma warning to label December 2025. Key studies: BMJ 2024 (French population study), JAMA Neurology 2025 (US study). Targets: women who used Depo-Provera ≥1 year and were diagnosed with meningioma. Defendants: Pfizer/Pharmacia. High-value cases involve surgery (craniotomy), radiation, neurologic deficits.",
  },
  {
    lawsuitKey: "Social Media Addiction",
    title: "Social Media Addiction Lawsuit Marketing Brief",
    file: "/home/ubuntu/upload/DR_SMA.md",
    summary: "Social media addiction litigation (MDL 3047, N.D. California). Defendants: Meta/Instagram, Snap, TikTok/ByteDance, Google/YouTube. First US jury trial (K.G.M.) underway in LA March 2026; TikTok and Snap settled pre-trial. Targets: parents of minors (10-17 at exposure) with eating disorders, self-harm, suicide attempts, depression. Claims: defective design, addictive mechanics, failure to protect minors. Section 230 defense is central issue.",
  },
  {
    lawsuitKey: "Illinois Juvenile Detention",
    title: "ILM Illinois Institutional Abuse Claims Marketing Brief",
    file: "/home/ubuntu/upload/DR_ILM.md",
    summary: "Illinois juvenile detention and institutional abuse litigation. Two tracks: (A) Illinois Youth Centers (IYCs) and Cook County JTDC sexual abuse by staff (900+ cases filed by mid-2025); (B) Illinois developmental disability centers (Choate, Shapiro, Mabley) — DOJ investigation opened March 2025. BJS data: Illinois 13.7% staff sexual misconduct rate. Targets: adults who were held as minors in IL juvenile facilities 1995-2022. Statute: 735 ILCS 5/13-202.2 (amended 1-1-26).",
  },
];

async function seed() {
  const conn = await createConnection(DB_URL);
  console.log("Connected to DB");

  for (const doc of docs) {
    const content = readFileSync(doc.file, "utf-8");
    await conn.execute(
      `INSERT INTO research_docs (lawsuitKey, title, content, summary)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content), summary = VALUES(summary), updatedAt = NOW()`,
      [doc.lawsuitKey, doc.title, content, doc.summary]
    );
    console.log(`✓ Seeded: ${doc.lawsuitKey}`);
  }

  await conn.end();
  console.log("Done.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
