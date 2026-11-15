package com.matthewbulkley.twogether.game.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * A pre-game party room for exactly 2 players - ported from Hero Details'
 * Lobby, with the class-pick step removed since there's nothing to pick
 * here. Once both seats are filled, the host can start; see
 * LobbyService.validateReadyToStart.
 */
public class Lobby {

    public static final int MAX_MEMBERS = 2;

    private final String code;
    private final List<LobbyMember> members = new ArrayList<>();
    private boolean started;
    // Set once the host starts the game - clients learn this over the same
    // lobby WebSocket broadcast and switch to the game socket for this id.
    private UUID gameId;

    public Lobby(String code) {
        this.code = code;
    }

    public String getCode() { return code; }
    public List<LobbyMember> getMembers() { return members; }
    public boolean isStarted() { return started; }
    public void setStarted(boolean started) { this.started = started; }
    public UUID getGameId() { return gameId; }
    public void setGameId(UUID gameId) { this.gameId = gameId; }

    public Optional<LobbyMember> findMember(UUID playerId) {
        return members.stream().filter(member -> member.getPlayerId().equals(playerId)).findFirst();
    }
}
