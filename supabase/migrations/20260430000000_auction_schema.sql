-- SPL Hub — Auction schema (Phase 2, Season 6)
-- Migration: 20260430000000_auction_schema.sql
--
-- Three tables: s6_players, s6_teams, auction_sales
-- RLS enabled on all three with public read policies.
-- Apply manually via Supabase SQL Editor.

-- ─────────────────────────────────────────────
-- S6 PLAYERS
-- (player pool for the Season 6 auction)
-- ─────────────────────────────────────────────
CREATE TABLE s6_players (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL,
  category         text        NOT NULL CHECK (category IN ('A', 'B', 'C', 'D')),
  base_price       integer     NOT NULL,
  mapped_player_id uuid        REFERENCES players(id) ON DELETE SET NULL,
  is_debut         boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX s6_players_mapped_player_id_idx ON s6_players (mapped_player_id);
CREATE INDEX s6_players_category_idx         ON s6_players (category);

ALTER TABLE s6_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read s6_players" ON s6_players FOR SELECT USING (true);

-- ─────────────────────────────────────────────
-- S6 TEAMS
-- (franchises participating in Season 6)
-- ─────────────────────────────────────────────
CREATE TABLE s6_teams (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text        NOT NULL UNIQUE,
  color                 text        NOT NULL,
  captain_s6_player_id  uuid        REFERENCES s6_players(id) ON DELETE SET NULL,
  budget_total          integer     NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX s6_teams_captain_s6_player_id_idx ON s6_teams (captain_s6_player_id);

ALTER TABLE s6_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read s6_teams" ON s6_teams FOR SELECT USING (true);

-- ─────────────────────────────────────────────
-- AUCTION SALES
-- (result of each bid: who bought whom, for how much)
-- ─────────────────────────────────────────────
CREATE TABLE auction_sales (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  s6_player_id   uuid        NOT NULL REFERENCES s6_players(id) ON DELETE CASCADE,
  s6_team_id     uuid        NOT NULL REFERENCES s6_teams(id)   ON DELETE CASCADE,
  price          integer     NOT NULL,
  sold_at        timestamptz NOT NULL DEFAULT now(),
  voided         boolean     NOT NULL DEFAULT false
);

CREATE INDEX auction_sales_player_voided_idx ON auction_sales (s6_player_id, voided);
CREATE INDEX auction_sales_team_id_idx       ON auction_sales (s6_team_id);

ALTER TABLE auction_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read auction_sales" ON auction_sales FOR SELECT USING (true);
