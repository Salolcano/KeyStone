"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { connect, fromWei, read, toWei, write } from "../lib/gl";

type Dep = { id: number; property: string; lease_terms: string; tenant: string; landlord: string; amount: string; status: string; attempts: number; tenant_url: string; landlord_url: string; tenant_paid: string; reason: string };
const LABEL: Record<string, string> = { funded: "Open", ruled: "Ruled", refunded: "Refunded", cancelled: "Cancelled", returned: "Returned" };
const short = (a: string) => a.slice(0, 6) + "..." + a.slice(-4);

export default function Home() {
  const [tab, setTab] = useState<"deposits" | "dashboard">("deposits");
  const [me, setMe] = useState("");
  const [deps, setDeps] = useState<Dep[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ landlord: "", property: "", terms: "", gen: "" });
  const [urls, setUrls] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    try { setDeps(JSON.parse(String(await read("get_deposits")))); }
    catch { setMsg("Could not read the contract. Check NEXT_PUBLIC_CONTRACT_ADDRESS."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function run(fn: string, args: any[], value = BigInt(0)) {
    setBusy(true); setMsg("Waiting for your wallet and the validators...");
    try {
      const acct = me || (await connect()); setMe(acct);
      await write(acct, fn, args, value);
      setMsg("Confirmed on Studio Next."); await load();
    } catch (e: any) { setMsg(e?.shortMessage || e?.message || "Transaction failed"); }
    setBusy(false);
  }

  const s = useMemo(() => {
    const n: Record<string, number> = { funded: 0, ruled: 0, refunded: 0, cancelled: 0, returned: 0 };
    let locked = BigInt(0), shareSum = 0, ruled = 0;
    for (const d of deps) {
      n[d.status]++;
      if (d.status === "funded") locked += BigInt(d.amount);
      if (d.status === "ruled") { ruled++; shareSum += Number((BigInt(d.tenant_paid) * BigInt(100)) / BigInt(d.amount)); }
    }
    return { n, locked, avg: ruled ? Math.round(shareSum / ruled) : 0 };
  }, [deps]);

  return (
    <>
      <header className="nav">
        <div className="brand"><svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#d9bb86" strokeWidth="2"><path d="M3 14 14 4l11 10M6 12v12h16V12"/><circle cx="14" cy="17" r="2"/></svg>Keystone Deposits</div>
        <nav className="tabs">
          <button className={"tab" + (tab === "deposits" ? " on" : "")} onClick={() => setTab("deposits")}>Deposits</button>
          <button className={"tab" + (tab === "dashboard" ? " on" : "")} onClick={() => setTab("dashboard")}>Dashboard</button>
        </nav>
        <button className="btn gold" onClick={async () => setMe(await connect())}>{me ? short(me) : "Connect wallet"}</button>
      </header>

      <section className="hero">
        <div>
          <h1>Rental deposits, settled <em>on the record.</em></h1>
          <p>The tenant locks the deposit. Landlord and tenant each post a public evidence page. GenLayer validators read both and decide the split. No one holds the money but the contract.</p>
          <div className="stats">
            <div><b>{s.n.funded}</b><span>Deposits held</span></div>
            <div><b>{fromWei(s.locked)}</b><span>GEN in escrow</span></div>
            <div><b>{s.avg}%</b><span>Average tenant share when ruled</span></div>
          </div>
        </div>
        <svg className="house" viewBox="0 0 380 300" fill="none" stroke="#d9bb86" strokeWidth="2.5" aria-hidden>
          <path d="M30 150 190 30l160 120M62 128v150h256V128"/><path d="M150 278V190a40 40 0 0 1 80 0v88"/><circle cx="190" cy="205" r="9"/><path d="M190 214v26M258 150h38v38h-38zM84 150h38v38H84z"/>
        </svg>
      </section>

      <section className="section">
        <h2>How a deposit is <em>decided</em></h2>
        <div className="steps">
          <div className="step"><h3>1. Lock</h3><p>The tenant sends the deposit with the lease terms. The contract holds it.</p></div>
          <div className="step"><h3>2. Present evidence</h3><p>Each party links a public page: move-in report, photos, repair invoices.</p></div>
          <div className="step"><h3>3. Rule or refund</h3><p>Validators set the split. If they cannot decide, the tenant can take the full deposit back, and a second inconclusive ruling refunds it automatically.</p></div>
        </div>
      </section>

      {tab === "deposits" ? (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="panel">
            <h2>Open a deposit</h2>
            <div className="form">
              <label>Landlord address<input value={form.landlord} onChange={e => setForm({ ...form, landlord: e.target.value })} placeholder="0x..." /></label>
              <label>Deposit (GEN)<input value={form.gen} onChange={e => setForm({ ...form, gen: e.target.value })} placeholder="5" /></label>
              <label className="full">Property<input value={form.property} onChange={e => setForm({ ...form, property: e.target.value })} placeholder="Unit 4B, 12 Harbour Street" /></label>
              <label className="full">Lease terms for deductions<textarea rows={3} value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} placeholder="Deposit returns in full minus damage beyond normal wear and unpaid rent." /></label>
            </div>
            <p><button className="btn" disabled={busy || !form.landlord || !form.property || !form.gen} onClick={() => run("create_deposit", [form.landlord, form.property, form.terms], toWei(form.gen))}>Lock deposit</button></p>
            {msg && <div className="msg">{msg}</div>}
          </div>

          {deps.length === 0 && <p className="mute">No deposits yet. Open the first one above.</p>}
          {[...deps].reverse().map(d => {
            const isT = me === d.tenant.toLowerCase(), isL = me === d.landlord.toLowerCase(), open = d.status === "funded";
            return (
              <div className="case" key={d.id}>
                <div className="row"><h3>{d.property}</h3><span className="pill">{LABEL[d.status]}</span><span className="mute">{fromWei(d.amount)} GEN</span></div>
                <div className="mute">Tenant {short(d.tenant)} / Landlord {short(d.landlord)} / Attempts {d.attempts}</div>
                <div>{d.lease_terms}</div>
                <div className="mute">{d.reason}</div>
                {open && (isT || isL) && (
                  <div className="row">
                    <input style={{ flex: 1, minWidth: 220 }} placeholder="Evidence page URL" value={urls[d.id] || ""} onChange={e => setUrls({ ...urls, [d.id]: e.target.value })} />
                    <button className="btn ghost" disabled={busy || !urls[d.id]} onClick={() => run("submit_evidence", [d.id, urls[d.id]])}>Submit evidence</button>
                    <button className="btn" disabled={busy || !(d.tenant_url || d.landlord_url)} onClick={() => run("request_ruling", [d.id])}>Request ruling</button>
                  </div>
                )}
                {open && isT && d.attempts === 0 && !d.landlord_url && <div className="row"><button className="btn ghost" disabled={busy} onClick={() => run("cancel_deposit", [d.id])}>Cancel deposit</button></div>}
                {open && isT && d.attempts > 0 && <div className="row"><button className="btn gold" disabled={busy} onClick={() => run("claim_refund", [d.id])}>Refund full deposit</button><span className="mute">Validators could not decide. You can take the deposit back now.</span></div>}
                {open && isL && <div className="row"><button className="btn ghost" disabled={busy} onClick={() => run("landlord_release", [d.id])}>Return full deposit</button></div>}
              </div>
            );
          })}
        </section>
      ) : (
        <section className="section" style={{ paddingTop: 0 }}>
          <h2>Dashboard</h2>
          <div className="grid4" style={{ marginTop: 18 }}>
            <div className="stat"><b>{deps.length}</b>Total deposits</div>
            <div className="stat"><b>{fromWei(s.locked)}</b>GEN held now</div>
            <div className="stat"><b>{s.avg}%</b>Average tenant share</div>
            <div className="stat"><b>{s.n.refunded + s.n.cancelled + s.n.returned}</b>Full refunds</div>
          </div>
          <div className="panel" style={{ marginTop: 20 }}>
            <h3>Outcomes</h3>
            {Object.keys(LABEL).map(k => (
              <div className="bar" key={k}><span>{LABEL[k]}</span><span><i style={{ width: deps.length ? (s.n[k] / deps.length) * 100 + "%" : 0 }} /></span><b>{s.n[k]}</b></div>
            ))}
          </div>
          <div className="panel" style={{ marginTop: 20, overflowX: "auto" }}>
            <table>
              <thead><tr><th>Property</th><th>Amount</th><th>Status</th><th>Tenant received</th><th>Attempts</th></tr></thead>
              <tbody>{deps.map(d => <tr key={d.id}><td>{d.property}</td><td>{fromWei(d.amount)} GEN</td><td>{LABEL[d.status]}</td><td>{fromWei(d.tenant_paid)} GEN</td><td>{d.attempts}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
      <footer className="foot">Keystone Deposits runs on GenLayer Studio Next (chain 61997).</footer>
    </>
  );
}
