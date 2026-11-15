package com.matthewbulkley.twogether.game.model;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * One active 2-player game. The host (from the Lobby) is always player 1
 * (spawn1/goal1); the other member is always player 2 - assigned once at
 * creation and never re-derived. Positions are client-authoritative (each
 * browser simulates its own player and reports in); openDoors/completed
 * are server-authoritative, computed from both players' latest reported
 * positions - see GameSessionService.applyMove for why that split exists.
 */
public class GameSession {

    private final UUID id;
    private final String levelId;
    private final LevelManifest level;
    private final UUID player1Id;
    private final UUID player2Id;
    private final Instant startedAt;

    private volatile PlayerPosition player1Pos;
    private volatile PlayerPosition player2Pos;
    private final Set<String> openDoors = ConcurrentHashMap.newKeySet();
    private volatile boolean completed;
    private volatile Instant completedAt;

    public GameSession(UUID id, String levelId, LevelManifest level, UUID player1Id, UUID player2Id,
                        PlayerPosition player1Pos, PlayerPosition player2Pos) {
        this.id = id;
        this.levelId = levelId;
        this.level = level;
        this.player1Id = player1Id;
        this.player2Id = player2Id;
        this.player1Pos = player1Pos;
        this.player2Pos = player2Pos;
        this.startedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getLevelId() { return levelId; }
    public LevelManifest getLevel() { return level; }
    public UUID getPlayer1Id() { return player1Id; }
    public UUID getPlayer2Id() { return player2Id; }
    public Instant getStartedAt() { return startedAt; }

    public PlayerPosition getPlayer1Pos() { return player1Pos; }
    public void setPlayer1Pos(PlayerPosition pos) { this.player1Pos = pos; }
    public PlayerPosition getPlayer2Pos() { return player2Pos; }
    public void setPlayer2Pos(PlayerPosition pos) { this.player2Pos = pos; }

    public Set<String> getOpenDoors() { return openDoors; }
    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }

    public boolean isMember(UUID playerId) {
        return player1Id.equals(playerId) || player2Id.equals(playerId);
    }

    /** 1 or 2, or 0 if not a member - used to stamp relayed moves with whose they are. */
    public int slotFor(UUID playerId) {
        if (player1Id.equals(playerId)) return 1;
        if (player2Id.equals(playerId)) return 2;
        return 0;
    }
}
