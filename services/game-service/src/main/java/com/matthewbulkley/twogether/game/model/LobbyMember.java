package com.matthewbulkley.twogether.game.model;

import java.util.UUID;

/**
 * One party seat. No class-pick step here (unlike Hero Details' lobby this
 * was ported from) - with a hard MAX_MEMBERS of 2, "ready" just means both
 * seats are filled.
 */
public class LobbyMember {

    private final UUID playerId;
    private String playerName;
    private boolean host;
    private boolean connected;

    public LobbyMember(UUID playerId, String playerName, boolean host) {
        this.playerId = playerId;
        this.playerName = playerName;
        this.host = host;
        this.connected = true;
    }

    public UUID getPlayerId() { return playerId; }
    public String getPlayerName() { return playerName; }
    public boolean isHost() { return host; }
    public void setHost(boolean host) { this.host = host; }
    public boolean isConnected() { return connected; }
    public void setConnected(boolean connected) { this.connected = connected; }
}
