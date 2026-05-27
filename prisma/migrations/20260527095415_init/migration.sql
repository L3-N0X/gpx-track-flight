-- CreateTable
CREATE TABLE "SharedTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gpxContent" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
