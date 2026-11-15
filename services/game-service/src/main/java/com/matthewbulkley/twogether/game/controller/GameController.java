package com.matthewbulkley.twogether.game.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class GameController {

    @GetMapping("/game/health")
    public Map<String, String> health() {
        return Map.of(
                "status", "UP",
                "service", "game-service");
    }
}
