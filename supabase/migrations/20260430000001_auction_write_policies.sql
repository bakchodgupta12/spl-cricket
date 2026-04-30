-- SPL Hub — Auction write policies + decimal price fix
-- Run in Supabase SQL Editor after applying 20260430000000_auction_schema.sql
--
-- Without these policies the anon client gets RLS violation (42501)
-- on every INSERT/UPDATE into the auction tables.

-- ── Write policies ──────────────────────────────────────────────────────────
CREATE POLICY "auction admin write" ON s6_players    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "auction admin write" ON s6_teams      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "auction admin write" ON auction_sales FOR ALL USING (true) WITH CHECK (true);

-- ── Allow decimal prices (Cat C/D use 0.5-unit increments) ─────────────────
ALTER TABLE auction_sales ALTER COLUMN price TYPE numeric(10,2);
