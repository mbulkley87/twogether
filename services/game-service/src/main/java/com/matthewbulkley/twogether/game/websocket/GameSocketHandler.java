package com.matthewbulkley.twogether.game.websocket;

import tools.jackson.databind.ObjectMapper;
import com.matthewbulkley.twogether.game.dto.CompleteMessage;
import com.matthewbulkley.twogether.game.dto.MoveMessage;
import com.matthewbulkley.twogether.game.dto.PeerMoveMessage;
import com.matthewbulkley.twogether.game.dto.StateMessage;
import com.matthewbulkley.twogether.game.model.GameSession;
import com.matthewbulkley.twogether.game.service.GameNotFoundException;
import com.matthewbulkley.twogether.game.service.GameSessionService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.PingMessage;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.TimeUnit;

/**
 * Unlike Hero Details' GameSocketHandler (server-to-client only, every
 * mutation via REST), this one is bidirectional: clients send their own
 * position at a steady clip (~15Hz) and this handler relays it straight to
 * the other player immediately, while separately recomputing the
 * server-authoritative puzzle state (open doors, completion) from both
 * players' latest reported positions and only pushing THAT when it
 * actually changes. See GameSessionService for why the authority split
 * exists. Connection auth and the dead-connection ping sweep are the same
 * pattern as LobbyWebSocketHandler/Hero Details' version.
 */
@Component
public class GameSocketHandler extends TextWebSocketHandler {

    private static final String GAME_ID_ATTRIBUTE = "gameId";
    private static final String PLAYER_ID_ATTRIBUTE = "playerId";

    private final GameSessionService gameSessionService;
    private final ObjectMapper objectMapper;
    private final Map<UUID, Set<WebSocketSession>> sessionsByGameId = new ConcurrentHashMap<>();

    public GameSocketHandler(GameSessionService gameSessionService, ObjectMapper objectMapper) {
        this.gameSessionService = gameSessionService;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        UUID gameId = extractGameId(session);
        UUID playerId = extractPlayerId(session);

        if (gameId == null || playerId == null || !isMember(gameId, playerId)) {
            session.close(CloseStatus.NOT_ACCEPTABLE);
            return;
        }

        session.getAttributes().put(GAME_ID_ATTRIBUTE, gameId);
        session.getAttributes().put(PLAYER_ID_ATTRIBUTE, playerId);
        sessionsByGameId.computeIfAbsent(gameId, key -> new CopyOnWriteArraySet<>()).add(session);

        // A reconnect (including a refreshed tab) needs the current puzzle
        // state right away, not just whatever the next move happens to
        // trigger - otherwise a closed door could render as open (or vice
        // versa) until something else changes it.
        sendStateSnapshot(session, gameId);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        UUID gameId = (UUID) session.getAttributes().get(GAME_ID_ATTRIBUTE);
        if (gameId == null) return;
        Set<WebSocketSession> sessions = sessionsByGameId.get(gameId);
        if (sessions != null) {
            sessions.remove(session);
            if (sessions.isEmpty()) sessionsByGameId.remove(gameId);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        UUID gameId = (UUID) session.getAttributes().get(GAME_ID_ATTRIBUTE);
        UUID playerId = (UUID) session.getAttributes().get(PLAYER_ID_ATTRIBUTE);
        if (gameId == null || playerId == null) return;

        MoveMessage move = objectMapper.readValue(message.getPayload(), MoveMessage.class);
        if (!"move".equals(move.type())) return;

        GameSessionService.MoveResult result;
        try {
            result = gameSessionService.applyMove(gameId, playerId, move);
        } catch (GameNotFoundException | IllegalArgumentException e) {
            return;
        }

        relayMove(session, gameId, playerId, move);
        if (result.puzzleStateChanged()) {
            broadcastState(gameId);
        }
        if (result.justCompleted()) {
            broadcastComplete(gameId, result.elapsedMs());
        }
    }

    @Scheduled(fixedRate = 20, timeUnit = TimeUnit.SECONDS)
    void sweepDeadConnections() {
        for (Set<WebSocketSession> sessions : sessionsByGameId.values()) {
            List<WebSocketSession> dead = null;
            for (WebSocketSession session : sessions) {
                try {
                    synchronized (session) {
                        if (session.isOpen()) {
                            session.sendMessage(new PingMessage());
                            continue;
                        }
                    }
                } catch (IOException e) {
                    // Falls through to dead-session handling below.
                }
                if (dead == null) dead = new java.util.ArrayList<>();
                dead.add(session);
            }
            if (dead != null) {
                for (WebSocketSession session : dead) {
                    sessions.remove(session);
                    try {
                        session.close(CloseStatus.GOING_AWAY);
                    } catch (IOException ignored) {
                        // Already gone - this is best-effort cleanup.
                    }
                }
            }
        }
    }

    private void relayMove(WebSocketSession sender, UUID gameId, UUID playerId, MoveMessage move) {
        GameSession gameSession = gameSessionService.getSession(gameId);
        int senderSlot = gameSession.slotFor(playerId);
        PeerMoveMessage relayed = PeerMoveMessage.from(senderSlot, move);
        String json = objectMapper.writeValueAsString(relayed);
        sendToOthers(gameId, sender, json);
    }

    private void broadcastState(UUID gameId) {
        GameSession gameSession = gameSessionService.getSession(gameId);
        StateMessage stateMessage = StateMessage.of(List.copyOf(gameSession.getOpenDoors()), gameSession.isCompleted());
        broadcastToAll(gameId, objectMapper.writeValueAsString(stateMessage));
    }

    private void broadcastComplete(UUID gameId, long elapsedMs) {
        CompleteMessage completeMessage = CompleteMessage.of(elapsedMs);
        broadcastToAll(gameId, objectMapper.writeValueAsString(completeMessage));
    }

    private void sendStateSnapshot(WebSocketSession session, UUID gameId) {
        try {
            GameSession gameSession = gameSessionService.getSession(gameId);
            StateMessage stateMessage = gameSession.isCompleted()
                    ? null
                    : StateMessage.of(List.copyOf(gameSession.getOpenDoors()), false);
            String json = gameSession.isCompleted()
                    ? objectMapper.writeValueAsString(CompleteMessage.of(Duration.between(gameSession.getStartedAt(), gameSession.getCompletedAt()).toMillis()))
                    : objectMapper.writeValueAsString(stateMessage);
            sendTo(session, json);
        } catch (GameNotFoundException e) {
            // Nothing to resync yet - the next real state change will broadcast normally.
        }
    }

    private void sendToOthers(UUID gameId, WebSocketSession exclude, String json) {
        Set<WebSocketSession> sessions = sessionsByGameId.get(gameId);
        if (sessions == null) return;
        TextMessage message = new TextMessage(json);
        for (WebSocketSession session : sessions) {
            if (session == exclude) continue;
            sendTo(session, message);
        }
    }

    private void broadcastToAll(UUID gameId, String json) {
        Set<WebSocketSession> sessions = sessionsByGameId.get(gameId);
        if (sessions == null) return;
        TextMessage message = new TextMessage(json);
        for (WebSocketSession session : sessions) {
            sendTo(session, message);
        }
    }

    private void sendTo(WebSocketSession session, String json) {
        sendTo(session, new TextMessage(json));
    }

    private void sendTo(WebSocketSession session, TextMessage message) {
        try {
            synchronized (session) {
                if (session.isOpen()) {
                    session.sendMessage(message);
                }
            }
        } catch (IOException e) {
            // Dropped session - afterConnectionClosed/the ping sweep will clean it up.
        }
    }

    private boolean isMember(UUID gameId, UUID playerId) {
        try {
            return gameSessionService.getSession(gameId).isMember(playerId);
        } catch (GameNotFoundException e) {
            return false;
        }
    }

    private UUID extractGameId(WebSocketSession session) {
        String path = session.getUri() == null ? null : session.getUri().getPath();
        if (path == null) return null;
        String[] segments = path.split("/");
        if (segments.length == 0) return null;
        try {
            return UUID.fromString(segments[segments.length - 1]);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private UUID extractPlayerId(WebSocketSession session) {
        if (session.getUri() == null) return null;
        String raw = UriComponentsBuilder.fromUri(session.getUri())
                .build()
                .getQueryParams()
                .getFirst("playerId");
        try {
            return raw == null ? null : UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
