#!/usr/bin/env python3
"""Theme Orbital — Office page mockup generator.

Single source of truth for the 18 Office pages under showcase/office/.
The shell (topbar, nav, page header) lives here once; each page only defines
its content sections. Re-run after editing:  python3 scripts/build-office-pages.py
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "showcase" / "office"
OUT.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- nav model
NAV = [
    ("Pilotage", [
        ("dashboard", "Dashboard", "home"),
        ("ceo", "CEO View", "eye"),
        ("pnl", "P&L", "chart-bar"),
        ("cashflow", "Cash Flow", "trending-up"),
    ]),
    ("Comptabilité", [
        ("transactions", "Transactions", "file-text"),
        ("pending", "Pending", "clock"),
        ("reconciliation", "Réconciliation", "check"),
        ("imports", "Imports", "upload"),
        ("bank", "Bank", "bank"),
        ("coa", "Chart of Accounts", "layout-grid"),
        ("vat", "VAT", "file-text"),
    ]),
    ("Relations", [
        ("clients", "Clients", "users"),
        ("suppliers", "Suppliers", "users"),
        ("projects", "Projects", "folder"),
        ("wave-invoices", "Wave Invoices", "download"),
    ]),
    ("Système", [
        ("monitoring", "Monitoring", "search"),
        ("audit", "Audit", "calendar"),
        ("settings", "Settings", "settings"),
    ]),
]

# ---------------------------------------------------------------- helpers
def icon(name, size=16):
    return f'<img class="nav-icon-img" style="width:{size}px;height:{size}px" src="../../assets/icons/icon-{name}.svg" alt="">'

def badge(text, tone):
    return f'<span class="orb-badge orb-badge--{tone}">{text}</span>'

def kpi(label, value, delta=None, up=True, detail="", lead=False, icon_name=None):
    cls = "orb-kpi orb-kpi--lead" if lead else "orb-kpi"
    ic = f'<span class="orb-kpi__icon">{icon(icon_name, 15)}</span>' if icon_name else ""
    trend = ""
    if delta:
        arrow = "▲" if up else "▼"
        tone = "up" if up else "down"
        trend = (f'<div class="orb-kpi__trend"><span class="orb-kpi__delta {tone}">{arrow} {delta}</span>'
                 f'<span class="orb-kpi__detail">{detail}</span></div>')
    elif detail:
        trend = f'<div class="orb-kpi__trend"><span class="orb-kpi__detail">{detail}</span></div>'
    return (f'<article class="{cls}"><div class="orb-kpi__head">'
            f'<span class="orb-kpi__label">{label}</span>{ic}</div>'
            f'<div class="orb-kpi__value">{value}</div>{trend}</article>')

def table(cols, rows):
    head = "".join(f"<th>{c}</th>" for c in cols)
    body = "".join(f"<tr>{r}</tr>" for r in rows)
    return (f'<div class="orb-table-wrap"><div class="orb-table-scroll"><table class="orb-table">'
            f'<thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div></div>')

def panel(title, inner, link=None):
    a = f'<a href="#">{link} →</a>' if link else ""
    return f'<div class="orb-panel panel-pad"><div class="panel-title">{title} {a}</div>{inner}</div>'

def bars_svg(values, color="#2FD4FF", labels=None, h=150):
    """Simple bar chart; values 0..1."""
    n = len(values)
    w = 600
    bw = w / n * 0.55
    gap = w / n
    bars, texts = [], []
    for i, v in enumerate(values):
        x = i * gap + (gap - bw) / 2
        bh = max(4, v * (h - 30))
        bars.append(f'<rect x="{x:.0f}" y="{h - 20 - bh:.0f}" width="{bw:.0f}" height="{bh:.0f}" rx="3" fill="{color}" opacity=".85"/>')
        if labels:
            texts.append(f'<text x="{x + bw/2:.0f}" y="{h - 6}" text-anchor="middle" font-size="9" fill="rgba(234,246,250,.4)" font-family="monospace">{labels[i]}</text>')
    return (f'<svg class="chart-frame" viewBox="0 0 {w} {h}" preserveAspectRatio="none">'
            f'<line x1="0" y1="{h-20}" x2="{w}" y2="{h-20}" stroke="rgba(140,210,235,.2)" stroke-width="1"/>'
            + "".join(bars) + "".join(texts) + "</svg>")

def duo_bars_svg(pairs, labels, h=170):
    """Grouped in/out bars + net line; pairs = [(in 0..1, out 0..1)]."""
    n = len(pairs)
    w = 640
    gap = w / n
    bw = gap * 0.26
    parts = [f'<line x1="0" y1="{h-22}" x2="{w}" y2="{h-22}" stroke="rgba(140,210,235,.2)"/>']
    pts = []
    for i, (vi, vo) in enumerate(pairs):
        x0 = i * gap + gap * 0.18
        hi, ho = max(4, vi * (h - 40)), max(4, vo * (h - 40))
        parts.append(f'<rect x="{x0:.0f}" y="{h-22-hi:.0f}" width="{bw:.0f}" height="{hi:.0f}" rx="3" fill="#2EE6A8" opacity=".8"/>')
        parts.append(f'<rect x="{x0+bw+3:.0f}" y="{h-22-ho:.0f}" width="{bw:.0f}" height="{ho:.0f}" rx="3" fill="#EF4444" opacity=".7"/>')
        net = (vi - vo) * 0.5 + 0.5
        pts.append(f"{i*gap+gap/2:.0f},{h-22-net*(h-40):.0f}")
        parts.append(f'<text x="{i*gap+gap/2:.0f}" y="{h-7}" text-anchor="middle" font-size="9" fill="rgba(234,246,250,.4)" font-family="monospace">{labels[i]}</text>')
    parts.append(f'<polyline points="{" ".join(pts)}" fill="none" stroke="#FFB800" stroke-width="1.6"/>')
    return f'<svg class="chart-frame" viewBox="0 0 {w} {h}" preserveAspectRatio="none">{"".join(parts)}</svg>'

MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"]

# ---------------------------------------------------------------- shell
def nav_html(active):
    groups = []
    for label, items in NAV:
        rows = [f'<span class="orb-nav__group">{label}</span>']
        for slug, name, ic in items:
            cls = "orb-nav__item active" if slug == active else "orb-nav__item"
            rows.append(f'<a class="{cls}" href="./{slug}.html">'
                        f'<span class="orb-nav__icon">{icon(ic)}</span>{name}</a>')
        groups.append("".join(rows))
    return f'<div class="orb-panel" style="padding:12px;"><div class="orb-nav">{"".join(groups)}</div></div>'

TICKER = ('<div class="orb-ticker">'
          '<span><i class="dot ok"></i>API 200 · 42 ms</span>'
          '<span><i class="dot ok"></i>MCB feed <b>sync 06:00</b></span>'
          '<span><i class="dot warn"></i>SBI import <b>128 unmatched</b></span>'
          '<span><i class="dot ok"></i>FX MUR <b>à jour</b></span>'
          '<span><i class="dot ok"></i>Audit <b>évt 8 412</b></span>'
          '</div>')

def page(slug, title, sub, content, actions=""):
    default_actions = '<span class="chip">Period: <b>This Year</b></span>'
    return f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ë • office — {title} · Orbital</title>
<link rel="stylesheet" href="../../tokens/orbital-tokens.css">
<link rel="stylesheet" href="../../components/orbital-components.css">
<link rel="stylesheet" href="./_shell.css">
<link rel="stylesheet" href="./_office-skin.css">
</head>
<body>
<div class="shell">
  <div class="topbar">
    <div class="brand">ë&nbsp;•&nbsp;office<em>.</em><span>orbital</span></div>
    {TICKER}
    <button class="orb-button orb-button--primary">Nouvelle écriture</button>
  </div>
  <div class="cockpit">
    <nav class="rail-left">{nav_html(slug)}</nav>
    <main class="main">
      <div class="page-head">
        <div class="left">
          <span class="kicker">workspace · eeee-mu</span>
          <h1>{title}</h1>
          <span class="sub">{sub}</span>
        </div>
        <div class="actions">{actions or default_actions}</div>
      </div>
      {content}
    </main>
  </div>
</div>
</body>
</html>
"""

# ---------------------------------------------------------------- page contents
P = {}

# --- dashboard
P["dashboard"] = dict(
    title="Dashboard",
    sub="Vue d'ensemble : trésorerie, activité, santé de la réconciliation.",
    content=f"""
<div class="kpi-row">
  {kpi("Trésorerie", "2 847 632 Rs", "12,5 %", True, "vs période préc.", lead=True, icon_name="bank")}
  {kpi("Income", "1 422 364 Rs", "8,1 %", True, "vs période préc.")}
  {kpi("Expenses", "3 999 779 Rs", "3,2 %", False, "vs période préc.")}
  {kpi("À réconcilier", "128", None, detail="lignes bancaires")}
</div>
<div class="two-col">
  {panel("Santé de la réconciliation", '''
    <div class="orb-ring">
      <div class="orb-ring__dial" style="--ring-stops:var(--orb-success) 0 78%, var(--orb-warning) 78% 91%, rgba(140,210,235,.12) 91% 100%;"><span>78%</span></div>
      <div class="orb-ring__legend" style="flex:1;">
        <div class="item"><span class="swatch" style="background:var(--orb-success);"></span>Matched <span class="val">1 204</span></div>
        <div class="item"><span class="swatch" style="background:var(--orb-warning);"></span>Suggested <span class="val">204</span></div>
        <div class="item"><span class="swatch" style="background:rgba(140,210,235,.35);"></span>Unmatched <span class="val">128</span></div>
      </div>
      <a class="orb-button orb-button--secondary" href="./reconciliation.html">Réconcilier</a>
    </div>''', link="ouvrir")}
  <div style="display:grid;gap:16px;">
    <div class="orb-insight">
      <div class="orb-insight__head">
        <span class="orb-kpi__icon" style="width:26px;height:26px;">{icon("check", 14)}</span>
        <span class="orb-insight__title">Prochaine action</span>
        {badge("97 %", "info")}
      </div>
      <div class="orb-insight__body">42 lignes SBI correspondent à des écritures existantes (montant + date exacts).</div>
      <div class="orb-insight__actions">
        <button class="orb-button orb-button--primary" style="min-height:32px;">Rapprocher 42</button>
        <button class="orb-button orb-button--ghost" style="min-height:32px;">Revoir</button>
      </div>
    </div>
    {panel("Balance âgée — top retards", '''
      <div class="mini-table">
        <div class="mini-row"><div class="who"><b>Bedouin Ltd</b><span>112 j de retard</span></div><span class="amt neg">58 400 Rs</span></div>
        <div class="mini-row"><div class="who"><b>Blue Penny Events</b><span>74 j de retard</span></div><span class="amt neg">21 300 Rs</span></div>
        <div class="mini-row"><div class="who"><b>MCB Corporate</b><span>à échoir 30 j</span></div><span class="amt pos">412 800 Rs</span></div>
      </div>''', link="tout")}
  </div>
</div>
""")

# --- ceo
P["ceo"] = dict(
    title="CEO View",
    sub="Lecture direction : revenus, atterrissage vs objectif, activité clients.",
    content=f"""
<div class="kpi-row">
  {kpi("Income YTD", "1 422 364 Rs", "11,9 %", True, "vs N-1", lead=True, icon_name="trending-up")}
  {kpi("Vs objectif", "88 %", None, detail="objectif 1,62 M Rs")}
  {kpi("Clients actifs", "42", "+8", True, "vs N-1")}
  {kpi("Événements", "117", None, detail="année en cours")}
</div>
<div class="two-col">
  {panel("Income par mois", bars_svg([.32,.28,.05,.55,.9,.88,.4,.2,.62,.5,.3,.36], labels=MONTHS)
    + '<div class="chart-legend"><span class="item"><span class="swatch" style="background:#2FD4FF"></span>Income validé</span></div>')}
  {panel("Top revenus", '''
    <div class="mini-table">
      <div class="mini-row"><div class="who"><b>Performance Fees — Booking</b><span>ë • talent</span></div><span class="amt pos">1 185 475 Rs</span></div>
      <div class="mini-row"><div class="who"><b>Labels — royalties</b><span>ë • music</span></div><span class="amt pos">236 889 Rs</span></div>
      <div class="mini-row"><div class="who"><b>Kaya Festival — billetterie</b><span>evënts</span></div><span class="amt pos">94 500 Rs</span></div>
    </div>''', link="P&L")}
</div>
{panel("Net par département", '''
  <div class="tree-head grid-pnl"><span>Département</span><span>Income</span><span>Expenses</span><span>Net</span></div>
  <div class="tree-row first grid-pnl"><span class="name">ë • talent</span><span class="money pos">1 185 475</span><span class="money">416 619</span><span class="money pos">+768 856</span></div>
  <div class="tree-row grid-pnl"><span class="name">ë • music</span><span class="money pos">236 889</span><span class="money">50 000</span><span class="money pos">+186 889</span></div>
  <div class="tree-row grid-pnl"><span class="name">ë • office</span><span class="money muted">0</span><span class="money">3 261 229</span><span class="money neg">−3 261 229</span></div>
''')}
""")

# --- pnl
P["pnl"] = dict(
    title="P&L",
    sub="Arbre département → division → catégorie. Un seul tableau, déplié à la demande (remplace les trois tables empilées).",
    content=f"""
<div class="kpi-row">
  {kpi("Income", "1 422 364 Rs", None, detail="validated only", lead=True, icon_name="trending-up")}
  {kpi("Expenses", "3 999 779 Rs")}
  {kpi("Net", "−2 577 415 Rs")}
  {kpi("Transactions", "312")}
</div>
<div class="orb-panel filter-strip">
  <span class="chip">Department: <b>All</b></span>
  <span class="chip">Division: <b>All</b></span>
  <span class="chip">Category: <b>All</b></span>
  <span class="spacer"></span>
  <span class="chip static">Tree · Chart</span>
  <button class="orb-button orb-button--secondary" style="min-height:32px;">Filter</button>
</div>
<div class="orb-panel">
  <div class="tree-head grid-pnl"><span>Department / Division / Category</span><span>Income</span><span>Expenses</span><span>Net</span></div>
  <div class="tree-row first grid-pnl"><span class="name"><span class="tw">▼</span>ë • office</span><span class="money muted">0</span><span class="money">3 261 229</span><span class="money neg">−3 261 229</span></div>
  <div class="tree-row lvl2 grid-pnl"><span class="name"><span class="tw">▼</span>Finance</span><span class="money muted">0</span><span class="money">1 865 063</span><span class="money neg">−1 865 063</span></div>
  <div class="tree-row lvl3 grid-pnl"><span class="name">Cash Float</span><span class="money muted">0</span><span class="money">1 373 479</span><span class="money neg">−1 373 479</span></div>
  <div class="tree-row lvl3 grid-pnl"><span class="name">Bank Charges</span><span class="money muted">0</span><span class="money">2 867</span><span class="money neg">−2 867</span></div>
  <div class="tree-row lvl2 grid-pnl"><span class="name"><span class="tw">▶</span>HR / Team</span><span class="money muted">0</span><span class="money">915 289</span><span class="money neg">−915 289</span></div>
  <div class="tree-row lvl2 grid-pnl"><span class="name"><span class="tw">▶</span>Operations</span><span class="money muted">0</span><span class="money">296 983</span><span class="money neg">−296 983</span></div>
  <div class="tree-row first grid-pnl" style="border-top:1px solid var(--orb-border);"><span class="name"><span class="tw">▶</span>ë • talent</span><span class="money pos">1 185 475</span><span class="money">416 619</span><span class="money pos">+768 856</span></div>
  <div class="tree-row grid-pnl"><span class="name"><span class="tw">▶</span>ë • music</span><span class="money pos">236 889</span><span class="money">50 000</span><span class="money pos">+186 889</span></div>
  <div class="tree-row grid-pnl"><span class="name"><span class="tw">▶</span>evënts</span><span class="money muted">0</span><span class="money">206 150</span><span class="money neg">−206 150</span></div>
  <div class="tree-row grid-pnl"><span class="name"><span class="tw">▶</span>bōucan</span><span class="money muted">0</span><span class="money">141 305</span><span class="money neg">−141 305</span></div>
  <div class="tree-row grid-pnl"><span class="name"><span class="tw">▶</span>the storë</span><span class="money muted">0</span><span class="money">17 250</span><span class="money neg">−17 250</span></div>
</div>
""")

# --- coa
P["coa"] = dict(
    title="Chart of Accounts",
    sub="Arbre réel avec ajout contextuel — « + division / + category » directement sur la ligne parente.",
    actions='<button class="orb-button orb-button--primary">+ Department</button>',
    content=f"""
<div class="orb-panel filter-strip">
  <span class="chip">Show: <b>Active only</b></span>
  <span class="chip">Type: <b>All</b></span>
</div>
<div class="orb-panel">
  <div class="tree-head grid-coa"><span>Department / Division / Category</span><span class="cell-c">Kind</span><span class="cell-c">Type</span><span>Status</span><span></span></div>
  <div class="tree-row first grid-coa"><span class="name"><span class="tw">▼</span>ë • office</span><span>{badge("department", "info")}</span><span>—</span><span>{badge("active", "success")}</span><span style="text-align:right;"><button class="orb-button orb-button--ghost" style="min-height:26px;padding:0 10px;font-size:11px;">+ division</button></span></div>
  <div class="tree-row lvl2 grid-coa"><span class="name"><span class="tw">▼</span>Finance</span><span>{badge("division", "info")}</span><span>—</span><span>{badge("active", "success")}</span><span style="text-align:right;"><button class="orb-button orb-button--ghost" style="min-height:26px;padding:0 10px;font-size:11px;">+ category</button></span></div>
  <div class="tree-row lvl3 grid-coa"><span class="name">Bank Charges</span><span>{badge("category", "warning")}</span><span>{badge("expense", "warning")}</span><span>{badge("active", "success")}</span><span style="text-align:right;"><button class="orb-button orb-button--ghost" style="min-height:26px;padding:0 10px;font-size:11px;">edit</button></span></div>
  <div class="tree-row lvl3 grid-coa"><span class="name">Cash Float</span><span>{badge("category", "warning")}</span><span>{badge("expense", "warning")}</span><span>{badge("active", "success")}</span><span style="text-align:right;"><button class="orb-button orb-button--ghost" style="min-height:26px;padding:0 10px;font-size:11px;">edit</button></span></div>
  <div class="tree-row lvl2 grid-coa"><span class="name"><span class="tw">▶</span>HR / Team</span><span>{badge("division", "info")}</span><span>—</span><span>{badge("active", "success")}</span><span style="text-align:right;"><button class="orb-button orb-button--ghost" style="min-height:26px;padding:0 10px;font-size:11px;">+ category</button></span></div>
  <div class="tree-row first grid-coa" style="border-top:1px solid var(--orb-border);"><span class="name"><span class="tw">▼</span>ë • talent</span><span>{badge("department", "info")}</span><span>—</span><span>{badge("active", "success")}</span><span style="text-align:right;"><button class="orb-button orb-button--ghost" style="min-height:26px;padding:0 10px;font-size:11px;">+ division</button></span></div>
  <div class="tree-row lvl2 grid-coa"><span class="name"><span class="tw">▼</span>Booking Agency</span><span>{badge("division", "info")}</span><span>—</span><span>{badge("active", "success")}</span><span style="text-align:right;"><button class="orb-button orb-button--ghost" style="min-height:26px;padding:0 10px;font-size:11px;">+ category</button></span></div>
  <div class="tree-row lvl3 grid-coa"><span class="name">Performance Fees Collected</span><span>{badge("category", "warning")}</span><span>{badge("income", "success")}</span><span>{badge("active", "success")}</span><span style="text-align:right;"><button class="orb-button orb-button--ghost" style="min-height:26px;padding:0 10px;font-size:11px;">edit</button></span></div>
  <div class="tree-row lvl3 grid-coa"><span class="name" style="opacity:.55;">Team Meals</span><span>{badge("category", "warning")}</span><span>{badge("expense", "warning")}</span><span>{badge("inactive", "muted")}</span><span style="text-align:right;"><button class="orb-button orb-button--ghost" style="min-height:26px;padding:0 10px;font-size:11px;">edit</button></span></div>
</div>
""")

# --- transactions
P["transactions"] = dict(
    title="Transactions",
    sub="Grand livre filtrable ; édition en panneau latéral, signe porté par le type.",
    actions=('<span class="chip">Period: <b>This Year</b></span>'
             '<button class="orb-button orb-button--secondary">Export CSV</button>'
             '<button class="orb-button orb-button--primary">New entry</button>'),
    content=f"""
<div class="orb-panel filter-strip">
  <span class="chip">Account: <b>All</b></span><span class="chip">Department: <b>All</b></span>
  <span class="chip">Division: <b>All</b></span><span class="chip">Category: <b>All</b></span>
  <span class="chip">Project: <b>All</b></span><span class="chip">Type: <b>All</b></span>
  <span class="chip">Status: <b>All</b></span>
  <span class="spacer"></span>
  <button class="orb-button orb-button--secondary" style="min-height:32px;">Filter</button>
</div>
<div class="two-col">
  {table(
    ["Date", "Description", "Classification", "Type", "Amount", "Status"],
    [
      '<td>04/02</td><td class="lead-cell">DJ performance invoice</td><td>ë • talent · Booking · Perf. Fees</td><td>' + badge("income", "success") + '</td><td class="money pos">+500 000,00 Rs</td><td>' + badge("validated", "success") + "</td>",
      '<td>09/02</td><td class="lead-cell">Projector rental</td><td>bōucan · Equipment · Rental</td><td>' + badge("expense", "warning") + '</td><td class="money neg">−120 000,00 Rs</td><td>' + badge("validated", "success") + "</td>",
      '<td>12/02</td><td class="lead-cell">Current account fee</td><td>ë • office · Finance · Bank Charges</td><td>' + badge("expense", "warning") + '</td><td class="money neg">−5 000,00 Rs</td><td>' + badge("matched", "info") + "</td>",
      '<td>15/02</td><td class="lead-cell">Awaiting category</td><td>to classify</td><td>' + badge("expense", "warning") + '</td><td class="money neg">−8 500,00 Rs</td><td>' + badge("draft", "amber") + "</td>",
      '<td>18/02</td><td class="lead-cell">Salaries — February</td><td>ë • office · HR / Team · Salaries</td><td>' + badge("expense", "warning") + '</td><td class="money neg">−502 193,00 Rs</td><td>' + badge("validated", "success") + "</td>",
      '<td>21/02</td><td class="lead-cell">Label royalties Q1</td><td>ë • music · Labels · Royalties</td><td>' + badge("income", "success") + '</td><td class="money pos">+236 889,45 Rs</td><td>' + badge("validated", "success") + "</td>",
    ])}
  <div class="drawer-mock">
    <div class="panel-title">Edit transaction</div>
    <div class="orb-field"><label>Date</label><input class="orb-input" value="2026-02-09"></div>
    <div class="orb-field"><label>Description</label><input class="orb-input" value="Projector rental"></div>
    <div class="orb-field"><label>Amount</label><input class="orb-input" value="120 000.00"></div>
    <div class="orb-field"><label>Category</label><input class="orb-input" value="bōucan · Equipment · Rental"></div>
    <div class="row">
      <button class="orb-button orb-button--primary" style="min-height:32px;">Save</button>
      <button class="orb-button orb-button--secondary" style="min-height:32px;">Validate</button>
      <button class="orb-button orb-button--ghost" style="min-height:32px;">Close</button>
    </div>
    <div class="orb-alert orb-alert--success"><div class="orb-alert__body"><strong>Success</strong><span>Action accepted · audit recorded.</span></div></div>
  </div>
</div>
<div class="row" style="justify-content:center;color:var(--orb-text-muted);font-size:12px;">
  <span>312 loaded</span>
  <button class="orb-button orb-button--ghost" style="min-height:30px;">Load more</button>
  <button class="orb-button orb-button--ghost" style="min-height:30px;">Load all</button>
</div>
""")

# --- imports
P["imports"] = dict(
    title="Imports",
    sub="Relevés bancaires CSV (MCB, SBI, générique) et cashflow — preview, confirmation idempotente, réversibilité.",
    content=f"""
<div class="two-col">
  <div style="display:grid;gap:16px;">
    <div class="dropzone">
      {icon("upload", 30)}
      <b>Déposer un relevé CSV</b>
      <small>MCB · SBI · CSV générique — parse auto, aperçu avant écriture</small>
      <button class="orb-button orb-button--secondary" style="min-height:32px;">Choisir un fichier</button>
    </div>
    <div class="orb-alert orb-alert--success"><div class="orb-alert__body"><strong>SBI JUL 21 — MAY 26.csv</strong><span>2 652 lignes acceptées · 0 rejet · 14 doublons ignorés · compte SBI MUR détecté</span></div></div>
  </div>
  {panel("Pipeline du dernier import", '''
    <div class="orb-stepper">
      <div class="orb-step done"><span class="orb-step__node">✓</span><span class="orb-step__label">Preview</span><span class="orb-step__hint">2 652 lues</span></div>
      <div class="orb-step done"><span class="orb-step__node">✓</span><span class="orb-step__label">Confirm</span><span class="orb-step__hint">0 rejet</span></div>
      <div class="orb-step active"><span class="orb-step__node">3</span><span class="orb-step__label">Réconcilier</span><span class="orb-step__hint">128 restantes</span></div>
      <div class="orb-step"><span class="orb-step__node">4</span><span class="orb-step__label">Valider</span><span class="orb-step__hint">—</span></div>
    </div>''')}
</div>
{table(
  ["Source", "File", "Period", "Accepted", "Rejected", "Dupl.", "Status", ""],
  [
    '<td>' + badge("SBI", "info") + '</td><td class="lead-cell">SBI JUL 21 — MAY 26.csv</td><td>2021-07 → 2026-05</td><td>2 652</td><td>0</td><td>14</td><td>' + badge("confirmed", "success") + '</td><td><button class="orb-button orb-button--danger" style="min-height:26px;padding:0 10px;font-size:11px;">Cancel import</button></td>',
    '<td>' + badge("MCB", "info") + '</td><td class="lead-cell">fixture-mcb-feb.csv</td><td>2026-02</td><td>3</td><td>0</td><td>1</td><td>' + badge("confirmed", "success") + '</td><td><button class="orb-button orb-button--danger" style="min-height:26px;padding:0 10px;font-size:11px;">Cancel import</button></td>',
    '<td>' + badge("cashflow", "muted") + '</td><td class="lead-cell">cashflow-2026-H1.xlsx</td><td>2026-01 → 2026-06</td><td>6</td><td>0</td><td>0</td><td>' + badge("confirmed", "success") + "</td><td></td>",
  ])}
""")

# --- reconciliation
P["reconciliation"] = dict(
    title="Réconciliation",
    sub="Rapprochement lignes bancaires ↔ écritures. Le montant vient du relevé (signé par direction), la description du CSV.",
    content=f"""
<div class="kpi-row">
  {kpi("À rapprocher", "128", None, detail="unmatched", lead=True, icon_name="check")}
  {kpi("Taux matched", "78 %", "2,1 pts", True, "vs semaine préc.")}
  {kpi("Suggestions", "204", None, detail="haute confiance : 42")}
  {kpi("Plus ancienne", "38 j", None, detail="ligne du 2026-06-02")}
</div>
<div class="orb-insight">
  <div class="orb-insight__head">
    <span class="orb-kpi__icon" style="width:26px;height:26px;">{icon("check", 14)}</span>
    <span class="orb-insight__title">Rapprochement par lot</span>
    {badge("97 %", "info")}
  </div>
  <div class="orb-insight__body">42 lignes SBI correspondent exactement (montant + date) à des écritures existantes.</div>
  <div class="orb-insight__actions">
    <button class="orb-button orb-button--primary" style="min-height:32px;">Rapprocher 42</button>
    <button class="orb-button orb-button--ghost" style="min-height:32px;">Revoir une par une</button>
  </div>
</div>
{table(
  ["Description", "Date", "Amount", "Suggested match", "Conf.", "Status", ""],
  [
    '<td class="lead-cell">SALARY BATCH FEB — BULK 442</td><td>28/02</td><td class="money neg">−502 193,00 Rs</td><td>Salaries — February</td><td>' + badge("98 %", "success") + '</td><td>' + badge("suggested", "warning") + '</td><td><button class="orb-button orb-button--secondary" style="min-height:26px;padding:0 12px;font-size:11px;">Accept</button></td>',
    '<td class="lead-cell">TRSF BEDOUIN LTD INV-BED-1</td><td>04/02</td><td class="money pos">+500 000,00 Rs</td><td>DJ performance invoice</td><td>' + badge("97 %", "success") + '</td><td>' + badge("suggested", "warning") + '</td><td><button class="orb-button orb-button--secondary" style="min-height:26px;padding:0 12px;font-size:11px;">Accept</button></td>',
    '<td class="lead-cell">ATM FEE 12/02 CURRENT ACC</td><td>12/02</td><td class="money neg">−5 000,00 Rs</td><td>Current account fee</td><td>' + badge("matched", "success") + '</td><td>' + badge("matched", "info") + '</td><td><button class="orb-button orb-button--ghost" style="min-height:26px;padding:0 12px;font-size:11px;">Unmatch</button></td>',
    '<td class="lead-cell">POS THE STORE 15/02</td><td>15/02</td><td class="money neg">−8 500,00 Rs</td><td>—</td><td>' + badge("0 %", "muted") + '</td><td>' + badge("unmatched", "error") + '</td><td><button class="orb-button orb-button--secondary" style="min-height:26px;padding:0 12px;font-size:11px;">Create entry</button></td>',
  ])}
<div class="row" style="color:var(--orb-text-muted);font-size:12px;">
  <span>Actions par ligne : Accept · Match · Create entry · Ignore · Reject · Move account</span>
</div>
""")

# --- pending
P["pending"] = dict(
    title="Pending",
    sub="Écritures draft à classifier (catégorie requise pour valider). Le type income/expense n'est jamais réécrit par la catégorie.",
    content=f"""
<div class="two-col">
  {panel("À classifier — 4 sélectionnées / 12", '''
    <div class="mini-table">
      <div class="mini-row"><div class="who"><b>POS THE STORE 15/02</b><span>to classify · to classify</span></div><span class="amt neg">−8 500 Rs</span></div>
      <div class="mini-row"><div class="who"><b>FUEL STATION A1 03/03</b><span>to classify · to classify</span></div><span class="amt neg">−4 220 Rs</span></div>
      <div class="mini-row"><div class="who"><b>TRSF LABEL ADV Q2</b><span>to classify · to classify</span></div><span class="amt pos">+48 000 Rs</span></div>
      <div class="mini-row"><div class="who"><b>OFFICE SUPPLIES 08/03</b><span>to classify · to classify</span></div><span class="amt neg">−1 410 Rs</span></div>
    </div>''')}
  <div class="drawer-mock">
    <div class="panel-title">Classifier la sélection</div>
    <div class="orb-field"><label>Category</label><input class="orb-input" value="ë • office · Operations · Transport / Fuel"></div>
    <div class="orb-field"><label>Project (optional)</label><input class="orb-input" placeholder="—"></div>
    <div class="orb-alert orb-alert--info"><div class="orb-alert__body"><strong>Info</strong><span>Le type (income/expense) de chaque écriture est conservé — la catégorie ne fait que ranger.</span></div></div>
    <div class="row">
      <button class="orb-button orb-button--primary" style="min-height:32px;">Classifier 4</button>
      <button class="orb-button orb-button--secondary" style="min-height:32px;">Classifier + Valider</button>
    </div>
  </div>
</div>
""")

# --- cashflow
P["cashflow"] = dict(
    title="Cash Flow",
    sub="Projection mensuelle : entrées, sorties, solde de clôture (dernier import par compte+mois fait foi).",
    actions=('<span class="chip">Period: <b>This Year</b></span>'
             '<button class="orb-button orb-button--secondary">Import cashflow</button>'),
    content=f"""
<div class="kpi-row kpi-row--3">
  {kpi("Inflow (proj.)", "1 998 400 Rs", None, detail="12 mois", lead=True, icon_name="trending-up")}
  {kpi("Outflow (proj.)", "1 646 900 Rs")}
  {kpi("Clôture déc.", "3 199 132 Rs", "8,3 %", True, "vs clôture N-1")}
</div>
{panel("Projection mensuelle",
  duo_bars_svg([(.5,.4),(.42,.38),(.15,.3),(.66,.5),(.98,.6),(.9,.55),(.5,.45),(.28,.4),(.7,.52),(.6,.48),(.42,.4),(.5,.44)], MONTHS)
  + '<div class="chart-legend">'
    '<span class="item"><span class="swatch" style="background:#2EE6A8"></span>Inflow</span>'
    '<span class="item"><span class="swatch" style="background:#EF4444"></span>Outflow</span>'
    '<span class="item"><span class="swatch" style="background:#FFB800"></span>Net</span></div>')}
{table(
  ["Month", "Inflow", "Outflow", "Closing"],
  [
    '<td class="lead-cell">2026-05</td><td class="money pos">163 400 Rs</td><td class="money neg">98 900 Rs</td><td class="money">2 912 300 Rs</td>',
    '<td class="lead-cell">2026-06</td><td class="money pos">148 800 Rs</td><td class="money neg">91 200 Rs</td><td class="money">2 969 900 Rs</td>',
    '<td class="lead-cell">2026-07</td><td class="money pos">82 600 Rs</td><td class="money neg">74 300 Rs</td><td class="money">2 978 200 Rs</td>',
    '<td class="lead-cell">2026-08</td><td class="money pos">46 200 Rs</td><td class="money neg">66 100 Rs</td><td class="money">2 958 300 Rs</td>',
  ])}
""")

# --- clients
P["clients"] = dict(
    title="Clients",
    sub="Encaissements : balance âgée par client, retards priorisés, ancienneté calculée depuis la date de transaction.",
    content=f"""
<div class="kpi-row">
  {kpi("Reste à encaisser", "1 284 636 Rs", None, detail="42 clients", lead=True, icon_name="users")}
  {kpi("Dont échu", "96 159 Rs", None, detail="7,5 % du total")}
  {kpi("Délai moyen", "52 j")}
  {kpi("Retard moyen", "18 j", None, detail="créances échues")}
</div>
{table(
  ["Client", "Reste à encaisser", "Retard moyen", "&gt; 90 j", "61-90 j", "31-60 j", "0-30 j", "À échoir"],
  [
    '<td class="lead-cell">Bedouin Ltd</td><td class="money">184 600 Rs</td><td>112 j</td><td><span class="heat od3">58 400</span></td><td><span class="heat zero">—</span></td><td><span class="heat zero">—</span></td><td><span class="heat zero">—</span></td><td><span class="heat up1">126 200</span></td>',
    '<td class="lead-cell">MCB Corporate</td><td class="money">412 800 Rs</td><td>—</td><td><span class="heat zero">—</span></td><td><span class="heat zero">—</span></td><td><span class="heat zero">—</span></td><td><span class="heat zero">—</span></td><td><span class="heat up2">412 800</span></td>',
    '<td class="lead-cell">Blue Penny Events</td><td class="money">67 940 Rs</td><td>74 j</td><td><span class="heat zero">—</span></td><td><span class="heat od2">21 300</span></td><td><span class="heat zero">—</span></td><td><span class="heat zero">—</span></td><td><span class="heat up1">46 640</span></td>',
    '<td class="lead-cell">Grand Baie Resorts</td><td class="money">38 059 Rs</td><td>29 j</td><td><span class="heat zero">—</span></td><td><span class="heat zero">—</span></td><td><span class="heat od1">11 200</span></td><td><span class="heat od1">5 259</span></td><td><span class="heat up1">21 600</span></td>',
  ])}
<div class="orb-alert orb-alert--warning"><div class="orb-alert__body"><strong>Limite</strong><span>Pas de date d'échéance sur les transactions aujourd'hui — le « retard » est mesuré depuis la date de transaction, pas une échéance contractuelle.</span></div></div>
""")

# --- suppliers
P["suppliers"] = dict(
    title="Suppliers",
    sub="Décaissements : dettes fournisseurs par ancienneté, priorisation des paiements.",
    content=f"""
<div class="kpi-row">
  {kpi("Reste à décaisser", "435 556 Rs", None, detail="18 fournisseurs", lead=True, icon_name="users")}
  {kpi("Dont échu", "211 660 Rs", None, detail="48,6 % du total")}
  {kpi("Délai moyen", "34 j")}
  {kpi("Retard moyen", "41 j", None, detail="dettes échues")}
</div>
{table(
  ["Supplier", "Reste à décaisser", "Retard moyen", "&gt; 90 j", "61-90 j", "31-60 j", "0-30 j", "À échoir"],
  [
    '<td class="lead-cell">Studio Rentals Co</td><td class="money">82 734 Rs</td><td>—</td><td><span class="heat zero">—</span></td><td><span class="heat zero">—</span></td><td><span class="heat zero">—</span></td><td><span class="heat zero">—</span></td><td><span class="heat up2">82 734</span></td>',
    '<td class="lead-cell">Island Print &amp; Sign</td><td class="money">54 819 Rs</td><td>217 j</td><td><span class="heat od3">54 819</span></td><td><span class="heat zero">—</span></td><td><span class="heat zero">—</span></td><td><span class="heat zero">—</span></td><td><span class="heat zero">—</span></td>',
    '<td class="lead-cell">SoundHire Mauritius</td><td class="money">46 628 Rs</td><td>180 j</td><td><span class="heat od2">2 291</span></td><td><span class="heat zero">—</span></td><td><span class="heat zero">—</span></td><td><span class="heat zero">—</span></td><td><span class="heat up1">44 337</span></td>',
    '<td class="lead-cell">MCB (frais)</td><td class="money">12 973 Rs</td><td>363 j</td><td><span class="heat od3">12 973</span></td><td><span class="heat zero">—</span></td><td><span class="heat zero">—</span></td><td><span class="heat zero">—</span></td><td><span class="heat zero">—</span></td>',
  ])}
""")

# --- projects
P["projects"] = dict(
    title="Projects",
    sub="P&L par projet + Budget vs Actual (les lignes de budget existent déjà côté API).",
    actions='<button class="orb-button orb-button--primary">New project</button>',
    content=f"""
<div class="kpi-row kpi-row--3">
  {kpi("Kaya Festival 2026", "+5 288 Rs", None, detail="net · 42 transactions", lead=True, icon_name="folder")}
  {kpi("Studio upgrade", "−184 300 Rs", None, detail="net · 17 transactions")}
  {kpi("the storë — pop-up", "−17 250 Rs", None, detail="net · 3 transactions")}
</div>
{panel("Budget vs Actual — Kaya Festival 2026", '''
  <div style="display:grid;gap:14px;">
    <div>
      <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--orb-text-muted);margin-bottom:5px;">
        <span>Income — 9 450 / 8 000 Rs budgetés</span><span style="color:var(--orb-success);font-weight:700;">118 %</span>
      </div>
      <div class="orb-progress"><span style="width:100%;background:linear-gradient(90deg,#0E7FA6,#2EE6A8);"></span></div>
    </div>
    <div>
      <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--orb-text-muted);margin-bottom:5px;">
        <span>Expenses — 2 380 / 2 000 Rs budgetés</span><span style="color:var(--orb-error);font-weight:700;">119 %</span>
      </div>
      <div class="orb-progress"><span style="width:100%;background:linear-gradient(90deg,#FF8A3C,#EF4444);"></span></div>
    </div>
  </div>''')}
{table(
  ["Category", "Budgeted", "Actual", "Variance", "Status"],
  [
    '<td class="lead-cell">Live income</td><td class="money">8 000 Rs</td><td class="money pos">9 450 Rs</td><td class="money pos">+1 450 Rs</td><td>' + badge("118 % received", "success") + "</td>",
    '<td class="lead-cell">Equipment rental</td><td class="money">2 000 Rs</td><td class="money neg">2 380 Rs</td><td class="money neg">−380 Rs</td><td>' + badge("119 % spent", "error") + "</td>",
    '<td class="lead-cell">Production fees</td><td class="money muted">—</td><td class="money neg">1 782 Rs</td><td class="money muted">—</td><td>' + badge("no budget line", "warning") + "</td>",
  ])}
""")

# --- monitoring
P["monitoring"] = dict(
    title="Monitoring",
    sub="Santé du domaine : contrôles d'intégrité, files en attente, derniers imports.",
    content=f"""
<div class="kpi-row">
  {kpi("Checks", "5 / 6", None, detail="intégrité OK", lead=True, icon_name="search")}
  {kpi("Pending", "12", None, detail="à classifier")}
  {kpi("Unmatched", "128", None, detail="lignes bancaires")}
  {kpi("API p95", "84 ms", None, detail="screen/office")}
</div>
<div class="two-col">
  {panel("Contrôles d'intégrité", '''
    <div class="mini-table">
      <div class="mini-row"><div class="who"><b>Transactions sans catégorie validées</b><span>0 détectée</span></div>''' + badge("pass", "success") + '''</div>
      <div class="mini-row"><div class="who"><b>Allocations orphelines</b><span>0 détectée</span></div>''' + badge("pass", "success") + '''</div>
      <div class="mini-row"><div class="who"><b>Sommes P&L vs ledger</b><span>écart 0,00 Rs</span></div>''' + badge("pass", "success") + '''</div>
      <div class="mini-row"><div class="who"><b>FX manquants</b><span>1 transaction EUR sans taux</span></div>''' + badge("warn", "warning") + '''</div>
      <div class="mini-row"><div class="who"><b>Doublons bancaires</b><span>14 candidats marqués</span></div>''' + badge("pass", "success") + '''</div>
    </div>''')}
  {panel("Derniers imports", '''
    <div class="mini-table">
      <div class="mini-row"><div class="who"><b>SBI JUL 21 — MAY 26.csv</b><span>2 652 lignes · confirmé</span></div><span class="amt">06:00</span></div>
      <div class="mini-row"><div class="who"><b>fixture-mcb-feb.csv</b><span>3 lignes · confirmé</span></div><span class="amt">hier</span></div>
      <div class="mini-row"><div class="who"><b>cashflow-2026-H1.xlsx</b><span>6 mois · confirmé</span></div><span class="amt">02/07</span></div>
    </div>''', link="imports")}
</div>
""")

# --- bank
P["bank"] = dict(
    title="Bank",
    sub="Comptes, lignes brutes de relevés (magnitude + direction), candidats de rapprochement.",
    actions='<button class="orb-button orb-button--primary">Add account</button>',
    content=f"""
<div class="kpi-row kpi-row--3">
  {kpi("MCB Current · MUR", "2 412 632 Rs", None, detail="au 10/07 · actif", lead=True, icon_name="bank")}
  {kpi("SBI Current · MUR", "391 208 Rs", None, detail="au 10/07 · actif")}
  {kpi("MCB EUR", "€ 8 940", None, detail="≈ 435 000 Rs convertis")}
</div>
{table(
  ["Date", "Description", "Reference", "Direction", "Amount", "MUR", "Status"],
  [
    '<td>04/02</td><td class="lead-cell">TRSF BEDOUIN LTD</td><td>INV-BED-1</td><td>' + badge("credit", "success") + '</td><td class="money pos">+500 000,00</td><td class="money pos">+500 000,00</td><td>' + badge("matched", "info") + "</td>",
    '<td>09/02</td><td class="lead-cell">RENTAL PROJECTOR SHOP</td><td>—</td><td>' + badge("debit", "warning") + '</td><td class="money neg">−120 000,00</td><td class="money neg">−120 000,00</td><td>' + badge("suggested", "warning") + "</td>",
    '<td>15/02</td><td class="lead-cell">POS THE STORE</td><td>UNMATCHED</td><td>' + badge("debit", "warning") + '</td><td class="money neg">−8 500,00</td><td class="money neg">−8 500,00</td><td>' + badge("unmatched", "error") + "</td>",
    '<td>21/02</td><td class="lead-cell">SEPA LABEL GmbH</td><td>RY-2026-Q1</td><td>' + badge("credit", "success") + '</td><td class="money pos">+€ 4 980,00</td><td class="money pos">+236 889,45</td><td>' + badge("matched", "info") + "</td>",
  ])}
<div class="row" style="color:var(--orb-text-muted);font-size:12px;">
  <span>Actions par ligne : Create transaction · Ignore · Move account</span>
</div>
""")

# --- audit
P["audit"] = dict(
    title="Audit",
    sub="Journal immuable de toutes les mutations — acteur, action, entité, clé d'idempotence.",
    content=f"""
<div class="orb-panel filter-strip">
  <span class="chip">Actor: <b>All</b></span>
  <span class="chip">Entity: <b>All</b></span>
  <span class="chip">Action: <b>All</b></span>
  <span class="spacer"></span>
  <button class="orb-button orb-button--secondary" style="min-height:32px;">Filter</button>
</div>
{table(
  ["When", "Actor", "Action", "Entity", "Id"],
  [
    '<td>10/07 06:02</td><td>bot · sophie@eeee.mu</td><td class="lead-cell">office_bank_import_confirm</td><td>office_bank_import_batch</td><td style="font-family:var(--orb-mono);font-size:10.5px;">batch_8f21…</td>',
    '<td>09/07 18:44</td><td>d.p.valence@…</td><td class="lead-cell">office_transaction_validate</td><td>office_transaction</td><td style="font-family:var(--orb-mono);font-size:10.5px;">tx_4a90…</td>',
    '<td>09/07 18:41</td><td>d.p.valence@…</td><td class="lead-cell">office_transaction_update</td><td>office_transaction</td><td style="font-family:var(--orb-mono);font-size:10.5px;">tx_4a90…</td>',
    '<td>09/07 11:12</td><td>bot · sophie@eeee.mu</td><td class="lead-cell">office_reconciliation_approve</td><td>office_bank_reconciliation_match</td><td style="font-family:var(--orb-mono);font-size:10.5px;">recon_bb02…</td>',
    '<td>08/07 22:30</td><td>d.p.valence@…</td><td class="lead-cell">office_bank_import_delete</td><td>office_bank_import_batch</td><td style="font-family:var(--orb-mono);font-size:10.5px;">batch_77c1…</td>',
  ])}
""")

# --- vat
P["vat"] = dict(
    title="VAT",
    sub="TVA collectée / déductible sur la période — synthèse déclarable.",
    content=f"""
<div class="kpi-row kpi-row--3">
  {kpi("Net VAT", "+42 318 Rs", None, detail="à reverser", lead=True, icon_name="file-text")}
  {kpi("Collectée", "96 220 Rs", None, detail="sur income validé")}
  {kpi("Déductible", "53 902 Rs", None, detail="sur expenses validées")}
</div>
{table(
  ["Rate", "Base", "Collected", "Deductible", "Net"],
  [
    '<td class="lead-cell">15 %</td><td class="money">641 467 Rs</td><td class="money pos">96 220 Rs</td><td class="money neg">53 902 Rs</td><td class="money pos">+42 318 Rs</td>',
    '<td class="lead-cell">0 % (exempt)</td><td class="money">780 897 Rs</td><td class="money muted">—</td><td class="money muted">—</td><td class="money muted">—</td>',
  ])}
<div class="orb-alert orb-alert--info"><div class="orb-alert__body"><strong>Période</strong><span>Déclaration trimestrielle Q2 2026 — échéance MRA : 2026-07-20.</span></div></div>
""")

# --- settings
P["settings"] = dict(
    title="Settings",
    sub="Configuration du workspace Office : devises, période, zone dangereuse (admin).",
    content=f"""
<div class="two-col">
  {table(
    ["Currency", "Role", "Converted balance (MUR)", "As of"],
    [
      '<td>' + badge("MUR", "info") + '</td><td>Reference currency · 2 accounts</td><td class="money">2 803 840 Rs</td><td>10/07/2026</td>',
      '<td>' + badge("EUR", "muted") + '</td><td>Converted to MUR · 1 account</td><td class="money">435 000 Rs</td><td>10/07/2026</td>',
    ])}
  <div class="drawer-mock" style="border-color:var(--orb-error-border);">
    <div class="panel-title" style="color:var(--orb-error);">Danger zone — administrator only</div>
    <div class="orb-alert orb-alert--error"><div class="orb-alert__body"><strong>Reset financier</strong><span>Efface transactions (validées incluses), comptes, imports, lignes et rapprochements du workspace. Irréversible.</span></div></div>
    <div class="orb-field"><label>Taper la phrase exacte</label><input class="orb-input error" placeholder="DELETE ALL OFFICE DATA"></div>
    <button class="orb-button orb-button--danger">Réinitialiser le workspace</button>
  </div>
</div>
""")

# --- wave-invoices
P["wave-invoices"] = dict(
    title="Wave Invoices",
    sub="Factures importées depuis Wave — statut d'encaissement et lien vers l'écriture.",
    actions='<button class="orb-button orb-button--secondary">Sync Wave</button>',
    content=f"""
{table(
  ["Invoice", "Client", "Issued", "Amount", "Status", "Ledger"],
  [
    '<td class="lead-cell">INV-2026-0141</td><td>Bedouin Ltd</td><td>02/02</td><td class="money pos">500 000,00 Rs</td><td>' + badge("paid", "success") + '</td><td>' + badge("linked", "info") + "</td>",
    '<td class="lead-cell">INV-2026-0152</td><td>Blue Penny Events</td><td>18/03</td><td class="money pos">67 940,00 Rs</td><td>' + badge("overdue", "error") + '</td><td>' + badge("linked", "info") + "</td>",
    '<td class="lead-cell">INV-2026-0166</td><td>Grand Baie Resorts</td><td>02/06</td><td class="money pos">38 059,00 Rs</td><td>' + badge("sent", "warning") + '</td><td>' + badge("—", "muted") + "</td>",
  ])}
<div class="orb-alert orb-alert--info"><div class="orb-alert__body"><strong>Dernière synchro</strong><span>10/07 06:15 — 3 factures à jour, 0 conflit.</span></div></div>
""")

# ---------------------------------------------------------------- index page
def build_index():
    cards = []
    for group, items in NAV:
        for slug, name, ic in items:
            sub = P[slug]["sub"][:90] + ("…" if len(P[slug]["sub"]) > 90 else "")
            cards.append(
                f'<a class="orb-panel panel-pad" style="text-decoration:none;color:inherit;" href="./{slug}.html">'
                f'<div class="panel-title">{group}</div>'
                f'<div style="display:flex;gap:10px;align-items:center;">'
                f'<span class="orb-kpi__icon">{icon(ic, 15)}</span>'
                f'<b style="font-size:14px;color:var(--orb-text);">{name}</b></div>'
                f'<span style="font-size:11.5px;color:var(--orb-text-muted);">{sub}</span></a>')
    content = ('<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">'
               + "".join(cards) + "</div>")
    html = page("__index__", "Office — toutes les pages", "18 maquettes Orbital, une par page réelle de l'app.", content,
                actions='<a class="orb-button orb-button--secondary" href="../index.html">Composants</a>'
                        '<a class="orb-button orb-button--secondary" href="../dashboard.html">Cockpit</a>')
    (OUT / "index.html").write_text(html, encoding="utf-8")

# ---------------------------------------------------------------- build
for slug, spec in P.items():
    html = page(slug, spec["title"], spec["sub"], spec["content"], spec.get("actions", ""))
    (OUT / f"{slug}.html").write_text(html, encoding="utf-8")
build_index()
print(f"built {len(P)} pages + index → {OUT}")
