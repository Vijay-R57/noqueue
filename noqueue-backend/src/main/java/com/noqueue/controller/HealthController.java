package com.noqueue.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * Public health check — no auth required.
 * Used by:
 *  - start-noqueue.bat: poll until backend is UP before launching the agent
 *  - Print Agent: verify backend reachable before starting heartbeat
 *  - Admin Dashboard: check if backend is online
 */
@RestController
@RequestMapping("/api/v1")
public class HealthController {

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
            "status",    "UP",
            "backend",   "running",
            "timestamp", Instant.now().toString()
        ));
    }
}
