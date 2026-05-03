package com.noqueue.agent.service;

import com.noqueue.agent.config.Config;
import com.noqueue.agent.model.Order;
import com.noqueue.agent.util.LoggerUtil;

import java.io.File;

public class QueueWorker implements Runnable {

    private static final int MAX_PRINT_RETRIES = 2;
    private static final long PRINT_RETRY_DELAY_MS = 3000;

    private final ApiService apiService;
    private final FileService fileService;
    private final PrinterService printerService;

    private volatile boolean running = true;

    public QueueWorker(ApiService apiService, FileService fileService, PrinterService printerService) {
        this.apiService = apiService;
        this.fileService = fileService;
        this.printerService = printerService;
    }

    public void stop() {
        running = false;
    }

    @Override
    public void run() {
        LoggerUtil.info("[WORKER] Queue Worker started. Polling every " + (Config.POLLING_INTERVAL_MS / 1000) + "s...");

        while (running) {
            try {
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

        // ── PHASE 1: Download (up to 3 attempts, handled in FileService) ──
        File pdfFile;
        LoggerUtil.info("[JOB] Phase 1: Downloading file...");
        try {
            pdfFile = fileService.downloadFile(job.getId(), job.getFileUrl());
        } catch (Exception e) {
            LoggerUtil.error("[JOB] File download permanently failed after all retries. Marking FAILED.", e);
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
                // Verify printer is still up before each attempt
                if (!printerService.isPrinterAvailable()) {
                    throw new Exception("Printer not available. Is it online and set as default?");
                }

                printerService.printDocument(job, pdfFile);
                printed = true;
                LoggerUtil.info("[JOB] Print attempt " + attempt + " succeeded.");
                break;

            } catch (Exception e) {
                lastPrintError = e;
                LoggerUtil.error("[JOB] Print attempt " + attempt + " failed: " + e.getMessage(), e);

                if (attempt < MAX_PRINT_RETRIES) {
                    LoggerUtil.info("[JOB] Waiting " + (PRINT_RETRY_DELAY_MS / 1000) + "s before retry...");
                    try { Thread.sleep(PRINT_RETRY_DELAY_MS); } catch (InterruptedException ignored) {}
                }
            }
        }

        // ── PHASE 3: Update final status ───────────────────────────────────
        if (printed) {
            LoggerUtil.info("[JOB] Printing completed. Updating status to COMPLETED.");
            apiService.updateJobStatus(job.getId(), "COMPLETED");
            LoggerUtil.info("[JOB] Order #" + job.getId() + " finished successfully!");
        } else {
            LoggerUtil.error("[JOB] Printing failed after " + MAX_PRINT_RETRIES
                    + " attempts. Marking Order #" + job.getId() + " as FAILED.");
            LoggerUtil.error("[JOB] Last error: " + (lastPrintError != null ? lastPrintError.getMessage() : "unknown"));
            apiService.updateJobStatus(job.getId(), "FAILED");
        }
    }
}
