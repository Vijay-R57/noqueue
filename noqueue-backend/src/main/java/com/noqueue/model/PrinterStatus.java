package com.noqueue.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "printer_status")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PrinterStatus {

    @Id
    private Long id; // Always 1 — singleton row

    private boolean agentOnline;
    private String  printerName;
    private boolean printerConnected;
    private String  printerState; // IDLE, PRINTING, PAUSED, OFFLINE
    private Instant lastPing;

    // Admin-set: the printer name the admin wants the agent to use
    private String  configuredPrinterName;
    private boolean connectRequested;
}
