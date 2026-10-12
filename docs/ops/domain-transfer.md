# Domain transfer to Cloudflare Registrar

One-off runbook for [#839](https://github.com/SalvageUnion-io/SU-SRD/issues/839): move both registrations to Cloudflare (DNS is already there) and close out Netlify.
Delete it when done. **you** = owner-only (sign-in, auth code or payment); the agent prepares and verifies.

1. **Know the starting point.** `intheunionnow.com`: Hover (Tucows), transferable now. `salvageunion.io`: Name.com, ICANN 60-day lock
   lifts 2026-10-28 (2026-11-04 if the 2026-09-05 renewal touched contacts; Name.com shows the date).
2. **Re-check before starting (agent).** `whois <domain> | grep -i -E 'registrar:|updated|expir|status'`; `dig +short DS <domain>` must print
   nothing (DNSSEC on blocks the transfer).
3. **Go `intheunionnow.com` first.** It rehearses the flow; Cloudflare needs nothing, both zones are already Active.
4. **you: unlock.** Name.com → My Domains / Hover → Domains: turn off the transfer lock and any domain or privacy lock; note auto-renew.
5. **you: get the EPP auth code.** Just before the next step (it expires); never paste it into chat.
6. **you: start the transfer.** Cloudflare → Domain Registration → Transfer Domains: paste the code, confirm the payment method
   and registrant contacts, then Confirm transfer.
7. **you: approve the transfer-out email** from Name.com / Hover; otherwise the release takes up to five days.
8. **Never touch nameservers or DNSSEC mid-transfer.** Enable DNSSEC in Cloudflare afterwards.
9. **Verify (agent).** `whois <domain> | grep -i -E 'registrar:|expir'` shows `Registrar: Cloudflare, Inc.`;
   `curl -sI https://<domain> | grep -i '^server'` shows `server: cloudflare`.
10. **you: stop old billing.** Turn off auto-renew at Name.com and Hover, or close the accounts.

## Netlify cleanup

Independent of the transfers; safe now.

1. **you: delete site `suindex`.** Site configuration → Danger zone → Delete site. If it fails, remove the custom domain first;
   failing that, open a support ticket citing #1093312.
2. **you: delete any leftover `salvageunion.io` DNS zone.** Team → Domains; nothing delegates to it.
3. **you: check billing.** Team → Billing: no domain renewal scheduled, no paid plan left.
4. **you: delete the `salvageunion-io` team.**
5. **agent: close #839 and delete this runbook.**
