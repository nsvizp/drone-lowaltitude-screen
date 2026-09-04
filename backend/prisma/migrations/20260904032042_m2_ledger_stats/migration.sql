-- CreateTable
CREATE TABLE "flight_records" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "route_id" INTEGER NOT NULL,
    "route_name" TEXT NOT NULL,
    "flyer_id" INTEGER NOT NULL,
    "flyer_name" TEXT NOT NULL,
    "shelter_id" INTEGER NOT NULL,
    "shelter_name" TEXT NOT NULL,
    "create_time" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "org" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "stock" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "shelters" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "lng" REAL NOT NULL,
    "lat" REAL NOT NULL,
    "spare_drones" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "flyers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "last_mission" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "stat_feeds" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "payload" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_name_key" ON "warehouses"("name");
