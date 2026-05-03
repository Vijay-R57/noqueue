package com.noqueue.agent;

import com.noqueue.agent.config.Config;
import com.noqueue.agent.model.Order;
import com.noqueue.agent.server.StatusServer;
import com.noqueue.agent.service.ApiService;
import com.noqueue.agent.service.FileService;
import com.noqueue.agent.service.PrinterService;
import com.noqueue.agent.service.QueueWorker;
import com.noqueue.agent.util.LoggerUtil;

import java.io.File;
import java.util.concurrent.atomic.AtomicBoolean;

public class Main {

    public static void main(String[] args) throws Exception {
        LoggerUtil.info("===========================================");
        LoggerUtil.info("       NoQueue Print Agent v1.2            ");
        LoggerUtil.info("===========================================");
        LoggerUtil.info("[INIT] Backend: " + Config.BASE_URL);

        // Initialize services
        ApiService apiService = new ApiService();
        FileService fileService = new FileService();
        PrinterService printerService = new PrinterService();

        // Shared state between QueueWorker and StatusServer
        AtomicBoolean isPrinting = new AtomicBoolean(false);

        // ── STEP 1: Authenticate ─────────────────────────────────────────
        LoggerUtil.info("[INIT] STEP 1: Authenticating with backend...");
        if (Config.AUTH_TOKEN.isEmpty()) {
            boolean loggedIn = apiService.login();
            if (!loggedIn) {
                LoggerUtil.error("[INIT] Authentication failed. Create agent account first:");
                LoggerUtil.error("[INIT]   POST /api/v1/auth/signup { email: agent@noqueue.com, role: ADMIN }");
                System.exit(1);
            }
        } else {
            LoggerUtil.info("[INIT] Using pre-configured AUTH_TOKEN.");
        }

        // ── STEP 2: Detect printer ───────────────────────────────────────
        LoggerUtil.info("[INIT] STEP 2: Checking printer availability...");
        printerService.listAllPrinters();
        if (printerService.isPrinterAvailable()) {
            LoggerUtil.info("[INIT]   [OK] Printer found: " + printerService.getDefaultPrinterName());
        } else {
            LoggerUtil.error("[INIT]   [WARN] No target printer detected. Jobs will fail until one is connected.");
        }

        // ── STEP 3: Start Printer Status HTTP Server on :9090 ────────────
        LoggerUtil.info("[INIT] STEP 3: Starting Printer Status API...");
        StatusServer statusServer = new StatusServer(printerService, isPrinting);
        statusServer.start();

        // ── TEST MODE ────────────────────────────────────────────────────
        if (args.length > 0 && args[0].equals("--test")) {
            LoggerUtil.info("");
            LoggerUtil.info("====== RUNNING IN TEST MODE (bypasses backend) ======");
            runTestMode(fileService, printerService, isPrinting);
            statusServer.stop();
            return;
        }

        // ── STEP 4: Start Queue Worker ───────────────────────────────────
        LoggerUtil.info("[INIT] STEP 4: Starting Queue Worker...");
        LoggerUtil.info("");
        QueueWorker worker = new QueueWorker(apiService, fileService, printerService, isPrinting);
        Thread workerThread = new Thread(worker);
        workerThread.setName("queue-worker");

        // Graceful shutdown (Ctrl+C)
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            LoggerUtil.info("[SHUTDOWN] Signal received. Stopping agent...");
            worker.stop();
            try { workerThread.join(5000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            statusServer.stop();
            LoggerUtil.info("[SHUTDOWN] Agent stopped cleanly.");
        }));

        workerThread.start();
    }

    private static void runTestMode(FileService fileService, PrinterService printerService,
                                    AtomicBoolean isPrinting) {
        LoggerUtil.info("Creating hardcoded test order...");

        Order test = new Order();
        test.setId(0L);
        test.setFileUrl("https://www.orimi.com/pdf-test.pdf");
        test.setPrintType("SINGLE");
        test.setTokenNumber("TEST-001");

        // TEST A: File Download
        LoggerUtil.info("");
        LoggerUtil.info("TEST A: Downloading file from: " + test.getFileUrl());
        File pdfFile;
        try {
            pdfFile = fileService.downloadFile(test.getId(), test.getFileUrl());
            LoggerUtil.info("  [OK] File downloaded -> " + pdfFile.getAbsolutePath() + " (" + pdfFile.length() + " bytes)");
        } catch (Exception e) {
            LoggerUtil.error("  [FAIL] File download FAILED.", e);
            return;
        }

        // TEST B: Printer
        LoggerUtil.info("");
        LoggerUtil.info("TEST B: Checking printer...");
        if (!printerService.isPrinterAvailable()) {
            LoggerUtil.error("  [FAIL] No printer available.");
            return;
        }
        LoggerUtil.info("  [OK] Printer: " + printerService.getDefaultPrinterName());

        // TEST C: Print
        LoggerUtil.info("");
        LoggerUtil.info("TEST C: Sending to printer...");
        try {
            isPrinting.set(true);
            printerService.printDocument(test, pdfFile);
            isPrinting.set(false);
            LoggerUtil.info("  [OK] Print job issued!");
        } catch (Exception e) {
            isPrinting.set(false);
            LoggerUtil.error("  [FAIL] Print FAILED.", e);
        }

        LoggerUtil.info("");
        LoggerUtil.info("====== TEST MODE COMPLETE ======");
        LoggerUtil.info("[STATUS-SERVER] Still running on :9090 — press Ctrl+C to stop.");
    }
}
