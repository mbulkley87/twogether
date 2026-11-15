package com.matthewbulkley.twogether.game.dto;

/** Inbound client->server message over /ws/game/{gameId} - see GameSocketHandler. */
public record MoveMessage(String type, long seq, double x, double y, String dir, boolean moving) {
}
