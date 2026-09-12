"use client";
import { useEffect, useState } from 'react';
import { conversionRate, type WebsiteOverview } from '@/lib/website/overview-types';

const number = (value: number) => value.toLocaleString('en-US');
const date = (value: string) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const muted = 'text-[#9aa6bc]';
export function WebsiteOverviewPanel({ initialData }: { initialData: WebsiteOverview | null }) {
  const [data,setData] = useState(initialData);
  const [days,setDays] = useState(30);
  const [revision,setRevision] = useState(0);
  const [loading,setLoading] = useState(!initialData);
  const [error,setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setLoading(true); setError('');
    const timeout = window.setTimeout(() => controller.abort(),15000);
    void fetch(`/api/owner/website?days=${days}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (response.redirected || response.status === 401 || response.status === 403) {
        if (active) setData(null);
        throw new Error('Sign in with an owner or administrator account to view this information.');
      }
      const body = await response.json();
      if (!response.ok || !body.data) throw new Error(body.error || 'Website analytics could not load.');
      if (active) setData(body.data);
    }).catch(cause => { if (active) setError(cause.name === 'AbortError' ? 'The request took too long. Please refresh.' : cause.message); }).finally(() => {
      window.clearTimeout(timeout); if (active) setLoading(false);
    });
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  },[days,revision]);
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') setRevision(value => value+1); },60000);
    return () => window.clearInterval(timer);
  },[]);
  const current = data?.days === days ? data : null;
  return <section id="website-overview" aria-labelledby="website-overview-title" className="mt-4 rounded-xl border border-[#3b2d65] bg-[linear-gradient(145deg,#121328,#09101a)] p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-[10px] font-medium uppercase tracking-[.18em] text-[#baa2ef]">Public website</p><h2 id="website-overview-title" className="mt-1 text-lg font-semibold tracking-tight">Website & private beta</h2><a href="https://projectyouplus.com" target="_blank" rel="noreferrer" className={`mt-1 inline-block text-xs underline decoration-[#594376] underline-offset-4 ${muted}`}>projectyouplus.com</a></div>
      <div className="flex flex-wrap gap-2"><a href="https://search.google.com/search-console?resource_id=sc-domain%3Aprojectyouplus.com" target="_blank" rel="noreferrer" className="flex min-h-10 items-center rounded-lg border border-[#35415a] px-3 text-xs">Google Search performance</a><label className="sr-only" htmlFor="website-period">Website reporting period</label><select id="website-period" value={days} onChange={event => setDays(Number(event.target.value))} className="min-h-10 rounded-lg border border-[#35415a] bg-[#0d1422] px-3 text-xs">{[7,30,90].map(value => <option key={value} value={value}>Last {value} days</option>)}</select><button type="button" onClick={() => setRevision(value => value+1)} disabled={loading} className="min-h-10 rounded-lg border border-[#594481] px-4 text-xs text-[#d1bfff] disabled:opacity-50">{loading ? 'Updating…' : 'Refresh'}</button></div>
    </div>
    {error && <p role="alert" className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/5 p-3 text-xs text-amber-200">{error}{current ? ' Showing the last available data.' : ''}</p>}
    {!current ? <p role="status" className={`py-10 text-center text-sm ${muted}`}>{loading ? 'Loading website activity…' : 'Website activity is unavailable. Refresh to try again.'}</p> : <>
      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Website visits" value={number(current.visits)} detail={`Tracked sessions · ${days} days`} />
        <Metric label="New beta signups" value={number(current.signups)} detail={`Unique email entries · ${days} days`} />
        <Metric label="Visit-to-signup rate" value={conversionRate(current.converted_visits,current.visits)} detail={`${number(current.converted_visits)} tracked visits joined`} />
        <Metric label="Total waitlist" value={number(current.total_waitlist)} detail={`${number(current.waiting)} waiting for access · all time`} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 rounded-xl border border-[#263149] bg-[#080f1b]/70 p-4"><h3 className="text-sm font-semibold">Visits & signups</h3><ActivityChart rows={current.daily} /><div className={`mt-3 flex flex-wrap gap-4 text-xs ${muted}`}><span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#ad8bfa]" />Visits</span><span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#6ee7b7]" />Beta signups</span><span className="ml-auto">Daily · UTC</span></div><div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#263149] pt-3"><Small label="Beta CTA sessions" value={current.cta_visits}/><Small label="Form starts" value={current.form_starts}/><Small label="Converted visits" value={current.converted_visits}/></div></div>
        <div className="min-w-0 rounded-xl border border-[#263149] bg-[#080f1b]/70 p-4"><h3 className="text-sm font-semibold">Traffic sources</h3><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead className={muted}><tr><th scope="col" className="py-2 font-normal">Source</th><th scope="col" className="text-right font-normal">Visits</th><th scope="col" className="text-right font-normal">Signups</th><th scope="col" className="text-right font-normal">Rate</th></tr></thead><tbody>{current.sources.map(row => <tr key={row.source} className="border-t border-[#202c41]"><th scope="row" className="py-3 font-medium capitalize">{row.source}</th><td className="text-right">{number(row.visits)}</td><td className="text-right">{number(row.signups)}</td><td className="text-right text-[#cdb9ff]">{conversionRate(row.converted,row.visits)}</td></tr>)}</tbody></table></div>{!current.sources.length && <Empty>No traffic recorded in this period.</Empty>}</div>
      </div>
      <details className="mt-4 rounded-xl border border-[#263149] bg-[#080f1b]/70 p-4"><summary className="cursor-pointer text-sm font-semibold">Campaign performance</summary><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-xs"><thead className={muted}><tr><th scope="col" className="py-2 font-normal">Campaign</th><th scope="col" className="font-normal">Source / medium</th><th scope="col" className="text-right font-normal">Visits</th><th scope="col" className="text-right font-normal">Signups</th></tr></thead><tbody>{current.campaigns.map(row => <tr key={`${row.source}:${row.medium}:${row.campaign}`} className="border-t border-[#202c41]"><th scope="row" className="max-w-[220px] break-words py-3 pr-3 font-medium">{row.campaign || 'No campaign tag'}</th><td className="max-w-[180px] break-words pr-3">{row.source}{row.medium ? ` / ${row.medium}` : ''}</td><td className="text-right">{number(row.visits)}</td><td className="text-right">{number(row.signups)}</td></tr>)}</tbody></table></div>{!current.campaigns.length && <Empty>Campaigns appear when visitors arrive through tracked links.</Empty>}<p className={`mt-3 text-[11px] ${muted}`}>Top 10 campaigns by signups, then visits.</p></details>
      <div className="mt-4 rounded-xl border border-[#263149] bg-[#080f1b]/70 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Recent beta signups</h3><span className={`text-[11px] ${muted}`}>Latest 10 in this period</span></div><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[660px] text-left text-xs"><thead className={muted}><tr>{['Person','Focus','Source','Joined','Status'].map(label => <th key={label} scope="col" className="py-2 pr-4 font-normal">{label}</th>)}</tr></thead><tbody>{current.recent.map(row => <tr key={row.id} className="border-t border-[#202c41]"><td className="max-w-[240px] break-words py-3 pr-4"><div className="font-medium">{row.name}</div><div className={`mt-1 ${muted}`}>{row.email}</div></td><td className="max-w-[220px] break-words pr-4">{row.improvement_goal || 'Not provided'}</td><td className="max-w-[170px] break-words pr-4"><div className="capitalize">{row.source}</div>{row.utm_campaign && <div className={`mt-1 ${muted}`}>{row.utm_campaign}</div>}</td><td className="whitespace-nowrap pr-4">{date(row.created_at)}</td><td className="capitalize text-[#cdb9ff]">{row.signup_status}</td></tr>)}</tbody></table></div>{!current.recent.length && <Empty>No beta signups in this period yet.</Empty>}</div>
      <p className={`mt-4 text-[11px] leading-relaxed ${muted}`}>Visits are anonymous tab sessions, not unique people. Conversion counts visits with a recorded signup; signups without a matching visit remain in signup totals. Known QA campaigns and reserved test emails are excluded. Early launch totals include untagged development checks. Updates every minute while this page is visible.</p>
      <p className={`mt-1 text-[11px] ${muted}`}>Updated {new Date(current.updated_at).toLocaleString('en-US',{timeZone:'UTC'})} UTC.</p>
    </>}
  </section>;
}
function Metric({label,value,detail}:{label:string;value:string;detail:string}) { return <div className="rounded-xl border border-[#34314d] bg-[#17142b]/60 p-4"><p className={`text-xs ${muted}`}>{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight text-[#ede5ff]">{value}</p><p className={`mt-2 text-[11px] ${muted}`}>{detail}</p></div>; }
function Small({label,value}:{label:string;value:number}) { return <div><p className="text-lg font-semibold">{number(value)}</p><p className={`mt-1 text-[10px] ${muted}`}>{label}</p></div>; }
function Empty({children}:{children:React.ReactNode}) { return <p className={`py-7 text-center text-xs ${muted}`}>{children}</p>; }
function ActivityChart({rows}:{rows:WebsiteOverview['daily']}) {
  const width=680,height=200,pad=24,bottom=172,max=Math.max(1,...rows.map(row=>Math.max(row.visits,row.signups)));
  const x=(i:number)=>pad+i*(width-pad*2)/Math.max(1,rows.length-1),y=(n:number)=>bottom-n/max*(bottom-pad);
  const points=(key:'visits'|'signups')=>rows.map((row,i)=>`${x(i)},${y(row[key])}`).join(' ');
  return <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-[200px] w-full" role="img" aria-label={`Daily visits and beta signups for ${rows.length} days. ${rows.reduce((sum,row)=>sum+row.visits,0)} visits and ${rows.reduce((sum,row)=>sum+row.signups,0)} signups.`}>
    {[0,.5,1].map(level=><g key={level}><line x1={pad} x2={width-pad} y1={y(max*level)} y2={y(max*level)} stroke="#273349" strokeDasharray="3 6"/><text x={pad} y={y(max*level)-5} fill="#9aa6bc" fontSize="10">{Math.round(max*level)}</text></g>)}
    <polyline points={points('visits')} fill="none" stroke="#ad8bfa" strokeWidth="2.5" strokeLinejoin="round"/><polyline points={points('signups')} fill="none" stroke="#6ee7b7" strokeWidth="2.5" strokeLinejoin="round"/>
    {rows.map((row,i)=><g key={row.date}><circle cx={x(i)} cy={y(row.visits)} r={row.visits?3:0} fill="#ad8bfa"/><circle cx={x(i)} cy={y(row.signups)} r={row.signups?3:0} fill="#6ee7b7"/><rect x={x(i)-8} y={pad} width="16" height={bottom-pad} fill="transparent"><title>{date(row.date)}: {row.visits} visits, {row.signups} signups</title></rect></g>)}
    <text x={pad} y={height-4} fill="#9aa6bc" fontSize="10">{rows[0] ? date(rows[0].date) : ''}</text><text x={width-pad} y={height-4} textAnchor="end" fill="#9aa6bc" fontSize="10">Today</text>
  </svg>;
}
