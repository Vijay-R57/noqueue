package com.noqueue.agent;

import com.noqueue.agent.config.Config;
import com.noqueue.agent.server.StatusServer;
import com.noqueue.agent.service.ApiService;
import com.noqueue.agent.service.FileService;
import com.noqueue.agent.service.HeartbeatService;
import com.noqueue.agent.service.PrinterService;
import com.noqueue.agent.service.QueueWorker;
import com.noqueue.agent.util.LoggerUtil;

import java.io.File;
import java.io.RandomAccessFile;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * NoQueue Agent Launcher
 *
 * Responsibilities:
 *  1. Single-instance lock — prevents duplicate agent processes
 *  2. Starts HeartbeatService for live backend status
 *  3. Starts QueueWorker for job polling
 *  4. Starts StatusServer (local HTTP) for admin UI on localhost:9090
 *  5. Graceful shutdown on Ctrl+C / Windows service stop
 */
public class NoQueueAgentLauncher {

    private static final String LOCK_FILE = "noqueue-agent.lock";

    public static void main(String[] args) throws Exception {

        // ── 1. Single-instance lock ─────────────────────────────────────────
        if (!acquireLock()) {
            LoggerUtil.info("[LAUNCHER] NoQueue Agent is already running. Exiting duplicate instance.");
            System.exit(0);
        }

        printBanner();
        LoggerUtil.info("[INFO] NoQueue Agent Started");
        LoggerUtil.info("[INFO] Backend URL  : " + Config.BASE_URL);

        // ── 2. Parse flags ──────────────────────────────────────────────────
        boolean statusOnly = hasArg(args, "--status-only");
        boolean testMode   = hasArg(args, "--test");

        // ── 3. Init services ────────────────────────────────────────────────
        ApiService     apiService     = new ApiService();
        FileService    fileService    = new FileService();
        PrinterService printerService = new PrinterService();

        AtomicBoolean isPrinting = new AtomicBoolean(false);
        AtomicBoolean isPaused   = new AtomicBoolean(false);

        // ── 4. Status-only / test mode shortcuts ────────────────────────────
        if (statusOnly || testMode) {
            LoggerUtil.info("[LAUNCHER] Running in " + (testMode ? "TEST" : "STATUS-ONLY") + " mode.");
            printerService.listAllPrinters();
            StatusServer statusServer = new StatusServer(printerService, isPrinting, isPaused);
            statusServer.start();
            hookShutdown(null, null, null, statusServer);
            if (testMode) runTestMode(fileService, printerService, isPrinting);
            LoggerUtil.info("[LAUNCHER] Status server on :9090 — Ctrl+C to stop.");
            Thread.currentThread().join();
            return;
        }

        // ── 5. Wait for backend to be healthy ───────────────────────────────
        LoggerUtil.info("[STEP 1] Waiting for backend to be reachable...");
        waitForBackend();
        LoggerUtil.info("[INFO] Backend reachable");

        // ── 6. Authenticate ─────────────────────────────────────────────────
        LoggerUtil.info("[STEP 2] Authenticating with backend...");
        int authAttempts = 0;
        while (Config.AUTH_TOKEN.isEmpty()) {
            if (authAttempts++ > 3) {
                LoggerUtil.error("[STEP 2] Authentication failed after 3 attempts. Exiting.");
                System.exit(1);
            }
            boolean ok = apiService.login();
            if (!ok) {
                LoggerUtil.error("[STEP 2] Login failed. Retrying in 10s...");
                Thread.sleep(10_000);
            }
        }
        LoggerUtil.info("[STEP 2] Authentication OK.");
        LoggerUtil.info("[INFO] Agent connected");

        // ── 6. Detect printer ────────────────────────────────────────────────
        LoggerUtil.info("[STEP 2] Detecting printers...");
        printerService.listAllPrinters();
        if (printerService.isPrinterAvailable()) {
            LoggerUtil.info("[INFO]    Printer Ready: " + printerService.getDefaultPrinterName());
        } else {
            LoggerUtil.info("[WARN]    No printer detected yet — will bind when admin connects.");
        }

        // ── 7. Start Status Server (localhost:9090) ──────────────────────────
        LoggerUtil.info("[STEP 3] Starting Printer Status API on :9090...");
        StatusServer statusServer = new StatusServer(printerService, isPrinting, isPaused);
        statusServer.start();

        // ── 8. Start Heartbeat (backend→admin dashboard) ──────────────────────
        LoggerUtil.info("[STEP 4] Starting Heartbeat Service...");
        HeartbeatService heartbeat = new HeartbeatService(printerService, isPrinting, isPaused);
        heartbeat.start();
        LoggerUtil.info("[INFO] Heartbeat active");

        // ── 9. Start Queue Worker ─────────────────────────────────────────────
        LoggerUtil.info("[STEP 5] Starting Queue Worker...");
        QueueWorker worker = new QueueWorker(apiService, fileService, printerService, isPrinting, isPaused);
        Thread workerThread = new Thread(worker, "queue-worker");

        hookShutdown(worker, workerThread, heartbeat, statusServer);
        workerThread.start();

        LoggerUtil.info("==============================================");
        LoggerUtil.info("  NoQueue Agent is RUNNING. Polling queue...");
        LoggerUtil.info("==============================================");
    }

    // ── Lock: prevents two agent processes running at once ──────────────────
    private static FileLock         globalLock;
    private static FileChannel       lockChannel;
    private static RandomAccessFile  lockRaf;

    private static boolean acquireLock() {
        try {
            File lockFile = new File(Config.TEMP_DIR + "/" + LOCK_FILE);
            lockFile.getParentFile().mkdirs();
            lockRaf     = new RandomAccessFile(lockFile, "rw");
            lockChannel = lockRaf.getChannel();
            globalLock  = lockChannel.tryLock();
            return globalLock != null;
        } catch (Exception e) {
            // If we can't acquire, assume another instance is running
            return false;
        }
    }

    // ── Graceful shutdown hook ───────────────────────────────────────────────
    private static void hookShutdown(QueueWorker worker, Thread workerThread,
                                     HeartbeatService heartbeat, StatusServer statusServer) {
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            LoggerUtil.info("[SHUTDOWN] Stopping NoQueue Agent...");
            if (worker != null)     worker.stop();
            if (heartbeat != null)  heartbeat.stop();
            if (workerThread != null) {
                try { workerThread.join(5000); } catch (InterruptedException ignored) {}
            }
            if (statusServer != null) statusServer.stop();
            try {
                if (globalLock  != null) globalLock.release();
                if (lockChannel != null) lockChannel.close();
                if (lockRaf     != null) lockRaf.close();
            } catch (Exception ignored) {}
            LoggerUtil.info("[SHUTDOWN] Agent stopped cleanly.");
        }, "shutdown-hook"));
    }

    private static boolean hasArg(String[] args, String flag) {
        for (String a : args) if (a.equals(flag)) return true;
        return false;
    }

    private static void runTestMode(FileService fileService, PrinterService printerService,
                                    AtomicBoolean isPrinting) {
        LoggerUtil.info("[TEST] Listing printers and verifying setup only.");
        LoggerUtil.info("[TEST] Complete.");
    }

    private static void printBanner() {
        LoggerUtil.info("╔══════════════════════════════════════════╗");
        LoggerUtil.info("║    NoQueue Print Agent v2.0              ║");
        LoggerUtil.info("║    Production-Grade Auto-Launcher        ║");
        LoggerUtil.info("╚══════════════════════════════════════════╝");
    }

    /** Blocks until GET /api/v1/health returns 200, retrying every 5 seconds. */
    private static void waitForBackend() {
        String healthUrl = Config.BASE_URL + "/health";
        while (true) {
            try {
                java.net.HttpURLConnection conn =
                    (java.net.HttpURLConnection) new java.net.URL(healthUrl).openConnection();
                conn.setConnectTimeout(3000);
                conn.setReadTimeout(3000);
                conn.setRequestMethod("GET");
                int code = conn.getResponseCode();
                conn.disconnect();
                if (code == 200) return;
            } catch (Exception ignored) {}
            LoggerUtil.info("[STEP 1] Backend not ready yet. Retrying in 5s...");
            try { Thread.sleep(5000); } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }
}
