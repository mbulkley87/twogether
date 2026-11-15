package com.matthewbulkley.twogether.game.controller;

import com.matthewbulkley.twogether.game.model.GameSession;
import com.matthewbulkley.twogether.game.model.Lobby;
import com.matthewbulkley.twogether.game.service.GameSessionService;
import com.matthewbulkley.twogether.game.service.LobbyService;
import com.matthewbulkley.twogether.game.websocket.LobbyWebSocketHandler;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class LobbyController {

    private static final String DEFAULT_LEVEL = "dungeon1";

    private final LobbyService lobbyService;
    private final GameSessionService gameSessionService;
    private final LobbyWebSocketHandler lobbyWebSocketHandler;

    public LobbyController(LobbyService lobbyService, GameSessionService gameSessionService, LobbyWebSocketHandler lobbyWebSocketHandler) {
        this.lobbyService = lobbyService;
        this.gameSessionService = gameSessionService;
        this.lobbyWebSocketHandler = lobbyWebSocketHandler;
    }

    @PostMapping("/lobbies")
    public LobbyService.JoinResult createLobby(
            @RequestParam String playerName,
            @RequestParam(defaultValue = "false") boolean isPublic) {
        LobbyService.JoinResult result = lobbyService.create(playerName, isPublic);
        lobbyWebSocketHandler.broadcast(result.lobby().getCode());
        return result;
    }

    /** Public, still-joinable lobbies - lets a player join without needing a code at all. */
    @GetMapping("/lobbies/public")
    public List<Lobby> listPublicLobbies() {
        return lobbyService.listPublicLobbies();
    }

    @PostMapping("/lobbies/{code}/join")
    public LobbyService.JoinResult joinLobby(
            @PathVariable String code,
            @RequestParam String playerName) {
        LobbyService.JoinResult result = lobbyService.join(code, playerName);
        lobbyWebSocketHandler.broadcast(code);
        return result;
    }

    @GetMapping("/lobbies/{code}")
    public Lobby getLobby(@PathVariable String code) {
        return lobbyService.get(code);
    }

    @PostMapping("/lobbies/{code}/start")
    public Lobby startGame(
            @PathVariable String code,
            @RequestParam UUID playerId) {
        lobbyService.validateReadyToStart(code, playerId);
        GameSession session = gameSessionService.createSession(lobbyService.get(code), DEFAULT_LEVEL);
        Lobby lobby = lobbyService.markStarted(code, session.getId());
        lobbyWebSocketHandler.broadcast(code);
        return lobby;
    }

    @PostMapping("/lobbies/{code}/leave")
    public ResponseEntity<Lobby> leaveLobby(
            @PathVariable String code,
            @RequestParam UUID playerId) {
        Lobby lobby = lobbyService.leave(code, playerId);
        lobbyWebSocketHandler.broadcast(code);
        return lobby == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(lobby);
    }
}
