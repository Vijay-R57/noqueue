package com.noqueue.service;

import com.noqueue.dto.HeartbeatDto;
import com.noqueue.model.PrinterStatus;
import com.noqueue.repository.PrinterStatusRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PrinterStatusService {

    private final PrinterStatusRepository repository;

    private static final long SINGLETON_ID = 1L;
    // If no heartbeat for 15s, agent is considered offline
    private static final long OFFLINE_THRESHOLD_SEC = 15;

    // ── Called by agent every 5 seconds ─────────────────────────────────────
    @Transactional
    public void receiveHeartbeat(HeartbeatDto dto) {
        PrinterStatus status = repository.findById(SINGLETON_ID)
                .orElse(PrinterStatus.builder().id(SINGLETON_ID).build());

        status.setAgentOnline(dto.isAgentOnline());
        status.setPrinterName(dto.getPrinterName());
        status.setPrinterConnected(dto.isPrinterConnected());
        status.setPrinterState(dto.getPrinterState());
        status.setLastPing(Instant.now());

        repository.save(status);

        // Structured heartbeat log
        log.info("[HEARTBEAT] Agent online: {}", dto.isAgentOnline());
        log.info("[PRINTER]   {}", dto.getPrinterName() != null ? dto.getPrinterName() : "None");
        log.info("[STATE]     {}", dto.getPrinterState() != null ? dto.getPrinterState() : "UNKNOWN");
    }

    // ── Called by Admin UI to request printer connection ────────────────────
    @Transactional
    public void requestConnect(String printerName) {
        PrinterStatus status = repository.findById(SINGLETON_ID)
                .orElse(PrinterStatus.builder().id(SINGLETON_ID).build());

        status.setConfiguredPrinterName(printerName);
        status.setConnectRequested(true);
        repository.save(status);
    }

    // ── Called by Admin UI to disconnect ────────────────────────────────────
    @Transactional
    public void requestDisconnect() {
        Optional<PrinterStatus> opt = repository.findById(SINGLETON_ID);
        opt.ifPresent(status -> {
            status.setConnectRequested(false);
            status.setConfiguredPrinterName(null);
            repository.save(status);
        });
    }

    // ── Called by Admin Dashboard to get live status ─────────────────────────
    public PrinterStatus getStatus() {
        return repository.findById(SINGLETON_ID).orElse(
                PrinterStatus.builder()
                        .id(SINGLETON_ID)
                        .agentOnline(false)
                        .printerConnected(false)
                        .printerState("OFFLINE")
                        .build()
        );
    }

    // ── Computed: considers agent offline if no ping in 15s ─────────────────
    public boolean isAgentAlive() {
        return repository.findById(SINGLETON_ID)
                .map(s -> s.getLastPing() != null &&
                        Instant.now().getEpochSecond() - s.getLastPing().getEpochSecond() < OFFLINE_THRESHOLD_SEC)
                .orElse(false);
    }
}
