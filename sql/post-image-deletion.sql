CREATE TABLE IF NOT EXISTS post_image_delete_jobs (
  path TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  image_id TEXT NOT NULL,
  result TEXT
);

CREATE TABLE IF NOT EXISTS post_image_releases (
  id TEXT PRIMARY KEY,
  bytes INTEGER NOT NULL CHECK (bytes >= 0),
  released INTEGER NOT NULL DEFAULT 0 CHECK (released IN (0, 1))
);

CREATE TABLE IF NOT EXISTS post_image_space (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  bytes INTEGER NOT NULL CHECK (bytes >= 0)
);

CREATE TRIGGER IF NOT EXISTS post_image_return_space
AFTER UPDATE OF released ON post_image_releases
WHEN OLD.released = 0 AND NEW.released = 1
BEGIN
  INSERT INTO post_image_space (id, bytes) VALUES (1, NEW.bytes)
  ON CONFLICT (id) DO UPDATE SET bytes = bytes + excluded.bytes;
END;
