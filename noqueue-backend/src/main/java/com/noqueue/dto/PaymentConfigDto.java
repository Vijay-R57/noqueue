package com.noqueue.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentConfigDto {
    private String upiId;
    private String merchantName;
    private boolean cashEnabled;
    private String qrImageBase64;
}
