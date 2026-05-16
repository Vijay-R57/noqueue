package com.noqueue.dto;

import lombok.Data;

/**
 * Request body for POST /api/v1/payment/verify
 * Used after the user completes a UPI / QR payment externally.
 */
@Data
public class PaymentVerifyRequest {
    private Long orderId;
    /** Transaction reference returned by the payment gateway / UPI app */
    private String transactionId;
}
