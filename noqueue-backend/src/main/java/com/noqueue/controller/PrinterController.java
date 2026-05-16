package com.noqueue.controller;

import com.noqueue.dto.HeartbeatDto;
import com.noqueue.dto.PrinterConnectRequest;
import com.noqueue.model.PrinterStatus;
import com.noqueue.service.PrinterStatusService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Printer Management API — bridges Admin UI ↔ Backend ↔ Local Print Agent
 *
 * Endpoints:
 *   POST /api/v1/printer/heartbeat   ← called by Print Agent every 5s
 *   GET  /api/v1/printer/status      ← polled by Admin Dashboard
 *   POST /api/v1/printer/connect     ← called by Admin when clicking "Connect Printer"
 *   POST /api/v1/printer/disconnect  ← called by Admin when clicking "Disconnect"
 *   GET  /api/v1/printer/config      ← polled by Print Agent to detect connect requests
 */
@RestController
@RequestMapping("/api/v1/printer")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PrinterController {

    private final PrinterStatusService printerStatusService;

    // ── Agent → Backend: receive live heartbeat ──────────────────────────────
    @PostMapping("/heartbeat")
    public ResponseEntity<Void> heartbeat(@RequestBody HeartbeatDto dto) {
        printerStatusService.receiveHeartbeat(dto);
        return ResponseEntity.ok().build();
    }

    // ── Admin Dashboard → Backend: get live printer status ───────────────────
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        PrinterStatus s = printerStatusService.getStatus();
        boolean alive  = printerStatusService.isAgentAlive();

        return ResponseEntity.ok(Map.of(
            "agentOnline",      alive,
            "printerName",      s.getPrinterName()    != null ? s.getPrinterName()    : "None",
            "printerConnected", alive && s.isPrinterConnected(),
            "printerState",     alive ? (s.getPrinterState() != null ? s.getPrinterState() : "OFFLINE") : "OFFLINE",
            "lastPing",         s.getLastPing() != null ? s.getLastPing().toString() : "Never",
            "configuredPrinter", s.getConfiguredPrinterName() != null ? s.getConfiguredPrinterName() : ""
        ));
    }

    // ── Admin clicks "Connect Printer" → store request in DB ─────────────────
    @PostMapping("/connect")
    public ResponseEntity<Map<String, String>> connect(@RequestBody PrinterConnectRequest req) {
        if (req.getPrinterName() == null || req.getPrinterName().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "printerName is required"));
        }
        printerStatusService.requestConnect(req.getPrinterName());
        return ResponseEntity.ok(Map.of(
            "message", "Connect request stored. Agent will bind printer within 5 seconds.",
            "printer", req.getPrinterName()
        ));
    }

    // ── Admin clicks "Disconnect" ─────────────────────────────────────────────
    @PostMapping("/disconnect")
    public ResponseEntity<Map<String, String>> disconnect() {
        printerStatusService.requestDisconnect();
        return ResponseEntity.ok(Map.of("message", "Disconnect request stored."));
    }

    // ── Print Agent polls this to get its config (connect request) ───────────
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getConfig() {
        PrinterStatus s = printerStatusService.getStatus();
        return ResponseEntity.ok(Map.of(
            "connectRequested",       s.isConnectRequested(),
            "configuredPrinterName",  s.getConfiguredPrinterName() != null ? s.getConfiguredPrinterName() : ""
        ));
    }
}
