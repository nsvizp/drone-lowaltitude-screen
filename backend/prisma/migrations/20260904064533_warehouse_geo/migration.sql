-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_warehouses" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "org" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "stock" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "lng" REAL NOT NULL DEFAULT 0,
    "lat" REAL NOT NULL DEFAULT 0
);
INSERT INTO "new_warehouses" ("capacity", "id", "items", "name", "org", "stock") SELECT "capacity", "id", "items", "name", "org", "stock" FROM "warehouses";
DROP TABLE "warehouses";
ALTER TABLE "new_warehouses" RENAME TO "warehouses";
CREATE UNIQUE INDEX "warehouses_name_key" ON "warehouses"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
