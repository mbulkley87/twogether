package com.matthewbulkley.twogether.game.service;

import com.matthewbulkley.twogether.game.model.Lobby;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Plain instantiation, no Spring context - LobbyService is a constructor-free POJO service. */
class LobbyServiceTest {

    private LobbyService lobbyService;

    @BeforeEach
    void setUp() {
        lobbyService = new LobbyService();
    }

    @Test
    void createStartsAOneMemberLobbyWithTheCreatorAsHost() {
        LobbyService.JoinResult result = lobbyService.create("Alex", false);

        assertThat(result.lobby().getMembers()).hasSize(1);
        assertThat(result.lobby().getMembers().get(0).isHost()).isTrue();
        assertThat(result.lobby().getMembers().get(0).isConnected()).isTrue();
        assertThat(result.lobby().getMembers().get(0).getPlayerId()).isEqualTo(result.playerId());
        assertThat(result.lobby().isPublic()).isFalse();
    }

    @Test
    void joinRejectsAThirdMember() {
        LobbyService.JoinResult host = lobbyService.create("Alex", false);
        String code = host.lobby().getCode();
        lobbyService.join(code, "Sam");

        assertThatThrownBy(() -> lobbyService.join(code, "Jo"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("full");
    }

    @Test
    void joinRejectsAnAlreadyStartedLobby() {
        LobbyService.JoinResult host = lobbyService.create("Alex", false);
        String code = host.lobby().getCode();
        lobbyService.join(code, "Sam");
        lobbyService.markStarted(code, UUID.randomUUID());

        assertThatThrownBy(() -> lobbyService.join(code, "Jo"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("started");
    }

    @Test
    void getUnknownCodeThrowsLobbyNotFound() {
        assertThatThrownBy(() -> lobbyService.get("ZZZZZ"))
                .isInstanceOf(LobbyNotFoundException.class);
    }

    @Test
    void validateReadyToStartRequiresBothSeatsFilled() {
        LobbyService.JoinResult host = lobbyService.create("Alex", false);
        String code = host.lobby().getCode();

        assertThatThrownBy(() -> lobbyService.validateReadyToStart(code, host.playerId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Waiting");

        lobbyService.join(code, "Sam");
        lobbyService.validateReadyToStart(code, host.playerId()); // does not throw
    }

    @Test
    void validateReadyToStartRejectsANonHostRequester() {
        LobbyService.JoinResult host = lobbyService.create("Alex", false);
        String code = host.lobby().getCode();
        LobbyService.JoinResult other = lobbyService.join(code, "Sam");

        assertThatThrownBy(() -> lobbyService.validateReadyToStart(code, other.playerId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("host");
    }

    @Test
    void leaveReassignsHostWhenTheHostLeaves() {
        LobbyService.JoinResult host = lobbyService.create("Alex", false);
        String code = host.lobby().getCode();
        LobbyService.JoinResult other = lobbyService.join(code, "Sam");

        Lobby afterLeave = lobbyService.leave(code, host.playerId());

        assertThat(afterLeave.getMembers()).hasSize(1);
        assertThat(afterLeave.findMember(other.playerId()).orElseThrow().isHost()).isTrue();
    }

    @Test
    void leaveDeletesAnEmptyLobby() {
        LobbyService.JoinResult host = lobbyService.create("Alex", false);
        String code = host.lobby().getCode();

        Lobby afterLeave = lobbyService.leave(code, host.playerId());

        assertThat(afterLeave).isNull();
        assertThatThrownBy(() -> lobbyService.get(code)).isInstanceOf(LobbyNotFoundException.class);
    }

    @Test
    void createRejectsABlankPlayerName() {
        assertThatThrownBy(() -> lobbyService.create("   ", false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("name");
    }

    @Test
    void listPublicLobbiesOnlyReturnsPublicJoinableOnes() {
        LobbyService.JoinResult publicOpen = lobbyService.create("Alex", true);
        lobbyService.create("Sam", false); // private - should never show up

        LobbyService.JoinResult publicFull = lobbyService.create("Jo", true);
        lobbyService.join(publicFull.lobby().getCode(), "Kim"); // now full - no longer joinable

        LobbyService.JoinResult publicStarted = lobbyService.create("Lee", true);
        lobbyService.join(publicStarted.lobby().getCode(), "Mo");
        lobbyService.markStarted(publicStarted.lobby().getCode(), UUID.randomUUID());

        var listed = lobbyService.listPublicLobbies();

        assertThat(listed).hasSize(1);
        assertThat(listed.get(0).getCode()).isEqualTo(publicOpen.lobby().getCode());
    }

    @Test
    void listPublicLobbiesIsEmptyWhenThereAreNoPublicLobbies() {
        lobbyService.create("Alex", false);
        assertThat(lobbyService.listPublicLobbies()).isEmpty();
    }
}
