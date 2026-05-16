package com.noqueue.model;

public enum OrderStatus {
    PAYMENT_PENDING,   // Order created, awaiting payment
    CASH_PENDING,      // Cash on Receive chosen; admin must confirm
    WAITING,           // Legacy / intermediate state
    PAID,              // Payment confirmed
    READY_TO_PRINT,    // Queued for printing
    PRINTING,
    COMPLETED,
    FAILED
}
