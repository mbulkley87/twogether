package com.matthewbulkley.twogether.game.dto;

/** Outbound server->client relay of the OTHER player's move - see GameSocketHandler. */
public record PeerMoveMessage(String type, int playerSlot, double x, double y, String dir, boolean moving, long seq) {

    public static PeerMoveMessage from(int playerSlot, MoveMessage move) {
        return new PeerMoveMessage("peerMove", playerSlot, move.x(), move.y(), move.dir(), move.moving(), move.seq());
    }
}
