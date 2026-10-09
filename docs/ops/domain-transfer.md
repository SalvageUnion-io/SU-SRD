# Domain transfer to Cloudflare Registrar

Moves both domains' registrations to Cloudflare Registrar, where their DNS
already lives, and closes out Netlify ([#839](https://github.com/SalvageUnion-io/SU-SRD/issues/839)).
A one-off operator runbook, prepared 2026-10-08: delete it once both transfers
and the Netlify cleanup are done.

Every step marked **you** happens in a registrar or billing UI: it needs the
owner's sign-in, an auth code (a secret) or a payment, so an agent prepares and
verifies but does not perform it.

## Where things stand (2026-10-08)

| | `salvageunion.io` | `intheunionnow.com` |
| --- | --- | --- |
| Registrar | Name.com, in the owner's own account since 2026-08-28 (Netlify ticket #1093312, [#925](https://github.com/SalvageUnion-io/SU-SRD/pull/925)) | Tucows, managed at **Hover** |
| DNS | Cloudflare, zone active since 2026-08-31 ([#926](https://github.com/SalvageUnion-io/SU-SRD/pull/926)) | Cloudflare, since 2026-08-19 |
| Transfer lock | on (`clientTransferProhibited`) | on (`clientTransferProhibited`, `clientUpdateProhibited`) |
| DNSSEC | off (no DS record) | off (no DS record) |
| Last changed | 2026-09-05 (a renewal: expiry moved a year) | 2026-08-19 (the nameserver change) |
| Expires | 2027-11-17 → 2028-11-17 after transfer | 2027-02-15 → 2028-02-15 after transfer |
| Earliest transfer | **2026-10-28** (see below) | **now** |

Netlify is no longer in either domain's registration path. The Netlify cleanup
at the end does not wait on these transfers.

**Why `salvageunion.io` waits.** ICANN locks a transfer for 60 days after a
registrant name, organisation or email change, and Name.com recorded one on
2026-08-28 when Netlify handed the domain over, so the lock lifts 2026-10-27.
If the 2026-09-05 change also touched contacts, it lifts 2026-11-04. Name.com's
domain page shows the exact date. Cloudflare will hold an early request
"In Progress", but auth codes expire, so start after the lock lifts.

Re-check the table before starting:

```bash
whois salvageunion.io | grep -i -E 'registrar:|updated|expir|status'
whois intheunionnow.com | grep -i -E 'registrar:|updated|expir|status'
dig +short DS salvageunion.io; dig +short DS intheunionnow.com
```

Both DS lookups must print nothing: Cloudflare refuses a transfer while DNSSEC
is on at the old registrar.

## Steps, per domain

`intheunionnow.com` can go first and rehearses the flow.

| # | Who | Where | Do |
| --- | --- | --- | --- |
| 1 | — | Cloudflare | Nothing: each zone is already Active on a full setup, which Cloudflare requires before it accepts an auth code. |
| 2 | you | Name.com → My Domains → `salvageunion.io`; Hover → Domains → `intheunionnow.com` | Note the transfer-lock date (Name.com) and whether auto-renew is on. |
| 3 | you | same page → **Transfer Lock** (Name.com) / **Transfer lock** toggle (Hover) | Turn it off, along with any separate domain or privacy lock. |
| 4 | you | same page → **Authorization Code** / **Auth code** | Copy the EPP code. Request it just before step 5, since it expires, and never paste it into chat. |
| 5 | you | Cloudflare dashboard → Domain Registration → **Transfer Domains** | Select the domain and paste the auth code. Confirm the payment method first: a failed charge can leave the transfer half-started. The price (one year at Cloudflare's at-cost rate) is shown before you pay. |
| 6 | you | same flow | Confirm the registrant contacts, then **Confirm transfer**. |
| 7 | you | email from Name.com / Hover about the transfer out | Approve it. Otherwise the old registrar takes up to five days to release the domain. |
| 8 | agent | terminal | Run the verification below. |

Expect about 30 minutes of active work. Cloudflare quotes up to 10 days end to
end, and approving step 7 usually makes it hours.

Do not change nameservers at any point: they are already Cloudflare's. Do not
turn DNSSEC on at the old registrar mid-transfer. Afterwards, Cloudflare
enables DNSSEC in one click.

## Verify

```bash
whois salvageunion.io | grep -i -E 'registrar:|expir'
whois intheunionnow.com | grep -i -E 'registrar:|expir'
curl -sI https://salvageunion.io | grep -i '^server'
curl -sI https://intheunionnow.com | grep -i '^server'
```

Expect `Registrar: Cloudflare, Inc.` with the new expiry dates, and
`server: cloudflare`. In the dashboard, both domains appear under Domain
Registration → Manage Domains.

Then turn off auto-renew at Name.com and Hover, or close those accounts, so
neither bills for a domain it no longer holds.

## Netlify cleanup (#839)

This is independent of the transfers, and safe now: the registration left
Netlify on 2026-08-28, and #925 retracted the old "do not delete the team"
warning.

1. **you:** Netlify → site `suindex` → Site configuration → Danger zone →
   **Delete site**. It still lists `salvageunion.io` as its primary domain but
   has served nothing since 2026-08-31, and `suindex.netlify.app` returns 404.
   If the delete fails again, remove the custom domain under Domain management
   first and retry; failing that, open a support ticket citing #1093312.
2. **you:** Netlify → team → **Domains**. If a `salvageunion.io` DNS zone is
   still listed, delete it. The registry no longer delegates to it, so no live
   record goes with it.
3. **you:** Netlify → team → Billing. Confirm that no domain renewal is
   scheduled (the 2026-10-14 auto-renew recorded in
   [#863](https://github.com/SalvageUnion-io/SU-SRD/pull/863) should have left
   with the registration) and that no paid plan remains.
4. **you:** delete the `salvageunion-io` team. `in-the-union-now` and
   `su-assets` are already gone.
5. **agent:** close #839, remove the Netlify bullet from
   [services and agent tooling](../ARCHITECTURE.md#services-and-agent-tooling),
   and delete this runbook.
