package com.matthewbulkley.twogether.game.service;

import com.matthewbulkley.twogether.game.model.Lobby;
import com.matthewbulkley.twogether.game.model.LobbyMember;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory 2-player lobbies, ported from Hero Details' LobbyService - same
 * join-code/TTL/eviction shape, with the class-pick step removed since
 * there's nothing to pick here. "Ready to start" collapses to "both seats
 * are filled."
 */
@Service
public class LobbyService {

    // Ambiguous characters (0/O, 1/I/L) left out so a spoken/typed code
    // between two people doesn't need spelling out.
    private static final String CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 5;
    private static final Duration LOBBY_TTL = Duration.ofHours(6);

    private final SecureRandom random = new SecureRandom();
    private final Map<String, Lobby> lobbies = new ConcurrentHashMap<>();
    private final Map<String, Instant> lastActivity = new ConcurrentHashMap<>();

    public record JoinResult(Lobby lobby, UUID playerId) { }

    public JoinResult create(String playerName, boolean isPublic) {
        String name = requirePlayerName(playerName);
        String code = generateUniqueCode();
        Lobby lobby = new Lobby(code, isPublic);
        UUID playerId = UUID.randomUUID();
        lobby.getMembers().add(new LobbyMember(playerId, name, true));
        lobbies.put(code, lobby);
        touch(code);
        return new JoinResult(lobby, playerId);
    }

    /** Public, still-joinable lobbies - what GET /api/lobbies/public lists for join-without-a-code. */
    public List<Lobby> listPublicLobbies() {
        return lobbies.values().stream()
                .filter(Lobby::isPublic)
                .filter(Lobby::isJoinable)
                .toList();
    }

    public JoinResult join(String code, String playerName) {
        String name = requirePlayerName(playerName);
        Lobby lobby = require(code);
        touch(code);

        synchronized (lobby) {
            if (lobby.isStarted()) {
                throw new IllegalArgumentException("That game has already started");
            }
            if (lobby.getMembers().size() >= Lobby.MAX_MEMBERS) {
                throw new IllegalArgumentException("That lobby is full");
            }
            UUID playerId = UUID.randomUUID();
            lobby.getMembers().add(new LobbyMember(playerId, name, false));
            return new JoinResult(lobby, playerId);
        }
    }

    public Lobby get(String code) {
        Lobby lobby = require(code);
        touch(code);
        return lobby;
    }

    /**
     * Checked before handing the lobby off to GameSessionService.createSession -
     * throws if the party isn't actually ready yet.
     */
    public void validateReadyToStart(String code, UUID requestingPlayerId) {
        Lobby lobby = require(code);
        synchronized (lobby) {
            LobbyMember requester = requireMember(lobby, requestingPlayerId);
            if (!requester.isHost()) {
                throw new IllegalArgumentException("Only the host can start the game");
            }
            if (lobby.isStarted()) {
                throw new IllegalArgumentException("This game has already started");
            }
            if (lobby.getMembers().size() < Lobby.MAX_MEMBERS) {
                throw new IllegalArgumentException("Waiting for a second player to join");
            }
        }
    }

    public Lobby markStarted(String code, UUID gameId) {
        Lobby lobby = require(code);
        touch(code);
        synchronized (lobby) {
            lobby.setStarted(true);
            lobby.setGameId(gameId);
            return lobby;
        }
    }

    public Lobby markConnected(String code, UUID playerId) {
        Lobby lobby = require(code);
        touch(code);
        synchronized (lobby) {
            requireMember(lobby, playerId).setConnected(true);
            return lobby;
        }
    }

    /** The party waits for a dropped player rather than kicking them - same decision as Hero Details' lobby. */
    public Lobby markDisconnected(String code, UUID playerId) {
        Lobby lobby = lobbies.get(code);
        if (lobby == null) return null;
        synchronized (lobby) {
            lobby.findMember(playerId).ifPresent(member -> member.setConnected(false));
            return lobby;
        }
    }

    public Lobby leave(String code, UUID playerId) {
        Lobby lobby = require(code);
        touch(code);

        synchronized (lobby) {
            LobbyMember member = requireMember(lobby, playerId);
            lobby.getMembers().remove(member);

            if (lobby.getMembers().isEmpty()) {
                lobbies.remove(code);
                lastActivity.remove(code);
                return null;
            }

            if (member.isHost()) {
                lobby.getMembers().get(0).setHost(true);
            }
            return lobby;
        }
    }

    private LobbyMember requireMember(Lobby lobby, UUID playerId) {
        return lobby.findMember(playerId)
                .orElseThrow(() -> new IllegalArgumentException("You are not in this lobby"));
    }

    private String requirePlayerName(String playerName) {
        String trimmed = playerName == null ? "" : playerName.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("A name is required");
        }
        return trimmed.length() > 24 ? trimmed.substring(0, 24) : trimmed;
    }

    private Lobby require(String code) {
        Lobby lobby = lobbies.get(code);
        if (lobby == null) {
            throw new LobbyNotFoundException(code);
        }
        return lobby;
    }

    private String generateUniqueCode() {
        String code;
        do {
            StringBuilder builder = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                builder.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            }
            code = builder.toString();
        } while (lobbies.containsKey(code));
        return code;
    }

    private void touch(String code) {
        lastActivity.put(code, Instant.now());
    }

    @Scheduled(fixedRate = 30, timeUnit = java.util.concurrent.TimeUnit.MINUTES)
    void evictStaleLobbies() {
        Instant cutoff = Instant.now().minus(LOBBY_TTL);
        lastActivity.entrySet().removeIf(entry -> {
            boolean stale = entry.getValue().isBefore(cutoff);
            if (stale) lobbies.remove(entry.getKey());
            return stale;
        });
    }
}
