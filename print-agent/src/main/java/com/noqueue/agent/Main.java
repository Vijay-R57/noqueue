package com.noqueue.agent;

import com.noqueue.agent.config.Config;
import com.noqueue.agent.model.Order;
import com.noqueue.agent.service.ApiService;
import com.noqueue.agent.service.FileService;
import com.noqueue.agent.service.PrinterService;
import com.noqueue.agent.service.QueueWorker;
import com.noqueue.agent.util.LoggerUtil;

import java.io.File;

public class Main {

    public static void main(String[] args) throws Exception {
        LoggerUtil.info("===========================================");
        LoggerUtil.info("       NoQueue Print Agent v1.1            ");
        LoggerUtil.info("===========================================");
        LoggerUtil.info("[INIT] Backend: " + Config.BASE_URL);

        // Initialize Services
        ApiService apiService = new ApiService();
        FileService fileService = new FileService();
        PrinterService printerService = new PrinterService();

        // ── STEP 1: Authenticate ─────────────────────────────────────────
        LoggerUtil.info("[INIT] STEP 1: Authenticating with backend...");
        if (Config.AUTH_TOKEN.isEmpty()) {
            // No token in env var or Config → auto-login
            boolean loggedIn = apiService.login();
            if (!loggedIn) {
                LoggerUtil.error("[INIT] Could not authenticate. Create agent account on backend first:");
                LoggerUtil.error("[INIT]   POST /api/v1/auth/signup  { email: agent@noqueue.com, role: ADMIN }");
                LoggerUtil.error("[INIT]   Then restart the agent.");
                System.exit(1);
            }
        } else {
            LoggerUtil.info("[INIT] Using pre-configured AUTH_TOKEN.");
        }

        // ── STEP 2: Detect printer ───────────────────────────────────────
        LoggerUtil.info("[INIT] STEP 2: Checking printer availability...");
        if (printerService.isPrinterAvailable()) {
            LoggerUtil.info("[INIT]   [OK] Printer found: " + printerService.getDefaultPrinterName());
        } else {
            LoggerUtil.error("[INIT]   [WARN] No default printer detected. Jobs will fail until one is installed.");
        }

        // ── TEST MODE: bypass backend with a hardcoded job ───────────────
        // Usage: gradlew run --args="--test"
        if (args.length > 0 && args[0].equals("--test")) {
            LoggerUtil.info("");
            LoggerUtil.info("====== RUNNING IN TEST MODE (bypasses backend) ======");
            runTestMode(fileService, printerService);
            return;
        }

        // ── STEP 3: Start Queue Worker ───────────────────────────────────
        LoggerUtil.info("[INIT] STEP 3: Starting Queue Worker...");
        LoggerUtil.info("");
        QueueWorker worker = new QueueWorker(apiService, fileService, printerService);
        Thread workerThread = new Thread(worker);
        workerThread.setName("queue-worker");

        // Graceful Shutdown Hook (handles Ctrl+C)
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            LoggerUtil.info("[SHUTDOWN] Signal received. Stopping agent gracefully...");
            worker.stop();
            try {
                workerThread.join(5000); // Wait max 5s for current job to finish
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            LoggerUtil.info("[SHUTDOWN] Agent stopped cleanly.");
        }));

        workerThread.start();
    }

    /**
     * TEST MODE: Hardcodes one order to isolate printer issues from backend issues.
     * If this succeeds -> printer stack is fully working.
     */
    private static void runTestMode(FileService fileService, PrinterService printerService) {
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
            LoggerUtil.error("  [FAIL] File download FAILED. Check URL or internet connection.", e);
            return;
        }

        // TEST B: Printer check
        LoggerUtil.info("");
        LoggerUtil.info("TEST B: Checking printer...");
        if (!printerService.isPrinterAvailable()) {
            LoggerUtil.error("  [FAIL] No printer available. Install printer driver first.");
            return;
        }
        LoggerUtil.info("  [OK] Printer: " + printerService.getDefaultPrinterName());

        // TEST C: Print
        LoggerUtil.info("");
        LoggerUtil.info("TEST C: Sending to printer...");
        try {
            printerService.printDocument(test, pdfFile);
            LoggerUtil.info("  [OK] Print job issued! Check your printer output.");
        } catch (Exception e) {
            LoggerUtil.error("  [FAIL] Print FAILED.", e);
            LoggerUtil.info("  TIP: If using 'Microsoft Print to PDF', check taskbar for Save dialog.");
            LoggerUtil.info("  TIP: If blank pages, use Apache PDFBox for proper PDF rendering.");
        }

        LoggerUtil.info("");
        LoggerUtil.info("====== TEST MODE COMPLETE ======");
    }
}
