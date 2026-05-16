package com.noqueue.agent.service;

import com.noqueue.agent.config.Config;
import com.noqueue.agent.model.Order;
import com.noqueue.agent.util.LoggerUtil;

import java.io.File;
import java.util.concurrent.atomic.AtomicBoolean;

public class QueueWorker implements Runnable {

    private static final int MAX_PRINT_RETRIES = 2;
    private static final long PRINT_RETRY_DELAY_MS = 3000;

    private final ApiService apiService;
    private final FileService fileService;
    private final PrinterService printerService;
    // Shared with StatusServer so the frontend knows live print state
    private final AtomicBoolean isPrinting;
    // Shared with StatusServer — set by POST /printer/pause and /printer/resume
    private final AtomicBoolean isPaused;

    private volatile boolean running = true;

    public QueueWorker(ApiService apiService, FileService fileService,
                       PrinterService printerService, AtomicBoolean isPrinting,
                       AtomicBoolean isPaused) {
        this.apiService     = apiService;
        this.fileService    = fileService;
        this.printerService = printerService;
        this.isPrinting     = isPrinting;
        this.isPaused       = isPaused;
    }

    public void stop() {
        running = false;
    }

    @Override
    public void run() {
        LoggerUtil.info("[WORKER] Queue Worker started. Polling every " + (Config.POLLING_INTERVAL_MS / 1000) + "s...");

        while (running) {
            try {
                // ── Queue Pause support ──────────────────────────────────
                if (isPaused.get()) {
                    LoggerUtil.info("[WORKER] Queue is paused by admin. Waiting " + (Config.POLLING_INTERVAL_MS / 1000) + "s...");
                    Thread.sleep(Config.POLLING_INTERVAL_MS);
                    continue;
                }

                // ── Auto-detect: poll backend for connect requests ──────────────
                try {
                    com.google.gson.JsonObject config = apiService.fetchPrinterConfig();
                    if (config != null
                            && config.has("connectRequested")
                            && config.get("connectRequested").getAsBoolean()) {

                        String targetPrinter = config.has("configuredPrinterName")
                                ? config.get("configuredPrinterName").getAsString()
                                : "";

                        if (!targetPrinter.isBlank()) {
                            String matched = printerService.setActivePrinter(targetPrinter);
                            if (matched != null) {
                                LoggerUtil.info("[WORKER] Auto-connected to printer: \"" + matched + "\"");
                            } else {
                                LoggerUtil.error("[WORKER] Auto-connect failed: printer not found: \"" + targetPrinter + "\"");
                            }
                        }
                    }
                } catch (Exception configEx) {
                    // Non-fatal — continue polling queue
                }

                Order job = apiService.fetchNextJob();

                if (job == null) {
                    LoggerUtil.info("[WORKER] No jobs ready. Waiting " + (Config.POLLING_INTERVAL_MS / 1000) + "s...");
                } else {
                    processJob(job);
                }

                Thread.sleep(Config.POLLING_INTERVAL_MS);

            } catch (InterruptedException e) {
                LoggerUtil.info("[WORKER] Worker interrupted. Stopping.");
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                LoggerUtil.error("[WORKER] Unexpected error in worker loop", e);
                try { Thread.sleep(Config.POLLING_INTERVAL_MS); } catch (InterruptedException ignored) {}
            }
        }

        LoggerUtil.info("[WORKER] Queue Worker stopped.");
    }

    private void processJob(Order job) {
        LoggerUtil.info("==============================================");
        LoggerUtil.info("[JOB] Order #" + job.getId()
                + " | Token: " + job.getTokenNumber()
                + " | Pages: " + job.getPages()
                + " | Type: " + job.getPrintType()
                + " | Color: " + job.getColorType());
        LoggerUtil.info("==============================================");

        // ── PHASE 1: Download (3-attempt retry inside FileService) ─────────
        File pdfFile;
        LoggerUtil.info("[JOB] Phase 1: Downloading file...");
        try {
            pdfFile = fileService.downloadFile(job.getId(), job.getFileUrl());
        } catch (Exception e) {
            LoggerUtil.error("[JOB] File download permanently failed. Marking FAILED.", e);
            apiService.updateJobStatus(job.getId(), "FAILED");
            return;
        }

        // ── PHASE 2: Print (up to MAX_PRINT_RETRIES attempts) ─────────────
        LoggerUtil.info("[JOB] Phase 2: Printing...");

        boolean printed = false;
        Exception lastPrintError = null;

        for (int attempt = 1; attempt <= MAX_PRINT_RETRIES; attempt++) {
            LoggerUtil.info("[JOB] Print attempt " + attempt + " of " + MAX_PRINT_RETRIES + "...");
            try {
                if (!printerService.isPrinterAvailable()) {
                    throw new Exception("Printer not available. Is it online and set as default?");
                }

                isPrinting.set(true);   // signal StatusServer → isPrinting: true
                printerService.printDocument(job, pdfFile);
                isPrinting.set(false);  // done

                printed = true;
                LoggerUtil.info("[JOB] Print attempt " + attempt + " succeeded.");
                break;

            } catch (Exception e) {
                isPrinting.set(false);
                lastPrintError = e;
                LoggerUtil.error("[JOB] Print attempt " + attempt + " failed: " + e.getMessage(), e);

                if (attempt < MAX_PRINT_RETRIES) {
                    LoggerUtil.info("[JOB] Waiting " + (PRINT_RETRY_DELAY_MS / 1000) + "s before retry...");
                    try { Thread.sleep(PRINT_RETRY_DELAY_MS); } catch (InterruptedException ignored) {}
                }
            }
        }

        // ── PHASE 3: Final status update ───────────────────────────────────
        if (printed) {
            LoggerUtil.info("[JOB] Printing completed. Updating status to COMPLETED.");
            apiService.updateJobStatus(job.getId(), "COMPLETED");
            LoggerUtil.info("[JOB] Order #" + job.getId() + " finished successfully!");
        } else {
            LoggerUtil.error("[JOB] All retries exhausted. Marking Order #" + job.getId() + " as FAILED.");
            if (lastPrintError != null) {
                LoggerUtil.error("[JOB] Last error: " + lastPrintError.getMessage());
            }
            apiService.updateJobStatus(job.getId(), "FAILED");
        }
    }
}
