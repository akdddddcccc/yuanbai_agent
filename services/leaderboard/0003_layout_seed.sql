-- NULL preserves already-started legacy maps and old clients.
ALTER TABLE runs ADD COLUMN layout_seed TEXT;
