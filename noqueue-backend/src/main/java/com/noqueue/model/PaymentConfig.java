package com.noqueue.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "payment_config")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String upiId;

    private String merchantName;

    private boolean cashEnabled;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String qrImageBase64;
}
