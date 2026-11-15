package com.matthewbulkley.twogether.game.websocket;

import tools.jackson.databind.ObjectMapper;
import com.matthewbulkley.twogether.game.model.Lobby;
import com.matthewbulkley.twogether.game.service.LobbyNotFoundException;
import com.matthewbulkley.twogether.game.service.LobbyService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.PingMessage;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.TimeUnit;

/**
 * Ported from Hero Details' LobbyWebSocketHandler, unchanged in mechanism -
 * server-to-client only, clients never send messages here, all lobby
 * mutation goes through the REST LobbyController, which calls broadcast()
 * after every change. See that class's comments (and this project's own
 * plan doc) for why the active ping sweep matters: a lobby sitting idle
 * while waiting for a second player is exactly the situation where a
 * mobile network or intermediate proxy can silently drop a WebSocket
 * without ever sending a close frame.
 */
@Component
public class LobbyWebSocketHandler extends TextWebSocketHandler {

    private static final String CODE_ATTRIBUTE = "lobbyCode";
    private static final String PLAYER_ID_ATTRIBUTE = "playerId";

    private final LobbyService lobbyService;
    private final ObjectMapper objectMapper;
    private final Map<String, Set<WebSocketSession>> sessionsByCode = new ConcurrentHashMap<>();

    public LobbyWebSocketHandler(LobbyService lobbyService, ObjectMapper objectMapper) {
        this.lobbyService = lobbyService;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String code = extractCode(session);
        UUID playerId = extractPlayerId(session);

        if (code == null || playerId == null || !isMember(code, playerId)) {
            session.close(CloseStatus.NOT_ACCEPTABLE);
            return;
        }

        session.getAttributes().put(CODE_ATTRIBUTE, code);
        session.getAttributes().put(PLAYER_ID_ATTRIBUTE, playerId);
        sessionsByCode.computeIfAbsent(code, key -> new CopyOnWriteArraySet<>()).add(session);

        lobbyService.markConnected(code, playerId);
        broadcast(code);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String code = (String) session.getAttributes().get(CODE_ATTRIBUTE);
        UUID playerId = (UUID) session.getAttributes().get(PLAYER_ID_ATTRIBUTE);
        if (code == null) {
            return;
        }

        Set<WebSocketSession> sessions = sessionsByCode.get(code);
        if (sessions != null) {
            sessions.remove(session);
        }

        lobbyService.markDisconnected(code, playerId);
        broadcast(code);
    }

    @Scheduled(fixedRate = 20, timeUnit = TimeUnit.SECONDS)
    void sweepDeadConnections() {
        for (Map.Entry<String, Set<WebSocketSession>> entry : sessionsByCode.entrySet()) {
            String code = entry.getKey();
            List<WebSocketSession> dead = null;

            for (WebSocketSession session : entry.getValue()) {
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
                    entry.getValue().remove(session);
                    UUID playerId = (UUID) session.getAttributes().get(PLAYER_ID_ATTRIBUTE);
                    if (playerId != null) {
                        lobbyService.markDisconnected(code, playerId);
                    }
                    try {
                        session.close(CloseStatus.GOING_AWAY);
                    } catch (IOException ignored) {
                        // Already gone - this is best-effort cleanup.
                    }
                }
            }

            if (!entry.getValue().isEmpty()) {
                broadcast(code);
            }
        }
    }

    public void broadcast(String code) {
        Set<WebSocketSession> sessions = sessionsByCode.get(code);
        if (sessions == null || sessions.isEmpty()) {
            return;
        }

        String json;
        try {
            Lobby lobby = lobbyService.get(code);
            json = objectMapper.writeValueAsString(lobby);
        } catch (LobbyNotFoundException e) {
            return;
        } catch (Exception e) {
            return;
        }

        TextMessage message = new TextMessage(json);
        for (WebSocketSession session : sessions) {
            try {
                synchronized (session) {
                    if (session.isOpen()) {
                        session.sendMessage(message);
                    }
                }
            } catch (IOException e) {
                // Dropped session - afterConnectionClosed will clean it up.
            }
        }
    }

    private boolean isMember(String code, UUID playerId) {
        try {
            return lobbyService.get(code).findMember(playerId).isPresent();
        } catch (LobbyNotFoundException e) {
            return false;
        }
    }

    private String extractCode(WebSocketSession session) {
        String path = session.getUri() == null ? null : session.getUri().getPath();
        if (path == null) {
            return null;
        }
        String[] segments = path.split("/");
        return segments.length == 0 ? null : segments[segments.length - 1];
    }

    private UUID extractPlayerId(WebSocketSession session) {
        if (session.getUri() == null) {
            return null;
        }
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
