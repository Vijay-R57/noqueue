package com.noqueue.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PrinterConnectRequest {
    private String printerName;
}
