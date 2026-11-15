package com.matthewbulkley.twogether.game.config;

import com.matthewbulkley.twogether.game.websocket.GameSocketHandler;
import com.matthewbulkley.twogether.game.websocket.LobbyWebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    @Value("${app.cors.allowed-origins:http://localhost:5175}")
    private String[] allowedOrigins;

    private final LobbyWebSocketHandler lobbyWebSocketHandler;
    private final GameSocketHandler gameSocketHandler;

    public WebSocketConfig(LobbyWebSocketHandler lobbyWebSocketHandler, GameSocketHandler gameSocketHandler) {
        this.lobbyWebSocketHandler = lobbyWebSocketHandler;
        this.gameSocketHandler = gameSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(lobbyWebSocketHandler, "/ws/lobby/{code}")
                .setAllowedOrigins(allowedOrigins);
        registry.addHandler(gameSocketHandler, "/ws/game/{gameId}")
                .setAllowedOrigins(allowedOrigins);
    }
}
