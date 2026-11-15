package com.matthewbulkley.twogether.game.service;

import com.matthewbulkley.twogether.game.dto.MoveMessage;
import com.matthewbulkley.twogether.game.model.GameSession;
import com.matthewbulkley.twogether.game.model.Lobby;
import com.matthewbulkley.twogether.game.model.LobbyMember;
import com.matthewbulkley.twogether.game.model.LevelManifest;
import com.matthewbulkley.twogether.game.model.PlayerPosition;
import com.matthewbulkley.twogether.game.model.TileCoord;
import tools.jackson.databind.ObjectMapper;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Creates and updates GameSessions. Movement itself is client-authoritative
 * (each browser simulates its own player and reports its position
 * periodically) - this service never simulates a wall collision and the
 * level manifests it loads carry no wall geometry at all. What IS
 * authoritative here: which doors are open, and whether the level is
 * complete. Both are derived fresh from both players' latest reported
 * positions on every move, because each client only ever has a stale,
 * network-delayed copy of the other player's position - if each client
 * computed this locally instead, the two screens could legitimately
 * disagree about whether a door is open.
 */
@Service
public class GameSessionService {

    // Must match frontend/src/game/movement.js exactly - the server needs
    // to interpret reported x/y in the same units the client used to
    // compute them, to check plate/door/goal overlap correctly.
    private static final int TILE_SIZE = 16;
    private static final int PLAYER_SIZE = 12;

    private final Map<String, LevelManifest> levels = new ConcurrentHashMap<>();
    private final Map<UUID, GameSession> sessions = new ConcurrentHashMap<>();

    public GameSessionService(ObjectMapper objectMapper) {
        loadLevels(objectMapper);
    }

    private void loadLevels(ObjectMapper objectMapper) {
        try {
            Resource[] resources = new PathMatchingResourcePatternResolver()
                    .getResources("classpath:levels/*.json");
            for (Resource resource : resources) {
                String filename = resource.getFilename();
                if (filename == null) continue;
                String levelId = filename.substring(0, filename.lastIndexOf('.'));
                try (InputStream in = resource.getInputStream()) {
                    levels.put(levelId, objectMapper.readValue(in, LevelManifest.class));
                }
            }
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load level manifests", e);
        }
    }

    public GameSession createSession(Lobby lobby, String levelId) {
        LevelManifest level = levels.get(levelId);
        if (level == null) {
            throw new IllegalArgumentException("Unknown level: " + levelId);
        }
        List<LobbyMember> members = lobby.getMembers();
        LobbyMember host = members.stream().filter(LobbyMember::isHost).findFirst()
                .orElseThrow(() -> new IllegalStateException("Lobby has no host"));
        LobbyMember other = members.stream().filter(m -> !m.isHost()).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Need a second player to start"));

        UUID gameId = UUID.randomUUID();
        PlayerPosition pos1 = PlayerPosition.initial(level.spawn1(), TILE_SIZE, PLAYER_SIZE);
        PlayerPosition pos2 = PlayerPosition.initial(level.spawn2(), TILE_SIZE, PLAYER_SIZE);
        GameSession session = new GameSession(gameId, levelId, level, host.getPlayerId(), other.getPlayerId(), pos1, pos2);
        sessions.put(gameId, session);
        return session;
    }

    public GameSession getSession(UUID gameId) {
        GameSession session = sessions.get(gameId);
        if (session == null) {
            throw new GameNotFoundException(gameId);
        }
        return session;
    }

    public record MoveResult(boolean puzzleStateChanged, boolean justCompleted, long elapsedMs) { }

    public MoveResult applyMove(UUID gameId, UUID playerId, MoveMessage move) {
        GameSession session = getSession(gameId);
        int slot = session.slotFor(playerId);
        if (slot == 0) {
            throw new IllegalArgumentException("You are not in this game");
        }

        PlayerPosition incoming = new PlayerPosition(move.x(), move.y(), move.dir(), move.moving(), move.seq());
        if (slot == 1) {
            if (move.seq() > session.getPlayer1Pos().lastSeq()) session.setPlayer1Pos(incoming);
        } else {
            if (move.seq() > session.getPlayer2Pos().lastSeq()) session.setPlayer2Pos(incoming);
        }

        if (session.isCompleted()) {
            return new MoveResult(false, false, 0);
        }

        boolean changed = recomputeOpenDoors(session);
        boolean justCompleted = false;
        long elapsedMs = 0;
        if (isLevelComplete(session)) {
            session.setCompleted(true);
            session.setCompletedAt(Instant.now());
            justCompleted = true;
            elapsedMs = Duration.between(session.getStartedAt(), session.getCompletedAt()).toMillis();
            changed = true;
        }
        return new MoveResult(changed, justCompleted, elapsedMs);
    }

    private boolean recomputeOpenDoors(GameSession session) {
        LevelManifest level = session.getLevel();
        var openNow = level.plates().entrySet().stream()
                .filter(entry -> overlaps(session.getPlayer1Pos(), entry.getValue()) || overlaps(session.getPlayer2Pos(), entry.getValue()))
                .map(Map.Entry::getKey)
                .toList();

        boolean changed = !session.getOpenDoors().equals(Set.copyOf(openNow));
        session.getOpenDoors().clear();
        session.getOpenDoors().addAll(openNow);
        return changed;
    }

    private boolean isLevelComplete(GameSession session) {
        LevelManifest level = session.getLevel();
        return overlaps(session.getPlayer1Pos(), level.goal1()) && overlaps(session.getPlayer2Pos(), level.goal2());
    }

    private boolean overlaps(PlayerPosition pos, TileCoord tile) {
        double tx1 = tile.x() * (double) TILE_SIZE;
        double ty1 = tile.y() * (double) TILE_SIZE;
        return pos.x() < tx1 + TILE_SIZE
                && pos.x() + PLAYER_SIZE > tx1
                && pos.y() < ty1 + TILE_SIZE
                && pos.y() + PLAYER_SIZE > ty1;
    }
}
