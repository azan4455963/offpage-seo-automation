# Google Sheet schema — "Off-Page SEO Prospector"

Ek Google Sheet banao with **3 tabs** (exact names, exact column order — first row = header).

---

## Tab 1: `Tasks`
Har run ek row. Ye aap ka control + log hai.

| Column | Example | Kaun bharta hai |
|--------|---------|-----------------|
| `task_id` | 1 | workflow (auto-increment) |
| `niche` | education | aap (form) |
| `country` | *(blank)* / Pakistan | aap (form) |
| `mode` | local+global / local | workflow (country se derive) |
| `target_count` | 50 | aap (form, default 50) |
| `date_created` | 2026-07-14 10:30 | workflow |
| `status` | pending → running → done | workflow |
| `results_found` | 50 | workflow (end pe) |
| `notes` | — | workflow (errors/quota) |

---

## Tab 2: `Results`
Har qualified prospect ek row. Yahi aap ki asli deliverable hai — team ko yahi dikhega.

| Column | Example | Matlab |
|--------|---------|--------|
| `task_id` | 1 | kis task ka result |
| `domain` | example.com | root domain |
| `opportunity_url` | example.com/write-for-us | exact page jahan link add karna hai |
| `type` | guest_post / directory | opportunity ki type |
| `footprint_matched` | "write for us" | kaunse footprint se mila |
| `signal_matched` | "submit a guest post" | page pe verify hone wala phrase |
| `country` | pk / us | detected (TLD ya gl) |
| `page_rank` | 4 | Open PageRank 0-10 (authority) |
| `spam_score` | 10 | 0-100 (low = accha) |
| `verified` | yes | contribution filter pass |
| `title` | Write For Us - Example | page title |
| `date_found` | 2026-07-14 | — |

---

## Tab 3: `Seen Domains`
Dedup ka master. Workflow yahan se padhta hai (skip already-found) aur naye domains yahan likhta hai. **Ye tab uniqueness guarantee karta hai** — isse chhedna mat.

**Qualified AUR rejected dono domains yahan jate hain** — taake fail hua domain agle run me dobara fetch/process na ho (warna har run wahi kachra dobara check hota rahega).

| Column | Example |
|--------|---------|
| `domain` | example.com |
| `first_task_id` | 1 |
| `first_seen_date` | 2026-07-14 |
| `status` | qualified / rejected |

---

### Notes
- Header row bilkul isi spelling/case me rakho — n8n Google Sheets node column names se match karta hai.
- `Tasks` aur `Seen Domains` initially khaali (sirf header). `task_id` 1 se start.
- Sheet ko n8n ke Google account ke saath share/owned rakho jise credential me use karoge.
