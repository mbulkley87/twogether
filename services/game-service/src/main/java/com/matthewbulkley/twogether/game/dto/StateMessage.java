package com.matthewbulkley.twogether.game.dto;

import java.util.List;

/**
 * Outbound server->client authoritative puzzle state - the client never
 * computes openDoors/completed itself, only ever renders what this says.
 * Sent only when something actually changes, or as a full resync right
 * after connecting/reconnecting - never on a fixed timer.
 */
public record StateMessage(String type, List<String> openDoors, boolean completed) {

    public static StateMessage of(List<String> openDoors, boolean completed) {
        return new StateMessage("state", openDoors, completed);
    }
}
