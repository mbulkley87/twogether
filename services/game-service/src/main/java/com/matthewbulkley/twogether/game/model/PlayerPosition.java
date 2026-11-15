package com.matthewbulkley.twogether.game.model;

/**
 * Immutable snapshot of one player's latest reported position - GameSession
 * holds a volatile reference to one of these per player and swaps it out
 * wholesale on each update, rather than mutating fields, so a read never
 * sees a half-updated position without needing a lock. lastSeq guards
 * against applying a late/out-of-order packet over a newer one.
 */
public record PlayerPosition(double x, double y, String dir, boolean moving, long lastSeq) {

    public static PlayerPosition initial(TileCoord spawnTile, int tileSize, int playerSize) {
        double x = spawnTile.x() * tileSize + (tileSize - playerSize) / 2.0;
        double y = spawnTile.y() * tileSize + (tileSize - playerSize) / 2.0;
        return new PlayerPosition(x, y, "down", false, -1);
    }
}
