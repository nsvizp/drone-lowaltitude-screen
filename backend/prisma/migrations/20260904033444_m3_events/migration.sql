-- CreateTable
CREATE TABLE "event_feed" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "node_records" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "disaster_id" INTEGER,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "disaster_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "severity" INTEGER NOT NULL,
    "lng" REAL NOT NULL,
    "lat" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" DATETIME
);
