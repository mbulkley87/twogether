package com.matthewbulkley.twogether.game.service;

public class LobbyNotFoundException extends RuntimeException {

    public LobbyNotFoundException(String code) {
        super("Lobby not found: " + code);
    }
}
