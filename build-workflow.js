// Builds the n8n workflow JSON for the Off-Page SEO Link Prospector (v2 spec)
// Run: node build-workflow.js  → writes workflow.json
const fs = require('fs');

// ---------- Code node sources ----------

const CONFIG_CODE = `return [{ json: {
  sheetId: 'REPLACE_WITH_SHEET_ID',
  serperKey: 'REPLACE_WITH_SERPER_KEY',
  oprKey: 'REPLACE_WITH_OPENPAGERANK_KEY'
} }];`;

const ASSIGN_TASK_CODE = `const rows = $input.all();
const lastId = rows.length ? Math.max(0, ...rows.map(r => Number(r.json.task_id) || 0)) : 0;
const t = $('On form submission').first().json;
const country = String(t.country || '').trim();
return [{ json: {
  task_id: lastId + 1,
  niche: String(t.niche || '').trim(),
  country,
  mode: country ? 'country-specific' : 'local+global',
  target_count: Number(t.target_count) || 50,
  date_created: new Date().toISOString().slice(0, 16).replace('T', ' ')
} }];`;

const FOOTPRINTS_CODE = `// [pattern, type] — enabled footprints (v2 library)
const F = [
  ['"write for us"','guest_post'],
  ['"write for us" "guest post"','guest_post'],
  ['"guest post"','guest_post'],
  ['"guest post guidelines"','guest_post'],
  ['"submit a guest post"','guest_post'],
  ['"become a contributor"','guest_post'],
  ['"become a guest blogger"','guest_post'],
  ['"contribute to our site"','guest_post'],
  ['"guest article"','guest_post'],
  ['"guest column"','guest_post'],
  ['"accepting guest posts"','guest_post'],
  ['"want to write for us"','guest_post'],
  ['"submit an article"','guest_post'],
  ['"submit your post"','guest_post'],
  ['"guest bloggers wanted"','guest_post'],
  ['"this is a guest post by"','guest_post'],
  ['"guest post by"','guest_post'],
  ['"articles wanted"','guest_post'],
  ['"submit blog post"','guest_post'],
  ['"become an author"','guest_post'],
  ['inurl:write-for-us','guest_post'],
  ['inurl:guest-post','guest_post'],
  ['inurl:guest-posts','guest_post'],
  ['inurl:contribute','guest_post'],
  ['intitle:"write for us"','guest_post'],
  ['"editorial guidelines" "submit"','guest_post'],
  ['"guest posting guidelines"','guest_post'],
  ['"add guest post"','guest_post'],
  ['"submit your site"','directory'],
  ['"submit url"','directory'],
  ['"add your business"','directory'],
  ['"add your listing"','directory'],
  ['"add your site"','directory'],
  ['"suggest a site"','directory'],
  ['"add url"','directory'],
  ['"submit your website"','directory'],
  ['inurl:submit-site','directory'],
  ['inurl:add-listing','directory'],
  ['"directory" "add your business"','directory']
];
return F.map(f => ({ json: { pattern: f[0], type: f[1] } }));`;

const QUERY_BUILDER_CODE = `const task = $('Assign Task ID').first().json;
const footprints = $input.all().map(i => i.json);
const niche = task.niche;

const CC = {
  pakistan: { gl: 'pk', tld: '.pk' }, india: { gl: 'in', tld: '.in' },
  'united states': { gl: 'us', tld: '.com' }, usa: { gl: 'us', tld: '.com' },
  uk: { gl: 'uk', tld: '.co.uk' }, 'united kingdom': { gl: 'uk', tld: '.co.uk' },
  canada: { gl: 'ca', tld: '.ca' }, australia: { gl: 'au', tld: '.com.au' },
  uae: { gl: 'ae', tld: '.ae' }, 'saudi arabia': { gl: 'sa', tld: '.sa' }
};
const cc = CC[(task.country || '').toLowerCase()] || null;

const out = [];
for (const f of footprints) {
  const base = niche + ' ' + f.pattern;
  if (cc) {
    out.push({ query: base, gl: cc.gl, hl: 'en', type: f.type, footprint: f.pattern });
    out.push({ query: base + ' site:' + cc.tld, gl: cc.gl, hl: 'en', type: f.type, footprint: f.pattern });
  } else {
    out.push({ query: base, gl: 'us', hl: 'en', type: f.type, footprint: f.pattern });
  }
}
return out.map(q => ({ json: { ...q, task_id: task.task_id } }));`;

const FLATTEN_CODE = `const BLOCKED = ['medium.com','linkedin.com','facebook.com','youtube.com','quora.com','reddit.com',
  'pinterest.com','twitter.com','x.com','instagram.com','tiktok.com','blogspot.com','wordpress.com',
  'wix.com','weebly.com','tumblr.com','substack.com','fiverr.com','upwork.com','amazon.com',
  'wikipedia.org','slideshare.net','issuu.com','scribd.com','github.com','apple.com','google.com'];

const HINTS = ['write for us','guest post','guest article','contributor','contribute','submit',
  'add your','write-for-us','guest-post','add-listing','submit-site','become an author','editorial guidelines'];

function hostOf(link) {
  const m = String(link || '').match(/^https?:\\/\\/([^\\/?#]+)/i);
  return m ? m[1].toLowerCase().split(':')[0] : null;
}
function regDomain(hostname) {
  const h = hostname.replace(/^www\\./, '');
  const parts = h.split('.');
  if (parts.length <= 2) return h;
  const sld = ['co', 'com', 'org', 'net', 'ac', 'gov', 'edu'];
  return sld.includes(parts[parts.length - 2]) ? parts.slice(-3).join('.') : parts.slice(-2).join('.');
}

const queries = $('Query Builder').all();
const responses = $input.all();
const items = [];
for (let i = 0; i < responses.length; i++) {
  const meta = (queries[i] || {}).json || {};
  const body = responses[i].json || {};
  for (const o of (body.organic || [])) {
    const host = hostOf(o.link);
    if (!host) continue;
    const domain = regDomain(host);
    if (BLOCKED.some(b => domain === b || domain.endsWith('.' + b))) continue;
    const hay = ((o.title || '') + ' ' + (o.snippet || '') + ' ' + o.link).toLowerCase();
    if (!HINTS.some(h => hay.includes(h))) continue;
    items.push({ json: {
      task_id: meta.task_id, domain,
      opportunity_url: o.link, title: o.title || '', snippet: o.snippet || '',
      type: meta.type, footprint_matched: meta.footprint
    } });
  }
}
return items;`;

const DEDUP_CODE = `const seen = new Set($('Read Seen Domains').all().map(r => String(r.json.domain || '').toLowerCase()).filter(Boolean));
const out = []; const runSeen = new Set();
for (const it of $input.all()) {
  const d = it.json.domain.toLowerCase();
  if (seen.has(d) || runSeen.has(d)) continue;
  runSeen.add(d); out.push(it);
}
return out;`;

const PR_BATCH_CODE = `const domains = [...new Set($input.all().map(i => i.json.domain.toLowerCase()))];
const out = [];
for (let i = 0; i < domains.length; i += 100) {
  const qs = domains.slice(i, i + 100).map(d => 'domains%5B%5D=' + encodeURIComponent(d)).join('&');
  out.push({ json: { url: 'https://openpagerank.com/api/v1.0/getPageRank?' + qs } });
}
return out;`;

const SCORE_CODE = `const items = $('Dedup').all();
const prMap = {};
for (const r of $input.all()) {
  for (const e of ((r.json || {}).response || [])) {
    if (e && e.domain) prMap[e.domain.toLowerCase()] = Number(e.page_rank_integer) || 0;
  }
}
const badTlds = ['.xyz','.top','.loan','.club','.click','.gq','.tk','.ml','.cf','.ga'];
const adult = ['casino','porn','xxx','viagra','escort','gambling','betting'];
const ccMap = { '.pk':'pk','.in':'in','.uk':'uk','.ca':'ca','.au':'au','.ae':'ae','.sa':'sa' };
const out = [];
for (const it of items) {
  const d = it.json.domain.toLowerCase();
  const url = (it.json.opportunity_url || '').toLowerCase();
  const pr = prMap[d] || 0;
  let s = 0;
  if (badTlds.some(t => d.endsWith(t))) s += 40;
  if (!url.startsWith('https')) s += 20;
  if (adult.some(w => d.includes(w) || url.includes(w))) s += 60;
  const spam_score = Math.min(s, 100);
  const tld = '.' + d.split('.').pop();
  if (spam_score < 50 && pr >= 2) {
    out.push({ json: { ...it.json, page_rank: pr, spam_score, country: ccMap[tld] || 'global' } });
  }
}
return out;`;

const VERIFY_CODE = `const metas = $('Score + Filter').all();
const bodies = $input.all();
const POS = {
  guest_post: ['write for us','write for our','guest post','submit a guest post','guest contributor',
    'become a contributor','contributor guidelines','submit an article','guest author','accepting guest',
    'guest posting','submit your post','editorial guidelines','become an author'],
  directory: ['add your business','submit your site','add your listing','add url','submit url',
    'add your site','submit your website','suggest a site','add your company']
};
const NEG = ['no longer accepting','submissions are closed','guest posts are closed',
  'we are not accepting','currently closed','not accepting guest','closed for submissions'];

const out = [];
for (let i = 0; i < bodies.length; i++) {
  const meta = (metas[i] || {}).json || {};
  const html = String((bodies[i].json || {}).data || '').toLowerCase();
  let verified = 'no', signal = '', type = meta.type;
  if (html) {
    if (NEG.some(n => html.includes(n))) { signal = 'CLOSED'; }
    else {
      for (const [t, phrases] of Object.entries(POS)) {
        const m = phrases.find(p => html.includes(p));
        if (m) { verified = 'yes'; signal = m; type = t; break; }
      }
    }
  }
  out.push({ json: { ...meta, type, verified, signal_matched: signal,
    date_found: new Date().toISOString().slice(0, 10) } });
}
return out;`;

const PREP_RESULTS_CODE = `return $input.all().map(it => { const j = it.json; return { json: {
  task_id: j.task_id, domain: j.domain, opportunity_url: j.opportunity_url, type: j.type,
  footprint_matched: j.footprint_matched, signal_matched: j.signal_matched, country: j.country,
  page_rank: j.page_rank, spam_score: j.spam_score, verified: j.verified,
  title: j.title, date_found: j.date_found
} }; });`;

// ---------- helpers ----------

let x = 0;
const pos = (row = 0) => { x += 220; return [x, row * 220]; };
const code = (name, jsCode, position, extra = {}) => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name, type: 'n8n-nodes-base.code', typeVersion: 2, position,
  parameters: { jsCode }, ...extra
});
const SHEET_ID_EXPR = "={{ $('Config').first().json.sheetId }}";
const sheetsNode = (name, operation, tab, columns, position, extra = {}) => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name, type: 'n8n-nodes-base.googleSheets', typeVersion: 4, position,
  parameters: {
    operation,
    documentId: { __rl: true, mode: 'id', value: SHEET_ID_EXPR },
    sheetName: { __rl: true, mode: 'name', value: tab },
    ...(columns ? { columns } : {}),
    options: {}
  }, ...extra
});

// ---------- nodes ----------

const nodes = [];

nodes.push({
  id: 'form-trigger', name: 'On form submission',
  type: 'n8n-nodes-base.formTrigger', typeVersion: 2, position: pos(),
  webhookId: '7d9e4f2a-53b1-4c8e-9a06-1f2e3d4c5b6a',
  parameters: {
    formTitle: 'Off-Page SEO Prospector',
    formDescription: 'Niche + country (optional) do — qualified backlink prospects Google Sheet me aayenge.',
    formFields: { values: [
      { fieldLabel: 'niche', placeholder: 'e.g. education', requiredField: true },
      { fieldLabel: 'country', placeholder: 'optional — e.g. Pakistan' },
      { fieldLabel: 'target_count', fieldType: 'number', placeholder: '50' }
    ] },
    options: {}
  }
});

nodes.push(code('Config', CONFIG_CODE, pos()));
nodes.push(sheetsNode('Read Tasks', 'read', 'Tasks', null, pos(), { alwaysOutputData: true, executeOnce: true }));
nodes.push(code('Assign Task ID', ASSIGN_TASK_CODE, pos()));
nodes.push(sheetsNode('Create Task Row', 'append', 'Tasks', {
  mappingMode: 'defineBelow', matchingColumns: [],
  value: {
    task_id: '={{ $json.task_id }}', niche: '={{ $json.niche }}', country: '={{ $json.country }}',
    mode: '={{ $json.mode }}', target_count: '={{ $json.target_count }}',
    date_created: '={{ $json.date_created }}', status: 'running', results_found: '', notes: ''
  }
}, pos()));
nodes.push(sheetsNode('Read Seen Domains', 'read', 'Seen Domains', null, pos(), { alwaysOutputData: true, executeOnce: true }));
nodes.push(code('Footprints', FOOTPRINTS_CODE, pos()));
nodes.push(code('Query Builder', QUERY_BUILDER_CODE, pos()));

nodes.push({
  id: 'serp-search', name: 'SERP Search',
  type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos(),
  onError: 'continueRegularOutput', retryOnFail: true, maxTries: 2,
  parameters: {
    method: 'POST', url: 'https://google.serper.dev/search',
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'X-API-KEY', value: "={{ $('Config').first().json.serperKey }}" },
      { name: 'Content-Type', value: 'application/json' }
    ] },
    sendBody: true, specifyBody: 'json',
    jsonBody: '={{ JSON.stringify({ q: $json.query, gl: $json.gl, hl: $json.hl, num: 10 }) }}',
    options: { batching: { batch: { batchSize: 1, batchInterval: 1100 } }, timeout: 20000 }
  }
});

nodes.push(code('Flatten + Prefilter', FLATTEN_CODE, pos()));
nodes.push(code('Dedup', DEDUP_CODE, pos()));
nodes.push(code('PR Batches', PR_BATCH_CODE, pos()));

nodes.push({
  id: 'open-pagerank', name: 'Open PageRank',
  type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos(),
  onError: 'continueRegularOutput', retryOnFail: true, maxTries: 2,
  parameters: {
    method: 'GET', url: '={{ $json.url }}',
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'API-OPR', value: "={{ $('Config').first().json.oprKey }}" }
    ] },
    options: { timeout: 20000 }
  }
});

nodes.push(code('Score + Filter', SCORE_CODE, pos()));

nodes.push({
  id: 'fetch-page', name: 'Fetch Page',
  type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos(),
  onError: 'continueRegularOutput',
  parameters: {
    method: 'GET', url: '={{ $json.opportunity_url }}',
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' }
    ] },
    options: {
      batching: { batch: { batchSize: 1, batchInterval: 500 } },
      timeout: 15000,
      response: { response: { responseFormat: 'text' } },
      redirect: { redirect: { followRedirects: true, maxRedirects: 5 } }
    }
  }
});

nodes.push(code('Verify Contribution', VERIFY_CODE, pos()));

nodes.push({
  id: 'if-verified', name: 'IF Verified',
  type: 'n8n-nodes-base.if', typeVersion: 2, position: pos(),
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
      combinator: 'and',
      conditions: [{
        id: 'cond-verified',
        leftValue: '={{ $json.verified }}', rightValue: 'yes',
        operator: { type: 'string', operation: 'equals' }
      }]
    },
    options: {}
  }
});

nodes.push({
  id: 'limit', name: 'Limit',
  type: 'n8n-nodes-base.limit', typeVersion: 1, position: pos(),
  parameters: { maxItems: "={{ $('Assign Task ID').first().json.target_count }}" }
});

nodes.push(code('Prep Results', PREP_RESULTS_CODE, pos()));

nodes.push(sheetsNode('Append Results', 'append', 'Results',
  { mappingMode: 'autoMapInputData', matchingColumns: [], value: {} }, pos()));

nodes.push(sheetsNode('Seen (Qualified)', 'append', 'Seen Domains', {
  mappingMode: 'defineBelow', matchingColumns: [],
  value: {
    domain: '={{ $json.domain }}', first_task_id: '={{ $json.task_id }}',
    first_seen_date: '={{ $json.date_found }}', status: 'qualified'
  }
}, pos()));

nodes.push(sheetsNode('Mark Task Done', 'appendOrUpdate', 'Tasks', {
  mappingMode: 'defineBelow', matchingColumns: ['task_id'],
  value: {
    task_id: "={{ $('Assign Task ID').first().json.task_id }}",
    status: 'done',
    results_found: "={{ $('Prep Results').all().length }}"
  }
}, pos(), { executeOnce: true }));

// rejected branch (row below the IF node)
nodes.push(sheetsNode('Seen (Rejected)', 'append', 'Seen Domains', {
  mappingMode: 'defineBelow', matchingColumns: [],
  value: {
    domain: '={{ $json.domain }}', first_task_id: '={{ $json.task_id }}',
    first_seen_date: '={{ $json.date_found }}', status: 'rejected'
  }
}, [nodes.find(n => n.name === 'IF Verified').position[0] + 220, 220]));

// ---------- connections (linear chain + IF branches) ----------

const chain = ['On form submission', 'Config', 'Read Tasks', 'Assign Task ID', 'Create Task Row',
  'Read Seen Domains', 'Footprints', 'Query Builder', 'SERP Search', 'Flatten + Prefilter',
  'Dedup', 'PR Batches', 'Open PageRank', 'Score + Filter', 'Fetch Page',
  'Verify Contribution', 'IF Verified'];
const qualifiedChain = ['Limit', 'Prep Results', 'Append Results', 'Seen (Qualified)', 'Mark Task Done'];

const connections = {};
const link = (from, to, outputIndex = 0) => {
  connections[from] = connections[from] || { main: [] };
  while (connections[from].main.length <= outputIndex) connections[from].main.push([]);
  connections[from].main[outputIndex].push({ node: to, type: 'main', index: 0 });
};
for (let i = 0; i < chain.length - 1; i++) link(chain[i], chain[i + 1]);
link('IF Verified', 'Limit', 0);
link('IF Verified', 'Seen (Rejected)', 1);
for (let i = 0; i < qualifiedChain.length - 1; i++) link(qualifiedChain[i], qualifiedChain[i + 1]);

const workflow = {
  name: 'Off-Page SEO Link Prospector',
  nodes,
  connections,
  settings: { executionOrder: 'v1' }
};

fs.writeFileSync(__dirname + '/workflow.json', JSON.stringify(workflow, null, 2));
console.log('workflow.json written:', nodes.length, 'nodes');