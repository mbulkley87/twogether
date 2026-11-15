package com.matthewbulkley.twogether.game.dto;

/** Outbound server->client, sent once when both players reach their own goal. */
public record CompleteMessage(String type, long elapsedMs) {

    public static CompleteMessage of(long elapsedMs) {
        return new CompleteMessage("complete", elapsedMs);
    }
}
