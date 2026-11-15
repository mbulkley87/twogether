package com.matthewbulkley.twogether.game.service;

import com.matthewbulkley.twogether.game.dto.MoveMessage;
import com.matthewbulkley.twogether.game.model.GameSession;
import com.matthewbulkley.twogether.game.model.Lobby;
import com.matthewbulkley.twogether.game.model.LobbyMember;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Plain instantiation (loads the real committed levels/dungeon1.json from
 * the classpath, same file the frontend's Tiled map was extracted from -
 * see extract-level-manifest.mjs) - this is the cross-check the project's
 * plan calls for: the server's puzzle logic and the client's puzzle logic
 * are implemented in two different languages against the same source
 * level, so a future change to one that silently diverges from the other
 * would be caught here, not just by eyeballing both.
 */
class GameSessionServiceTest {

    private static final int TILE_SIZE = 16;

    private GameSessionService service;
    private UUID player1Id;
    private UUID player2Id;
    private UUID gameId;

    @BeforeEach
    void setUp() {
        service = new GameSessionService(new ObjectMapper());

        Lobby lobby = new Lobby("TEST1");
        player1Id = UUID.randomUUID();
        player2Id = UUID.randomUUID();
        lobby.getMembers().add(new LobbyMember(player1Id, "Host", true));
        lobby.getMembers().add(new LobbyMember(player2Id, "Other", false));

        GameSession session = service.createSession(lobby, "dungeon1");
        gameId = session.getId();
    }

    @Test
    void createSessionAssignsTheHostAsPlayer1() {
        GameSession session = service.getSession(gameId);
        assertThat(session.getPlayer1Id()).isEqualTo(player1Id);
        assertThat(session.getPlayer2Id()).isEqualTo(player2Id);
        assertThat(session.slotFor(player1Id)).isEqualTo(1);
        assertThat(session.slotFor(player2Id)).isEqualTo(2);
    }

    @Test
    void getSessionForAnUnknownIdThrows() {
        assertThatThrownBy(() -> service.getSession(UUID.randomUUID()))
                .isInstanceOf(GameNotFoundException.class);
    }

    @Test
    void applyMoveFromANonMemberThrows() {
        MoveMessage move = new MoveMessage("move", 1, 0, 0, "down", true);
        assertThatThrownBy(() -> service.applyMove(gameId, UUID.randomUUID(), move))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aDoorOpensOnlyWhileAPlayerOverlapsItsPlate_andClosesWhenTheyLeave() {
        // Level's plate "a" is at tile (3,4) -> pixel (48,64).
        MoveMessage onPlate = new MoveMessage("move", 1, 48, 64, "down", false);
        var result = service.applyMove(gameId, player1Id, onPlate);
        assertThat(result.puzzleStateChanged()).isTrue();
        assertThat(service.getSession(gameId).getOpenDoors()).contains("a");

        // Player1 moves away from the plate - the door should close again.
        MoveMessage awayFromPlate = new MoveMessage("move", 2, 48, 200, "down", true);
        result = service.applyMove(gameId, player1Id, awayFromPlate);
        assertThat(result.puzzleStateChanged()).isTrue();
        assertThat(service.getSession(gameId).getOpenDoors()).doesNotContain("a");
    }

    @Test
    void levelCompletesOnlyWhenBothPlayersAreInTheirOwnGoal() {
        // goal1 (1,4) -> pixel (16,64); goal2 (10,6) -> pixel (160,96).
        var p1AtGoal = service.applyMove(gameId, player1Id, new MoveMessage("move", 1, 16, 64, "left", false));
        assertThat(p1AtGoal.justCompleted()).isFalse();

        var p2AtGoal = service.applyMove(gameId, player2Id, new MoveMessage("move", 1, 160, 96, "right", false));
        assertThat(p2AtGoal.justCompleted()).isTrue();
        assertThat(p2AtGoal.elapsedMs()).isGreaterThanOrEqualTo(0);
        assertThat(service.getSession(gameId).isCompleted()).isTrue();
    }

    @Test
    void anOlderSequenceNumberIsIgnored() {
        service.applyMove(gameId, player1Id, new MoveMessage("move", 10, 48, 64, "down", false));
        assertThat(service.getSession(gameId).getOpenDoors()).contains("a");

        // A late/out-of-order packet with a lower seq must not move the
        // player back off the plate.
        service.applyMove(gameId, player1Id, new MoveMessage("move", 3, 999, 999, "down", true));
        assertThat(service.getSession(gameId).getPlayer1Pos().x()).isEqualTo(48);
        assertThat(service.getSession(gameId).getOpenDoors()).contains("a");
    }
}
