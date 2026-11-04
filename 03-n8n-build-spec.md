# n8n build spec v2.1 — Off-Page SEO Link Prospector

**v2 changes (Fable review, 2026-07-14):** platform blocklist added; pipeline reordered (cheap filters BEFORE expensive page fetch); SERP snippet pre-filter; PageRank batched; cross-type verify; registered-domain dedup; rejected domains also logged to Seen Domains; batch sheet writes.

**v2.1 changes (live-tuning, 2026-07-14) — false-positive fixes:**
1. **Meta/listicle filter** (Flatten + Verify dono me): "How to find guest post sites", "List of 100+ sites", "Top 400 education blogs" type pages — jo guest posting ke BAARE ME hain, opportunities nahi — title/URL regex se reject (`META_RE`). Rejection signal: `META-LISTICLE`.
2. **Niche relevance check** (Verify me): niche ke word-stems (healthcare→"health", education→"educat") page HTML me min 3 baar milne chahiye (domain-match +3, title-match +2 bonus). Fail → reject with signal `OFF-NICHE(count)`. Isse off-topic sites (e.g. IT company with generic "write for us") katati hain, aur `.edu` domains pe bane spam "EDU guest post" paid-link pages bhi.
3. **Op note:** full runs hamesha FORM (production URL) se — editor ka "Test workflow" heavy runs pe cloud memory se crash ho sakta hai (exec #9 crashed).
Tested on real exec data: education run 117→94 qualified (23 removed sab genuinely junk); botster.io + techasoft.com junk URLs confirmed REJECTED.

**v2.2 changes (2026-07-14):**
1. **Blocklist +10 document/presentation platforms:** slideserve, prezi, academia.edu, researchgate, docplayer, studocu, coursehero, calameo, yumpu, pdfcoffee (listicles slide ke roop me chhupte hain).
2. **Quoted-title reject:** title me literal `"` quotes = query-stuffed SEO-spam page (e.g. `health "accepting guest posts"`) → reject.
3. **META_RE me additions:** "link building", "seo for/service/tips", "blogs that accept", "guest post service", "buy guest post".
4. **Country aliases (Query Builder):** america/USA/us → united states; england/britain → uk; dubai/emirates → uae; KSA/saudi → saudi arabia; pak/ind/aus/can. Naya country = CC map me ek line.
Tested vs healthcare run (exec10): exactly 4 borderline junk killed (slideserve, samaritaninfotech, chatterbuzzmedia, doctorsinternet), 46 solid kept.

**v2.3 changes (2026-07-14, n8n AI review ke baad — accepted points only):**
1. **Inverse-intent footprints DELETED:** `"this is a guest post by"`, `"guest post by"`, bare `"guest post"` — ye published articles dhoondte the, invitation pages nahi. (36 footprints bache)
2. **Chrome-strip in Verify:** `<header>/<nav>/<footer>/<script>/<style>` hata ke sirf main content scan hota hai — footer ke sitewide "Write for Us" link se random articles verify pass ho rahe the (biggest false-positive source). HTML 300KB cap (memory).
3. **Archive-URL reject:** `/tag/`, `/category/`, `/author/`, `/page/N`, `?page=` — Flatten + Verify dono me. Signal: `ARCHIVE-PAGE`.
4. **META_RE ab URL pe bhi** Verify me (pehle sirf title).
5. **FETCH-FAILED ≠ blacklist:** naya "Filter Blacklistable" node — fetch-fail hue domains Seen (Rejected) me NAHI jate, agle run me retry honge. Signals ab explicit: `FETCH-FAILED` vs `NO-SIGNAL`.
6. **POS phrases +4:** article submission, submission form, submission guidelines, author guidelines.
7. OPR error message ab credential ki taraf point karta hai (Config nahi).
**Rejected AI suggestions (context-blind):** Fetch/SERP error handling "missing" (pehle se laga hai — factually galat); Limit se pehle Seen-qualified record karna (beyond-cap prospects hamesha ke liye gum ho jate); niche gate title/URL-only (genuine generic write-for-us pages kat jate, exec10 me body-gate ne 10 sahi rejections kiye); footprint kam karna (coverage = tool ki value). **Deferred (post-demo):** Seen Domains → n8n Data Table migration; fetch/verify SplitInBatches loop; positional pairing → pairedItem refactor; all-evaluated-domains ledger.
Test vs exec10: 82 → 55 qualified; removed sab published-articles/archives/SEO-agency junk; healthcareexecutive.org + healthdisgroup.com jaise genuine pages recover kiye.

**v2.4–2.7 (2026-07-17, team-lead feedback):**
- OUTPUT = EXACTLY 3 columns: `country`, `domain`, `signal_matched` (Prep Results stripped; opportunity_url + task_id removed).
- `country` reflects target country (us/pk/uk) when specified, not 'global'.
- ARTICLE-PAGE reject: URL last-segment 3+ hyphens & no opportunity-keyword (killed published articles dsausa/naspa).
- SERVICE_RE domain reject: guest-post|link-build|backlink|seo-agency|seo-company|seo-service|digital-marketing|marketing-agency|outreach (killed guestposttracker, thedentalseocompany).
- Geo (country set): reject ANY 2-letter foreign ccTLD except neutral (com/org/net/io/co/ai/me/edu→see below/gov/tv) and target's ccTLD — fixed .au leak (old hardcoded FOREIGN_TLDS removed). Plus content geo-check (India/PK markers ≥3 → WRONG-GEO).
- **.edu/.gov/.mil BLOCKED** at Flatten (university/govt not guest-post targets — killed pacific.edu/colostate.edu).
- Directory type must be niche-branded (niche in domain/title) else GENERIC-DIRECTORY (killed yext/synup).
- Niche AND-logic + **primary-word-dominant gate**: primary niche stem must be in domain/title OR appear ≥4× in body (else OFF-NICHE-WEAK) — stops incidental mentions (scispace-type). Multi-word niche: all stems must be present.
- Removed low-precision POS phrase "become an author" (matched writing sites).
- Blocklist += listing-SaaS/tools (yext, synup, chewy, brightlocal, birdeye, moz, semrush, ahrefs, yelp, trustpilot, g2, capterra, clutch).

**Sheet reset:** built a TEMP webhook workflow with 3 Google Sheets `clear`(specificRange A2:Z100000, headers preserved) nodes, ran it, deleted it — Tasks/Results/Seen Domains reset so task_id restarts at 1.

**Fresh run exec20 (dental/usa, task 1):** 20 results, 3-col, all us. ~14 solid dental authorities (ada.org/dentaltown/dentaleconomics/rdhmag/dental-tribune), ~6 borderline (nature.com/scispace/generic .co) needing light human QA. No .edu/.au/service/writing-site junk. Realistic precision ~70-75% on free tier — final tightening cuts genuine sites (e.g. rdhmag has no 'dental' in domain), so a 2-min human QA pass is expected.

Ye node-by-node blueprint hai. Placeholders `<<SERPER_KEY>>` / `<<OPR_KEY>>` n8n Credentials me daalna — chat/file-share me kabhi paste mat karna.

Free tools: **Serper.dev** (discovery), **Open PageRank** (authority), **Google Sheets** (storage).

**Pipeline order (v2):** input → task id → footprints → queries → SERP → flatten + blocklist + snippet pre-filter → dedup → PageRank batch + spam score → page fetch + verify (sirf survivors) → limit → write.

> Kyun ye order: page fetch sabse slow/failure-prone step hai (timeouts, bot-blocks). PageRank 1 call me 100 domains de deta hai. Sasta filter pehle → fetch sirf ~150-200 pe chalega, ~700 pe nahi. Run 3-4x faster.

---

## Node 0 — Form Trigger
- Node: **n8n Form Trigger**
- Fields: `niche` (text, required), `country` (text, optional), `target_count` (number, default 50)
- ⚠️ Form URL public hota hai — production me Basic Auth lagana ya URL team tak hi rakhna.
- Note team ke liye: `target_count` ek **cap** hai, guarantee nahi. Ek run me qualified 30 bhi aa sakte hain. Aur chahiye → dobara run karo, dedup ki wajah se hamesha naye hi milenge.

## Node 1 — Get / Assign Task ID
- **Google Sheets → Read rows** (Tab `Tasks`) → last `task_id`.
- **Code node:**

```js
const rows = $input.all();
const lastId = rows.length ? Math.max(...rows.map(r => Number(r.json.task_id) || 0)) : 0;
const trigger = $('Form Trigger').first().json;
const country = (trigger.country || '').trim();
return [{ json: {
  task_id: lastId + 1,
  niche: trigger.niche.trim(),
  country,
  mode: country ? 'country-specific' : 'local+global',
  target_count: Number(trigger.target_count) || 50,
  date_created: new Date().toISOString()
}}];
```
→ Google Sheets **Append** to `Tasks` (status `running`).

## Node 2 — Load Footprint Library
```js
const footprints = [ /* paste 01-footprint-library.json here */ ];
return footprints.filter(f => f.enabled).map(f => ({ json: f }));
```

## Node 3 — Query Builder
```js
const task = $('Assign Task ID').first().json;
const footprints = $input.all().map(i => i.json);
const niche = task.niche;

const CC = {
  pakistan:{gl:'pk',tld:'.pk'}, india:{gl:'in',tld:'.in'}, 'united states':{gl:'us',tld:'.com'},
  uk:{gl:'uk',tld:'.co.uk'}, 'united kingdom':{gl:'uk',tld:'.co.uk'}, canada:{gl:'ca',tld:'.ca'},
  australia:{gl:'au',tld:'.com.au'}, uae:{gl:'ae',tld:'.ae'}, 'saudi arabia':{gl:'sa',tld:'.sa'}
};
const cc = CC[(task.country || '').toLowerCase()] || null;

const out = [];
for (const f of footprints) {
  const base = `${niche} ${f.pattern}`;
  if (cc) {
    out.push({ query: base, gl: cc.gl, hl: 'en', type: f.type, footprint: f.pattern });
    out.push({ query: `${base} site:${cc.tld}`, gl: cc.gl, hl: 'en', type: f.type, footprint: f.pattern });
  } else {
    out.push({ query: base, gl: 'us', hl: 'en', type: f.type, footprint: f.pattern });
  }
}
return out.map(q => ({ json: { ...q, task_id: task.task_id } }));
```

## Node 4 — SERP Discovery (Serper.dev)
- **HTTP Request** (loop; Retry on fail ON; ~1s interval)
  - `POST https://google.serper.dev/search`
  - Headers: `X-API-KEY: <<SERPER_KEY>>`, `Content-Type: application/json`
  - Body: `{ "q": "={{ $json.query }}", "gl": "={{ $json.gl }}", "hl": "={{ $json.hl }}", "num": 10 }`

## Node 5 — Flatten + Blocklist + Snippet Pre-filter  🆕
Teen kaam ek Code node me: (a) organic results flatten, (b) **platform blocklist** — Medium/LinkedIn/Quora waghera ke high-PR platform pages nikalo (ye verify bhi pass kar jate hain, isliye PEHLE katna zaroori), (c) **snippet pre-filter** — Google ka title/snippet free signal hai; jis result ke title/snippet/URL me koi contribution hint hi nahi, usse fetch pe mat bhejo.

```js
const BLOCKED = ['medium.com','linkedin.com','facebook.com','youtube.com','quora.com','reddit.com',
  'pinterest.com','twitter.com','x.com','instagram.com','tiktok.com','blogspot.com','wordpress.com',
  'wix.com','weebly.com','tumblr.com','substack.com','fiverr.com','upwork.com','amazon.com',
  'wikipedia.org','slideshare.net','issuu.com','scribd.com','github.com','apple.com','google.com'];

const HINTS = ['write for us','guest post','guest article','contributor','contribute','submit',
  'add your','write-for-us','guest-post','add-listing','submit-site','become an author','editorial guidelines'];

// registered domain nikaalo: sub.example.co.uk → example.co.uk, blog.example.com → example.com
function regDomain(hostname) {
  const h = hostname.replace(/^www\./,'');
  const parts = h.split('.');
  if (parts.length <= 2) return h;
  const sld = ['co','com','org','net','ac','gov','edu'];
  return sld.includes(parts[parts.length-2]) ? parts.slice(-3).join('.') : parts.slice(-2).join('.');
}

const items = [];
for (const res of $input.all()) {
  const meta = res.json;
  for (const o of (meta.organic || [])) {
    let host; try { host = new URL(o.link).hostname; } catch { continue; }
    const domain = regDomain(host);
    if (BLOCKED.some(b => domain === b || domain.endsWith('.' + b))) continue;
    const hay = `${o.title||''} ${o.snippet||''} ${o.link}`.toLowerCase();
    if (!HINTS.some(hint => hay.includes(hint))) continue;   // snippet pre-filter
    items.push({ json: {
      task_id: meta.task_id, domain,
      opportunity_url: o.link, title: o.title || '', snippet: o.snippet || '',
      type: meta.type, footprint_matched: meta.footprint
    }});
  }
}
return items;
```

## Node 6 — Dedup (registered domain pe)
- **Google Sheets → Read** `Seen Domains` (qualified + rejected dono skip honge).

```js
const seen = new Set($('Read Seen Domains').all().map(r => (r.json.domain||'').toLowerCase()));
const out = []; const runSeen = new Set();
for (const it of $input.all()) {
  const d = it.json.domain.toLowerCase();
  if (seen.has(d) || runSeen.has(d)) continue;
  runSeen.add(d); out.push(it);
}
return out;
```

## Node 7 — Authority batch (Open PageRank) + Spam Scorecard  🆕 (fetch se PEHLE)
> ⚠️ **API UPDATE (2026-07):** Open PageRank ab Keywords Everywhere ke under hai. Purana `openpagerank.com` endpoint dead hai — har key ko "Invalid" bolta hai. Naya API:
> - `POST https://openpagerank.keywordseverywhere.com/v1/domains/bulk`
> - Header: `Authorization: Bearer opr_live_...` (key format `opr_live_` + 40 chars)
> - Body: `{ "domains": ["a.com", ...], "include_history": false }` (max 100/request)
> - Response: `{ "results": [{ "domain", "found", "open_page_rank" (0-10), "rank", "referring_domains" }] }`
> - Free tier: 60 req/min; monthly domain quota headers `X-Domains-Remaining`
> - Bonus signal: `referring_domains` — future quality column ke liye available

- **Code node** — domains ko 100-100 ke batches me todo (`{domains: [...]}` items) → **HTTP Request** per batch (upar wala naya endpoint).
- Merge karke scorecard (`results[].open_page_rank` se, round karke 0-10 int):

```js
// after merging page_rank_integer back onto items as page_rank
const badTlds = ['.xyz','.top','.loan','.club','.click','.gq','.tk','.ml','.cf','.ga'];
const adult   = ['casino','porn','xxx','viagra','escort','gambling','betting'];
return $input.all().map(it => {
  const d = it.json.domain.toLowerCase();
  const url = (it.json.opportunity_url||'').toLowerCase();
  const pr = Number(it.json.page_rank) || 0;
  let s = 0;
  if (badTlds.some(t => d.endsWith(t))) s += 40;
  if (!url.startsWith('https')) s += 20;
  if (adult.some(w => d.includes(w) || url.includes(w))) s += 60;
  const spam_score = Math.min(s, 100);
  const tld = '.' + d.split('.').pop();
  const ccMap = {'.pk':'pk','.in':'in','.uk':'uk','.ca':'ca','.au':'au','.ae':'ae'};
  return { json: { ...it.json, spam_score, page_rank: pr,
    country: ccMap[tld] || 'global',
    passed: spam_score < 50 && pr >= 2 } };
}).filter(x => x.json.passed);
```
> `pr >= 2` threshold pehli runs me dekhna — agar achhi chhoti niche sites cut ho rahi hon to 1 kar dena.

## Node 8 — Page Fetch + Verify Contribution ⭐ (sirf survivors pe)
- **HTTP Request** — GET `={{ $json.opportunity_url }}` (Response: String; Continue on Fail ON; timeout 15s; header `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)`).
- **Code node** — cross-type check: dono positive lists check karo, jo match kare wahi final type:

```js
const POS = {
  guest_post: ['write for us','write for our','guest post','submit a guest post','guest contributor',
    'become a contributor','contributor guidelines','submit an article','guest author','accepting guest',
    'guest posting','submit your post','editorial guidelines','become an author'],
  directory: ['add your business','submit your site','add your listing','add url','submit url',
    'add your site','submit your website','suggest a site','add your company']
};
const NEG = ['no longer accepting','submissions are closed','guest posts are closed',
  'we are not accepting','currently closed','not accepting guest','closed for submissions'];

return $input.all().map(it => {
  const html = String(it.json.body || it.json.data || '').toLowerCase();
  if (!html) return { json: { ...it.json, verified: 'no', signal_matched: '' } };
  if (NEG.some(n => html.includes(n))) return { json: { ...it.json, verified: 'no', signal_matched: 'CLOSED' } };
  for (const [type, phrases] of Object.entries(POS)) {
    const m = phrases.find(p => html.includes(p));
    if (m) return { json: { ...it.json, type, verified: 'yes', signal_matched: m } };
  }
  return { json: { ...it.json, verified: 'no', signal_matched: '' } };
});
// NOTE: filter mat karo yahan — rejected bhi Seen Domains me likhne hain (Node 10)
```

## Node 9 — Split + Limit
- **IF node**: `verified == 'yes'` → qualified branch; else → rejected branch.
- Qualified branch pe **Limit** node → `target_count`.

## Node 10 — Write (batch)
- Qualified → **Google Sheets Append** `Results` (ek batch call, row-by-row nahi).
- Qualified + Rejected dono → **Append** `Seen Domains` (`status` = qualified/rejected).
- **Update** `Tasks`: `status=done`, `results_found=count`.
- Order: pehle Seen Domains + Results, aakhri me status=done (crash-safety).

---

## Reliability notes
1. **SERP quota:** ~39 footprints × 1-2 passes ≈ 40-80 queries/run → Serper 2500 free ≈ 30-60 runs. Fallback: Google CSE (100/day).
2. **Fetch failures** = auto-reject (safe) + Seen me status=rejected, to dobara try nahi hoga. Agar koi achha domain block kar raha ho to manually Results me daal sakte ho.
3. **Blocklist maintain karo** — naya platform kachra dikhe to list me add karo (Node 5).
4. **Error branch:** workflow error hone pe `Tasks.notes` me error likho, status `error` karo — warna task `running` phasa rahega.
5. **Sheets quota:** batch appends use ho rahe hain; per-row append mat karna.
