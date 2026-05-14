package com.noqueue.controller;

import com.noqueue.service.OrderEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * SSE endpoint — keeps long-lived connections open and streams
 * order status events to subscribed clients (admin and user dashboards).
 *
 * Authentication: JWT validation is bypassed for this path in SecurityConfig
 * so the browser's native EventSource (which cannot set custom headers) can
 * connect. The stream is read-only and carries no sensitive write operations.
 */
@RestController
@RequestMapping("/api/v1/events")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")   // Next.js dev server + production origin
public class SseController {

    private final OrderEventService orderEventService;

    /**
     * GET /api/v1/events/orders
     *
     * Returns a text/event-stream that stays open until:
     *   - The client disconnects
     *   - The 30-minute timeout fires (browser auto-reconnects)
     *   - The server restarts
     */
    @GetMapping(value = "/orders", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribeToOrderEvents() {
        return orderEventService.subscribe();
    }
}
