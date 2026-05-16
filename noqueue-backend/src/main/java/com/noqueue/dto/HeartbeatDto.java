package com.noqueue.dto;

import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HeartbeatDto {
    private boolean agentOnline;
    private String  printerName;
    private boolean printerConnected;
    private String  printerState;
    private Instant lastPing;
}
