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
 *
 * <p>A lobby someone creates and then abandons (closes the tab, hits Back,
 * tries again) without ever calling /leave used to linger in the public
 * listing looking like a live open game until the 6-hour TTL swept it -
 * easy to reproduce by accident (create, abandon, create again) and
 * confusing for anyone else browsing public games in the meantime. Two
 * independent fixes close this: {@link #listPublicLobbies()} hides any
 * lobby with nobody currently connected, and {@link #evictAbandonedLobbies()}
 * actually removes a fully-disconnected lobby within ~2 minutes instead of
 * waiting out the full TTL.
 */
@Service
public class LobbyService {

    // Ambiguous characters (0/O, 1/I/L) left out so a spoken/typed code
    // between two people doesn't need spelling out.
    private static final String CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 5;
    private static final Duration LOBBY_TTL = Duration.ofHours(6);
    // Comfortably longer than a page refresh's reconnect (the frontend's
    // own reconnect-on-mount effect fires in well under a second) but
    // short enough that an actually-abandoned lobby doesn't haunt the
    // public listing for hours.
    private static final Duration ABANDONED_GRACE_PERIOD = Duration.ofMinutes(2);

    private final SecureRandom random = new SecureRandom();
    private final Map<String, Lobby> lobbies = new ConcurrentHashMap<>();
    private final Map<String, Instant> lastActivity = new ConcurrentHashMap<>();
    // Set the moment a lobby's last connected member drops, cleared the
    // moment anyone reconnects - see markConnected/markDisconnected.
    private final Map<String, Instant> fullyDisconnectedSince = new ConcurrentHashMap<>();

    public record JoinResult(Lobby lobby, UUID playerId) { }

    public JoinResult create(String playerName, boolean isPublic) {
        String name = requirePlayerName(playerName);
        String code = generateUniqueCode();
        Lobby lobby = new Lobby(code, isPublic);
        UUID playerId = UUID.randomUUID();
        lobby.getMembers().add(new LobbyMember(playerId, name, true));
        lobbies.put(code, lobby);
        // Defensive only - generateUniqueCode() already guarantees `code`
        // isn't a currently-live lobby, but a stale leftover entry here
        // (from a code that was freed up by eviction) would otherwise
        // wrongly mark this brand new lobby as already abandoned.
        fullyDisconnectedSince.remove(code);
        touch(code);
        return new JoinResult(lobby, playerId);
    }

    /**
     * Public, still-joinable lobbies with someone actually in them - what
     * GET /api/lobbies/public lists for join-without-a-code. Excludes a
     * lobby nobody is currently connected to, even before eviction catches
     * up to it - see the class-level note.
     */
    public List<Lobby> listPublicLobbies() {
        return lobbies.values().stream()
                .filter(Lobby::isPublic)
                .filter(Lobby::isJoinable)
                .filter(Lobby::hasConnectedMember)
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
            fullyDisconnectedSince.remove(code);
            return lobby;
        }
    }

    /** The party waits for a dropped player rather than kicking them - same decision as Hero Details' lobby. */
    public Lobby markDisconnected(String code, UUID playerId) {
        Lobby lobby = lobbies.get(code);
        if (lobby == null) return null;
        synchronized (lobby) {
            lobby.findMember(playerId).ifPresent(member -> member.setConnected(false));
            if (!lobby.hasConnectedMember()) {
                fullyDisconnectedSince.putIfAbsent(code, Instant.now());
            }
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
                fullyDisconnectedSince.remove(code);
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
            if (stale) {
                lobbies.remove(entry.getKey());
                fullyDisconnectedSince.remove(entry.getKey());
            }
            return stale;
        });
    }

    /**
     * Separate from (and much more frequent than) evictStaleLobbies above -
     * that one's a 6-hour backstop for any lobby regardless of connection
     * state; this one specifically clears out a lobby nobody is connected
     * to anymore within ~2 minutes, which is what actually stops an
     * abandoned "create, then leave without /leave" lobby from sitting in
     * the public listing (or just occupying memory) for hours.
     */
    @Scheduled(fixedRate = 30, timeUnit = java.util.concurrent.TimeUnit.SECONDS)
    void evictAbandonedLobbies() {
        Instant cutoff = Instant.now().minus(ABANDONED_GRACE_PERIOD);
        fullyDisconnectedSince.entrySet().removeIf(entry -> {
            boolean abandoned = entry.getValue().isBefore(cutoff);
            if (abandoned) {
                lobbies.remove(entry.getKey());
                lastActivity.remove(entry.getKey());
            }
            return abandoned;
        });
    }
}
