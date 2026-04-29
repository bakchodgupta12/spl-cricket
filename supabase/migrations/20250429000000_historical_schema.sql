-- SPL Hub — Historical schema (Phase 1)
-- Migration: 20250429000000_historical_schema.sql
--
-- Covers: seasons, teams, players, player_season_aliases, matches,
--         match_squads, innings, batting_records, bowling_records, fielding_credits
--
-- Auction tables (s6_*) are intentionally omitted — Phase 2/3.

-- ─────────────────────────────────────────────
-- SEASONS
-- ─────────────────────────────────────────────
CREATE TABLE seasons (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  number      integer     NOT NULL,          -- e.g. 1, 2, 3, 4, 5
  year        integer     NOT NULL,          -- calendar year the season was played
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seasons_number_unique UNIQUE (number)
);

-- ─────────────────────────────────────────────
-- TEAMS
-- (one row per team per season; same franchise can exist across seasons)
-- ─────────────────────────────────────────────
CREATE TABLE teams (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id   uuid        NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  color       text        NOT NULL DEFAULT '#6b7280',  -- hex colour for UI
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX teams_season_id_idx ON teams (season_id);

-- ─────────────────────────────────────────────
-- PLAYERS
-- (canonical identity across all seasons)
-- ─────────────────────────────────────────────
CREATE TABLE players (
  id              uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name  text  NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT players_canonical_name_unique UNIQUE (canonical_name)
);

CREATE INDEX players_canonical_name_idx ON players (canonical_name);

-- ─────────────────────────────────────────────
-- PLAYER SEASON ALIASES
-- (name as registered in a specific season's scorecard)
-- ─────────────────────────────────────────────
CREATE TABLE player_season_aliases (
  player_id        uuid  NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season_id        uuid  NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  registered_name  text  NOT NULL,
  PRIMARY KEY (player_id, season_id)
);

CREATE INDEX player_season_aliases_player_id_idx ON player_season_aliases (player_id);
CREATE INDEX player_season_aliases_season_id_idx ON player_season_aliases (season_id);

-- ─────────────────────────────────────────────
-- MATCHES
-- ─────────────────────────────────────────────
CREATE TABLE matches (
  id                    uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id             uuid    NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  file_name             text,                 -- source PDF filename for traceability
  date                  date,
  match_type            text,                 -- e.g. 'league', 'playoff', 'final'
  team_a_id             uuid    REFERENCES teams(id) ON DELETE SET NULL,
  team_b_id             uuid    REFERENCES teams(id) ON DELETE SET NULL,
  winner_team_id        uuid    REFERENCES teams(id) ON DELETE SET NULL,
  is_super_over_match   boolean NOT NULL DEFAULT false,
  abandoned             boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX matches_season_id_idx   ON matches (season_id);
CREATE INDEX matches_date_idx        ON matches (date);
CREATE INDEX matches_team_a_id_idx   ON matches (team_a_id);
CREATE INDEX matches_team_b_id_idx   ON matches (team_b_id);

-- ─────────────────────────────────────────────
-- MATCH SQUADS
-- (which players appeared in which match, for which team)
-- ─────────────────────────────────────────────
CREATE TABLE match_squads (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    uuid    NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id     uuid    NOT NULL REFERENCES teams(id)  ON DELETE CASCADE,
  player_id   uuid    NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  is_captain  boolean NOT NULL DEFAULT false,
  is_wk       boolean NOT NULL DEFAULT false,
  CONSTRAINT match_squads_match_player_unique UNIQUE (match_id, player_id)
);

CREATE INDEX match_squads_player_id_idx ON match_squads (player_id);
CREATE INDEX match_squads_match_id_idx  ON match_squads (match_id);
CREATE INDEX match_squads_team_id_idx   ON match_squads (team_id);

-- ─────────────────────────────────────────────
-- INNINGS
-- ─────────────────────────────────────────────
CREATE TABLE innings (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        uuid    NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  batting_team_id uuid    NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  bowling_team_id uuid    NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  runs            integer,
  wickets         integer,
  balls           integer,
  is_super_over   boolean NOT NULL DEFAULT false
);

CREATE INDEX innings_match_id_idx ON innings (match_id);

-- ─────────────────────────────────────────────
-- BATTING RECORDS
-- ─────────────────────────────────────────────
CREATE TABLE batting_records (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  innings_id      uuid    NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  player_id       uuid    NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  runs            integer NOT NULL DEFAULT 0,
  balls           integer NOT NULL DEFAULT 0,
  fours           integer NOT NULL DEFAULT 0,
  sixes           integer NOT NULL DEFAULT 0,
  dismissal_text  text,                       -- raw dismissal string from scorecard
  not_out         boolean NOT NULL DEFAULT false
);

CREATE INDEX batting_records_player_id_idx  ON batting_records (player_id);
CREATE INDEX batting_records_innings_id_idx ON batting_records (innings_id);

-- ─────────────────────────────────────────────
-- BOWLING RECORDS
-- ─────────────────────────────────────────────
CREATE TABLE bowling_records (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  innings_id       uuid    NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  player_id        uuid    NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  balls_bowled     integer NOT NULL DEFAULT 0,
  runs_conceded    integer NOT NULL DEFAULT 0,
  wickets          integer NOT NULL DEFAULT 0,
  dot_balls        integer NOT NULL DEFAULT 0,
  fours_conceded   integer NOT NULL DEFAULT 0,
  sixes_conceded   integer NOT NULL DEFAULT 0,
  wides            integer NOT NULL DEFAULT 0,
  no_balls         integer NOT NULL DEFAULT 0,
  maidens          integer NOT NULL DEFAULT 0
);

CREATE INDEX bowling_records_player_id_idx  ON bowling_records (player_id);
CREATE INDEX bowling_records_innings_id_idx ON bowling_records (innings_id);

-- ─────────────────────────────────────────────
-- FIELDING CREDITS
-- ─────────────────────────────────────────────
CREATE TABLE fielding_credits (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  innings_id  uuid  NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  player_id   uuid  NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kind        text  NOT NULL CHECK (kind IN ('catch', 'stumping', 'run_out'))
);

CREATE INDEX fielding_credits_player_id_idx  ON fielding_credits (player_id);
CREATE INDEX fielding_credits_innings_id_idx ON fielding_credits (innings_id);
