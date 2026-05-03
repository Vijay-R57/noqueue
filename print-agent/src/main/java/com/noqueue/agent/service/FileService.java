package com.noqueue.agent.service;

import com.noqueue.agent.config.Config;
import com.noqueue.agent.util.LoggerUtil;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class FileService {

    private static final int MAX_DOWNLOAD_RETRIES = 3;
    private static final long RETRY_DELAY_MS = 2000;

    /**
     * Downloads a file from the given URL with up to MAX_DOWNLOAD_RETRIES retries.
     * Each failed attempt waits RETRY_DELAY_MS before trying again.
     * Throws an Exception if all retries are exhausted.
     */
    public File downloadFile(Long orderId, String fileUrl) throws Exception {
        Exception lastException = null;

        for (int attempt = 1; attempt <= MAX_DOWNLOAD_RETRIES; attempt++) {
            try {
                LoggerUtil.info("[FILE] Download attempt " + attempt + " of " + MAX_DOWNLOAD_RETRIES
                        + " from: " + fileUrl);
                File result = attemptDownload(orderId, fileUrl);
                LoggerUtil.info("[FILE] Download successful: " + result.getAbsolutePath()
                        + " (" + result.length() + " bytes)");
                return result;

            } catch (Exception e) {
                lastException = e;
                LoggerUtil.error("[FILE] Download attempt " + attempt + " failed: " + e.getMessage(), e);

                if (attempt < MAX_DOWNLOAD_RETRIES) {
                    LoggerUtil.info("[FILE] Waiting " + (RETRY_DELAY_MS / 1000) + "s before retry...");
                    try { Thread.sleep(RETRY_DELAY_MS); } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new Exception("Download interrupted during retry wait.", ie);
                    }
                }
            }
        }

        throw new Exception("File download failed after " + MAX_DOWNLOAD_RETRIES
                + " attempts for Order #" + orderId, lastException);
    }

    private File attemptDownload(Long orderId, String fileUrl) throws Exception {
        URL url = new URL(fileUrl);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (NoQueue-PrintAgent/1.1)");
        conn.setInstanceFollowRedirects(true);
        conn.setConnectTimeout(10_000); // 10s connect timeout
        conn.setReadTimeout(30_000);    // 30s read timeout

        int code = conn.getResponseCode();
        if (code != 200) {
            throw new Exception("HTTP " + code + " from server");
        }

        File targetFile = new File(Config.TEMP_DIR, orderId + ".pdf");
        if (targetFile.exists()) {
            targetFile.delete();
        }

        try (InputStream in = conn.getInputStream();
             FileOutputStream out = new FileOutputStream(targetFile)) {
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = in.read(buffer)) != -1) {
                out.write(buffer, 0, bytesRead);
            }
        }

        if (targetFile.length() == 0) {
            throw new Exception("Downloaded file is empty (0 bytes).");
        }

        return targetFile;
    }
}
