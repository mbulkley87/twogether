package com.matthewbulkley.twogether.game.model;

import java.util.List;
import java.util.Map;

/**
 * Just enough of a level for the server to enforce the puzzle rules - no
 * wall/collision geometry at all, since movement is client-authoritative
 * (the server never simulates a wall collision, see GameSessionService).
 * Generated from the same Tiled .tmj the frontend loads - see
 * frontend/scripts/extract-level-manifest.mjs.
 */
public record LevelManifest(
        TileCoord spawn1,
        TileCoord spawn2,
        TileCoord goal1,
        TileCoord goal2,
        Map<String, TileCoord> plates,
        Map<String, List<TileCoord>> doors
) {
}
