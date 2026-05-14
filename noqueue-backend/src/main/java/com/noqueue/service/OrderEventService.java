package com.noqueue.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.noqueue.dto.OrderEventDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Manages all active SSE connections and broadcasts order events to them.
 *
 * Thread-safety:
 *   - CopyOnWriteArrayList is used so that concurrent reads (broadcasts)
 *     and writes (subscribe / cleanup) never cause ConcurrentModificationException.
 *   - Each emitter send is individually wrapped so a single dead client
 *     never blocks or kills the broadcast to healthy clients.
 *
 * We inject Spring's auto-configured ObjectMapper (from spring-boot-starter-web)
 * so Jackson + JavaTimeModule are already registered — no manual setup needed.
 */
@Service
public class OrderEventService {

    private static final Logger log = LoggerFactory.getLogger(OrderEventService.class);

    /** Timeout: 30 minutes. Browser auto-reconnects on expiry. */
    private static final long SSE_TIMEOUT_MS = 30 * 60 * 1000L;

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    private final ObjectMapper     mapper;

    /** Inject Spring's shared, fully-configured ObjectMapper (JavaTimeModule included). */
    public OrderEventService(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    // ── Subscribe ──────────────────────────────────────────────────────────

    /**
     * Creates a new SseEmitter, registers it, and wires completion/timeout/error
     * callbacks that automatically remove it from the active list.
     */
    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);

        emitters.add(emitter);
        log.info("[SSE] Client subscribed. Active connections: {}", emitters.size());

        // Remove on any terminal state
        Runnable cleanup = () -> {
            emitters.remove(emitter);
            log.info("[SSE] Client disconnected. Active connections: {}", emitters.size());
        };
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError((ex) -> cleanup.run());

        // Send an initial "connected" heartbeat so the browser confirms the stream is open
        try {
            emitter.send(SseEmitter.event()
                .name("connected")
                .data("{\"message\":\"SSE stream established\"}"));
        } catch (IOException e) {
            emitters.remove(emitter);
        }

        return emitter;
    }

    // ── Broadcast ──────────────────────────────────────────────────────────

    /**
     * Broadcasts an order event to all active SSE subscribers.
     * Dead emitters are removed in-place; errors on individual emitters
     * are caught so a single bad client never disrupts others.
     */
    public void broadcast(OrderEventDto event) {
        if (emitters.isEmpty()) return;

        String json;
        try {
            json = mapper.writeValueAsString(event);
        } catch (JsonProcessingException e) {
            log.error("[SSE] Failed to serialize event for order #{}: {}", event.getOrderId(), e.getMessage());
            return;
        }

        log.info("[SSE] Broadcasting to {} client(s): order #{} → {}",
                emitters.size(), event.getOrderId(), event.getStatus());

        List<SseEmitter> dead = new ArrayList<>();

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                    .name("order-update")
                    .data(json));
            } catch (IOException e) {
                dead.add(emitter);
                log.debug("[SSE] Dead emitter removed during broadcast.");
            }
        }

        emitters.removeAll(dead);
    }
}
